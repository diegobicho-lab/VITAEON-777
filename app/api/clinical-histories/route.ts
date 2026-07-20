import { AppointmentStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { openSensitiveText, sealSensitiveText } from "@/lib/security/crypto";
import { clinicalHistoryUpsertSchema } from "@/lib/validation/schemas";

const activeAppointmentStatuses = [
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_DOCTOR_ACCEPTANCE,
  AppointmentStatus.ACCEPTED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULE_REQUESTED,
  AppointmentStatus.RESCHEDULED
];

async function getAmatistaDoctor() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return { error: fail("FORBIDDEN", "Solo médicos pueden usar historias clínicas.", 403) };

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, include: { specialty: true, hospital: true } });
  if (!doctor) return { error: fail("DOCTOR_PROFILE_REQUIRED", "Completa tu perfil médico antes de usar historias clínicas.", 409) };
  // Obsidiana usa un panel comercial independiente; todos los demás planes tienen acceso.
  if (doctor.medal === "obsidiana") {
    return { error: fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403) };
  }

  return { user, doctor };
}

const includeClinicalHistory = {
  patient: { include: { user: { select: { name: true, email: true } } } },
  appointment: { include: { availabilitySlot: true } }
};

// ── PHI encryption helpers ───────────────────────────────────────────────────

/** Fields that contain protected health information and must be encrypted at rest. */
const CLINICAL_PHI_FIELDS = [
  "identificationCard",
  "ethnicGroup",
  "consultationReason",
  "hereditaryFamilyHistory",
  "nonPathologicalHistory",
  "pathologicalHistory",
  "surgicalHistory",
  "fractureHistory",
  "gynecoObstetricHistory",
  "currentCondition",
  "systemsReview",
  "physicalExam",
  "labsAndImaging",
  "diagnosis",
  "treatment",
  "diagnosesOrClinicalProblems",
  "therapeuticIndication",
  "plan",
  "prognosis",
  "healthStatus",
  "additionalMedicalNotes"
] as const;

type ClinicalPhiKey = (typeof CLINICAL_PHI_FIELDS)[number];

/** Seals all PHI fields with AES-256-GCM before writing to the database. */
function sealClinicalHistory(
  data: Record<ClinicalPhiKey, string>
): Record<ClinicalPhiKey, string | null> {
  return Object.fromEntries(
    CLINICAL_PHI_FIELDS.map((k) => [k, sealSensitiveText(data[k])])
  ) as Record<ClinicalPhiKey, string | null>;
}

/** Decrypts all PHI fields on a record returned from the database.
 *  Backwards-compatible: plaintext records (written before encryption was enabled)
 *  are returned as-is by openSensitiveText. */
function openClinicalHistory<T extends Record<string, unknown>>(history: T): T {
  const decrypted: Record<string, unknown> = {};
  for (const key of CLINICAL_PHI_FIELDS) {
    decrypted[key] = openSensitiveText(history[key] as string | null);
  }
  return { ...history, ...decrypted };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await getAmatistaDoctor();
  if (session.error) return session.error;

  const query = new URL(request.url).searchParams.get("q")?.trim();
  const histories = await prisma.clinicalHistory.findMany({
    where: {
      doctorId: session.doctor.id,
      ...(query
        ? {
            patient: {
              user: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { email: { contains: query, mode: "insensitive" } }
                ]
              }
            }
          }
        : {})
    },
    include: includeClinicalHistory,
    orderBy: { updatedAt: "desc" },
    take: 30
  });

  return ok(histories.map(openClinicalHistory));
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("clinical-histories:upsert", { limit: 40, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones. Intenta de nuevo en un momento.", 429);

  const session = await getAmatistaDoctor();
  if (session.error) return session.error;

  const body = await request.json().catch(() => null);
  const parsed = clinicalHistoryUpsertSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Revisa los datos de la historia clínica.", 422, parsed.error.flatten());

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: parsed.data.appointmentId,
      doctorId: session.doctor.id,
      patientId: parsed.data.patientId,
      status: { in: activeAppointmentStatuses }
    },
    select: { id: true }
  });
  if (!appointment) return fail("APPOINTMENT_NOT_FOUND", "La cita activa no pertenece a este médico y paciente.", 404);

  // Seal PHI fields with AES-256-GCM before persisting to the database.
  const sealedPhi = sealClinicalHistory({
    identificationCard: parsed.data.identificationCard,
    ethnicGroup: parsed.data.ethnicGroup,
    consultationReason: parsed.data.consultationReason,
    hereditaryFamilyHistory: parsed.data.hereditaryFamilyHistory,
    nonPathologicalHistory: parsed.data.nonPathologicalHistory,
    pathologicalHistory: parsed.data.pathologicalHistory,
    surgicalHistory: parsed.data.surgicalHistory,
    fractureHistory: parsed.data.fractureHistory,
    gynecoObstetricHistory: parsed.data.gynecoObstetricHistory,
    currentCondition: parsed.data.currentCondition,
    systemsReview: parsed.data.systemsReview,
    physicalExam: parsed.data.physicalExam,
    labsAndImaging: parsed.data.labsAndImaging,
    diagnosis: parsed.data.diagnosis,
    treatment: parsed.data.treatment,
    diagnosesOrClinicalProblems: parsed.data.diagnosesOrClinicalProblems,
    therapeuticIndication: parsed.data.therapeuticIndication,
    plan: parsed.data.plan,
    prognosis: parsed.data.prognosis,
    healthStatus: parsed.data.healthStatus,
    additionalMedicalNotes: parsed.data.additionalMedicalNotes
  });

  const historyData = {
    appointmentId: parsed.data.appointmentId,
    ...sealedPhi
  };

  // Siempre buscar por cita exacta — nunca sobrescribir el historial de otra consulta
  const exactHistory = await prisma.clinicalHistory.findFirst({
    where: {
      doctorId: session.doctor.id,
      patientId: parsed.data.patientId,
      appointmentId: parsed.data.appointmentId
    }
  });

  const history = exactHistory
    ? await prisma.clinicalHistory.update({
        where: { id: exactHistory.id },
        data: historyData,
        include: includeClinicalHistory
      })
    : await prisma.clinicalHistory.create({
        data: {
          doctorId: session.doctor.id,
          patientId: parsed.data.patientId,
          ...historyData
        },
        include: includeClinicalHistory
      });

  await auditLog({
    actorUserId: session.user.id,
    action: "CLINICAL_HISTORY_UPSERT",
    entityType: "ClinicalHistory",
    entityId: history.id,
    metadata: { appointmentId: history.appointmentId, patientId: history.patientId }
  });

  // Decrypt before returning so the client receives readable values.
  return ok(openClinicalHistory(history), { status: 201 });
}
