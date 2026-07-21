import { z } from "zod";
import { AppointmentStatus, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { resolveAssistantLink } from "@/lib/auth/assistant";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { createManyNotifications } from "@/lib/notifications/notifications";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { openSensitiveText, sealSensitiveText } from "@/lib/security/crypto";

const assistantAppointmentSchema = z.object({
  patientId: z.string().min(1),         // Patient.id (no userId)
  availabilitySlotId: z.string().min(1),
  paymentMethod: z.enum(["CASH", "TRANSFER"]).default("CASH"),
  reason: z.string().max(1200).optional()
});

/* ── POST — crear cita en nombre del doctor ─── */
export async function POST(request: Request) {
  const limit = await rateLimitByIp("assistants:appointments:create", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas solicitudes. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "ASSISTANT") {
    return fail("FORBIDDEN", "Solo asistentes pueden crear citas desde este endpoint.", 403);
  }

  const link = await resolveAssistantLink(user.id);
  if (!link) return fail("NOT_LINKED", "Asistente no vinculado a ningún médico.", 404);

  const body = await request.json().catch(() => null);
  const parsed = assistantAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Datos de cita inválidos.", 422, parsed.error.flatten());
  }

  // Verificar que el paciente existe
  const patient = await prisma.patient.findUnique({
    where: { id: parsed.data.patientId },
    include: { user: { select: { name: true, email: true, id: true } } }
  });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Paciente no encontrado.", 404);

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      // Verificar que el slot pertenece al médico del asistente, está activo y libre
      const slot = await tx.availabilitySlot.findFirst({
        where: {
          id: parsed.data.availabilitySlotId,
          doctorId: link.doctorId,
          isActive: true,
          appointment: null
        },
        include: { doctor: { include: { specialty: true } } }
      });
      if (!slot) throw new Error("SLOT_UNAVAILABLE");

      const provider =
        parsed.data.paymentMethod === "TRANSFER" ? PaymentProvider.TRANSFER : PaymentProvider.CASH;

      const created = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: link.doctorId,
          availabilitySlotId: slot.id,
          // Las citas creadas por la asistente se aceptan directamente
          status: AppointmentStatus.ACCEPTED,
          reason: parsed.data.reason ? sealSensitiveText(parsed.data.reason) : null,
          originalAmountCents: slot.doctor.consultationPriceCents,
          discountCents: 0,
          discountLabel: null,
          payments: {
            create: {
              provider,
              amountCents: slot.doctor.consultationPriceCents,
              status: PaymentStatus.PENDING
            }
          }
        },
        include: {
          payments: true,
          doctor: { include: { user: { select: { email: true } }, specialty: true } },
          availabilitySlot: true,
          patient: { include: { user: { select: { name: true, email: true, id: true } } } }
        }
      });

      return created;
    });

    // Notificaciones
    const startsAt = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Mexico_City"
    }).format(new Date(appointment.availabilitySlot.startsAt));

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");

    await createManyNotifications([
      {
        userId: patient.user.id,
        type: "appointment_created_by_assistant",
        title: "Cita agendada por recepción",
        message: `La recepción agendó una cita con ${appointment.doctor.fullName} para el ${startsAt}.`
      },
      ...(appointment.doctor.user?.email
        ? [
            {
              userId: appointment.doctor.userId ?? "",
              type: "new_appointment",
              title: "Nueva cita registrada",
              message: `La recepción agendó una cita con ${appointment.patient.user.name} para el ${startsAt}.`
            }
          ]
        : [])
    ].filter((n) => n.userId));

    // Email al paciente
    await sendTransactionalEmail({
      to: patient.user.email,
      subject: `Tu cita con ${appointment.doctor.fullName} fue agendada`,
      text: `La recepción agendó tu cita con ${appointment.doctor.fullName} (${appointment.doctor.specialty.name}) para el ${startsAt}. El pago se realiza en consultorio.`,
      html: emailShell(
        `Cita con ${appointment.doctor.fullName}`,
        `<p>Hola <strong>${appointment.patient.user.name}</strong>,</p>
        <p>La recepción agendó tu cita en <strong>VITAEON</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;width:100%;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;width:130px;">Médico</td><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:14px;font-weight:600;color:#071726;">${appointment.doctor.fullName}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;">Especialidad</td><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:14px;color:#374151;">${appointment.doctor.specialty.name}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#7f9aaa;">Fecha y hora</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#071726;">${startsAt}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:14px;color:#374151;">El pago se realiza directamente en el consultorio. Revisa tu cita desde tu panel de paciente.</p>
        ${emailButton("Ver mi cita", `${appUrl}/dashboard/patient`)}`
      )
    });

    await auditLog({
      actorUserId: user.id,
      action: "ASSISTANT_CREATE_APPOINTMENT",
      entityType: "Appointment",
      entityId: appointment.id,
      metadata: {
        doctorId: link.doctorId,
        patientId: patient.id,
        slotId: appointment.availabilitySlotId,
        assistantId: link.id
      }
    });

    return ok({ ...appointment, reason: openSensitiveText(appointment.reason) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_UNAVAILABLE") {
      return fail("SLOT_UNAVAILABLE", "El horario ya no está disponible.", 409);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("SLOT_ALREADY_BOOKED", "Ese horario acaba de ser reservado. Selecciona otro.", 409);
    }
    console.error("[assistants/appointments POST]", error);
    return fail("APPOINTMENT_CREATE_FAILED", "No fue posible crear la cita.", 500);
  }
}
