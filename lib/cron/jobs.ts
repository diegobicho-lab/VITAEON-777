import "server-only";
import { NextRequest } from "next/server";
import { SubscriptionStatus } from "@prisma/client";
import { ok, fail } from "@/lib/api-response";
import { autoCancelExpiredAppointments } from "@/lib/appointments/auto-cancel";
import { auditLog } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";

export function verifyCronRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return fail("UNAUTHORIZED", "Invalid cron secret.", 401);
  if (authHeader !== `Bearer ${cronSecret}`) return fail("UNAUTHORIZED", "Invalid cron secret.", 401);

  return null;
}

export async function runAutoCancelCron(now = new Date()) {
  const result = await autoCancelExpiredAppointments();
  const count = result.count;

  await auditLog({
    action: "CRON_AUTO_CANCEL_APPOINTMENTS",
    entityType: "Appointment",
    metadata: { cancelledCount: count, ranAt: now.toISOString() }
  });

  return { cancelledCount: count, ranAt: now.toISOString() };
}

export async function runExpireSubscriptionsCron(now = new Date()) {
  const gracePeriodEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const activeDoctors = await prisma.doctor.findMany({
    where: { subscriptionStatus: SubscriptionStatus.ACTIVE },
    select: { userId: true }
  });

  if (activeDoctors.length === 0) {
    return { expiredCount: 0, ranAt: now.toISOString() };
  }

  const expiredUserIds: string[] = [];
  for (const { userId } of activeDoctors) {
    if (!userId) continue;
    const latestPaid = await prisma.subscriptionPayment.findFirst({
      where: { userId, status: "PAID" },
      orderBy: { currentPeriodEnd: "desc" },
      select: { currentPeriodEnd: true }
    });
    if (latestPaid?.currentPeriodEnd && latestPaid.currentPeriodEnd < gracePeriodEnd) {
      expiredUserIds.push(userId);
    }
  }

  if (expiredUserIds.length === 0) {
    return { expiredCount: 0, ranAt: now.toISOString() };
  }

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
      ranAt: now.toISOString()
    }
  });

  return { expiredCount: result.count, ranAt: now.toISOString() };
}

export async function send24HourAppointmentReminders(now = new Date()) {
  const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");

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
      patient: { include: { user: { select: { name: true, email: true } } } },
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
    const startsAt = appt.availabilitySlot.startsAt.toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const startsAtFormatted = startsAt.charAt(0).toUpperCase() + startsAt.slice(1);
    const patientDisplayName = appt.guestPatientName ?? appt.patient.user.name;
    let success = true;

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
            <tr><td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;width:130px;">Médico</td><td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:14px;font-weight:700;color:#071726;">${appt.doctor.fullName}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;">Especialidad</td><td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:14px;color:#374151;">${appt.doctor.specialty.name}</td></tr>
            <tr><td style="padding:10px 0;font-size:13px;color:#7f9aaa;">Fecha y hora</td><td style="padding:10px 0;font-size:14px;font-weight:700;color:#071726;">${startsAtFormatted}</td></tr>
          </table>
          <p style="font-size:14px;color:#374151;margin-top:4px;">Si necesitas cancelar o modificar tu cita, comunícate con el consultorio con anticipación.</p>
          ${emailButton("Ver mi panel de paciente", `${appUrl}/dashboard/patient`)}`
        )
      });

      if (!patientSent && !skipped) success = false;
    }

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
            <tr><td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;width:130px;">Paciente</td><td style="padding:10px 0;border-bottom:1px solid #e5edf2;font-size:14px;font-weight:700;color:#071726;">${patientDisplayName}</td></tr>
            <tr><td style="padding:10px 0;font-size:13px;color:#7f9aaa;">Fecha y hora</td><td style="padding:10px 0;font-size:14px;font-weight:700;color:#071726;">${startsAtFormatted}</td></tr>
          </table>
          <p style="font-size:14px;color:#374151;margin-top:4px;">Accede a tu agenda clínica para ver todos los detalles de la cita.</p>
          ${emailButton("Ver mi agenda clínica", `${appUrl}/dashboard/doctor`)}`
        )
      });

      if (!doctorSent && !skipped) success = false;
    }

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
    metadata: { total: appointments.length, sent, failed, ranAt: now.toISOString() }
  });

  return { total: appointments.length, sent, failed, ranAt: now.toISOString() };
}

export async function send2HourAppointmentReminders(now = new Date()) {
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
      patient: { include: { user: { select: { name: true, email: true } } } },
      doctor: { include: { specialty: { select: { name: true } } } }
    }
  });

  let sent = 0;
  let failed = 0;

  for (const appt of appointments) {
    const patientEmail = appt.patient.user.email;
    const isGhost = patientEmail.endsWith("@vitaeon.internal");
    if (isGhost) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminder2hSentAt: now } });
      continue;
    }

    const startsAt = appt.availabilitySlot.startsAt.toLocaleString("es-MX", {
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
        <p style="font-size:14px;color:#374151;">Médico: <strong>${appt.doctor.fullName}</strong> - ${appt.doctor.specialty.name}</p>
        <p style="font-size:14px;color:#374151;margin-top:8px;">Si necesitas cancelar, comunícate directamente con el consultorio.</p>
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

  return { total: appointments.length, sent, failed, ranAt: now.toISOString() };
}

export { ok };
