import { NextRequest } from "next/server";
import { SubscriptionStatus } from "@prisma/client";
import { ok, fail } from "@/lib/api-response";
import { prisma } from "@/lib/db/prisma";
import { auditLog } from "@/lib/audit/audit";

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
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron expire-subscriptions] CRON_SECRET env var not set.");
    return fail("CRON_NOT_CONFIGURED", "Cron endpoint not configured.", 500);
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return fail("UNAUTHORIZED", "Invalid cron secret.", 401);
  }

  try {
    const gracePeriodEnd = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

    // Find subscriptions whose period has expired (with grace period applied).
    const expiredPayments = await prisma.subscriptionPayment.findMany({
      where: {
        currentPeriodEnd: { lt: gracePeriodEnd },
        status: "PAID"
      },
      select: { userId: true }
    });

    if (expiredPayments.length === 0) {
      return ok({ expiredCount: 0, ranAt: new Date().toISOString() });
    }

    const expiredUserIds = [...new Set(expiredPayments.map((p) => p.userId))];

    // Only downgrade doctors who are still marked ACTIVE.
    const result = await prisma.doctor.updateMany({
      where: {
        userId: { in: expiredUserIds },
        subscriptionStatus: SubscriptionStatus.ACTIVE
      },
      data: { subscriptionStatus: SubscriptionStatus.CANCELLED }
    });

    await auditLog({
      action: "CRON_EXPIRE_SUBSCRIPTIONS",
      entityType: "Doctor",
      metadata: {
        expiredCount: result.count,
        affectedUserIds: expiredUserIds,
        ranAt: new Date().toISOString()
      }
    });

    return ok({ expiredCount: result.count, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Cron expire-subscriptions] Failed:", error);
    return fail("CRON_FAILED", "Subscription expiry cron failed.", 500);
  }
}
