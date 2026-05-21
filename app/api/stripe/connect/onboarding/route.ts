import type Stripe from "stripe";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimitByIp } from "@/lib/security/rate-limit";

function appUrl() {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function POST() {
  const limit = await rateLimitByIp("stripe-connect:onboarding", { limit: 8, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos. Intenta de nuevo en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden configurar cobros.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Primero completa tu perfil médico.", 409);

  try {
    const stripe = getStripe();
    let stripeAccountId = doctor.stripeAccountId;

    if (!stripeAccountId) {
      const accountParams: Stripe.AccountCreateParams = {
        type: "express",
        country: "MX",
        email: user.email,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        metadata: {
          doctorId: doctor.id,
          userId: user.id,
          platform: "VITAEON"
        }
      };
      const account = await stripe.accounts.create(accountParams);
      stripeAccountId = account.id;
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: { stripeAccountId, stripeOnboardingCompleted: false, payoutsEnabled: false, chargesEnabled: false }
      });
    }

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl()}/dashboard/doctor?stripe_connect=refresh`,
      return_url: `${appUrl()}/dashboard/doctor?stripe_connect=return`,
      type: "account_onboarding"
    });

    await auditLog({
      actorUserId: user.id,
      action: "CREATE_STRIPE_CONNECT_ONBOARDING_LINK",
      entityType: "Doctor",
      entityId: doctor.id,
      metadata: { stripeAccountId }
    });

    return ok({ url: link.url });
  } catch (error) {
    console.error("[Stripe Connect onboarding error]", error);
    return fail(
      "STRIPE_CONNECT_ONBOARDING_FAILED",
      "No pudimos abrir la configuración de cobro. Revisa que Stripe esté configurado correctamente o intenta de nuevo.",
      502
    );
  }
}
