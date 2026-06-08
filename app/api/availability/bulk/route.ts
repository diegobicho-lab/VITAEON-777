import { randomUUID } from "crypto";
import { MedicalMedal } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { availabilityBulkSchema } from "@/lib/validation/schemas";

function combineDateAndTime(date: Date, time: string) {
  return new Date(`${uniqueDateKey(date)}T${time}:00-06:00`);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function uniqueDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

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
    const today = new Date();
    const end = new Date(today);
    end.setMonth(end.getMonth() + 1);
    for (let current = new Date(today); current <= end; current.setDate(current.getDate() + 1)) {
      if (parsed.data.repeatWeekdays.includes(current.getDay())) {
        dates.set(uniqueDateKey(current), new Date(current));
      }
    }
  }

  const now = new Date();
  const requestedRows = Array.from(dates.values()).flatMap((date) => {
    const dayStart = combineDateAndTime(date, parsed.data.startTime);
    const dayEnd = combineDateAndTime(date, parsed.data.endTime);
    const slots: Array<{
      doctorId: string;
      startsAt: Date;
      endsAt: Date;
      isActive: boolean;
      repeatBatchId?: string | null;
      generatedByMonthlyRepeat?: boolean;
      repeatLabel?: string | null;
    }> = [];

    for (let cursor = dayStart; addMinutes(cursor, parsed.data.durationMinutes) <= dayEnd; cursor = addMinutes(cursor, parsed.data.durationMinutes)) {
      const endsAt = addMinutes(cursor, parsed.data.durationMinutes);
      if (cursor > now && endsAt > cursor) {
        slots.push({
          doctorId: doctor.id,
          startsAt: cursor,
          endsAt,
          isActive: true,
          repeatBatchId,
          generatedByMonthlyRepeat: isMonthlyRepeat,
          repeatLabel
        });
      }
    }

    return slots;
  });

  if (requestedRows.length === 0) {
    return fail("NO_VALID_SLOTS", "No hay horarios futuros válidos para publicar.", 422);
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

  const rows = requestedRows.filter((slot) => {
    return !existingSlots.some((existing) => overlaps(slot.startsAt, slot.endsAt, existing.startsAt, existing.endsAt));
  });

  if (rows.length === 0) {
    return fail("NO_AVAILABLE_SLOTS", "Todos los horarios generados chocan con disponibilidad o citas existentes.", 409);
  }

  const result = await prisma.availabilitySlot.createMany({
    data: rows,
    skipDuplicates: true
  });

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_BULK_AVAILABILITY",
    entityType: "AvailabilitySlot",
    metadata: {
      requested: requestedRows.length,
      created: result.count,
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
      requested: requestedRows.length,
      skipped: requestedRows.length - rows.length,
      durationMinutes: parsed.data.durationMinutes,
      repeatBatchId
    },
    { status: 201 }
  );
}
