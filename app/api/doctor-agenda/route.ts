import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { openSensitiveText } from "@/lib/security/crypto";

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden ver esta agenda.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, include: { specialty: true } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);

  const now = new Date();
  const monthParam = requestUrl.searchParams.get("month");
  const monthStart = monthParam ? new Date(`${monthParam}-01T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const startsAt = new Date(monthStart);
  startsAt.setDate(startsAt.getDate() - startsAt.getDay());
  const horizon = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
  horizon.setDate(horizon.getDate() + (6 - horizon.getDay()));

  const slots = await prisma.availabilitySlot.findMany({
    where: { doctorId: doctor.id, startsAt: { gte: startsAt, lte: horizon } },
    include: {
      appointment: {
        include: {
          patient: { include: { user: { select: { name: true, email: true } } } },
          payments: true
        }
      }
    },
    orderBy: { startsAt: "asc" }
  });

  const days = new Map<string, Array<(typeof slots)[number]>>();
  for (const slot of slots) {
    const key = dayKey(slot.startsAt);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }

  return ok({
    doctorId: doctor.id,
    summary: {
      totalSlots: slots.length,
      booked: slots.filter((slot) => slot.appointment).length,
      available: slots.filter((slot) => !slot.appointment && slot.isActive).length
    },
    days: Array.from(days.entries()).map(([date, daySlots]) => ({
      date,
      total: daySlots.length,
      booked: daySlots.filter((slot) => slot.appointment).length,
      available: daySlots.filter((slot) => !slot.appointment && slot.isActive).length,
      slots: daySlots.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        isActive: slot.isActive,
        appointment: slot.appointment
          ? {
              id: slot.appointment.id,
              status: slot.appointment.status,
              reason: openSensitiveText(slot.appointment.reason),
              patientName: slot.appointment.patient.user.name,
              patientEmail: slot.appointment.patient.user.email,
              specialty: doctor.specialty.name,
              paymentStatus: slot.appointment.payments[0]?.status ?? "PENDING",
              paymentProvider: slot.appointment.payments[0]?.provider ?? "CASH"
            }
          : null
      }))
    }))
  });
}
