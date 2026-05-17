import "server-only";
import { prisma } from "@/lib/db/prisma";
import { openSensitiveText } from "@/lib/security/crypto";

export async function listAppointmentsForUser(user: { id: string; role: string }) {
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

  return appointments.map((appointment) => ({
    ...appointment,
    reason: openSensitiveText(appointment.reason)
  }));
}
