import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { send24HourAppointmentReminders, send2HourAppointmentReminders, verifyCronRequest } from "@/lib/cron/jobs";

export async function GET(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  const now = new Date();
  try {
    const [reminder24h, reminder2h] = await Promise.all([
      send24HourAppointmentReminders(now),
      send2HourAppointmentReminders(now)
    ]);

    await auditLog({
      action: "CRON_APPOINTMENT_REMINDERS_COMBINED",
      entityType: "Appointment",
      metadata: { reminder24h, reminder2h, ranAt: now.toISOString() }
    });

    return ok({ reminder24h, reminder2h, ranAt: now.toISOString() });
  } catch (error) {
    console.error("[Cron reminders] Failed:", error);
    return fail("CRON_FAILED", "Appointment reminders cron job failed.", 500);
  }
}
