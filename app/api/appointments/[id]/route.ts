import { AppointmentStatus, MedicalMedal, PaymentProvider, PaymentStatus, Role } from "@prisma/client";
import type Stripe from "stripe";
import { fail, ok } from "@/lib/api-response";
import { findNextAvailableSlot } from "@/lib/appointments/reschedule";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { createManyNotifications } from "@/lib/notifications/notifications";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { openSensitiveText } from "@/lib/security/crypto";
import { appointmentUpdateSchema } from "@/lib/validation/schemas";

type AppointmentAction =
  | "ACCEPT"
  | "COMPLETE"
  | "MARK_NO_SHOW"
  | "REQUEST_RESCHEDULE"
  | "REQUEST_CANCELLATION"
  | "MARK_REFUND_PENDING"
  | "APPROVE_REFUND"
  | "REJECT_REFUND"
  | "CANCEL";

const terminalStatuses = new Set<AppointmentStatus>([
  AppointmentStatus.CANCELLED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.REFUNDED
]);

function legacyAction(role: Role, status?: string, hasSlot?: boolean): AppointmentAction | null {
  if (status === "CONFIRMED" || status === "ACCEPTED") return "ACCEPT";
  if (status === "COMPLETED") return "COMPLETE";
  if (status === "CANCELLED") return role === "ADMIN" || role === "STAFF" ? "CANCEL" : "REQUEST_CANCELLATION";
  if (status === "NO_SHOW") return "MARK_NO_SHOW";
  if (status === "RESCHEDULE_REQUESTED" || hasSlot) return "REQUEST_RESCHEDULE";
  if (status === "REFUND_PENDING") return "MARK_REFUND_PENDING";
  return null;
}

function formatStartsAt(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function paymentSummary(payments: Array<{ status: PaymentStatus; amountCents: number }>) {
  return {
    hasPaidOnline: payments.some((payment) => payment.status === PaymentStatus.PAID),
    hasPendingPayment: payments.some((payment) => payment.status === PaymentStatus.PENDING),
    totalCents: payments[0]?.amountCents ?? 0,
    status: payments[0]?.status ?? PaymentStatus.PENDING
  };
}

function latestStripePayment(
  payments: Array<{
    id: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    providerPaymentIntentId: string | null;
    amountCents: number;
  }>
) {
  return payments.find((item) => item.provider === PaymentProvider.STRIPE && item.status === PaymentStatus.PAID);
}

async function notifyAppointmentChange(input: {
  appointment: {
    id: string;
    status: AppointmentStatus;
    cancellationReason: string | null;
    patient: { user: { id: string; name: string; email: string } };
    doctor: { fullName: string; user: { id: string; email: string } | null };
    availabilitySlot: { startsAt: Date };
  };
  title: string;
  patientMessage: string;
  doctorMessage: string;
  type: string;
  notifyAdmin?: boolean;
}) {
  const startsAt = formatStartsAt(input.appointment.availabilitySlot.startsAt);
  const admins = input.notifyAdmin
    ? await prisma.user.findMany({ where: { role: { in: [Role.ADMIN, Role.STAFF] }, isActive: true }, select: { id: true, email: true } })
    : [];

  await createManyNotifications([
    {
      userId: input.appointment.patient.user.id,
      type: input.type,
      title: input.title,
      message: input.patientMessage
    },
    {
      userId: input.appointment.doctor.user?.id,
      type: input.type,
      title: input.title,
      message: input.doctorMessage
    },
    ...admins.map((admin) => ({
      userId: admin.id,
      type: input.type,
      title: input.title,
      message: `${input.patientMessage} Cita: ${input.appointment.id}.`
    }))
  ]);

  await Promise.all([
    sendTransactionalEmail({
      to: input.appointment.patient.user.email,
      subject: `${input.title} en VITAEON`,
      text: `${input.patientMessage} Fecha: ${startsAt}.`,
      html: emailShell(input.title, `<p>${input.patientMessage}</p><p><strong>Fecha:</strong> ${startsAt}</p>`)
    }),
    input.appointment.doctor.user?.email
      ? sendTransactionalEmail({
          to: input.appointment.doctor.user.email,
          subject: `${input.title} en VITAEON`,
          text: `${input.doctorMessage} Fecha: ${startsAt}.`,
          html: emailShell(input.title, `<p>${input.doctorMessage}</p><p><strong>Fecha:</strong> ${startsAt}</p>`)
        })
      : Promise.resolve({ sent: false, skipped: true }),
    ...admins.map((admin) =>
      sendTransactionalEmail({
        to: admin.email,
        subject: `${input.title} requiere revisión en VITAEON`,
        text: `${input.patientMessage} Cita: ${input.appointment.id}. Fecha: ${startsAt}.`,
        html: emailShell(input.title, `<p>${input.patientMessage}</p><p><strong>Cita:</strong> ${input.appointment.id}</p><p><strong>Fecha:</strong> ${startsAt}</p>`)
      })
    )
  ]);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver la cita.", 401);

  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      ...(user.role === "PATIENT"
        ? { patient: { userId: user.id } }
        : user.role === "DOCTOR"
          ? { doctor: { userId: user.id } }
          : {})
    },
    include: {
      patient: { include: { user: true } },
      doctor: { include: { specialty: true, hospital: true } },
      availabilitySlot: true,
      payments: true
    }
  });

  if (!appointment) return fail("APPOINTMENT_NOT_FOUND", "No encontramos la cita.", 404);

  await auditLog({
    actorUserId: user.id,
    action: "VIEW_APPOINTMENT",
    entityType: "Appointment",
    entityId: appointment.id
  });

  return ok({ ...appointment, reason: openSensitiveText(appointment.reason) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await rateLimitByIp("appointments:update", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones de cita. Intenta de nuevo en un momento.", 429);

  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para modificar la cita.", 401);

  const body = await request.json().catch(() => null);
  const parsed = appointmentUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de cita inválidos.", 422, parsed.error.flatten());

  const action = parsed.data.action ?? legacyAction(user.role, parsed.data.status, Boolean(parsed.data.availabilitySlotId));
  if (!action) return fail("ACTION_REQUIRED", "Selecciona una acción válida para la cita.", 422);

  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      ...(user.role === "PATIENT"
        ? { patient: { userId: user.id } }
        : user.role === "DOCTOR"
          ? { doctor: { userId: user.id } }
          : {})
    },
    include: {
      payments: true,
      patient: { include: { user: true } },
      doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
      availabilitySlot: true
    }
  });

  if (!appointment) return fail("APPOINTMENT_NOT_FOUND", "No encontramos la cita.", 404);

  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";
  if (user.role === "DOCTOR" && appointment.doctor.medal === MedicalMedal.obsidiana) {
    return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);
  }

  if (terminalStatuses.has(appointment.status) && !isAdmin) {
    return fail("APPOINTMENT_CLOSED", "Esta cita ya está cerrada. Solo administración puede cambiarla.", 409);
  }

  if (action === "ACCEPT" && user.role !== "DOCTOR" && !isAdmin) {
    return fail("FORBIDDEN", "Solo el médico de la cita puede aceptarla.", 403);
  }
  if ((action === "COMPLETE" || action === "MARK_NO_SHOW") && user.role !== "DOCTOR" && !isAdmin) {
    return fail("FORBIDDEN", "Solo el médico de la cita puede cerrar la atención.", 403);
  }
  if (action === "REQUEST_RESCHEDULE" && user.role !== "PATIENT" && !isAdmin) {
    return fail("FORBIDDEN", "Solo el paciente dueño de la cita puede solicitar este cambio.", 403);
  }
  if (action === "REQUEST_CANCELLATION" && user.role !== "PATIENT" && user.role !== "DOCTOR" && !isAdmin) {
    return fail("FORBIDDEN", "Solo el paciente o el médico de la cita pueden solicitar cancelación.", 403);
  }
  if (action === "MARK_REFUND_PENDING" && !isAdmin) {
    return fail("FORBIDDEN", "Solo administración puede marcar reembolso pendiente manualmente.", 403);
  }
  if ((action === "APPROVE_REFUND" || action === "REJECT_REFUND") && user.role !== "DOCTOR" && !isAdmin) {
    return fail("FORBIDDEN", "Solo el médico de la cita o administración pueden resolver la devolución.", 403);
  }

  const payment = paymentSummary(appointment.payments);
  let title = "Cita actualizada";
  let patientMessage = "Tu cita fue actualizada.";
  let doctorMessage = `La cita de ${appointment.patient.user.name} fue actualizada.`;
  let notifyAdmin = false;

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
    if (action === "ACCEPT") {
      if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) {
        throw new Error("APPOINTMENT_CLOSED");
      }

      const data: Record<string, unknown> = {
        status: AppointmentStatus.ACCEPTED,
        acceptedAt: new Date(),
        acceptedByDoctor: true,
        acceptedAutomatically: false,
        acceptedReason: "Aceptada por el médico"
      };

      if (appointment.status === AppointmentStatus.RESCHEDULE_REQUESTED) {
        const nextSlot = parsed.data.availabilitySlotId
          ? await tx.availabilitySlot.findFirst({
              where: {
                id: parsed.data.availabilitySlotId,
                doctorId: appointment.doctorId,
                isActive: true,
                startsAt: { gte: new Date() },
                appointment: null
              }
            })
          : await findNextAvailableSlot(tx, appointment.doctorId, new Date());
        if (!nextSlot) throw new Error("SLOT_UNAVAILABLE");
        data.availabilitySlotId = nextSlot.id;
        data.status = AppointmentStatus.RESCHEDULED;
        data.requestedSlotId = null;
        data.rescheduleRequestedAt = null;
        data.reschedulePreferred = false;
        data.previousStartTime = appointment.availabilitySlot.startsAt;
        data.previousEndTime = appointment.availabilitySlot.endsAt;
        data.rescheduledAt = new Date();
      }

      title = appointment.status === AppointmentStatus.RESCHEDULE_REQUESTED ? "Cita reagendada" : "Cita aceptada por el médico";
      patientMessage = appointment.status === AppointmentStatus.RESCHEDULE_REQUESTED
        ? `La cita con ${appointment.doctor.fullName} fue reagendada al horario disponible más cercano.`
        : `Tu cita con ${appointment.doctor.fullName} fue aceptada por el médico.`;
      doctorMessage = appointment.status === AppointmentStatus.RESCHEDULE_REQUESTED
        ? `La cita de ${appointment.patient.user.name} fue reagendada al horario disponible más cercano.`
        : `Aceptaste la cita de ${appointment.patient.user.name}.`;

      return tx.appointment.update({
        where: { id: appointment.id },
        data,
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });
    }

    if (action === "COMPLETE") {
      if (appointment.status === AppointmentStatus.NO_SHOW || appointment.status === AppointmentStatus.CANCELLED) {
        throw new Error("APPOINTMENT_CLOSED");
      }
      title = "Cita completada";
      patientMessage = `La cita con ${appointment.doctor.fullName} fue marcada como completada. Ya puedes dejar una opinión verificada.`;
      doctorMessage = `Marcaste como completada la cita de ${appointment.patient.user.name}.`;

      return tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.COMPLETED, completedAt: new Date() },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });
    }

    if (action === "MARK_NO_SHOW") {
      title = "Paciente no asistió";
      patientMessage = `El médico marcó que no asististe a tu cita con ${appointment.doctor.fullName}. Puedes solicitar reagendamiento o cancelación desde tu panel.`;
      doctorMessage = `Marcaste como no asistida la cita de ${appointment.patient.user.name}.`;

      return tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.NO_SHOW, noShowAt: new Date() },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });
    }

    if (action === "REQUEST_RESCHEDULE") {
      if (appointment.status !== AppointmentStatus.NO_SHOW && appointment.status !== AppointmentStatus.ACCEPTED && appointment.status !== AppointmentStatus.PENDING_DOCTOR_ACCEPTANCE && !isAdmin) {
        throw new Error("RESCHEDULE_NOT_ALLOWED");
      }
      title = "Reagendamiento solicitado";
      patientMessage = `Solicitaste reagendar tu cita con ${appointment.doctor.fullName}. Conservaremos el pago original si ya estaba pagado.`;
      doctorMessage = `${appointment.patient.user.name} solicitó reagendar su cita.`;

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.RESCHEDULE_REQUESTED,
          requestedSlotId: parsed.data.availabilitySlotId ?? null,
          rescheduleRequestedAt: new Date(),
          reschedulePreferred: true,
          refundRequested: false,
          doctorRefundDecision: "pending"
        },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });
    }

    if (action === "REQUEST_CANCELLATION") {
      if (user.role === "DOCTOR" && !isAdmin) {
        const reason = parsed.data.cancellationReason ?? "Cancelación solicitada por médico desde agenda clínica.";
        title = "Solicitud de cancelación enviada";
        patientMessage = `El médico solicitó cancelar tu cita con ${appointment.doctor.fullName}. Administración revisará el caso antes de cualquier cambio final.`;
        doctorMessage = "Solicitud de cancelación enviada correctamente.";
        notifyAdmin = true;

        await tx.cancellationRequest.create({
          data: {
            appointmentId: appointment.id,
            doctorId: appointment.doctorId,
            patientId: appointment.patientId,
            reason,
            status: "pendiente"
          }
        });

        return tx.appointment.update({
          where: { id: appointment.id },
          data: {
            status: AppointmentStatus.CANCELLATION_REQUESTED,
            cancellationReason: reason,
            cancellationRequestedAt: new Date(),
            cancellationRequested: true,
            reschedulePreferred: true,
            refundRequested: false,
            doctorRefundDecision: "pending"
          },
          include: {
            patient: { include: { user: true } },
            doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
            availabilitySlot: true,
            payments: true
          }
        });
      }

      const reason = parsed.data.cancellationReason ?? "Cancelación solicitada desde panel.";
      title = payment.hasPaidOnline ? "Solicitud de cancelación recibida" : "Solicitud de cancelación recibida";
      patientMessage = payment.hasPaidOnline
        ? `Solicitaste cancelar tu cita con ${appointment.doctor.fullName}. Primero intentaremos reagendar; si procede devolución, el médico revisará el pago de esta cita.`
        : `Solicitaste cancelar tu cita con ${appointment.doctor.fullName}. Primero intentaremos reagendar.`;
      doctorMessage = `${appointment.patient.user.name} solicitó cancelar su cita. Prioriza reagendar; la devolución es una segunda opción si procede.`;
      notifyAdmin = payment.hasPaidOnline;

      await tx.cancellationRequest.create({
        data: {
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          reason,
          status: payment.hasPaidOnline ? "reembolso_solicitado" : "pendiente"
        }
      });

      const saved = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLATION_REQUESTED,
          cancellationReason: reason,
          cancellationRequestedAt: new Date(),
          cancellationRequested: true,
          reschedulePreferred: true,
          refundRequested: payment.hasPaidOnline,
          refundReason: payment.hasPaidOnline ? reason : null,
          refundRequestedAt: payment.hasPaidOnline ? new Date() : null,
          doctorRefundDecision: payment.hasPaidOnline ? "pending" : null
        },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });

      return saved;
    }

    if (action === "MARK_REFUND_PENDING") {
      title = "Reembolso pendiente de revisión";
      patientMessage = `Tu cita con ${appointment.doctor.fullName} quedó con reembolso pendiente de revisión administrativa.`;
      doctorMessage = `La cita de ${appointment.patient.user.name} quedó con reembolso pendiente.`;
      notifyAdmin = true;

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.REFUND_PENDING,
          refundRequestedAt: new Date(),
          refundRequested: true,
          refundReason: parsed.data.refundReason ?? parsed.data.cancellationReason ?? appointment.cancellationReason,
          doctorRefundDecision: "pending"
        },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });
    }

    if (action === "APPROVE_REFUND") {
      const stripePayment = latestStripePayment(appointment.payments);
      const reason = parsed.data.refundReason ?? parsed.data.cancellationReason ?? appointment.refundReason ?? appointment.cancellationReason ?? "Devolución aprobada por médico.";

      title = "Devolución aprobada";
      patientMessage = payment.hasPaidOnline
        ? `El médico aprobó la devolución de tu cita con ${appointment.doctor.fullName}. El proceso queda registrado en Stripe.`
        : `El médico aprobó la devolución o acuerdo fuera de plataforma para tu cita con ${appointment.doctor.fullName}.`;
      doctorMessage = `Aprobaste la devolución de la cita de ${appointment.patient.user.name}.`;
      notifyAdmin = true;

      if (payment.hasPaidOnline) {
        if (!stripePayment?.providerPaymentIntentId) throw new Error("PAYMENT_INTENT_REQUIRED");
        let refund: Stripe.Refund;
        try {
          refund = await getStripe().refunds.create({
            payment_intent: stripePayment.providerPaymentIntentId,
            amount: stripePayment.amountCents,
            metadata: {
              kind: "appointment_refund",
              appointmentId: appointment.id,
              paymentId: stripePayment.id,
              doctorId: appointment.doctorId
            }
          });
        } catch (caught) {
          console.error("[Stripe refund error]", caught);
          throw new Error("STRIPE_REFUND_FAILED");
        }

        await tx.payment.update({
          where: { id: stripePayment.id },
          data: {
            status: PaymentStatus.REFUNDED,
            refundId: refund.id,
            refundedAt: new Date(),
            refundedAmountCents: refund.amount,
            transferStatus: "refunded"
          }
        });
      }

      await tx.cancellationRequest.updateMany({
        where: { appointmentId: appointment.id, status: { in: ["pendiente", "reembolso_solicitado", "reembolso_pendiente"] } },
        data: { status: payment.hasPaidOnline ? "reembolso_aprobado" : "devolucion_fuera_de_plataforma" }
      });

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: payment.hasPaidOnline ? AppointmentStatus.REFUNDED : AppointmentStatus.CANCELLED,
          refundRequested: true,
          refundReason: reason,
          refundRequestedAt: appointment.refundRequestedAt ?? new Date(),
          doctorRefundDecision: "approved",
          cancellationRequested: true,
          cancellationRequestedAt: appointment.cancellationRequestedAt ?? new Date()
        },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });
    }

    if (action === "REJECT_REFUND") {
      title = "Devolución no aprobada";
      patientMessage = `El médico revisó la solicitud de devolución de tu cita con ${appointment.doctor.fullName}. Puedes coordinar reagendamiento desde tu panel.`;
      doctorMessage = `Marcaste como no aprobada la devolución de la cita de ${appointment.patient.user.name}.`;
      notifyAdmin = true;

      await tx.cancellationRequest.updateMany({
        where: { appointmentId: appointment.id, status: { in: ["pendiente", "reembolso_solicitado", "reembolso_pendiente"] } },
        data: { status: "reembolso_rechazado" }
      });

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLATION_REQUESTED,
          refundRequested: true,
          refundReason: parsed.data.refundReason ?? parsed.data.cancellationReason ?? appointment.refundReason,
          doctorRefundDecision: "rejected"
        },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });
    }

    if (action === "CANCEL") {
      title = "Cita cancelada";
      patientMessage = `La cita con ${appointment.doctor.fullName} fue cancelada.`;
      doctorMessage = `La cita de ${appointment.patient.user.name} fue cancelada.`;

      await tx.payment.updateMany({
        where: { appointmentId: appointment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED }
      });

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationReason: parsed.data.cancellationReason ?? "Cancelado por administración.",
          cancellationRequestedAt: new Date()
        },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
          availabilitySlot: true,
          payments: true
        }
      });
    }

      throw new Error("UNKNOWN_ACTION");
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SLOT_UNAVAILABLE") return fail("SLOT_UNAVAILABLE", "El nuevo horario ya no está disponible.", 409);
      if (error.message === "PAYMENT_INTENT_REQUIRED") {
        return fail("PAYMENT_INTENT_REQUIRED", "No encontramos el pago en línea necesario para procesar devolución.", 409);
      }
      if (error.message === "STRIPE_REFUND_FAILED") {
        return fail("STRIPE_REFUND_FAILED", "No pudimos procesar la devolución en Stripe. Revisa la configuración o inténtalo de nuevo.", 502);
      }
      if (error.message === "APPOINTMENT_CLOSED") return fail("APPOINTMENT_CLOSED", "Esta cita ya está cerrada.", 409);
      if (error.message === "RESCHEDULE_NOT_ALLOWED") {
        return fail("RESCHEDULE_NOT_ALLOWED", "Esta cita aún no permite solicitar reagendamiento.", 409);
      }
    }
    console.error("[Appointment update error]", error);
    return fail("APPOINTMENT_UPDATE_FAILED", "No fue posible actualizar la cita.", 500);
  }

  await auditLog({
    actorUserId: user.id,
    action: `APPOINTMENT_${action}`,
    entityType: "Appointment",
    entityId: updated.id,
    metadata: {
      status: updated.status,
      requestedSlotId: updated.requestedSlotId,
      paymentStatus: payment.status,
      refundPreparedOnly: updated.status === AppointmentStatus.REFUND_PENDING
    }
  });

  await notifyAppointmentChange({
    appointment: updated,
    title,
    patientMessage,
    doctorMessage,
    type: action.toLowerCase(),
    notifyAdmin
  });

  return ok({ ...updated, reason: openSensitiveText(updated.reason) });
}
