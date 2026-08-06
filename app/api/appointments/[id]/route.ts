import { AppointmentStatus, MedicalMedal, PaymentProvider, PaymentStatus, RefundPolicy, Role } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { findNextAvailableSlot } from "@/lib/appointments/reschedule";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { createManyNotifications } from "@/lib/notifications/notifications";
import {
  findRefundablePayment,
  refundAppointmentPayment,
  refundOutcomeMessage,
  type RefundOutcome
} from "@/lib/payments/refunds";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { openSensitiveText } from "@/lib/security/crypto";
import { appointmentUpdateSchema } from "@/lib/validation/schemas";

/**
 * Returns the doctorId linked to an ASSISTANT user, or null if not found.
 * Used to scope appointment queries so an ASSISTANT can only see their doctor's appointments.
 */
async function resolveAssistantDoctorId(userId: string): Promise<string | null> {
  const link = await prisma.doctorAssistant.findUnique({
    where: { userId },
    select: { doctorId: true }
  });
  return link?.doctorId ?? null;
}

type AppointmentAction =
  | "ACCEPT"
  | "COMPLETE"
  | "MARK_NO_SHOW"
  | "REQUEST_RESCHEDULE"
  | "REQUEST_CANCELLATION"
  | "CANCEL_BY_DOCTOR"
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
    refundId: string | null;
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

  // ASSISTANT: resolve linked doctor so we can filter to that doctor's appointments only.
  const assistantDoctorId = user.role === "ASSISTANT" ? await resolveAssistantDoctorId(user.id) : null;

  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      ...(user.role === "PATIENT"
        ? { patient: { userId: user.id } }
        : user.role === "DOCTOR"
          ? { doctor: { userId: user.id } }
          : user.role === "ASSISTANT"
            ? assistantDoctorId
              ? { doctorId: assistantDoctorId }
              : { id: "no-results" } // ASSISTANT without a linked doctor sees nothing
            : {}) // ADMIN / STAFF: no filter
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

  // ASSISTANT: resolve linked doctor for scoped filtering. All write actions will
  // still fail the role-specific checks below, but defense-in-depth requires us to
  // filter the lookup too.
  const assistantDoctorId = user.role === "ASSISTANT" ? await resolveAssistantDoctorId(user.id) : null;

  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      ...(user.role === "PATIENT"
        ? { patient: { userId: user.id } }
        : user.role === "DOCTOR"
          ? { doctor: { userId: user.id } }
          : user.role === "ASSISTANT"
            ? assistantDoctorId
              ? { doctorId: assistantDoctorId }
              : { id: "no-results" }
            : {}) // ADMIN / STAFF: no filter
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
  if (action === "CANCEL_BY_DOCTOR" && user.role !== "DOCTOR" && !isAdmin) {
    return fail("FORBIDDEN", "Solo el médico de la cita o administración pueden cancelarla directamente.", 403);
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
  // Resultado real de Stripe: se usa para no afirmar que el dinero se devolvió
  // cuando la devolución quedó pendiente o falló.
  let refundOutcome: RefundOutcome = { kind: "NOT_APPLICABLE", reason: "no_online_payment" };

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

      // Una cita reagendada vuelve a entrar al flujo de aceptación médica.
      // También se admite CANCELLATION_REQUESTED: si el paciente pidió cancelar
      // y el médico prefiere reagendar, esa es la alternativa recomendada.
      const isRescheduleAccept =
        appointment.status === AppointmentStatus.RESCHEDULE_REQUESTED ||
        appointment.status === AppointmentStatus.CANCELLATION_REQUESTED;

      if (isRescheduleAccept) {
        // El slot enviado por el cliente NO se confía: se revalida que sea de
        // este médico, futuro, activo y libre. Si no se envía ninguno, se toma
        // el hueco futuro más cercano (ya excluye días bloqueados).
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

        if (!nextSlot) {
          // No es un fallo técnico: sencillamente no hay agenda futura libre.
          throw new Error(parsed.data.availabilitySlotId ? "SLOT_UNAVAILABLE" : "NO_FUTURE_SLOTS");
        }
        if (nextSlot.id === appointment.availabilitySlotId) throw new Error("SLOT_UNAVAILABLE");

        data.availabilitySlotId = nextSlot.id;
        data.status = AppointmentStatus.RESCHEDULED;
        data.requestedSlotId = null;
        data.rescheduleRequestedAt = null;
        data.reschedulePreferred = false;
        data.previousStartTime = appointment.availabilitySlot.startsAt;
        data.previousEndTime = appointment.availabilitySlot.endsAt;
        data.rescheduledAt = new Date();
        // Reagendar cierra la solicitud de cancelación: el horario cambia, no se
        // pierde la cita ni el pago original.
        data.cancellationRequested = false;
        data.cancellationRequestedAt = null;
        data.cancellationReason = null;
        data.refundRequested = false;
        data.doctorRefundDecision = null;

        await tx.cancellationRequest.updateMany({
          where: { appointmentId: appointment.id, status: { in: ["pendiente", "reembolso_solicitado"] } },
          data: { status: "resuelta_reagendada" }
        });
      }

      const newStartsAt = isRescheduleAccept
        ? formatStartsAt(
            (await tx.availabilitySlot.findUniqueOrThrow({
              where: { id: data.availabilitySlotId as string },
              select: { startsAt: true }
            })).startsAt
          )
        : null;

      title = isRescheduleAccept ? "Cita reagendada" : "Cita aceptada por el médico";
      patientMessage = isRescheduleAccept
        ? `El médico aceptó reagendar tu cita con ${appointment.doctor.fullName}. Nuevo horario: ${newStartsAt}. Se conserva el pago original.`
        : `Tu cita con ${appointment.doctor.fullName} fue aceptada por el médico.`;
      doctorMessage = isRescheduleAccept
        ? `Reagendaste la cita de ${appointment.patient.user.name} al ${newStartsAt}.`
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

    /**
     * Cancelación definitiva iniciada por el médico.
     *
     * Antes esto creaba una solicitud "pendiente" que ningún flujo podía cerrar:
     * los botones de resolver devolución solo aparecen si `refundRequested` es
     * true, y aquí se guardaba en false. La cita quedaba atascada para siempre.
     * Ahora la cancelación se completa: libera el horario, devuelve el pago en
     * línea de forma idempotente y deja el estado financiero sincronizado.
     */
    if (action === "CANCEL_BY_DOCTOR") {
      const reason = parsed.data.cancellationReason ?? "Cancelación realizada por el médico.";
      const refundable = findRefundablePayment(appointment.payments);
      refundOutcome = await refundAppointmentPayment(tx, {
        payment: refundable,
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        reason
      });

      // Los pagos pendientes nunca se cobrarán: se marcan como fallidos.
      await tx.payment.updateMany({
        where: { appointmentId: appointment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED }
      });

      await tx.cancellationRequest.updateMany({
        where: { appointmentId: appointment.id, status: { in: ["pendiente", "reembolso_solicitado"] } },
        data: { status: "cancelada_por_medico" }
      });
      await tx.cancellationRequest.create({
        data: {
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          reason,
          status: refundOutcome.kind === "REFUNDED" ? "reembolso_aprobado" : "cancelada_por_medico"
        }
      });

      // El horario vuelve a estar disponible para otros pacientes.
      await tx.availabilitySlot.update({
        where: { id: appointment.availabilitySlotId },
        data: { isActive: true }
      });

      const refundNote = refundOutcomeMessage(refundOutcome);
      title = "Cita cancelada por el médico";
      patientMessage = `El médico canceló tu cita con ${appointment.doctor.fullName}. ${refundNote}`;
      doctorMessage = `Cancelaste la cita de ${appointment.patient.user.name}. ${refundNote}`;
      // Solo se avisa a administración cuando el dinero necesita revisión humana.
      notifyAdmin = refundOutcome.kind === "FAILED" || refundOutcome.kind === "PENDING";

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          // REFUNDED solo si Stripe confirmó. Un refund pendiente o fallido deja
          // la cita CANCELLED para no afirmar que el dinero ya se devolvió.
          status:
            refundOutcome.kind === "REFUNDED" || refundOutcome.kind === "ALREADY_REFUNDED"
              ? AppointmentStatus.REFUNDED
              : AppointmentStatus.CANCELLED,
          cancellationReason: reason,
          cancellationRequested: true,
          cancellationRequestedAt: new Date(),
          refundRequested: refundOutcome.kind !== "NOT_APPLICABLE",
          refundReason: refundOutcome.kind !== "NOT_APPLICABLE" ? reason : null,
          refundRequestedAt: refundOutcome.kind !== "NOT_APPLICABLE" ? new Date() : null,
          doctorRefundDecision:
            refundOutcome.kind === "REFUNDED" || refundOutcome.kind === "ALREADY_REFUNDED"
              ? "approved"
              : refundOutcome.kind === "NOT_APPLICABLE"
                ? null
                : "pending"
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
      const reason = parsed.data.cancellationReason ?? "Cancelación solicitada desde panel.";
      const policy = appointment.doctor.refundPolicy;

      // El médico declaró que no acepta devoluciones: la cancelación se cierra
      // de inmediato y sin reembolso. El paciente ya vio esta condición antes de
      // pagar y tuvo que confirmarla explícitamente en el cliente; aquí se
      // vuelve a aplicar la política desde el servidor, que es la fuente fiable.
      if (policy === RefundPolicy.NO_REFUNDS) {
        await tx.payment.updateMany({
          where: { appointmentId: appointment.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED }
        });
        await tx.cancellationRequest.create({
          data: {
            appointmentId: appointment.id,
            doctorId: appointment.doctorId,
            patientId: appointment.patientId,
            reason,
            status: "cancelada_sin_devolucion"
          }
        });
        await tx.availabilitySlot.update({
          where: { id: appointment.availabilitySlotId },
          data: { isActive: true }
        });

        title = "Cita cancelada";
        patientMessage = payment.hasPaidOnline
          ? `Tu cita con ${appointment.doctor.fullName} fue cancelada. Según la política de este médico, el pago no es reembolsable.`
          : `Tu cita con ${appointment.doctor.fullName} fue cancelada.`;
        doctorMessage = `${appointment.patient.user.name} canceló su cita. Tu política no acepta devoluciones, así que no hay reembolso pendiente.`;

        return tx.appointment.update({
          where: { id: appointment.id },
          data: {
            status: AppointmentStatus.CANCELLED,
            cancellationReason: reason,
            cancellationRequestedAt: new Date(),
            cancellationRequested: true,
            refundRequested: false,
            doctorRefundDecision: null
          },
          include: {
            patient: { include: { user: true } },
            doctor: { include: { user: { select: { id: true, email: true } }, specialty: true, hospital: true } },
            availabilitySlot: true,
            payments: true
          }
        });
      }

      // ACCEPTS_REFUNDS o CASE_BY_CASE: el médico resuelve la devolución. No se
      // reembolsa automáticamente porque el dinero sale de su cuenta conectada.
      const acceptsRefunds = policy === RefundPolicy.ACCEPTS_REFUNDS;
      title = "Solicitud de cancelación recibida";
      patientMessage = payment.hasPaidOnline
        ? acceptsRefunds
          ? `Solicitaste cancelar tu cita con ${appointment.doctor.fullName}. Este médico acepta devoluciones: procesará el reembolso conforme a sus políticas y al método de pago utilizado.`
          : `Solicitaste cancelar tu cita con ${appointment.doctor.fullName}. El médico o su equipo se pondrá en contacto contigo para continuar con la cancelación y la devolución.`
        : `Solicitaste cancelar tu cita con ${appointment.doctor.fullName}. No había pago en línea registrado.`;
      doctorMessage = `${appointment.patient.user.name} solicitó cancelar su cita. Puedes reagendar al horario más cercano o resolver la devolución.`;
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

      return tx.appointment.update({
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

      // Devolución idempotente: dos clics o un reintento por red no generan un
      // segundo reembolso del mismo pago.
      refundOutcome = await refundAppointmentPayment(tx, {
        payment: stripePayment,
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        reason
      });

      if (refundOutcome.kind === "FAILED") throw new Error(refundOutcome.message);

      const refundNote = refundOutcomeMessage(refundOutcome);
      patientMessage = `El médico aprobó la devolución de tu cita con ${appointment.doctor.fullName}. ${refundNote}`;
      doctorMessage = `Aprobaste la devolución de la cita de ${appointment.patient.user.name}. ${refundNote}`;
      notifyAdmin = refundOutcome.kind === "PENDING";

      // El horario se libera al aprobar la devolución.
      await tx.availabilitySlot.update({
        where: { id: appointment.availabilitySlotId },
        data: { isActive: true }
      });

      await tx.cancellationRequest.updateMany({
        where: { appointmentId: appointment.id, status: { in: ["pendiente", "reembolso_solicitado", "reembolso_pendiente"] } },
        data: { status: payment.hasPaidOnline ? "reembolso_aprobado" : "devolucion_fuera_de_plataforma" }
      });

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          // Solo REFUNDED cuando Stripe confirmó de verdad.
          status:
            refundOutcome.kind === "REFUNDED" || refundOutcome.kind === "ALREADY_REFUNDED"
              ? AppointmentStatus.REFUNDED
              : AppointmentStatus.CANCELLED,
          refundRequested: true,
          refundReason: reason,
          refundRequestedAt: appointment.refundRequestedAt ?? new Date(),
          doctorRefundDecision: refundOutcome.kind === "PENDING" ? "pending" : "approved",
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
      if (error.message === "SLOT_UNAVAILABLE") {
        return fail("SLOT_UNAVAILABLE", "Ese horario acaba de ser ocupado. Selecciona otra opción.", 409);
      }
      if (error.message === "NO_FUTURE_SLOTS") {
        // No es un error del sistema: el médico sencillamente no tiene agenda libre.
        return fail(
          "NO_FUTURE_SLOTS",
          "No hay horarios disponibles próximamente. Publica nueva disponibilidad o elige un horario manualmente.",
          409
        );
      }
      if (error.message === "MISSING_PAYMENT_INTENT") {
        return fail("PAYMENT_INTENT_REQUIRED", "No encontramos el pago en línea necesario para procesar devolución.", 409);
      }
      if (error.message === "STRIPE_REFUND_REJECTED") {
        return fail("STRIPE_REFUND_REJECTED", "Stripe rechazó la devolución. El equipo administrativo revisará el caso.", 502);
      }
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

  // ── Post-consult review invitation ────────────────────────────────────────
  // When a doctor marks a consultation COMPLETED, send the patient an email
  // inviting them to leave a verified review. Fire-and-forget (non-blocking).
  if (action === "COMPLETE") {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");
    const patientEmail = updated.patient.user.email;
    const isGhost = patientEmail.endsWith("@vitaeon.internal");

    if (!isGhost) {
      sendTransactionalEmail({
        to: patientEmail,
        subject: `¿Cómo estuvo tu consulta con ${updated.doctor.fullName}?`,
        text: `Tu cita con ${updated.doctor.fullName} fue marcada como completada. Si deseas, puedes dejar una opinión verificada sobre tu experiencia.`,
        html: emailShell(
          "¿Cómo estuvo tu consulta?",
          `<p>Hola <strong>${updated.patient.user.name}</strong>,</p>
          <p>Tu cita con <strong>${updated.doctor.fullName}</strong> (${updated.doctor.specialty.name}) acaba de ser registrada como completada.</p>
          <p>Tu opinión ayuda a otros pacientes a elegir con confianza. Solo toma un momento:</p>
          ${emailButton("Dejar mi opinión en VITAEON", `${appUrl}/dashboard/patient`)}`
        )
      }).catch((err) => console.error("[review-invite:email:failed]", err));
    }
  }

  return ok({ ...updated, reason: openSensitiveText(updated.reason) });
}
