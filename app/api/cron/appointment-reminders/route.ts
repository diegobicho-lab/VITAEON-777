import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";

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
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return fail("UNAUTHORIZED", "Invalid cron secret.", 401);
  if (authHeader !== `Bearer ${cronSecret}`) return fail("UNAUTHORIZED", "Invalid cron secret.", 401);

  const now = new Date();
  const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000); // +20 h
  const windowEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000);   // +28 h

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");

  // Appointments in the 24 h window, not yet reminded, still active
  const appointments = await prisma.appointment.findMany({
    where: {
      reminderSentAt: null,
      status: { in: ["PENDING", "ACCEPTED", "PENDING_DOCTOR_ACCEPTANCE"] },
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
          user: { select: { name: true, email: true } },
          specialty: { select: { name: true } }
        }
      }
    }
  });

  let sent = 0;
  let failed = 0;

  for (const appt of appointments) {
    const slot = appt.availabilitySlot;

    // Format date in Mexican Spanish for the email body
    const startsAt = slot.startsAt.toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // Capitalise first letter (locale gives lowercase weekday in es-MX)
    const startsAtFormatted = startsAt.charAt(0).toUpperCase() + startsAt.slice(1);

    const patientDisplayName = appt.guestPatientName ?? appt.patient.user.name;
    let success = true;

    // ── Patient reminder ─────────────────────────────────────────────────────
    const patientEmail = appt.patient.user.email;
    const isGhost = patientEmail.endsWith("@vitaeon.internal");

    if (!isGhost) {
      const { sent: patientSent, skipped } = await sendTransactionalEmail({
        to: patientEmail,
        subject: `Recordatorio: mañana tienes cita con ${appt.doctor.fullName}`,
        text: `Recuerda que tienes una cita médica mañana con ${appt.doctor.fullName} (${appt.doctor.specialty.name}). Fecha y hora: ${startsAtFormatted}.`,
        html: emailShell(
          "Recordatorio de tu cita médica",
          `<p>Hola <strong>${appt.patient.user.name}</strong>,</p>
          <p>Te recordamos que tienes una cita médica <strong>mañana</strong> en VITAEON.</p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;width:130px;">Médico</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:14px;font-weight:700;color:#071726;">${appt.doctor.fullName}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;">Especialidad</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:14px;color:#374151;">${appt.doctor.specialty.name}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:#7f9aaa;">Fecha y hora</td>
              <td style="padding:10px 0;font-size:14px;font-weight:700;color:#071726;">${startsAtFormatted}</td>
            </tr>
          </table>

          <p style="font-size:14px;color:#374151;margin-top:4px;">
            Si necesitas cancelar o modificar tu cita, comunícate con el consultorio con anticipación.
          </p>
          ${emailButton("Ver mi panel de paciente", `${appUrl}/dashboard/patient`)}`
        )
      });

      if (!patientSent && !skipped) success = false;
    }

    // ── Doctor reminder ──────────────────────────────────────────────────────
    const doctorEmail = appt.doctor.user?.email;
    if (doctorEmail) {
      const { sent: doctorSent, skipped } = await sendTransactionalEmail({
        to: doctorEmail,
        subject: `Recordatorio de agenda: cita con ${patientDisplayName} mañana`,
        text: `Tienes una cita médica mañana con ${patientDisplayName}. Fecha y hora: ${startsAtFormatted}.`,
        html: emailShell(
          "Recordatorio de agenda clínica",
          `<p>Hola <strong>${appt.doctor.fullName}</strong>,</p>
          <p>Este es un recordatorio de tu próxima cita <strong>mañana</strong>.</p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;width:130px;">Paciente</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:14px;font-weight:700;color:#071726;">${patientDisplayName}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:#7f9aaa;">Fecha y hora</td>
              <td style="padding:10px 0;font-size:14px;font-weight:700;color:#071726;">${startsAtFormatted}</td>
            </tr>
          </table>

          <p style="font-size:14px;color:#374151;margin-top:4px;">
            Accede a tu agenda clínica para ver todos los detalles de la cita.
          </p>
          ${emailButton("Ver mi agenda clínica", `${appUrl}/dashboard/doctor`)}`
        )
      });

      if (!doctorSent && !skipped) success = false;
    }

    // Mark reminder sent (only if at least one email was dispatched successfully)
    if (success) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: now }
      });
      sent++;
    } else {
      failed++;
    }
  }

  await auditLog({
    action: "CRON_APPOINTMENT_REMINDERS",
    entityType: "Appointment",
    metadata: {
      total: appointments.length,
      sent,
      failed,
      ranAt: now.toISOString()
    }
  });

  return ok({
    total: appointments.length,
    sent,
    failed,
    ranAt: now.toISOString()
  });
}
