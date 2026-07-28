import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { runExpireSubscriptionsCron, verifyCronRequest } from "@/lib/cron/jobs";

/**
 * Vercel Cron Job — expire past-due doctor subscriptions.
 *
 * Runs daily at 03:00 UTC (see vercel.json).
 *
 * If a doctor's subscription period ended more than 3 days ago and their
 * subscription is still marked ACTIVE, we downgrade them to CANCELLED so they
 * lose access to premium features (amatista gate).  The 3-day grace period
 * gives Stripe enough time to retry failed payments before we act.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    return ok(await runExpireSubscriptionsCron());
  } catch (error) {
    console.error("[Cron expire-subscriptions] Failed:", error);
    return fail("CRON_FAILED", "Subscription expiry cron failed.", 500);
  }
}
