import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { send24HourAppointmentReminders, verifyCronRequest } from "@/lib/cron/jobs";

/**
 * Vercel Cron — appointment reminder emails (24 h before).
 *
 * Runs every day at 08:00 CST (14:00 UTC).
 * Finds all active appointments starting within the next 20–28 hours
 * that haven't received a reminder yet, and sends:
 *   • A reminder email to the patient (skipped for ghost/walk-in records).
 *   • A reminder email to the doctor.
 *
 * Sets `reminderSentAt` after both emails are dispatched so the cron
 * is idempotent — re-running the same day will not double-send.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    return ok(await send24HourAppointmentReminders());
  } catch (error) {
    console.error("[Cron appointment-reminders] Failed:", error);
    return fail("CRON_FAILED", "Appointment reminders cron job failed.", 500);
  }
}
