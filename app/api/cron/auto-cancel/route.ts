import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { runAutoCancelCron, verifyCronRequest } from "@/lib/cron/jobs";

/**
 * Vercel Cron Job — auto-cancel expired appointments.
 *
 * Runs every hour (see vercel.json).  Vercel passes the CRON_SECRET as a
 * Bearer token in the Authorization header so no external actor can call it.
 *
 * Before this cron existed, auto-cancel ran opportunistically inside GET
 * /api/appointments — meaning slots stayed blocked forever when there was no
 * traffic.  This endpoint guarantees cancellations happen on schedule.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    return ok(await runAutoCancelCron());
  } catch (error) {
    console.error("[Cron auto-cancel] Failed:", error);
    return fail("CRON_FAILED", "Auto-cancel cron job failed.", 500);
  }
}
