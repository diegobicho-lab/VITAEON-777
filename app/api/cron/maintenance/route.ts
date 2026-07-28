import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { purgeExpiredAuthTokens, runAutoCancelCron, runExpireSubscriptionsCron, verifyCronRequest } from "@/lib/cron/jobs";

export async function GET(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  const now = new Date();
  try {
    const [autoCancel, subscriptions] = await Promise.all([
      runAutoCancelCron(now),
      runExpireSubscriptionsCron(now)
    ]);
    const authTokenPurge = await purgeExpiredAuthTokens(now);

    await auditLog({
      action: "CRON_MAINTENANCE",
      metadata: { autoCancel, subscriptions, authTokenPurge, ranAt: now.toISOString() }
    });

    return ok({ autoCancel, subscriptions, authTokenPurge, ranAt: now.toISOString() });
  } catch (error) {
    console.error("[Cron maintenance] Failed:", error);
    return fail("CRON_FAILED", "Maintenance cron job failed.", 500);
  }
}
