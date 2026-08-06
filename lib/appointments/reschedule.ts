import { clinicDateKey, getBlockedDateKeys, type PrismaLike } from "@/lib/availability/availability";

/**
 * Busca el horario futuro más cercano realmente reservable con ese médico.
 *
 * Aplica el mismo criterio que ve el paciente: activo, sin cita asignada,
 * futuro y fuera de los días que el médico marcó como no disponibles. Antes
 * ignoraba los días bloqueados, así que un reagendamiento automático podía
 * caer justo en una fecha que el médico había cerrado.
 *
 * Devuelve null cuando no hay ningún hueco: quien llama debe tratarlo como un
 * caso normal, no como un error técnico.
 */
export async function findNextAvailableSlot(tx: PrismaLike, doctorId: string, fromDate = new Date()) {
  // Se recorre en páginas para no cargar toda la agenda en memoria cuando el
  // médico tiene muchos días bloqueados consecutivos.
  const PAGE_SIZE = 50;
  const MAX_PAGES = 6;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const candidates = await tx.availabilitySlot.findMany({
      where: {
        doctorId,
        isActive: true,
        startsAt: { gte: fromDate },
        appointment: null
      },
      orderBy: { startsAt: "asc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE
    });

    if (candidates.length === 0) return null;

    const blockedKeys = await getBlockedDateKeys(tx, doctorId, {
      from: candidates[0].startsAt,
      to: candidates[candidates.length - 1].startsAt
    });

    const usable = candidates.find((slot) => !blockedKeys.has(clinicDateKey(slot.startsAt)));
    if (usable) return usable;

    if (candidates.length < PAGE_SIZE) return null;
  }

  return null;
}

/**
 * Lista los próximos horarios reservables, para ofrecer alternativas cuando el
 * paciente pide reagendar en lugar de cancelar.
 */
export async function findUpcomingAvailableSlots(
  tx: PrismaLike,
  doctorId: string,
  options?: { fromDate?: Date; take?: number }
) {
  const fromDate = options?.fromDate ?? new Date();
  const take = options?.take ?? 8;

  const candidates = await tx.availabilitySlot.findMany({
    where: {
      doctorId,
      isActive: true,
      startsAt: { gte: fromDate },
      appointment: null
    },
    orderBy: { startsAt: "asc" },
    take: take * 4 // margen para descartar días bloqueados sin repetir consulta
  });

  if (candidates.length === 0) return [];

  const blockedKeys = await getBlockedDateKeys(tx, doctorId, {
    from: candidates[0].startsAt,
    to: candidates[candidates.length - 1].startsAt
  });

  return candidates.filter((slot) => !blockedKeys.has(clinicDateKey(slot.startsAt))).slice(0, take);
}
