import { describe, expect, it } from "vitest";
import { clinicDayKey, clinicDayStart, formatClinicDateTime, formatClinicTime } from "@/lib/clinic-time";

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

describe("inicio del día clínico", () => {
  // `?scope=upcoming` filtra desde el inicio del día clínico, no desde "ahora":
  // una cita de las 09:00 sigue siendo la de hoy a las 09:30 y el médico
  // necesita verla.
  it("no deja fuera una cita que ya empezó hoy", () => {
    const cita = new Date("2026-11-13T15:00:00.000Z"); // 09:00 en México
    const ahora = new Date("2026-11-13T15:30:00.000Z"); // 09:30 en México
    expect(cita.getTime()).toBeGreaterThanOrEqual(clinicDayStart(ahora).getTime());
    expect(cita.getTime()).toBeLessThan(ahora.getTime());
  });

  // El fallo que esto evita: con la medianoche UTC, a las 18:00 de México ya es
  // el día siguiente en UTC, así que toda la tarde quedaría fuera de "hoy".
  it("ancla la medianoche a la zona del consultorio, no a UTC", () => {
    const tardeEnMexico = new Date("2026-11-13T23:00:00.000Z"); // 17:00 en México
    expect(clinicDayKey(clinicDayStart(tardeEnMexico))).toBe("2026-11-13");
    expect(clinicDayStart(tardeEnMexico).toISOString()).toBe("2026-11-13T06:00:00.000Z");
  });
});

describe("ventana de agenda de la secretaría", () => {
  // Antes esto replicaba la lógica del route; una copia en el test no detecta una
  // regresión en el código real. Ahora `clinicDayStart` se importa de la librería
  // que usan tanto el portal de secretaría como `?scope=upcoming`.
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

  // El bug original: `new Date().setHours(0,0,0,0)` usa la hora local del
  // proceso, que en Vercel es UTC. "Hoy" iba de las 18:00 de ayer a las 17:59
  // de hoy en México, así que las citas de la tarde salían de la ventana.
  it("incluye las citas de la tarde que la medianoche UTC dejaba fuera", () => {
    // 9 de noviembre de 2026, 20:00 en México (= 10 de noviembre 02:00 UTC).
    const citaDeNoche = new Date("2026-11-10T02:00:00.000Z");
    // El servidor corre a las 10:00 de México de ese mismo 9 de noviembre.
    const ahora = new Date("2026-11-09T16:00:00.000Z");

    const inicio = clinicDayStart(ahora);
    const fin = addDays(inicio, 7);

    expect(clinicDayKey(citaDeNoche)).toBe("2026-11-09");
    expect(citaDeNoche >= inicio && citaDeNoche <= fin).toBe(true);

    // Cómo se comportaba antes: fin del día según UTC.
    const finUtc = new Date("2026-11-09T23:59:59.999Z");
    expect(citaDeNoche <= finUtc).toBe(false);
  });

  it("abarca los próximos 7 días, no solo hoy", () => {
    const ahora = new Date("2026-11-09T16:00:00.000Z");
    const inicio = clinicDayStart(ahora);
    const fin = addDays(inicio, 7);

    const enSeisDias = new Date("2026-11-15T20:00:00.000Z");
    const enNueveDias = new Date("2026-11-18T20:00:00.000Z");

    expect(enSeisDias <= fin).toBe(true);
    expect(enNueveDias <= fin).toBe(false);
  });

  it("agrupa por día del consultorio, no por día UTC", () => {
    // Dos citas del mismo 9 de noviembre en México, pero una cae en el 10 UTC.
    const tarde = new Date("2026-11-09T22:00:00.000Z"); // 16:00 México
    const noche = new Date("2026-11-10T02:00:00.000Z"); // 20:00 México

    expect(clinicDayKey(tarde)).toBe(clinicDayKey(noche));
    expect(tarde.toISOString().slice(0, 10)).not.toBe(noche.toISOString().slice(0, 10));
  });
});
