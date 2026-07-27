import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";

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
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return fail("UNAUTHORIZED", "Invalid cron secret.", 401);
  if (authHeader !== `Bearer ${cronSecret}`) return fail("UNAUTHORIZED", "Invalid cron secret.", 401);

  const now = new Date();
  // Window: appointments starting between 90 and 150 minutes from now
  const windowStart = new Date(now.getTime() + 90 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 150 * 60 * 1000);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");

  const appointments = await prisma.appointment.findMany({
    where: {
      reminder2hSentAt: null,
      status: { in: ["PENDING", "ACCEPTED", "PENDING_DOCTOR_ACCEPTANCE", "CONFIRMED"] },
      availabilitySlot: {
        startsAt: { gte: windowStart, lte: windowEnd }
      }
    },
    include: {
      availabilitySlot: true,
      patient: {
        include: {
          user: { select: { name: true, email: true } }
        }
      },
      doctor: {
        include: {
          specialty: { select: { name: true } }
        }
      }
    }
  });

  let sent = 0;
  let failed = 0;

  for (const appt of appointments) {
    const slot = appt.availabilitySlot;
    const patientEmail = appt.patient.user.email;
    const isGhost = patientEmail.endsWith("@vitaeon.internal");
    if (isGhost) {
      // Mark as sent so we don't keep retrying ghost accounts
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminder2hSentAt: now } });
      continue;
    }

    const startsAt = slot.startsAt.toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit"
    });

    const { sent: emailSent, skipped } = await sendTransactionalEmail({
      to: patientEmail,
      subject: `Tu cita con ${appt.doctor.fullName} es en ~2 horas`,
      text: `Recuerda que tienes una cita con ${appt.doctor.fullName} (${appt.doctor.specialty.name}) hoy a las ${startsAt}.`,
      html: emailShell(
        "Recordatorio: tu cita es en ~2 horas",
        `<p>Hola <strong>${appt.patient.user.name}</strong>,</p>
        <p>Este es un recordatorio de último momento: tu cita médica en VITAEON es <strong>hoy a las ${startsAt}</strong>.</p>
        <p style="font-size:14px;color:#374151;">
          Médico: <strong>${appt.doctor.fullName}</strong> — ${appt.doctor.specialty.name}
        </p>
        <p style="font-size:14px;color:#374151;margin-top:8px;">
          Si necesitas cancelar, comunícate directamente con el consultorio.
        </p>
        ${emailButton("Ver mi cita", `${appUrl}/dashboard/patient`)}`
      )
    });

    if (emailSent || skipped) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminder2hSentAt: now } });
      sent++;
    } else {
      failed++;
    }
  }

  await auditLog({
    action: "CRON_APPOINTMENT_REMINDERS_2H",
    entityType: "Appointment",
    metadata: { total: appointments.length, sent, failed, ranAt: now.toISOString() }
  });

  return ok({ total: appointments.length, sent, failed, ranAt: now.toISOString() });
}
