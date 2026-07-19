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
 * In production, throws a loud error if the variable is unset or zero so we
 * never silently process payments without collecting revenue.
 *
 * In development / test the fee defaults to 0 so local testing works without
 * configuration.
 */
export function getPlatformFeePercentage(): number {
  const raw = process.env.STRIPE_PLATFORM_FEE_PERCENTAGE;
  const parsed = Number(raw ?? "0");
  const fee = Number.isFinite(parsed) ? parsed : 0;

  if (fee === 0 && process.env.NODE_ENV === "production") {
    // Throw rather than silently swallow: a 0% fee in production is almost
    // always a misconfiguration.  This surfaces immediately in Vercel logs /
    // Sentry and blocks the payment rather than letting revenue walk out the
    // door.
    throw new Error(
      "[VITAEON revenue] STRIPE_PLATFORM_FEE_PERCENTAGE is 0 or unset in production. " +
        "Set this env var in Vercel to a value like 10 (= 10%) before processing live payments."
    );
  }

  return fee;
}
