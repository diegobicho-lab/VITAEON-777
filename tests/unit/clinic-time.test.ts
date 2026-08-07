import { describe, expect, it } from "vitest";
import { clinicDayKey, formatClinicDateTime, formatClinicTime } from "@/lib/clinic-time";

describe("hora del consultorio", () => {
  // El backend genera los slots anclados a -06:00. Si la interfaz los mostrara
  // en la zona del dispositivo, un médico con el equipo en UTC veria su agenda
  // de 09:00-13:00 como 15:00-19:00.
  it("muestra la hora del consultorio, no la del dispositivo", () => {
    const nineAmMexico = new Date("2026-08-09T15:00:00.000Z");
    expect(formatClinicTime(nineAmMexico)).toContain("9:00");
    expect(formatClinicTime(nineAmMexico).toLowerCase()).toContain("a.m.");
  });

  it("formatea fecha y hora completas en zona del consultorio", () => {
    const noonMexico = new Date("2026-08-09T18:00:00.000Z");
    const formatted = formatClinicDateTime(noonMexico);
    expect(formatted).toContain("9"); // día 9
    expect(formatted).toContain("12:00");
  });

  // Regresión: agrupar por UTC mandaba los horarios de la tarde al día
  // siguiente del calendario, y el médico veía "días extra".
  it("agrupa los horarios de la tarde en el día correcto", () => {
    // 18:00 en México = 00:00 UTC del día siguiente.
    const sixPmMexico = new Date("2026-08-10T00:00:00.000Z");
    expect(sixPmMexico.toISOString().slice(0, 10)).toBe("2026-08-10"); // lo que hacía antes
    expect(clinicDayKey(sixPmMexico)).toBe("2026-08-09"); // el día real de consultorio
  });

  it("mantiene el día correcto para horarios de la mañana", () => {
    const nineAmMexico = new Date("2026-08-09T15:00:00.000Z");
    expect(clinicDayKey(nineAmMexico)).toBe("2026-08-09");
  });

  it("cubre el rango completo de una jornada sin cambiar de día", () => {
    // 09:00 a 19:00 hora de México, todas deben caer en el mismo día natural.
    const hours = [15, 16, 17, 18, 19, 20, 21, 22, 23];
    for (const utcHour of hours) {
      const instant = new Date(`2026-08-09T${String(utcHour).padStart(2, "0")}:00:00.000Z`);
      expect(clinicDayKey(instant)).toBe("2026-08-09");
    }
  });
});
