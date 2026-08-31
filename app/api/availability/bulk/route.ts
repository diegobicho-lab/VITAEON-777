import { randomUUID } from "crypto";
import { MedicalMedal } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildSlotsForDay,
  civilDateKey,
  clinicTodayCivil,
  getBlockedDateKeys,
  rangesOverlap
} from "@/lib/availability/availability";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { availabilityBulkSchema } from "@/lib/validation/schemas";

// Generación de slots, zona horaria y detección de solapamientos viven en
// lib/availability: wizard, agenda y reservas comparten exactamente esta lógica.
//
// Las fechas que llegan aquí son SOLO FECHA ("2026-08-10"), no instantes, por lo
// que su día natural se lee con `civilDateKey`. Usar la clave en zona clínica
// las retrocedía un día y publicaba horarios en fechas nunca seleccionadas.
const uniqueDateKey = civilDateKey;

export async function POST(request: Request) {
  const limit = await rateLimitByIp("availability:bulk", { limit: 12, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados cambios de calendario. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden modificar su calendario.", 403);

  const body = await request.json().catch(() => null);
  const parsed = availabilityBulkSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Bloque de disponibilidad inválido.", 422, parsed.error.flatten());

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);

  const dates = new Map<string, Date>();
  if (parsed.data.date) dates.set(uniqueDateKey(parsed.data.date), parsed.data.date);
  for (const date of parsed.data.dates ?? []) dates.set(uniqueDateKey(date), date);

  const isMonthlyRepeat = Boolean(parsed.data.repeatWeekdays?.length);
  const repeatBatchId = isMonthlyRepeat ? randomUUID() : null;
  const repeatLabel = isMonthlyRepeat ? "Disponibilidad repetida del próximo mes" : null;

  if (parsed.data.repeatWeekdays?.length) {
    // Se recorre en días civiles anclados a medianoche UTC y se lee el día de
    // la semana con getUTCDay(). Con getDay() sobre `new Date()` el servidor
    // (UTC en Vercel) podía adelantarse un día respecto a México entre las
    // 00:00 y las 06:00 UTC y repetir el weekday equivocado.
    const cursor = clinicTodayCivil();
    const end = new Date(cursor);
    end.setUTCMonth(end.getUTCMonth() + 1);

    while (cursor <= end) {
      if (parsed.data.repeatWeekdays.includes(cursor.getUTCDay())) {
        dates.set(uniqueDateKey(cursor), new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const now = new Date();

  // Un día bloqueado no vuelve a generar disponibilidad: si no se filtrara aquí,
  // la disponibilidad recurrente repoblaría fechas que el médico cerró a propósito.
  const blockedKeys = await getBlockedDateKeys(prisma, doctor.id);
  // `blockedKeys` guarda días civiles, así que se compara con la clave civil.
  const requestedDates = Array.from(dates.values()).filter((date) => !blockedKeys.has(civilDateKey(date)));
  const blockedSkipped = dates.size - requestedDates.length;

  const requestedRows = requestedDates.flatMap((date) =>
    buildSlotsForDay({
      date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      durationMinutes: parsed.data.durationMinutes,
      now
    }).map((slot) => ({
      doctorId: doctor.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      isActive: true,
      repeatBatchId,
      generatedByMonthlyRepeat: isMonthlyRepeat,
      repeatLabel
    }))
  );

  if (requestedRows.length === 0) {
    return fail(
      "NO_VALID_SLOTS",
      blockedSkipped > 0
        ? "Las fechas seleccionadas están marcadas como no disponibles. Habilítalas primero para publicar horarios."
        : "No hay horarios futuros válidos para publicar.",
      422
    );
  }

  const minStart = requestedRows.reduce((min, slot) => (slot.startsAt < min ? slot.startsAt : min), requestedRows[0].startsAt);
  const maxEnd = requestedRows.reduce((max, slot) => (slot.endsAt > max ? slot.endsAt : max), requestedRows[0].endsAt);
  const existingSlots = await prisma.availabilitySlot.findMany({
    where: {
      doctorId: doctor.id,
      startsAt: { lt: maxEnd },
      endsAt: { gt: minStart },
      OR: [{ appointment: { isNot: null } }, { isActive: true }]
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      appointment: { select: { id: true } }
    }
  });

  const rows = requestedRows.filter(
    (slot) => !existingSlots.some((existing) => rangesOverlap(slot, existing))
  );

  /**
   * Horarios que ya existen en esas mismas horas pero están desactivados.
   *
   * Publicar disponibilidad sobre una fecha que el médico había ocultado no
   * hacía nada: la comprobación de solapamiento ignora los inactivos, así que
   * se intentaban crear de nuevo y la restricción única `(doctorId, startsAt)`
   * los descartaba en silencio con `skipDuplicates`. El médico veía "0 de N
   * publicados" sin saber por qué. Publicar una franja significa ponerla a
   * disposición del paciente, así que se reactivan.
   *
   * Solo se tocan los que no tienen cita: una cita reservada nunca se altera.
   */
  const reactivatable = await prisma.availabilitySlot.findMany({
    where: {
      doctorId: doctor.id,
      isActive: false,
      appointment: { is: null },
      startsAt: { in: requestedRows.map((slot) => slot.startsAt) }
    },
    select: { id: true }
  });

  const reactivated = reactivatable.length
    ? await prisma.availabilitySlot.updateMany({
        where: { id: { in: reactivatable.map((slot) => slot.id) } },
        data: { isActive: true }
      })
    : { count: 0 };

  if (rows.length === 0 && reactivated.count === 0) {
    return fail("NO_AVAILABLE_SLOTS", "Todos los horarios generados chocan con disponibilidad o citas existentes.", 409);
  }

  const result = rows.length
    ? await prisma.availabilitySlot.createMany({ data: rows, skipDuplicates: true })
    : { count: 0 };

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_BULK_AVAILABILITY",
    entityType: "AvailabilitySlot",
    metadata: {
      requested: requestedRows.length,
      created: result.count,
      reactivated: reactivated.count,
      skipped: requestedRows.length - rows.length,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      durationMinutes: parsed.data.durationMinutes,
      repeatBatchId
    }
  });

  return ok(
    {
      created: result.count,
      reactivated: reactivated.count,
      requested: requestedRows.length,
      skipped: requestedRows.length - rows.length,
      blockedDatesSkipped: blockedSkipped,
      durationMinutes: parsed.data.durationMinutes,
      repeatBatchId
    },
    { status: 201 }
  );
}
