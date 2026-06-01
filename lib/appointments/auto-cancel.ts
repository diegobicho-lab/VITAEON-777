import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const AUTO_CANCEL_REASON = "Cita cancelada automáticamente por vencimiento sin confirmación o asistencia";

const cancellableExpiredStatuses = [
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_DOCTOR_ACCEPTANCE,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.NO_SHOW
];

export async function autoCancelExpiredAppointments(now = new Date()) {
  return prisma.appointment.updateMany({
    where: {
      status: { in: cancellableExpiredStatuses },
      availabilitySlot: { endsAt: { lt: now } },
      clinicalHistory: null,
      completedAt: null,
      refundRequested: false,
      reschedulePreferred: false
    },
    data: {
      status: AppointmentStatus.AUTO_CANCELLED,
      autoCancelledAt: now,
      autoCancellationReason: AUTO_CANCEL_REASON,
      cancellationReason: AUTO_CANCEL_REASON
    }
  });
}
