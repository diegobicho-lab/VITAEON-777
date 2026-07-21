import { AppointmentStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { openSensitiveText, sealSensitiveText } from "@/lib/security/crypto";
import { prescriptionUpsertSchema } from "@/lib/validation/schemas";

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
  if (!user || user.role !== "DOCTOR") return { error: fail("FORBIDDEN", "Solo médicos pueden usar recetario.", 403) };

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, include: { specialty: true, hospital: true } });
  if (!doctor) return { error: fail("DOCTOR_PROFILE_REQUIRED", "Completa tu perfil médico antes de usar recetario.", 409) };
  // Obsidiana usa un panel comercial independiente; todos los demás planes tienen acceso.
  if (doctor.medal === "obsidiana") {
    return { error: fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403) };
  }

  return { user, doctor };
}

const includePrescription = {
  patient: { include: { user: { select: { name: true, email: true } } } },
  appointment: { include: { availabilitySlot: true } },
  template: true
};

// ── PHI encryption helpers ───────────────────────────────────────────────────

/** Fields that contain protected health information and must be encrypted at rest. */
const PRESCRIPTION_PHI_FIELDS = [
  "diagnosis",
  "medicationInstructions",
  "dosage",
  "frequency",
  "duration",
  "generalRecommendations",
  "additionalNotes"
] as const;

type PrescriptionPhiKey = (typeof PRESCRIPTION_PHI_FIELDS)[number];

type PrescriptionPhiInput = Record<PrescriptionPhiKey, string> & { patientAge: string };

/** Seals all PHI fields with AES-256-GCM before writing to the database. */
function sealPrescriptionData(data: PrescriptionPhiInput): Record<PrescriptionPhiKey | "patientAge", string | null> {
  return {
    patientAge: sealSensitiveText(data.patientAge),
    ...Object.fromEntries(
      PRESCRIPTION_PHI_FIELDS.map((k) => [k, sealSensitiveText(data[k])])
    ) as Record<PrescriptionPhiKey, string | null>
  };
}

/** Decrypts all PHI fields on a record returned from the database.
 *  Backwards-compatible: plaintext records written before encryption was enabled
 *  are returned as-is by openSensitiveText. */
function openPrescription<T extends Record<string, unknown>>(prescription: T): T {
  const decrypted: Record<string, unknown> = {
    patientAge: openSensitiveText(prescription.patientAge as string | null)
  };
  for (const key of PRESCRIPTION_PHI_FIELDS) {
    decrypted[key] = openSensitiveText(prescription[key] as string | null);
  }
  return { ...prescription, ...decrypted };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await getAmatistaDoctor();
  if (session.error) return session.error;

  const query = new URL(request.url).searchParams.get("q")?.trim();
  const prescriptions = await prisma.prescription.findMany({
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
    include: includePrescription,
    orderBy: { updatedAt: "desc" },
    take: 30
  });

  return ok(prescriptions.map(openPrescription));
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("prescriptions:upsert", { limit: 40, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones. Intenta de nuevo en un momento.", 429);

  const session = await getAmatistaDoctor();
  if (session.error) return session.error;

  const body = await request.json().catch(() => null);
  const parsed = prescriptionUpsertSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Revisa los datos de la receta.", 422, parsed.error.flatten());

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

  if (parsed.data.templateId) {
    const template = await prisma.prescriptionTemplate.findFirst({
      where: { id: parsed.data.templateId, doctorId: session.doctor.id },
      select: { id: true }
    });
    if (!template) return fail("TEMPLATE_NOT_FOUND", "El recetario seleccionado no pertenece a este médico.", 404);
  }

  // Seal PHI fields with AES-256-GCM before persisting to the database.
  let sealedData: ReturnType<typeof sealPrescriptionData>;
  try {
    sealedData = sealPrescriptionData({
      patientAge: parsed.data.patientAge,
      diagnosis: parsed.data.diagnosis,
      medicationInstructions: parsed.data.medicationInstructions,
      dosage: parsed.data.dosage,
      frequency: parsed.data.frequency,
      duration: parsed.data.duration,
      generalRecommendations: parsed.data.generalRecommendations,
      additionalNotes: parsed.data.additionalNotes
    });
  } catch {
    return fail("ENCRYPTION_FAILED", "No fue posible cifrar la receta. Verifica la configuración del servidor.", 500);
  }

  const prescriptionData = {
    ...sealedData,
    templateId: parsed.data.templateId ?? null
  };

  let prescription;
  if (parsed.data.id) {
    const existing = await prisma.prescription.findFirst({ where: { id: parsed.data.id, doctorId: session.doctor.id }, select: { id: true } });
    if (!existing) return fail("PRESCRIPTION_NOT_FOUND", "La receta no pertenece a este médico.", 404);
    prescription = await prisma.prescription.update({
      where: { id: existing.id },
      data: prescriptionData,
      include: includePrescription
    });
  } else {
    prescription = await prisma.prescription.create({
      data: {
        doctorId: session.doctor.id,
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId,
        ...prescriptionData
      },
      include: includePrescription
    });
  }

  await auditLog({
    actorUserId: session.user.id,
    action: "PRESCRIPTION_UPSERT",
    entityType: "Prescription",
    entityId: prescription.id,
    metadata: { appointmentId: prescription.appointmentId, patientId: prescription.patientId }
  });

  // Decrypt before returning so the client receives readable values.
  return ok(openPrescription(prescription), { status: 201 });
}
