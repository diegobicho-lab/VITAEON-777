import { MedicalMedal } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { CLINIC_TIME_ZONE } from "@/lib/availability/availability";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { weekdayClearSchema } from "@/lib/validation/schemas";

const WEEKDAY_LABELS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Día de la semana (0=domingo) en zona clínica, no en UTC del servidor. */
function clinicWeekday(date: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "short"
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(formatted);
}

const ACTIVE_APPOINTMENT_STATUSES = ["CANCELLED", "AUTO_CANCELLED", "REFUNDED", "NO_SHOW", "COMPLETED"];

/**
 * GET → disponibilidad futura agrupada por día de la semana.
 *
 * Es la vista que consume el panel "día por día": cada día se gestiona de forma
 * independiente sin arrastrar cambios a los demás.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver tu agenda.", 401);
  if (user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden ver su horario.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) {
    return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);
  }

  const slots = await prisma.availabilitySlot.findMany({
    where: { doctorId: doctor.id, startsAt: { gte: new Date() } },
    include: { appointment: { select: { id: true, status: true } } },
    orderBy: { startsAt: "asc" }
  });

  const byWeekday = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    slots: [] as Array<{ id: string; startsAt: Date; endsAt: Date; isActive: boolean; hasAppointment: boolean }>,
    bookedCount: 0
  }));

  for (const slot of slots) {
    const day = byWeekday[clinicWeekday(slot.startsAt)];
    const hasActiveAppointment = Boolean(
      slot.appointment && !ACTIVE_APPOINTMENT_STATUSES.includes(slot.appointment.status)
    );
    day.slots.push({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      isActive: slot.isActive,
      hasAppointment: hasActiveAppointment
    });
    if (hasActiveAppointment) day.bookedCount += 1;
  }

  return ok(byWeekday);
}

/**
 * DELETE → elimina la disponibilidad futura de UN día de la semana.
 *
 * Sin `confirm: true` devuelve solo la vista previa del impacto. Las citas ya
 * reservadas bloquean la operación: no se dejan citas huérfanas ni se cancela
 * nada en silencio; el médico debe reagendarlas o cancelarlas primero.
 */
export async function DELETE(request: Request) {
  const limit = await rateLimitByIp("availability:clear-weekday", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados cambios de calendario. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para modificar tu agenda.", 401);
  if (user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden modificar su horario.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) {
    return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = weekdayClearSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Selecciona un día válido.", 422, parsed.error.flatten());

  const { weekday, confirm } = parsed.data;
  const label = WEEKDAY_LABELS[weekday];

  const futureSlots = await prisma.availabilitySlot.findMany({
    where: { doctorId: doctor.id, startsAt: { gte: new Date() } },
    include: { appointment: { select: { id: true, status: true } } }
  });

  // El filtro por día de la semana se hace en memoria porque PostgreSQL
  // evaluaría EXTRACT(DOW) en UTC y desplazaría los horarios nocturnos de día.
  const targetSlots = futureSlots.filter((slot) => clinicWeekday(slot.startsAt) === weekday);
  const booked = targetSlots.filter(
    (slot) => slot.appointment && !ACTIVE_APPOINTMENT_STATUSES.includes(slot.appointment.status)
  );
  const deletable = targetSlots.filter((slot) => !slot.appointment);

  if (!confirm) {
    return ok({
      preview: true,
      weekday,
      label,
      deletableCount: deletable.length,
      bookedCount: booked.length,
      bookedAppointments: booked.map((slot) => ({
        id: slot.appointment!.id,
        startsAt: slot.startsAt,
        status: slot.appointment!.status
      }))
    });
  }

  if (booked.length > 0) {
    return fail(
      "WEEKDAY_HAS_APPOINTMENTS",
      `No puedes eliminar este horario sin gestionar primero las citas existentes. Hay ${booked.length} cita(s) reservada(s) los ${label}.`,
      409,
      { bookedCount: booked.length }
    );
  }

  if (deletable.length === 0) {
    return ok({ deleted: 0, weekday, label, message: `No hay horarios futuros configurados los ${label}.` });
  }

  const result = await prisma.availabilitySlot.deleteMany({
    where: { id: { in: deletable.map((slot) => slot.id) }, doctorId: doctor.id, appointment: { is: null } }
  });

  await auditLog({
    actorUserId: user.id,
    action: "CLEAR_WEEKDAY_AVAILABILITY",
    entityType: "AvailabilitySlot",
    metadata: { weekday, label, deleted: result.count }
  });

  return ok({ deleted: result.count, weekday, label });
}
