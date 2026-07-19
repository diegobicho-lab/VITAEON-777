import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { autoCancelExpiredAppointments } from "@/lib/appointments/auto-cancel";
import { auditLog } from "@/lib/audit/audit";

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
  // Verify the Vercel cron secret to prevent unauthorized calls.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron auto-cancel] CRON_SECRET env var not set — endpoint is unprotected.");
    return fail("CRON_NOT_CONFIGURED", "Cron endpoint not configured.", 500);
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return fail("UNAUTHORIZED", "Invalid cron secret.", 401);
  }

  try {
    const result = await autoCancelExpiredAppointments();
    const count = result.count;

    await auditLog({
      action: "CRON_AUTO_CANCEL_APPOINTMENTS",
      entityType: "Appointment",
      metadata: { cancelledCount: count, ranAt: new Date().toISOString() }
    });

    return ok({ cancelledCount: count, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Cron auto-cancel] Failed:", error);
    return fail("CRON_FAILED", "Auto-cancel cron job failed.", 500);
  }
}
