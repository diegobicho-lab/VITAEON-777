import { MedicalMedal, PaymentProvider, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/notifications";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { subscriptionCheckoutSchema } from "@/lib/validation/schemas";

const planPrices = {
  oro: 0,
  diamante: 25000,
  amatista: 39900
};

const planLabels = {
  oro: "Oro",
  diamante: "Diamante",
  amatista: "Amatista"
};

export async function POST(request: Request) {
  const limit = await rateLimitByIp("subscriptions:checkout", { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos de suscripción. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden gestionar suscripción médica.", 403);

  const body = await request.json().catch(() => null);
  const parsed = subscriptionCheckoutSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Plan inválido.", 422, parsed.error.flatten());

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);

  const amountCents = planPrices[parsed.data.plan];
  const plan = MedicalMedal[parsed.data.plan];

  if (amountCents === 0) {
    const payment = await prisma.subscriptionPayment.create({
      data: {
        userId: user.id,
        plan,
        amountCents,
        status: PaymentStatus.PAID,
        provider: PaymentProvider.CASH
      }
    });
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { medal: plan, subscriptionStatus: SubscriptionStatus.FREE }
    });
    await createNotification({
      userId: user.id,
      type: "subscription_updated",
      title: "Plan Oro activo",
      message: "Tu plan Oro quedó activo con visibilidad normal dentro de VITAEON."
    });
    await auditLog({
      actorUserId: user.id,
      action: "ACTIVATE_FREE_DOCTOR_PLAN",
      entityType: "SubscriptionPayment",
      entityId: payment.id,
      metadata: { plan: parsed.data.plan }
    });
    return ok({ payment, plan: parsed.data.plan, status: "active" });
  }

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const platformOwnerRef = process.env.VITAEON_PLATFORM_OWNER_REF ?? "vitaeon-primary-stripe-account";
  const stripe = getStripe();
  const payment = await prisma.subscriptionPayment.create({
    data: {
      userId: user.id,
      plan,
      amountCents,
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.STRIPE
    }
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "mxn",
          unit_amount: amountCents,
          product_data: {
            name: `VITAEON Plan ${planLabels[parsed.data.plan]}`,
            description: "Suscripción médica VITAEON"
          }
        },
        quantity: 1
      }
    ],
    success_url: `${appUrl}/dashboard/doctor?subscription=success`,
    cancel_url: `${appUrl}/dashboard/doctor?subscription=cancelled`,
    metadata: {
      kind: "doctor_subscription",
      paymentId: payment.id,
      userId: user.id,
      doctorId: doctor.id,
      plan: parsed.data.plan,
      platformOwnerRef
    }
  });

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: { providerSessionId: session.id }
  });
  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { subscriptionStatus: SubscriptionStatus.PENDING }
  });

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_STRIPE_SUBSCRIPTION_CHECKOUT",
    entityType: "SubscriptionPayment",
    entityId: payment.id,
    metadata: { plan: parsed.data.plan, sessionId: session.id, platformOwnerRef }
  });

  return ok({ checkoutUrl: session.url, sessionId: session.id, paymentId: payment.id });
}
