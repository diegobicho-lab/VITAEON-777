import { AppointmentStatus, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { ok, fail } from "@/lib/api-response";
import { autoCancelExpiredAppointments } from "@/lib/appointments/auto-cancel";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { auditLog } from "@/lib/audit/audit";
import { getWelcomeDiscountQuote } from "@/lib/discounts/welcome-discount";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { createManyNotifications } from "@/lib/notifications/notifications";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { openSensitiveText, sealSensitiveText } from "@/lib/security/crypto";
import { appointmentCreateSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver citas.", 401);

  // Fire-and-forget: do not await so we don't add latency to the user's request.
  // A Vercel Cron (vercel.json) now runs this every hour as the primary mechanism.
  void autoCancelExpiredAppointments().catch((err) =>
    console.error("[appointments GET] background auto-cancel error:", err)
  );

  // Hard cap: prevents loading thousands of rows for users with long history.
  // The dashboard only displays the most recent N appointments.
  // Full cursor pagination is a planned future enhancement.
  const APPOINTMENTS_HARD_LIMIT = user.role === "ADMIN" || user.role === "STAFF" ? 200 : 100;

  const appointments = await prisma.appointment.findMany({
    where:
      user.role === "PATIENT"
        ? { patient: { userId: user.id } }
        : user.role === "DOCTOR"
          ? { doctor: { userId: user.id } }
          : {},
    include: {
      doctor: { include: { specialty: true, hospital: true } },
      patient: { include: { user: true } },
      availabilitySlot: true,
      payments: true
    },
    orderBy: { createdAt: "desc" },
    take: APPOINTMENTS_HARD_LIMIT
  });

  return ok(appointments.map((appointment) => ({ ...appointment, reason: openSensitiveText(appointment.reason) })));
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("appointments:create", { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas solicitudes de cita. Intenta de nuevo en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "PATIENT") return fail("FORBIDDEN", "Solo pacientes pueden crear citas.", 403);

  const body = await request.json().catch(() => null);
  const parsed = appointmentCreateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de cita inválidos.", 422, parsed.error.flatten());

  const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
  if (!patient) return fail("PATIENT_PROFILE_REQUIRED", "El usuario no tiene perfil de paciente.", 409);

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const slot = await tx.availabilitySlot.findFirst({
        where: {
          id: parsed.data.availabilitySlotId,
          doctorId: parsed.data.doctorId,
          isActive: true,
          appointment: null
        },
        include: { doctor: { include: { specialty: true } } }
      });
      if (!slot) throw new Error("SLOT_UNAVAILABLE");

      const discount = await getWelcomeDiscountQuote(tx, {
        patientId: patient.id,
        doctorId: parsed.data.doctorId,
        amountCents: slot.doctor.consultationPriceCents
      });

      const created = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: parsed.data.doctorId,
          availabilitySlotId: slot.id,
          status: AppointmentStatus.PENDING_DOCTOR_ACCEPTANCE,
          reason: sealSensitiveText(parsed.data.reason),
          originalAmountCents: slot.doctor.consultationPriceCents,
          discountCents: discount.discountCents,
          discountLabel: discount.label,
          payments: {
            create: {
              provider:
                parsed.data.paymentMethod === "CASH"
                  ? PaymentProvider.CASH
                  : parsed.data.paymentMethod === "TRANSFER"
                    ? PaymentProvider.TRANSFER
                    : PaymentProvider.STRIPE,
              amountCents: discount.finalAmountCents,
              status: PaymentStatus.PENDING
            }
          }
        },
        include: {
          payments: true,
          doctor: { include: { user: true, specialty: true } },
          availabilitySlot: true
        }
      });

      if (discount.eligible) {
        await tx.patient.update({
          where: { id: patient.id },
          data: { welcomeDiscountAvailable: false, welcomeDiscountUsedAt: new Date() }
        });
      }

      return created;
    });

    await auditLog({
      actorUserId: user.id,
      action: "CREATE_APPOINTMENT",
      entityType: "Appointment",
      entityId: appointment.id,
      metadata: { doctorId: appointment.doctorId, slotId: appointment.availabilitySlotId, discountCents: appointment.discountCents }
    });

    await createManyNotifications([
      {
        userId: user.id,
        type: "appointment_created",
        title: "Ticket de cita creado",
        message: `Tu ticket de cita con ${appointment.doctor.fullName} fue creado correctamente y está pendiente de aceptación médica.`
      },
      {
        userId: appointment.doctor.userId,
        type: "new_appointment",
        title: "Nueva cita en agenda",
        message: `${user.name} solicitó una cita de ${appointment.doctor.specialty.name}.`
      }
    ]);

    const startsAt = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Mexico_City"
    }).format(new Date(appointment.availabilitySlot.startsAt));

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");
    await Promise.all([
      sendTransactionalEmail({
        to: user.email,
        subject: `Tu cita con ${appointment.doctor.fullName} quedó registrada`,
        text: `Tu ticket de cita con ${appointment.doctor.fullName} (${appointment.doctor.specialty.name}) fue creado correctamente para el ${startsAt}. Revisa tu ticket y continúa con el pago desde tu panel de paciente.`,
        html: emailShell(
          `Cita con ${appointment.doctor.fullName}`,
          [
            `<p>Tu ticket de cita fue creado correctamente en <strong>VITAEON</strong>.</p>`,
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;width:100%;">`,
            `<tr><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;width:130px;">Médico</td><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:14px;font-weight:600;color:#071726;">${appointment.doctor.fullName}</td></tr>`,
            `<tr><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;">Especialidad</td><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:14px;color:#374151;">${appointment.doctor.specialty.name}</td></tr>`,
            `<tr><td style="padding:8px 0;font-size:13px;color:#7f9aaa;">Fecha y hora</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#071726;">${startsAt}</td></tr>`,
            `</table>`,
            `<p style="margin-top:16px;font-size:14px;color:#374151;">Tu cita está <strong>pendiente de aceptación médica</strong>. Revisa el ticket y completa el pago desde tu panel para confirmar.</p>`,
            emailButton("Ver mi ticket y pagar", `${appUrl}/dashboard/patient`)
          ].join("")
        )
      }),
      appointment.doctor.user?.email
        ? sendTransactionalEmail({
            to: appointment.doctor.user.email,
            subject: `Nueva solicitud de cita — ${user.name}`,
            text: `${user.name} solicitó una cita de ${appointment.doctor.specialty.name} para el ${startsAt}. Entra a tu panel médico para aceptarla.`,
            html: emailShell(
              "Nueva solicitud de cita",
              [
                `<p><strong>${user.name}</strong> solicitó una cita de <strong>${appointment.doctor.specialty.name}</strong>.</p>`,
                `<p style="margin-top:8px;"><strong>Fecha solicitada:</strong> ${startsAt}</p>`,
                `<p style="margin-top:12px;font-size:14px;color:#374151;">La cita está pendiente de tu aceptación. Entra a tu agenda clínica para aceptarla, completarla o marcar ausencia.</p>`,
                emailButton("Ver mi agenda clínica", `${appUrl}/dashboard/doctor`)
              ].join("")
            )
          })
        : Promise.resolve({ sent: false, skipped: true })
    ]);

    return ok(appointment, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_UNAVAILABLE") {
      return fail("SLOT_UNAVAILABLE", "El horario ya no está disponible.", 409);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("SLOT_ALREADY_BOOKED", "Ese horario acaba de ser reservado. Selecciona otro disponible.", 409);
    }
    return fail("APPOINTMENT_CREATE_FAILED", "No fue posible crear la cita.", 500);
  }
}
