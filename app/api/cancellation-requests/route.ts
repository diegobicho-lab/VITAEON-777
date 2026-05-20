import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { cancellationRequestSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver solicitudes.", 401);

  const requests = await prisma.cancellationRequest.findMany({
    where:
      user.role === Role.DOCTOR
        ? { doctor: { userId: user.id } }
        : user.role === Role.PATIENT
          ? { patient: { userId: user.id } }
          : user.role === Role.ADMIN || user.role === Role.STAFF
            ? {}
            : { id: "__none__" },
    include: {
      appointment: { include: { availabilitySlot: true, payments: true } },
      doctor: { select: { id: true, fullName: true } },
      patient: { include: { user: { select: { id: true, name: true, email: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  await auditLog({
    actorUserId: user.id,
    action: "VIEW_CANCELLATION_REQUESTS",
    entityType: "CancellationRequest",
    metadata: { count: requests.length, role: user.role }
  });

  return ok(requests);
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("cancellation-requests:create", { limit: 12, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas solicitudes. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== Role.DOCTOR) return fail("FORBIDDEN", "Solo médicos pueden enviar esta solicitud desde el panel médico.", 403);

  const body = await request.json().catch(() => null);
  const parsed = cancellationRequestSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de cancelación inválidos.", 422, parsed.error.flatten());

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: parsed.data.appointmentId,
      doctor: { userId: user.id },
      status: { notIn: ["CANCELLED", "COMPLETED", "REFUNDED"] }
    },
    include: { doctor: true, patient: true }
  });

  if (!appointment) return fail("APPOINTMENT_NOT_FOUND", "No encontramos una cita activa asignada a tu perfil.", 404);

  const saved = await prisma.$transaction(async (tx) => {
    const cancellationRequest = await tx.cancellationRequest.create({
      data: {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        reason: parsed.data.reason,
        status: "pendiente"
      }
    });

    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CANCELLATION_REQUESTED",
        cancellationReason: parsed.data.reason,
        cancellationRequestedAt: new Date()
      }
    });

    return cancellationRequest;
  });

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_DOCTOR_CANCELLATION_REQUEST",
    entityType: "CancellationRequest",
    entityId: saved.id,
    metadata: { appointmentId: appointment.id }
  });

  return ok({ request: saved, message: "Solicitud de cancelación enviada correctamente." }, { status: 201 });
}
