import { describe, expect, it } from "vitest";
import {
  addMinutes,
  buildSlotsForDay,
  clinicDateKey,
  combineClinicDateAndTime,
  hasInternalOverlap,
  rangesOverlap
} from "@/lib/availability/availability";

describe("fuente de verdad de disponibilidad", () => {
  it("interpreta el día natural en zona clínica, no en UTC del servidor", () => {
    // 2026-08-10 05:00 UTC son las 23:00 del 9 de agosto en México:
    // el día clínico debe ser el 9, no el 10.
    expect(clinicDateKey(new Date("2026-08-10T05:00:00.000Z"))).toBe("2026-08-09");
  });

  it("combina fecha y hora usando el offset de la zona clínica", () => {
    const instant = combineClinicDateAndTime(new Date("2026-08-10T12:00:00.000Z"), "09:00");
    expect(instant.toISOString()).toBe("2026-08-10T15:00:00.000Z"); // 09:00 -06:00
  });

  it("divide una franja en slots consecutivos de la duración indicada", () => {
    const slots = buildSlotsForDay({
      date: new Date("2027-03-15T12:00:00.000Z"),
      startTime: "09:00",
      endTime: "11:00",
      durationMinutes: 45,
      now: new Date("2027-01-01T00:00:00.000Z")
    });
    // 09:00-09:45, 09:45-10:30 — 10:30-11:15 excede el fin, se descarta.
    expect(slots).toHaveLength(2);
    expect(slots[0].endsAt.getTime() - slots[0].startsAt.getTime()).toBe(45 * 60_000);
  });

  it("descarta horarios que ya pasaron", () => {
    const slots = buildSlotsForDay({
      date: new Date("2020-01-15T12:00:00.000Z"),
      startTime: "09:00",
      endTime: "11:00",
      durationMinutes: 45,
      now: new Date()
    });
    expect(slots).toHaveLength(0);
  });

  it("no genera slots cuando el fin es anterior al inicio", () => {
    const slots = buildSlotsForDay({
      date: new Date("2027-03-15T12:00:00.000Z"),
      startTime: "14:00",
      endTime: "09:00",
      durationMinutes: 45,
      now: new Date("2027-01-01T00:00:00.000Z")
    });
    expect(slots).toHaveLength(0);
  });

  it("detecta rangos solapados y trata los extremos como abiertos", () => {
    const base = { startsAt: new Date("2027-03-15T15:00:00Z"), endsAt: new Date("2027-03-15T15:45:00Z") };
    expect(rangesOverlap(base, { startsAt: new Date("2027-03-15T15:30:00Z"), endsAt: new Date("2027-03-15T16:15:00Z") })).toBe(true);
    // Contiguos, no solapados: el fin de uno es el inicio del otro.
    expect(rangesOverlap(base, { startsAt: new Date("2027-03-15T15:45:00Z"), endsAt: new Date("2027-03-15T16:30:00Z") })).toBe(false);
  });

  it("detecta solapamientos dentro de un mismo conjunto", () => {
    const start = new Date("2027-03-15T15:00:00Z");
    expect(
      hasInternalOverlap([
        { startsAt: start, endsAt: addMinutes(start, 45) },
        { startsAt: addMinutes(start, 30), endsAt: addMinutes(start, 75) }
      ])
    ).toBe(true);

    expect(
      hasInternalOverlap([
        { startsAt: start, endsAt: addMinutes(start, 45) },
        { startsAt: addMinutes(start, 45), endsAt: addMinutes(start, 90) }
      ])
    ).toBe(false);
  });
});
