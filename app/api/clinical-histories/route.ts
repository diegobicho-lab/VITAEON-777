import { AppointmentStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
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
  if (doctor.medal !== "amatista" || doctor.subscriptionStatus !== "ACTIVE") {
    return { error: fail("AMATISTA_PLAN_REQUIRED", "Disponible exclusivamente para médicos con plan Amatista activo.", 403) };
  }

  return { user, doctor };
}

const includeClinicalHistory = {
  patient: { include: { user: { select: { name: true, email: true } } } },
  appointment: { include: { availabilitySlot: true } }
};

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

  return ok(histories);
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

  const history = await prisma.clinicalHistory.upsert({
    where: {
      doctorId_patientId_appointmentId: {
        doctorId: session.doctor.id,
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId
      }
    },
    update: {
      identificationCard: parsed.data.identificationCard,
      ethnicGroup: parsed.data.ethnicGroup,
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
      diagnosesOrClinicalProblems: parsed.data.diagnosesOrClinicalProblems,
      therapeuticIndication: parsed.data.therapeuticIndication,
      plan: parsed.data.plan,
      prognosis: parsed.data.prognosis,
      healthStatus: parsed.data.healthStatus
    },
    create: {
      doctorId: session.doctor.id,
      patientId: parsed.data.patientId,
      appointmentId: parsed.data.appointmentId,
      identificationCard: parsed.data.identificationCard,
      ethnicGroup: parsed.data.ethnicGroup,
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
      diagnosesOrClinicalProblems: parsed.data.diagnosesOrClinicalProblems,
      therapeuticIndication: parsed.data.therapeuticIndication,
      plan: parsed.data.plan,
      prognosis: parsed.data.prognosis,
      healthStatus: parsed.data.healthStatus
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

  return ok(history, { status: 201 });
}
