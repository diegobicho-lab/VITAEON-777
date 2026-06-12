import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { adminPatientStatusSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    return fail("FORBIDDEN", "Solo administración o staff pueden ver pacientes.", 403);
  }

  const patients = await prisma.patient.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          appointments: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  await auditLog({
    actorUserId: user.id,
    action: "VIEW_PATIENTS",
    entityType: "Patient",
    metadata: { count: patients.length }
  });

  return ok(
    patients.map((patient) => ({
      id: patient.id,
      name: patient.user.name,
      email: patient.user.email,
      phone: patient.phone,
      isActive: patient.user.isActive,
      appointmentsCount: patient._count.appointments,
      createdAt: patient.createdAt
    }))
  );
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return fail("FORBIDDEN", "Solo administración puede activar o pausar pacientes beta.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = adminPatientStatusSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de paciente inválidos.", 422, parsed.error.flatten());

  const patient = await prisma.patient.findUnique({
    where: { id: parsed.data.patientId },
    include: { user: true }
  });
  if (!patient) return fail("PATIENT_NOT_FOUND", "No encontramos el paciente solicitado.", 404);

  const updatedUser = await prisma.user.update({
    where: { id: patient.userId },
    data: { isActive: parsed.data.isActive },
    select: { id: true, isActive: true }
  });

  await prisma.notification.create({
    data: {
      userId: patient.userId,
      type: parsed.data.isActive ? "patient_account_enabled" : "patient_account_paused",
      title: parsed.data.isActive ? "Cuenta beta activada" : "Cuenta beta pausada",
      message: parsed.data.isActive
        ? "Tu cuenta beta volvió a estar activa dentro de VITAEON."
        : "Tu cuenta beta fue pausada por administración. Contacta a soporte para más información."
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: parsed.data.isActive ? "ENABLE_BETA_PATIENT" : "PAUSE_BETA_PATIENT",
    entityType: "Patient",
    entityId: patient.id,
    metadata: { userId: updatedUser.id, isActive: updatedUser.isActive }
  });

  return ok({ id: patient.id, isActive: updatedUser.isActive });
}
