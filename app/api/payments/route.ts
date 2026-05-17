import { PaymentProvider } from "@prisma/client";
import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { paymentIntentSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver pagos.", 401);

  const payments = await prisma.payment.findMany({
    where:
      user.role === "PATIENT"
        ? { appointment: { patient: { userId: user.id } } }
        : user.role === "DOCTOR"
          ? { appointment: { doctor: { userId: user.id } } }
          : user.role === "ADMIN" || user.role === "STAFF"
            ? {}
            : { id: "__none__" },
    include: {
      appointment: {
        include: {
          patient: { include: { user: { select: { name: true, email: true } } } },
          doctor: { include: { specialty: true, hospital: true } },
          availabilitySlot: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  await auditLog({
    actorUserId: user.id,
    action: "VIEW_PAYMENTS",
    entityType: "Payment",
    metadata: { role: user.role, count: payments.length }
  });

  return ok(
    payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amountCents: payment.amountCents,
      currency: payment.currency,
      receiptUrl: payment.receiptUrl,
      createdAt: payment.createdAt,
      appointment: {
        id: payment.appointment.id,
        status: payment.appointment.status,
        startsAt: payment.appointment.availabilitySlot.startsAt,
        doctor: payment.appointment.doctor.fullName,
        specialty: payment.appointment.doctor.specialty.name,
        hospital: payment.appointment.doctor.hospital.name,
        patient:
          user.role === "ADMIN" || user.role === "STAFF"
            ? {
                name: payment.appointment.patient.user.name,
                email: payment.appointment.patient.user.email
              }
            : undefined
      }
    }))
  );
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("payments:create", { limit: 12, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos de pago. Intenta de nuevo en un momento.", 429);

  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para pagar.", 401);
  if (user.role !== "PATIENT") return fail("FORBIDDEN", "Solo pacientes pueden pagar citas.", 403);

  const body = await request.json().catch(() => null);
  const parsed = paymentIntentSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de pago inválidos.", 422, parsed.error.flatten());

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: parsed.data.appointmentId,
      patient: { userId: user.id }
    },
    include: {
      payments: true,
      availabilitySlot: { include: { appointment: { select: { id: true } } } }
    }
  });
  if (!appointment) return fail("APPOINTMENT_NOT_FOUND", "No encontramos la cita.", 404);
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED" || appointment.status === "REFUND_PENDING" || appointment.status === "REFUNDED") {
    return fail("APPOINTMENT_NOT_PAYABLE", "Esta cita ya no puede pagarse.", 409);
  }
  if (appointment.availabilitySlot.appointment?.id !== appointment.id) {
    return fail("SLOT_NOT_AVAILABLE", "El horario ya no está disponible. Selecciona otro horario.", 409);
  }

  const payment = appointment.payments[0];
  if (!payment) return fail("PAYMENT_NOT_FOUND", "La cita no tiene pago asociado.", 404);
  if (payment.status === "PAID") return fail("PAYMENT_ALREADY_PAID", "Esta cita ya está pagada.", 409);

  if (parsed.data.provider === "CASH") {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: PaymentProvider.CASH, status: "PENDING" }
    });
    await auditLog({
      actorUserId: user.id,
      action: "SELECT_CASH_PAYMENT",
      entityType: "Payment",
      entityId: updated.id
    });
    return ok({ payment: updated, message: "Pago en efectivo marcado como pendiente." });
  }

  if (parsed.data.provider === "MERCADO_PAGO") {
    return fail(
      "PAYMENT_PROVIDER_NOT_READY",
      "Mercado Pago está preparado en el modelo, pero aún no está habilitado para cobros reales.",
      501
    );
  }

  if (payment.amountCents <= 0) {
    const paid = await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: PaymentProvider.STRIPE, status: "PAID" }
    });
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "PENDING_DOCTOR_ACCEPTANCE" } });
    await auditLog({
      actorUserId: user.id,
      action: "CONFIRM_ZERO_AMOUNT_PAYMENT",
      entityType: "Payment",
      entityId: paid.id,
      metadata: { appointmentId: appointment.id }
    });
    return ok({ payment: paid, message: "Cita confirmada sin cargo." });
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: payment.amountCents,
    currency: payment.currency,
    metadata: {
      appointmentId: appointment.id,
      paymentId: payment.id
    },
    automatic_payment_methods: { enabled: true }
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      provider: PaymentProvider.STRIPE,
      providerPaymentIntentId: intent.id
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_STRIPE_PAYMENT_INTENT",
    entityType: "Payment",
    entityId: payment.id,
    metadata: { appointmentId: appointment.id, stripePaymentIntentId: intent.id }
  });

  return ok({ clientSecret: intent.client_secret });
}
