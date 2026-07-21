import "server-only";
import { prisma } from "@/lib/db/prisma";
import { openSensitiveText } from "@/lib/security/crypto";

/** Roles allowed to list ALL appointments (no patient/doctor filter). */
const PRIVILEGED_ROLES = new Set(["ADMIN", "STAFF", "ASSISTANT"]);

export async function listAppointmentsForUser(user: { id: string; role: string }) {
  if (!PRIVILEGED_ROLES.has(user.role) && user.role !== "PATIENT" && user.role !== "DOCTOR") {
    // Unexpected role — fail closed to prevent accidental full-table scans.
    throw new Error(`listAppointmentsForUser: unexpected role "${user.role}"`);
  }

  const appointments = await prisma.appointment.findMany({
    where:
      user.role === "PATIENT"
        ? { patient: { userId: user.id } }
        : user.role === "DOCTOR"
          ? { doctor: { userId: user.id } }
          : {}, // ADMIN / STAFF / ASSISTANT — intentionally returns all appointments
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
