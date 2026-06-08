import { MedicalMedal, PaymentProvider, PaymentStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/notifications";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimitByIp } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const limit = await rateLimitByIp("subscriptions:cancel", { limit: 6, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos. Intenta de nuevo en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo el titular puede cancelar su suscripción.", 403);

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, medal: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "No encontramos un perfil asociado a esta suscripción.", 409);

  const body = await request.json().catch(() => null);
  const requestedPlan = typeof body?.plan === "string" ? body.plan : doctor.medal;
  if (!Object.prototype.hasOwnProperty.call(MedicalMedal, requestedPlan)) {
    return fail("INVALID_PLAN", "La suscripción indicada no es válida.", 422);
  }

  const plan = MedicalMedal[requestedPlan as keyof typeof MedicalMedal];
  if (plan !== doctor.medal) {
    return fail("PLAN_MISMATCH", "Solo puedes cancelar la suscripción activa de tu cuenta.", 409);
  }

  const payment = await prisma.subscriptionPayment.findFirst({
    where: {
      userId: user.id,
      plan,
      provider: PaymentProvider.STRIPE,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
      providerSubscriptionId: { not: null }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!payment?.providerSubscriptionId) {
    return fail(
      "SUBSCRIPTION_NOT_FOUND",
      "No encontramos una suscripción activa en Stripe para cancelar. Si acabas de pagar, espera unos segundos y actualiza.",
      404
    );
  }

  try {
    const stripe = getStripe();
    await stripe.subscriptions.update(payment.providerSubscriptionId, {
      cancel_at_period_end: true,
      metadata: {
        cancellationRequestedBy: user.id,
        cancellationRequestedFrom: "vitaeon-dashboard"
      }
    });
  } catch (error) {
    console.error("[Stripe subscription cancel error]", error);
    return fail(
      "STRIPE_SUBSCRIPTION_CANCEL_FAILED",
      "No pudimos cancelar la renovación en Stripe. Revisa la configuración o intenta de nuevo.",
      502
    );
  }

  await createNotification({
    userId: user.id,
    type: "subscription_cancel_requested",
    title: "Renovación cancelada",
    message: "Tu suscripción quedó programada para no renovarse automáticamente al terminar el periodo pagado."
  });

  await auditLog({
    actorUserId: user.id,
    action: "CANCEL_SUBSCRIPTION_RENEWAL",
    entityType: "SubscriptionPayment",
    entityId: payment.id,
    metadata: {
      plan: requestedPlan,
      providerSubscriptionId: payment.providerSubscriptionId
    }
  });

  return ok({
    status: "cancel_at_period_end",
    message: "La renovación quedó cancelada. Tu acceso seguirá disponible hasta terminar el periodo pagado."
  });
}
