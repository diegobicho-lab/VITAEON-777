import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getSecretarySession } from "@/lib/auth/secretary";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/notifications";
import { rateLimitByIp } from "@/lib/security/rate-limit";

/**
 * POST — registrar que el paciente pagó en el consultorio.
 *
 * La secretaría entra por enlace + PIN y no tiene cuenta VITAEON, así que no
 * puede usar `/api/appointments/[id]`, que exige sesión de usuario.
 *
 * Dos límites deliberados:
 *
 * 1. Solo efectivo y transferencia. Los pagos de Stripe los confirma el webhook
 *    contra el dinero real; marcarlos desde aquí dejaría a la plataforma
 *    afirmando un cobro que Stripe no respalda.
 *
 * 2. La cita se busca acotada al médico del enlace. El id viaja en la URL, pero
 *    no se confía en él: si la cita es de otro consultorio, no aparece.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;

  const limit = await rateLimitByIp("secretaria:pago:marcar", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Demasiadas operaciones seguidas. Espera un momento.", 429);
  }

  const session = await getSecretarySession(token);
  if (!session) return fail("UNAUTHORIZED", "Sesión de secretaría no válida.", 401);

  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { token },
    select: { isActive: true, doctorId: true }
  });
  if (!link?.isActive) return fail("LINK_INACTIVE", "El enlace fue desactivado por el médico.", 403);

  const appointment = await prisma.appointment.findFirst({
    // El doctorId viene del enlace, no del cliente.
    where: { id, doctorId: link.doctorId },
    select: {
      id: true,
      guestPatientName: true,
      patient: { select: { userId: true, user: { select: { name: true } } } },
      doctor: { select: { fullName: true, userId: true } },
      payments: { select: { id: true, provider: true, status: true, amountCents: true } }
    }
  });
  if (!appointment) return fail("NOT_FOUND", "Esta cita no existe o no es de este consultorio.", 404);

  const pendientesEnConsultorio = appointment.payments.filter(
    (p) =>
      (p.provider === PaymentProvider.CASH || p.provider === PaymentProvider.TRANSFER) &&
      p.status === PaymentStatus.PENDING
  );

  if (pendientesEnConsultorio.length === 0) {
    const yaPagada = appointment.payments.some(
      (p) =>
        (p.provider === PaymentProvider.CASH || p.provider === PaymentProvider.TRANSFER) &&
        p.status === PaymentStatus.PAID
    );
    return yaPagada
      ? fail("PAYMENT_ALREADY_PAID", "Esta cita ya estaba marcada como pagada.", 409)
      : fail(
          "NO_OFFLINE_PAYMENT",
          "Esta cita no se cobra en consultorio. El pago en línea lo confirma Stripe.",
          409
        );
  }

  await prisma.payment.updateMany({
    where: { id: { in: pendientesEnConsultorio.map((p) => p.id) } },
    data: { status: PaymentStatus.PAID }
  });

  const metodo =
    pendientesEnConsultorio[0].provider === PaymentProvider.CASH ? "efectivo" : "transferencia";
  const nombrePaciente =
    appointment.guestPatientName ?? appointment.patient?.user?.name ?? "el paciente";

  // El médico necesita enterarse: puede estar cobrando él en otra cita.
  if (appointment.doctor.userId) {
    await createNotification({
      userId: appointment.doctor.userId,
      type: "payment_marked_paid_secretary",
      title: "Pago registrado en recepción",
      message: `La secretaría registró el pago en ${metodo} de ${nombrePaciente}.`
    });
  }
  // Y el paciente, para que tenga constancia de lo que entregó.
  if (appointment.patient?.userId) {
    await createNotification({
      userId: appointment.patient.userId,
      type: "payment_marked_paid",
      title: "Pago registrado",
      message: `Se registró tu pago en ${metodo} de la cita con ${appointment.doctor.fullName}.`
    });
  }

  await auditLog({
    action: "SECRETARY_MARK_PAYMENT_PAID",
    entityType: "Appointment",
    entityId: appointment.id,
    metadata: {
      doctorId: link.doctorId,
      metodo,
      pagos: pendientesEnConsultorio.length
    }
  });

  return ok({
    appointmentId: appointment.id,
    pacienteNombre: nombrePaciente,
    metodo
  });
}
