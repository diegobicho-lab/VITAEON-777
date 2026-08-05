import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Fuente de verdad única para disponibilidad médica.
 *
 * Wizard de onboarding, agenda clínica del dashboard y el cálculo de slots que
 * ve el paciente consumen exclusivamente estas funciones. No debe existir una
 * segunda implementación de generación, validación o filtrado de horarios.
 *
 * Zona horaria: México suprimió el horario de verano en 2022, por lo que
 * America/Mexico_City es UTC-06:00 todo el año. El offset se declara una sola
 * vez aquí para que wizard, agenda y reservas interpreten las horas igual.
 */
export const CLINIC_TIME_ZONE = "America/Mexico_City";
export const CLINIC_UTC_OFFSET = "-06:00";

/** Cliente Prisma o cliente transaccional — permite reutilizar dentro de $transaction. */
export type PrismaLike = PrismaClient | Prisma.TransactionClient;

export type TimeRange = { startsAt: Date; endsAt: Date };

/** Clave de día natural (YYYY-MM-DD) en zona clínica, no en UTC del servidor. */
export function clinicDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

/**
 * Medianoche UTC del día natural clínico. Es el valor que se persiste en
 * `DoctorBlockedDate.date` (columna DATE) para que la comparación por día sea
 * exacta y no dependa de la hora del servidor.
 */
export function clinicDateOnly(date: Date): Date {
  return new Date(`${clinicDateKey(date)}T00:00:00.000Z`);
}

/** Combina un día natural clínico con una hora "HH:mm" en un instante absoluto. */
export function combineClinicDateAndTime(date: Date, time: string): Date {
  return new Date(`${clinicDateKey(date)}T${time}:00${CLINIC_UTC_OFFSET}`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Dos rangos se solapan si se cruzan en cualquier punto (extremos abiertos). */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

/** Detecta solapamientos dentro de un mismo conjunto de rangos. */
export function hasInternalOverlap(ranges: TimeRange[]): boolean {
  const sorted = [...ranges].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].startsAt < sorted[index - 1].endsAt) return true;
  }
  return false;
}

/**
 * Divide una franja horaria en slots consecutivos de `durationMinutes`.
 * Descarta los que ya pasaron: no tiene sentido publicar disponibilidad vencida.
 */
export function buildSlotsForDay(options: {
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  now?: Date;
}): TimeRange[] {
  const { date, startTime, endTime, durationMinutes, now = new Date() } = options;
  const dayStart = combineClinicDateAndTime(date, startTime);
  const dayEnd = combineClinicDateAndTime(date, endTime);
  const slots: TimeRange[] = [];

  for (
    let cursor = dayStart;
    addMinutes(cursor, durationMinutes) <= dayEnd;
    cursor = addMinutes(cursor, durationMinutes)
  ) {
    const endsAt = addMinutes(cursor, durationMinutes);
    if (cursor > now) slots.push({ startsAt: cursor, endsAt });
  }

  return slots;
}

/** Días bloqueados del médico como set de claves YYYY-MM-DD. */
export async function getBlockedDateKeys(
  db: PrismaLike,
  doctorId: string,
  range?: { from?: Date; to?: Date }
): Promise<Set<string>> {
  const blocked = await db.doctorBlockedDate.findMany({
    where: {
      doctorId,
      ...(range?.from || range?.to
        ? {
            date: {
              ...(range.from ? { gte: clinicDateOnly(range.from) } : {}),
              ...(range.to ? { lte: clinicDateOnly(range.to) } : {})
            }
          }
        : {})
    },
    select: { date: true }
  });

  return new Set(blocked.map((entry) => entry.date.toISOString().slice(0, 10)));
}

/** True si la fecha cae en un día que el médico marcó como no disponible. */
export async function isDateBlocked(db: PrismaLike, doctorId: string, date: Date): Promise<boolean> {
  const existing = await db.doctorBlockedDate.findUnique({
    where: { doctorId_date: { doctorId, date: clinicDateOnly(date) } },
    select: { id: true }
  });
  return Boolean(existing);
}

/**
 * Slots realmente reservables por un paciente.
 *
 * Único cálculo autorizado para exponer disponibilidad: aplica activos, sin
 * cita previa, futuros y no bloqueados. El frontend nunca debe recalcular esto
 * por su cuenta ni limitarse a ocultar horarios visualmente.
 */
export async function getBookableSlots(
  db: PrismaLike,
  doctorId: string,
  options?: { from?: Date; to?: Date; take?: number }
) {
  const from = options?.from ?? new Date();

  const slots = await db.availabilitySlot.findMany({
    where: {
      doctorId,
      isActive: true,
      appointment: null,
      startsAt: { gte: from, ...(options?.to ? { lte: options.to } : {}) }
    },
    orderBy: { startsAt: "asc" },
    ...(options?.take ? { take: options.take } : {})
  });

  if (slots.length === 0) return slots;

  const blockedKeys = await getBlockedDateKeys(db, doctorId, {
    from: slots[0].startsAt,
    to: slots[slots.length - 1].startsAt
  });

  if (blockedKeys.size === 0) return slots;
  return slots.filter((slot) => !blockedKeys.has(clinicDateKey(slot.startsAt)));
}

/**
 * Filtra por lotes los slots que caen en días bloqueados, para listados que ya
 * trajeron varios médicos con su disponibilidad incluida. Una sola consulta
 * adicional para todo el lote, en lugar de una por médico.
 *
 * Es el mismo criterio que aplica `getBookableSlots`, de modo que el listado
 * público y el detalle del médico nunca puedan discrepar.
 */
export async function stripBlockedDateSlots<
  TSlot extends { startsAt: Date },
  TDoctor extends { id: string; availabilitySlots: TSlot[] }
>(db: PrismaLike, doctors: TDoctor[]): Promise<TDoctor[]> {
  const doctorIds = doctors.filter((doctor) => doctor.availabilitySlots.length > 0).map((doctor) => doctor.id);
  if (doctorIds.length === 0) return doctors;

  const blocked = await db.doctorBlockedDate.findMany({
    where: { doctorId: { in: doctorIds }, date: { gte: clinicDateOnly(new Date()) } },
    select: { doctorId: true, date: true }
  });
  if (blocked.length === 0) return doctors;

  const blockedByDoctor = new Map<string, Set<string>>();
  for (const entry of blocked) {
    const key = entry.date.toISOString().slice(0, 10);
    const set = blockedByDoctor.get(entry.doctorId) ?? new Set<string>();
    set.add(key);
    blockedByDoctor.set(entry.doctorId, set);
  }

  return doctors.map((doctor) => {
    const blockedKeys = blockedByDoctor.get(doctor.id);
    if (!blockedKeys) return doctor;
    return {
      ...doctor,
      availabilitySlots: doctor.availabilitySlots.filter((slot) => !blockedKeys.has(clinicDateKey(slot.startsAt)))
    };
  });
}

export type BlockDatePreview = {
  freeSlots: number;
  bookedSlots: number;
  activeAppointments: Array<{ id: string; startsAt: Date; status: string; patientName: string | null }>;
};

/**
 * Qué se vería afectado al bloquear una fecha. Se usa para advertir al médico
 * ANTES de confirmar: nunca se cancelan citas de forma silenciosa.
 */
export async function previewBlockDate(
  db: PrismaLike,
  doctorId: string,
  date: Date
): Promise<BlockDatePreview> {
  const dayStart = combineClinicDateAndTime(date, "00:00");
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const slots = await db.availabilitySlot.findMany({
    where: { doctorId, startsAt: { gte: dayStart, lt: dayEnd } },
    include: {
      appointment: {
        include: { patient: { include: { user: { select: { name: true } } } } }
      }
    },
    orderBy: { startsAt: "asc" }
  });

  const cancelledStatuses = new Set(["CANCELLED", "AUTO_CANCELLED", "REFUNDED", "NO_SHOW", "COMPLETED"]);
  const activeAppointments = slots
    .filter((slot) => slot.appointment && !cancelledStatuses.has(slot.appointment.status))
    .map((slot) => ({
      id: slot.appointment!.id,
      startsAt: slot.startsAt,
      status: slot.appointment!.status as string,
      patientName: slot.appointment!.patient?.user?.name ?? null
    }));

  return {
    freeSlots: slots.filter((slot) => !slot.appointment).length,
    bookedSlots: slots.filter((slot) => Boolean(slot.appointment)).length,
    activeAppointments
  };
}
