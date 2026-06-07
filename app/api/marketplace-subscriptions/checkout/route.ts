import {
  MarketplaceListingStatus,
  MarketplaceSubscriptionStatus,
  PaymentProvider,
  PaymentStatus
} from "@prisma/client";
import type Stripe from "stripe";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { marketplaceSubscriptionCheckoutSchema } from "@/lib/validation/schemas";

function obsidianaPriceCents() {
  const raw = process.env.OBSIDIANA_PRICE_CENTS;
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("marketplace-subscriptions:checkout", { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return fail("FORBIDDEN", "Solo administración puede gestionar suscripciones Obsidiana.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = marketplaceSubscriptionCheckoutSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Suscripción Obsidiana inválida.", 422, parsed.error.flatten());

  const listing = await prisma.marketplaceListing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing) return fail("LISTING_NOT_FOUND", "No encontramos el perfil de representante o catering.", 404);

  const amountCents = obsidianaPriceCents();
  const payment = await prisma.marketplaceSubscriptionPayment.create({
    data: {
      listingId: listing.id,
      amountCents,
      status: amountCents === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
      provider: amountCents === 0 ? PaymentProvider.CASH : PaymentProvider.STRIPE
    }
  });

  if (amountCents === 0) {
    const activated = await prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        status: MarketplaceListingStatus.ACTIVE,
        subscriptionStatus: MarketplaceSubscriptionStatus.ACTIVE
      }
    });

    await auditLog({
      actorUserId: user.id,
      action: "ACTIVATE_FREE_OBSIDIANA_LISTING",
      entityType: "MarketplaceListing",
      entityId: activated.id,
      metadata: { paymentId: payment.id }
    });

    return ok({ listing: activated, payment, status: "active" });
  }

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let session: Stripe.Checkout.Session;
  try {
    const stripe = getStripe();
    const metadata = {
      kind: "marketplace_obsidiana",
      listingId: listing.id,
      paymentId: payment.id,
      plan: "obsidiana"
    };
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            unit_amount: amountCents,
            recurring: {
              interval: "month",
              interval_count: 1
            },
            product_data: {
              name: "VITAEON Obsidiana",
              description: "Suscripción mensual para representantes médicos y servicios de catering."
            }
          },
          quantity: 1
        }
      ],
      subscription_data: { metadata },
      success_url: `${appUrl}/dashboard/admin?obsidiana=success`,
      cancel_url: `${appUrl}/dashboard/admin?obsidiana=cancelled`,
      metadata
    });
  } catch (error) {
    console.error("[Stripe Obsidiana checkout error]", error);
    await prisma.marketplaceSubscriptionPayment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED }
    });
    return fail(
      "STRIPE_OBSIDIANA_CHECKOUT_FAILED",
      "No pudimos abrir el checkout de Obsidiana. Revisa que Stripe esté configurado correctamente o intenta de nuevo.",
      502
    );
  }

  await prisma.marketplaceSubscriptionPayment.update({
    where: { id: payment.id },
    data: {
      providerSessionId: session.id,
      providerCustomerId: typeof session.customer === "string" ? session.customer : null,
      providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : null
    }
  });
  await prisma.marketplaceListing.update({
    where: { id: listing.id },
    data: {
      providerSessionId: session.id,
      subscriptionStatus: MarketplaceSubscriptionStatus.PENDING
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_OBSIDIANA_CHECKOUT",
    entityType: "MarketplaceListing",
    entityId: listing.id,
    metadata: { sessionId: session.id, paymentId: payment.id }
  });

  return ok({ checkoutUrl: session.url, sessionId: session.id, paymentId: payment.id });
}
