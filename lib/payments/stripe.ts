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
