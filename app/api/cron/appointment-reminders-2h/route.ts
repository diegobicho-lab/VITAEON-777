import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { send2HourAppointmentReminders, verifyCronRequest } from "@/lib/cron/jobs";

/**
 * Vercel Cron — 2-hour appointment reminder emails.
 *
 * Runs every hour. Finds active appointments starting within the next
 * 90–150 minutes that haven't received a 2-hour reminder yet and sends:
 *   • A short reminder email to the patient.
 *
 * Sets `reminder2hSentAt` so it's idempotent — re-running won't double-send.
 * The 24h reminder (`reminderSentAt`) is handled by a separate cron.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    return ok(await send2HourAppointmentReminders());
  } catch (error) {
    console.error("[Cron appointment-reminders-2h] Failed:", error);
    return fail("CRON_FAILED", "Appointment reminders cron job failed.", 500);
  }
}
