import { MedicalMedal } from "@prisma/client";
import type Stripe from "stripe";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimitByIp } from "@/lib/security/rate-limit";

function bankLast4(account: Stripe.Account) {
  const externalAccounts = account.external_accounts as Stripe.ApiList<Stripe.ExternalAccount> | undefined;
  const bank = externalAccounts?.data.find((item): item is Stripe.BankAccount => item.object === "bank_account");
  return bank?.last4 ?? null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden consultar cobros.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Primero completa tu perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);
  if (!doctor.stripeAccountId) {
    return ok({
      stripeAccountId: null,
      stripeOnboardingCompleted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      bankAccountLast4: null,
      statusLabel: "Cuenta no configurada"
    });
  }

  const limit = await rateLimitByIp("stripe-connect:status", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas consultas de estado. Intenta de nuevo en un momento.", 429);

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(doctor.stripeAccountId, { expand: ["external_accounts"] });
    const payload = {
      stripeOnboardingCompleted: Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      chargesEnabled: Boolean(account.charges_enabled),
      bankAccountLast4: bankLast4(account)
    };

    const updated = await prisma.doctor.update({
      where: { id: doctor.id },
      data: payload,
      select: {
        stripeAccountId: true,
        stripeOnboardingCompleted: true,
        payoutsEnabled: true,
        chargesEnabled: true,
        bankAccountLast4: true
      }
    });

    await auditLog({
      actorUserId: user.id,
      action: "REFRESH_STRIPE_CONNECT_STATUS",
      entityType: "Doctor",
      entityId: doctor.id,
      metadata: { payoutsEnabled: updated.payoutsEnabled, chargesEnabled: updated.chargesEnabled }
    });

    return ok({
      ...updated,
      statusLabel:
        updated.chargesEnabled && updated.payoutsEnabled
          ? "Cuenta activa para recibir pagos"
          : "Configuración pendiente"
    });
  } catch (error) {
    console.error("[Stripe Connect status error]", error);
    return fail(
      "STRIPE_CONNECT_STATUS_FAILED",
      "No pudimos consultar el estado de tu cuenta de cobro. Revisa Stripe o intenta de nuevo.",
      502
    );
  }
}
