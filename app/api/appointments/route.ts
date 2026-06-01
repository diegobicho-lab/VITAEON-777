import { AppointmentStatus, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { ok, fail } from "@/lib/api-response";
import { autoCancelExpiredAppointments } from "@/lib/appointments/auto-cancel";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { auditLog } from "@/lib/audit/audit";
import { getWelcomeDiscountQuote } from "@/lib/discounts/welcome-discount";
import { emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { createManyNotifications } from "@/lib/notifications/notifications";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { openSensitiveText, sealSensitiveText } from "@/lib/security/crypto";
import { appointmentCreateSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver citas.", 401);

  await autoCancelExpiredAppointments();

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
    orderBy: { createdAt: "desc" }
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

    await Promise.all([
      sendTransactionalEmail({
        to: user.email,
        subject: "Tu cita quedó registrada en VITAEON",
        text: `Tu ticket de cita con ${appointment.doctor.fullName} fue creado correctamente para ${startsAt}. Puedes consultarlo en tu panel de paciente en la sección Mis citas.`,
        html: emailShell(
          "Ticket de cita creado",
          `<p>Tu ticket de cita con <strong>${appointment.doctor.fullName}</strong> fue creado correctamente.</p><p><strong>Fecha:</strong> ${startsAt}</p><p>Puedes consultarlo en tu panel de paciente en la sección Mis citas.</p>`
        )
      }),
      appointment.doctor.user?.email
        ? sendTransactionalEmail({
            to: appointment.doctor.user.email,
            subject: "Nueva cita en tu agenda VITAEON",
            text: `${user.name} solicitó una cita de ${appointment.doctor.specialty.name} para ${startsAt}.`,
            html: emailShell(
              "Nueva cita en agenda",
              `<p>${user.name} solicitó una cita de <strong>${appointment.doctor.specialty.name}</strong>.</p><p><strong>Fecha:</strong> ${startsAt}</p>`
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
