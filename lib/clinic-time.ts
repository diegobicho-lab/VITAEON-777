/**
 * Zona horaria clínica de VITAEON.
 *
 * Sin `server-only`: la comparten el backend (generación de slots) y el
 * frontend (renderizado de horas). Toda hora clínica debe mostrarse en la zona
 * del consultorio, nunca en la del dispositivo: un médico con el equipo en otra
 * zona —o detrás de una VPN— vería su agenda desplazada varias horas respecto a
 * lo que realmente configuró.
 *
 * México suprimió el horario de verano en 2022, por lo que el offset es
 * -06:00 todo el año.
 */
export const CLINIC_TIME_ZONE = "America/Mexico_City";
export const CLINIC_UTC_OFFSET = "-06:00";

/** Formatea un instante en hora del consultorio (ej. "09:00 a.m."). */
export function formatClinicTime(value: string | Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeStyle: "short",
    timeZone: CLINIC_TIME_ZONE
  }).format(new Date(value));
}

/** Formatea fecha y hora en zona del consultorio (ej. "9 ago 2026, 09:00 a.m."). */
export function formatClinicDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: CLINIC_TIME_ZONE
  }).format(new Date(value));
}

/** Día natural (YYYY-MM-DD) de un instante, leído en zona del consultorio. */
export function clinicDayKey(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}
