import "server-only";
import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required for online payments");
  return new Stripe(key, {
    // stripe@17.4.0 tipa 2025-02-24.acacia como versión latest; actualizar SDK antes de subir a una versión API posterior.
    apiVersion: "2025-02-24.acacia"
  });
}

/**
 * Returns the platform fee percentage from env as a number (e.g. 10 → 10%).
 *
 * VITAEON's revenue model is subscription-based: doctors pay a monthly plan
 * and keep 100% of their appointment payments.  A value of 0 (or unset) is
 * therefore intentional — doctors receive the full amount via Stripe Connect.
 *
 * If the model ever changes to include a transaction commission, set
 * STRIPE_PLATFORM_FEE_PERCENTAGE in Vercel (e.g. "10" for 10%) and the
 * payment flow will apply it automatically via application_fee_amount.
 */
export function getPlatformFeePercentage(): number {
  const raw = process.env.STRIPE_PLATFORM_FEE_PERCENTAGE;
  const parsed = Number(raw ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}
