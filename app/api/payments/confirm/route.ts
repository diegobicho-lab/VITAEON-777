import { AppointmentStatus, PaymentStatus } from "@prisma/client";
import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimitByIp } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const limit = await rateLimitByIp("payments:confirm", { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos de confirmación. Intenta de nuevo en un momento.", 429);

  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para confirmar el pago.", 401);
  if (user.role !== "PATIENT") return fail("FORBIDDEN", "Solo pacientes pueden confirmar pagos de sus citas.", 403);

  const body = await request.json().catch(() => null);
  const appointmentId = typeof body?.appointmentId === "string" ? body.appointmentId : "";
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId : "";

  if (!appointmentId && !paymentIntentId) {
    return fail("VALIDATION_ERROR", "No encontramos la referencia del pago para confirmar la cita.", 422);
  }

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        ...(paymentIntentId ? [{ providerPaymentIntentId: paymentIntentId }] : []),
        ...(appointmentId ? [{ appointmentId }] : [])
      ],
      appointment: { patient: { userId: user.id } }
    },
    include: {
      appointment: {
        include: {
          availabilitySlot: true,
          doctor: { select: { fullName: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!payment) return fail("PAYMENT_NOT_FOUND", "No encontramos el pago de esta cita.", 404);
  if (!payment.providerPaymentIntentId && !paymentIntentId) {
    return fail("PAYMENT_INTENT_NOT_FOUND", "El pago en línea todavía no tiene referencia de Stripe.", 409);
  }

  const stripePaymentIntentId = paymentIntentId || payment.providerPaymentIntentId;
  if (!stripePaymentIntentId) {
    return fail("PAYMENT_INTENT_NOT_FOUND", "El pago en línea todavía no tiene referencia de Stripe.", 409);
  }

  let isStripePaid = payment.status === PaymentStatus.PAID;
  let chargeId: string | null = payment.providerChargeId;

  if (!isStripePaid) {
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
      isStripePaid = intent.status === "succeeded";
      chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : chargeId;
    } catch (error) {
      console.error("[Stripe appointment payment confirmation error]", error);
      return fail(
        "STRIPE_PAYMENT_CONFIRMATION_FAILED",
        "Tu pago fue recibido, pero no pudimos confirmarlo todavía. Intenta actualizar en unos segundos.",
        502
      );
    }
  }

  if (!isStripePaid) {
    return fail(
      "PAYMENT_NOT_CONFIRMED",
      "No pudimos confirmar el pago todavía. Intenta actualizar en unos segundos.",
      409
    );
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.PAID,
      providerPaymentIntentId: stripePaymentIntentId,
      providerChargeId: chargeId,
      transferStatus: payment.transferStatus?.startsWith("paid_")
        ? payment.transferStatus
        : payment.transferStatus === "pending_manual_payout_doctor_connect"
          ? "paid_platform_pending_manual_payout"
          : "paid_destination_charge"
    }
  });

  const acceptedAt = payment.appointment.acceptedAt ?? new Date();
  const appointment = await prisma.appointment.update({
    where: { id: payment.appointmentId },
    data: {
      status: AppointmentStatus.ACCEPTED,
      acceptedAt,
      acceptedByDoctor: true,
      acceptedAutomatically: true,
      acceptedReason: "Pago en línea confirmado"
    },
    include: {
      payments: true,
      availabilitySlot: true,
      doctor: { include: { specialty: true, hospital: true } }
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: "CONFIRM_STRIPE_APPOINTMENT_PAYMENT_FROM_CLIENT",
    entityType: "Payment",
    entityId: payment.id,
    metadata: {
      appointmentId: appointment.id,
      stripePaymentIntentId
    }
  });

  return ok({
    appointment: {
      id: appointment.id,
      status: appointment.status,
      acceptedAutomatically: appointment.acceptedAutomatically,
      acceptedReason: appointment.acceptedReason,
      paymentStatus: appointment.payments[0]?.status ?? PaymentStatus.PAID,
      doctor: appointment.doctor.fullName,
      specialty: appointment.doctor.specialty.name,
      hospital: appointment.doctor.hospital.name,
      startsAt: appointment.availabilitySlot.startsAt,
      endsAt: appointment.availabilitySlot.endsAt
    }
  });
}
