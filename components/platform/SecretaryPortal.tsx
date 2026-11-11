"use client";

import {
  Calendar,
  CheckCircle2,
  Loader2,
  LogOut,
  Plus,
  Search,
  UserPlus,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── Tipos ──────────────────────────────────────────────────────── */

type DoctorInfo = {
  fullName: string;
  consultationPriceCents: number;
  consultationDurationMinutes: number;
  specialty: { name: string };
  hospital: { name: string };
};

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
};

type TodayAppointment = {
  id: string;
  status: string;
  secretaryCreated: boolean;
  guestPatientName: string | null;
  guestPatientPhone: string | null;
  availabilitySlot: { startsAt: string; endsAt: string };
  patient: { user: { name: string; email: string } } | null;
  payments: Array<{ provider: string; status: string }>;
  /** Día natural de la cita en zona del consultorio (YYYY-MM-DD). */
  dia: string;
  grupo: "hoy" | "manana" | "proximos";
  horaLocal: string;
};

type PatientResult = {
  userId: string;
  patientId: string | null;
  name: string;
  email: string;
  phone: string | null;
};

/* ── Helpers ────────────────────────────────────────────────────── */

function fmt(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(iso));
}

function fmtFull(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(iso));
}

function money(cents: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

/** Día natural en zona del consultorio; no depende de la zona del navegador. */
function clinicDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));
}

function isToday(iso: string) {
  return clinicDay(iso) === clinicDay(new Date());
}

function metodoPago(provider: string) {
  if (provider === "CASH") return "Efectivo";
  if (provider === "TRANSFER") return "Transferencia";
  return "En línea";
}

/**
 * Solo se cobra en mostrador lo que se paga en efectivo o transferencia. Los
 * pagos de Stripe los confirma el webhook contra el dinero real, así que la
 * secretaria no debe poder declararlos pagados desde aquí.
 */
function cobrableEnMostrador(payment?: { provider: string; status: string }) {
  if (!payment) return false;
  return (payment.provider === "CASH" || payment.provider === "TRANSFER") && payment.status === "PENDING";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACCEPTED: "Aceptada",
    CONFIRMED: "Confirmada",
    COMPLETED: "Completada",
    PENDING: "Pendiente",
    PENDING_DOCTOR_ACCEPTANCE: "Pendiente",
    CANCELLED: "Cancelada",
    AUTO_CANCELLED: "Cancelada",
    NO_SHOW: "No se presentó"
  };
  const done = ["ACCEPTED", "CONFIRMED", "COMPLETED"].includes(status);
  const bad = ["CANCELLED", "AUTO_CANCELLED", "NO_SHOW"].includes(status);
  const tone = done
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : bad
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  const dot = done ? "bg-emerald-500" : bad ? "bg-red-500" : "bg-amber-500";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {map[status] ?? status}
    </span>
  );
}

/* ── Modal nueva cita ───────────────────────────────────────────── */

function NewAppointmentModal({
  token,
  slots,
  doctor,
  onClose,
  onCreated
}: {
  token: string;
  slots: Slot[];
  doctor: DoctorInfo;
  onClose: () => void;
  onCreated: (recibo: { nombre: string; detalle: string }) => void;
}) {
  const [patientType, setPatientType] = useState<"vitaeon" | "guest">("guest");

  // Guest
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // VITAEON
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Common
  const [slotId, setSlotId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /** Campo que impide confirmar, para marcarlo en vez de apagar el botón sin decir por qué. */
  const [invalidField, setInvalidField] = useState<"slot" | "guestName" | "guestPhone" | "patient" | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLButtonElement>(null);

  // El modal se cerraba solo con la X: ni Escape, ni clic fuera. Con un paciente
  // esperando al teléfono, quedarse atrapado en un formulario es caro.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving]);

  const freeSlots = slots;

  /** Resumen de lo que está por confirmarse, para poder leerlo en voz alta. */
  const selectedSlot = freeSlots.find((s) => s.id === slotId) ?? null;
  const resumen = selectedSlot
    ? `${fmtFull(selectedSlot.startsAt)} · ${doctor.consultationDurationMinutes} min · ${money(doctor.consultationPriceCents)} en ${paymentMethod === "CASH" ? "efectivo" : "transferencia"} al llegar`
    : null;

  async function searchVitaeonPatient() {
    if (query.trim().length < 3) return;
    setSearching(true);
    setError("");
    try {
      // Este buscador apuntaba a /api/assistants/patients, que exige una cuenta
      // con rol ASSISTANT. La secretaría entra por PIN y nunca la tiene, así que
      // la respuesta era siempre 403 y el catch lo mostraba como "no se encontró
      // ningún paciente": el mensaje culpaba al paciente de un fallo de sesión.
      const res = await fetch(`/api/secretaria/${token}/patients?q=${encodeURIComponent(query)}`);

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        setPatients([]);
        if (res.status === 401) {
          setError("Tu sesión expiró. Cierra esta ventana y vuelve a ingresar el PIN.");
        } else if (res.status === 403) {
          setError("El médico desactivó este enlace de secretaría.");
        } else {
          setError(json?.error?.message ?? "No se pudo buscar en este momento. Intenta de nuevo.");
        }
        return;
      }

      const json = (await res.json()) as { data?: PatientResult[] };
      const results = json.data ?? [];
      setPatients(results);
      if (results.length === 0) {
        const buscoPorCorreo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(query.trim());
        setError(
          buscoPorCorreo
            ? `No hay ninguna cuenta de VITAEON con el correo "${query.trim()}". Regístralo como paciente nuevo.`
            : `Ningún paciente de este consultorio coincide con "${query.trim()}". Si es su primera vez aquí, pídele su correo completo para buscarlo, o regístralo como paciente nuevo.`
        );
      }
    } catch {
      setError("No hay conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    setError("");
    setInvalidField(null);

    // El botón se deshabilitaba justo en estos tres casos, así que los mensajes
    // nunca se alcanzaban: la secretaria veía un botón gris sin explicación y
    // cinco campos donde buscar la culpa. Ahora el botón siempre responde y la
    // validación señala el campo concreto.
    if (patientType === "guest" && guestName.trim().length < 2) {
      setError("Escribe el nombre del paciente para poder agendar.");
      setInvalidField("guestName");
      return;
    }
    if (patientType === "vitaeon" && !selectedPatient?.patientId) {
      setError("Busca y selecciona al paciente, o regístralo como paciente nuevo.");
      setInvalidField("patient");
      return;
    }
    // El servidor exige mínimo 7 dígitos y responde "Datos de cita inválidos",
    // sin decir cuál campo. Mejor atraparlo aquí y señalar el teléfono.
    if (patientType === "guest" && guestPhone.trim() && guestPhone.trim().length < 7) {
      setError("El teléfono está incompleto. Escríbelo con lada, o déjalo vacío.");
      setInvalidField("guestPhone");
      return;
    }
    if (!slotId) {
      setError("Elige el horario de la cita.");
      setInvalidField("slot");
      return;
    }

    setSaving(true);
    try {
      const body =
        patientType === "guest"
          ? {
              patientType: "guest",
              guestName: guestName.trim(),
              guestPhone: guestPhone.trim() || undefined,
              availabilitySlotId: slotId,
              paymentMethod,
              reason: reason.trim() || undefined
            }
          : {
              patientType: "vitaeon",
              patientId: selectedPatient!.patientId,
              availabilitySlotId: slotId,
              paymentMethod,
              reason: reason.trim() || undefined
            };

      const res = await fetch(`/api/secretaria/${token}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      // `fail()` responde { ok:false, error:{ code, message } }: el error es un
      // objeto, no una cadena. Al tiparlo como string, pasárselo a `new Error`
      // lo convertía en "[object Object]" y la secretaria no podía saber qué
      // estaba mal — por ejemplo, que el teléfono es demasiado corto.
      const json = (await res.json()) as {
        data?: { patientName?: string };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo crear la cita. Intenta de nuevo.");
      const name = json.data?.patientName ?? (patientType === "guest" ? guestName : selectedPatient?.name ?? "");
      onCreated({ nombre: name, detalle: resumen ?? "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear la cita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nueva-cita-titulo"
        className="max-h-[95dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="nueva-cita-titulo" className="text-2xl font-bold text-[#071726]">
              Nueva cita
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {doctor.fullName} · {money(doctor.consultationPriceCents)} · {doctor.consultationDurationMinutes} min
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar sin agendar"
            className="rounded-full bg-slate-100 p-3 transition hover:bg-slate-200"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        <div className="mt-6 space-y-5">

          {/* Toggle tipo de paciente */}
          <div>
            <p id="tipo-paciente-label" className="mb-2 block text-sm font-semibold text-[#071726]">
              Tipo de paciente
            </p>
            <div role="radiogroup" aria-labelledby="tipo-paciente-label" className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 gap-1">
              <button
                ref={firstFieldRef}
                role="radio"
                aria-checked={patientType === "guest"}
                onClick={() => { setPatientType("guest"); setSelectedPatient(null); setPatients([]); }}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${patientType === "guest" ? "bg-[#071726] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Presencial / nuevo
              </button>
              <button
                role="radio"
                aria-checked={patientType === "vitaeon"}
                onClick={() => setPatientType("vitaeon")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${patientType === "vitaeon" ? "bg-[#071726] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Paciente VITAEON
              </button>
            </div>
          </div>

          {/* Datos del paciente */}
          {patientType === "guest" ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="guest-name" className="mb-2 block text-sm font-semibold text-[#071726]">
                  Nombre del paciente <span className="font-normal text-red-600">*</span>
                </label>
                <input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setInvalidField(null); }}
                  aria-invalid={invalidField === "guestName"}
                  placeholder="Ej. Juan Pérez García"
                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10 ${
                    invalidField === "guestName"
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>
              <div>
                <label htmlFor="guest-phone" className="mb-2 block text-sm font-semibold text-[#071726]">
                  Teléfono <span className="font-normal text-slate-600">(opcional)</span>
                </label>
                <input
                  id="guest-phone"
                  value={guestPhone}
                  onChange={(e) => { setGuestPhone(e.target.value); setInvalidField(null); }}
                  aria-invalid={invalidField === "guestPhone"}
                  placeholder="477 123 4567"
                  type="tel"
                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10 ${
                    invalidField === "guestPhone"
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="buscar-paciente" className="mb-2 block text-sm font-semibold text-[#071726]">
                Buscar paciente por nombre o correo
              </label>
              <div className="flex gap-2">
                <input
                  id="buscar-paciente"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setInvalidField(null); }}
                  onKeyDown={(e) => e.key === "Enter" && searchVitaeonPatient()}
                  aria-invalid={invalidField === "patient"}
                  placeholder="Nombre o correo electrónico…"
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10 ${
                    invalidField === "patient"
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                />
                <button
                  onClick={searchVitaeonPatient}
                  disabled={searching || query.trim().length < 3}
                  aria-label="Buscar paciente"
                  className="flex shrink-0 items-center gap-2 rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>

              {patients.length > 0 && !selectedPatient && (
                <div className="mt-2 grid gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  {patients.map((p) => (
                    <button
                      key={p.userId}
                      onClick={() => { setSelectedPatient(p); setPatients([]); }}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold text-[#071726]">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                      </div>
                      {p.patientId
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        : <X className="h-4 w-4 text-amber-500" />}
                    </button>
                  ))}
                </div>
              )}

              {selectedPatient && (
                <div className="mt-2 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-[#071726]">{selectedPatient.name}</p>
                    <p className="text-xs text-slate-500">{selectedPatient.email}</p>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} aria-label="Quitar paciente seleccionado" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Horario */}
          <div>
            <label htmlFor="horario" className="mb-2 block text-sm font-semibold text-[#071726]">Horario disponible</label>
            {freeSlots.length === 0 ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No hay horarios libres próximos. El médico debe publicar disponibilidad desde su panel.
              </p>
            ) : (
              <select
                id="horario"
                value={slotId}
                onChange={(e) => { setSlotId(e.target.value); setInvalidField(null); }}
                aria-invalid={invalidField === "slot"}
                className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10 ${
                  invalidField === "slot" ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <option value="">— Selecciona un horario —</option>
                {freeSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fmtFull(s.startsAt)}{isToday(s.startsAt) ? " · HOY" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Forma de pago */}
          <div>
            <p id="forma-pago-label" className="mb-2 block text-sm font-semibold text-[#071726]">
              Forma de pago <span className="font-normal text-slate-600">· se cobra al llegar</span>
            </p>
            <div role="radiogroup" aria-labelledby="forma-pago-label" className="flex gap-2">
              {(["CASH", "TRANSFER"] as const).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={paymentMethod === m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition ${
                    paymentMethod === m
                      ? "border-[#071726] bg-[#071726] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {m === "CASH" ? "Efectivo" : "Transferencia"}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label htmlFor="motivo" className="mb-2 block text-sm font-semibold text-[#071726]">
              Motivo de consulta <span className="font-normal text-slate-600">(opcional)</span>
            </label>
            <textarea
              id="motivo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Seguimiento, dolor de cabeza, revisión anual…"
              rows={2}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
            />
          </div>

          {/*
            Lo que va a quedar agendado, junto y en una sola frase. Su trabajo es
            decirlo en voz alta por teléfono; antes la hora vivía dentro del
            select cerrado y el precio en gris en el encabezado.
          */}
          {resumen && (
            <div className="rounded-2xl border border-[#1e9bd4]/30 bg-[#1e9bd4]/5 px-4 py-3">
              <p className="text-sm font-semibold text-[#071726]">{resumen}</p>
              <p className="mt-0.5 text-xs text-slate-600">
                con {doctor.fullName} · {doctor.hospital.name}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={submit}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#071726] py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar cita
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-slate-200 px-6 py-3.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── PIN Entry Screen ───────────────────────────────────────────── */

function PinEntry({
  token,
  doctorName,
  onAuthenticated
}: {
  token: string;
  doctorName: string;
  onAuthenticated: () => void;
}) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (pin.length < 4) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/secretaria/${token}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const json = (await res.json()) as { error?: { code?: string; message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "PIN incorrecto.");
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN incorrecto.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#071726] via-[#0a2d47] to-[#0d3d60] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="inline-block rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold tracking-[0.3em] text-white">
            VITAEON
          </span>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e9bd4]/20">
              <Calendar className="h-7 w-7 text-[#1e9bd4]" />
            </div>
            <h1 className="text-xl font-bold text-white">Panel de secretaría</h1>
            <p className="mt-1.5 text-sm text-white/60">{doctorName}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">PIN de acceso</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && verify()}
                placeholder="· · · ·"
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-center text-2xl tracking-widest text-white placeholder-white/30 outline-none transition focus:border-[#1e9bd4]/60 focus:ring-2 focus:ring-[#1e9bd4]/20"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/20 px-4 py-2.5 text-center text-sm font-semibold text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={verify}
              disabled={loading || pin.length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1e9bd4] py-3.5 text-sm font-bold text-white transition hover:bg-[#1e9bd4]/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Ingresar
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          Acceso restringido · Solo personal autorizado
        </p>
      </div>
    </main>
  );
}

/* ── Dashboard principal ────────────────────────────────────────── */

export function SecretaryPortalClient({
  token,
  doctorName
}: {
  token: string;
  doctorName: string;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [todayAppts, setTodayAppts] = useState<TodayAppointment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");
  /** Comprobante de la última cita creada; persiste hasta que ella lo cierra. */
  const [recibo, setRecibo] = useState<{ nombre: string; detalle: string } | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  /** Motivo por el que la agenda no se pudo cargar, o null si los datos son buenos. */
  const [loadError, setLoadError] = useState<"expired" | "inactive" | "failed" | "offline" | null>(null);
  /** Hora de la última carga correcta, para que no se confunda con datos frescos. */
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  /** Id de la cita cuyo cobro se está registrando, para desactivar solo ese botón. */
  const [cobrando, setCobrando] = useState<string | null>(null);

  // Verificar si ya hay sesión activa
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/secretaria/${token}/slots`);
        if (res.ok) setAuthenticated(true);
      } catch { /* no hay sesión */ }
      setLoading(false);
    })();
  }, [token]);

  /**
   * Carga la agenda.
   *
   * Antes, un `catch` silencioso y dos `if (res.ok)` hacían que una sesión
   * caducada (401) o un enlace desactivado por el médico (403) se renderizaran
   * como "sin citas programadas". La secretaria le decía al médico que no tenía
   * nada agendado y era falso. El estado vacío ahora solo aparece cuando el
   * servidor respondió 200 con una lista vacía de verdad.
   */
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [slotsRes, apptsRes] = await Promise.all([
        fetch(`/api/secretaria/${token}/slots`),
        fetch(`/api/secretaria/${token}/appointments`)
      ]);

      // La sesión dura 24 h: al vencer hay que volver a pedir el PIN, no fingir
      // que la agenda está vacía.
      if (slotsRes.status === 401 || apptsRes.status === 401) {
        setAuthenticated(false);
        setLoadError("expired");
        return;
      }
      if (slotsRes.status === 403 || apptsRes.status === 403) {
        setLoadError("inactive");
        return;
      }
      if (!slotsRes.ok || !apptsRes.ok) {
        setLoadError("failed");
        return;
      }

      const slotsJson = (await slotsRes.json()) as { data?: { doctor: DoctorInfo; slots: Slot[] } };
      if (slotsJson.data) {
        setDoctor(slotsJson.data.doctor);
        setSlots(slotsJson.data.slots);
      }
      const apptsJson = (await apptsRes.json()) as { data?: TodayAppointment[] };
      setTodayAppts(apptsJson.data ?? []);
      setLoadError(null);
      setLastSyncedAt(new Date());
    } catch {
      setLoadError("offline");
    } finally {
      setDataLoading(false);
    }
  }, [token]);

  /** Registra el cobro hecho en el mostrador y refresca la agenda. */
  const marcarPagada = useCallback(
    async (appointmentId: string, nombre: string) => {
      setCobrando(appointmentId);
      setMessage("");
      try {
        const res = await fetch(`/api/secretaria/${token}/appointments/${appointmentId}/pago`, {
          method: "POST"
        });
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        if (!res.ok) {
          setMessage(json?.error?.message ?? "No se pudo registrar el cobro.");
          return;
        }
        setMessage(`Cobro de ${nombre} registrado. Se notificó al médico.`);
        await loadData();
      } catch {
        setMessage("No hay conexión. El cobro no se registró.");
      } finally {
        setCobrando(null);
      }
    },
    [token, loadData]
  );

  useEffect(() => {
    if (authenticated) void loadData();
  }, [authenticated, loadData]);

  // La secretaria deja el panel abierto toda la jornada. Sin refresco, lo que ve
  // a las 16:00 puede ser lo que cargó a las 9:05, con cara de dato fresco.
  useEffect(() => {
    if (!authenticated) return;
    const id = setInterval(() => void loadData(), 60_000);
    return () => clearInterval(id);
  }, [authenticated, loadData]);

  async function logout() {
    await fetch(`/api/secretaria/${token}/auth`, { method: "DELETE" });
    setAuthenticated(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071726]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e9bd4]" />
      </main>
    );
  }

  if (!authenticated) {
    return <PinEntry token={token} doctorName={doctorName} onAuthenticated={() => setAuthenticated(true)} />;
  }

  const freeToday = slots.filter((s) => isToday(s.startsAt)).length;

  // La API ya devuelve las citas de los próximos 7 días ordenadas y etiquetadas
  // con su día del consultorio. Aquí solo se agrupan para mostrarlas.
  const citasDeHoy = todayAppts.filter((a) => a.grupo === "hoy");
  const diasAgenda = todayAppts.reduce<Array<{ dia: string; grupo: string; citas: TodayAppointment[] }>>(
    (acc, appt) => {
      const ultimo = acc[acc.length - 1];
      if (ultimo && ultimo.dia === appt.dia) ultimo.citas.push(appt);
      else acc.push({ dia: appt.dia, grupo: appt.grupo, citas: [appt] });
      return acc;
    },
    []
  );

  /**
   * La siguiente cita que todavía no ocurre.
   *
   * Es el único dato que la secretaria necesita en todo momento: es lo que
   * responde cuando el médico asoma la cabeza y pregunta "¿qué sigue?", y lo
   * que mira cuando suena el timbre. Hasta ahora vivía enterrada en una lista
   * donde la cita de las 9:00 se veía igual que la de las 17:30.
   */
  const ahora = Date.now();
  const siguienteCita =
    todayAppts.find((a) => new Date(a.availabilitySlot.startsAt).getTime() >= ahora) ?? null;

  /** Minutos que faltan, para la cuenta regresiva de recepción. */
  const minutosParaSiguiente = siguienteCita
    ? Math.round((new Date(siguienteCita.availabilitySlot.startsAt).getTime() - ahora) / 60000)
    : null;

  const faltaTexto = (min: number) => {
    if (min <= 0) return "ahora";
    if (min < 60) return `en ${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h < 24) return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
    return "más tarde";
  };

  const etiquetaDia = (dia: string, grupo: string) => {
    if (grupo === "hoy") return "Hoy";
    if (grupo === "manana") return "Mañana";
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Mexico_City"
    }).format(new Date(`${dia}T12:00:00-06:00`));
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf9f7_0%,#ffffff_50%,#eef5f8_100%)] px-4 pb-24 pt-10 sm:px-6 sm:pt-12">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 pb-8">
          <div>
            {doctor && (
              <>
                <h1 className="text-3xl font-bold tracking-tight text-[#071726]">{doctor.fullName}</h1>
                <p className="mt-1 text-sm text-slate-600">{doctor.specialty.name} · {doctor.hospital.name}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-[#071726]/15 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#071726]/20"
            >
              <Plus className="h-4 w-4" />
              Nueva cita
            </button>
            {/*
              "Salir" estaba a la misma altura y con la misma forma que la acción
              principal. Con el teléfono en la otra mano es fácil rozarlo y
              quedarse fuera con el paciente en la línea: ahora es un control
              terciario, no un botón gemelo.
            */}
            <button
              onClick={logout}
              aria-label="Cerrar sesión de secretaría"
              className="flex items-center gap-2 rounded-full px-3 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}

        {/* Comprobante: se queda hasta que ella lo cierra, porque lo tiene que leer. */}
        {recibo && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-900">Cita agendada para {recibo.nombre}</p>
                {recibo.detalle && <p className="mt-1 text-sm text-emerald-800">{recibo.detalle}</p>}
                <p className="mt-1 text-xs text-emerald-700">
                  Se notificó a {doctor?.fullName ?? "el médico"}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => { setRecibo(null); setShowModal(true); }}
                    className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
                  >
                    Agendar otra
                  </button>
                  <button
                    onClick={() => setRecibo(null)}
                    className="rounded-full border border-emerald-300 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fallo de carga: nunca se debe confundir con "no hay citas". */}
        {loadError && (
          <div
            role="alert"
            className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4"
          >
            <p className="font-semibold text-amber-900">
              {loadError === "expired" && "Tu sesión expiró"}
              {loadError === "inactive" && "El médico desactivó este enlace"}
              {loadError === "offline" && "Sin conexión"}
              {loadError === "failed" && "No se pudo cargar la agenda"}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {loadError === "expired" &&
                "Vuelve a ingresar el PIN para seguir viendo la agenda. No se perdió ninguna cita."}
              {loadError === "inactive" &&
                "Pídele al médico que vuelva a activarlo desde su panel."}
              {loadError === "offline" &&
                "Revisa tu internet. Lo que ves abajo puede estar desactualizado."}
              {loadError === "failed" &&
                "Lo que ves abajo puede estar desactualizado. Intenta actualizar."}
            </p>
            {loadError !== "expired" && (
              <button
                onClick={loadData}
                disabled={dataLoading}
                className="mt-3 rounded-full bg-amber-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-800 disabled:opacity-50"
              >
                {dataLoading ? "Actualizando…" : "Reintentar"}
              </button>
            )}
          </div>
        )}

        {/*
          Aquí vivían tres tarjetas iguales con un número cada una. Ocupaban el
          mejor espacio de la pantalla para decir cosas que no cambian la
          siguiente acción de nadie, y a 360px empujaban la agenda fuera del
          primer vistazo: ella abría el panel y veía cifras, no pacientes.

          La superficie de marca del producto (el gradiente navy) estaba gastada
          en la pantalla de PIN, donde pasa tres segundos. Se trae aquí, al único
          dato que mira todo el día.
        */}
        <section className="mb-8 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#071726] via-[#0a2d47] to-[#0d3d60] px-6 py-6 shadow-lg shadow-[#071726]/20 sm:px-8 sm:py-7">
          {siguienteCita ? (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1e9bd4]">
                  Siguiente
                </p>
                {minutosParaSiguiente !== null && (
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-white/70">
                    {faltaTexto(minutosParaSiguiente)}
                  </p>
                )}
              </div>

              <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {siguienteCita.guestPatientName ?? siguienteCita.patient?.user.name ?? "Paciente"}
              </p>

              <p className="mt-2 text-base text-white/80">
                <span className="tabular-nums">{siguienteCita.horaLocal || fmt(siguienteCita.availabilitySlot.startsAt)}</span>
                {siguienteCita.grupo !== "hoy" && ` · ${etiquetaDia(siguienteCita.dia, siguienteCita.grupo)}`}
                {doctor ? ` · ${doctor.consultationDurationMinutes} min` : ""}
                {siguienteCita.payments[0] ? ` · ${metodoPago(siguienteCita.payments[0].provider)}` : ""}
              </p>

              {siguienteCita.guestPatientPhone && (
                <a
                  href={`tel:${siguienteCita.guestPatientPhone.replace(/\s/g, "")}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold tabular-nums text-white transition hover:bg-white/20"
                >
                  {siguienteCita.guestPatientPhone}
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1e9bd4]">
                Siguiente
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                No queda ninguna cita por delante
              </p>
              <p className="mt-2 text-base text-white/70">
                {citasDeHoy.length > 0
                  ? "Las de hoy ya pasaron."
                  : "Nadie agendado todavía."}
              </p>
            </>
          )}

          {/* Los números se quedan, pero en voz baja: son contexto, no la tarea. */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/10 pt-4 text-sm text-white/60">
            <span className="tabular-nums">{citasDeHoy.length} hoy</span>
            <span className="tabular-nums">{freeToday} libres hoy</span>
            <span className="tabular-nums">{slots.length} horarios publicados</span>
          </div>
        </section>

        {/* Próximas citas (hoy + 7 días) */}
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#071726]">Próximas citas</h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Hoy y los próximos 7 días
                {lastSyncedAt && ` · actualizado ${fmt(lastSyncedAt.toISOString())}`}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={dataLoading}
              className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {dataLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              Actualizar
            </button>
          </div>

          {/* El vacío solo es real si el servidor respondió bien. */}
          {todayAppts.length === 0 && !loadError ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm text-slate-600">Sin citas programadas en los próximos 7 días.</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 rounded-full bg-[#071726] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Agendar una cita
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-6">
              {diasAgenda.map((bloque) => (
                <div key={bloque.dia}>
                  <div className="mb-2 flex items-center gap-3">
                    <h3
                      className={`text-sm font-bold capitalize ${
                        bloque.grupo === "hoy" ? "text-[#1e9bd4]" : "text-slate-600"
                      }`}
                    >
                      {etiquetaDia(bloque.dia, bloque.grupo)}
                    </h3>
                    <span className="text-xs tabular-nums text-slate-600">
                      {bloque.citas.length} {bloque.citas.length === 1 ? "cita" : "citas"}
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <div className="divide-y divide-slate-100">
              {bloque.citas.map((appt) => {
                const displayName = appt.guestPatientName ?? appt.patient?.user.name ?? "Paciente";
                const payment = appt.payments[0];
                return (
                  <div
                    key={appt.id}
                    className="-mx-2 flex flex-wrap items-center justify-between gap-4 rounded-xl px-2 py-3.5 transition-colors hover:bg-slate-50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#071726]">{displayName}</p>
                        {appt.secretaryCreated && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                            <UserPlus className="h-3 w-3" />
                            Secretaría
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">
                        <span className="tabular-nums">
                          {appt.horaLocal || fmt(appt.availabilitySlot.startsAt)}
                        </span>
                        {appt.guestPatientPhone ? ` · ${appt.guestPatientPhone}` : ""}
                        {payment ? ` · ${metodoPago(payment.provider)}` : ""}
                        {payment?.status === "PAID" && " · pagado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/*
                        El cobro en consultorio no tenía dónde registrarse: la
                        cita nacía con el pago pendiente y la pastilla ámbar
                        seguía ahí para siempre, aunque el paciente ya hubiera
                        pagado en el mostrador.
                      */}
                      {cobrableEnMostrador(payment) && (
                        <button
                          onClick={() => marcarPagada(appt.id, displayName)}
                          disabled={cobrando === appt.id}
                          className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {cobrando === appt.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Ya pagó
                        </button>
                      )}
                      <StatusBadge status={appt.status} />
                    </div>
                  </div>
                );
              })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="mt-10 text-center text-xs text-slate-500">
          VITAEON · Panel de secretaría · Acceso restringido
        </p>
      </div>

      {showModal && doctor && (
        <NewAppointmentModal
          token={token}
          slots={slots}
          doctor={doctor}
          onClose={() => setShowModal(false)}
          onCreated={(recibo) => {
            setShowModal(false);
            // El banner anterior se borraba a los 6 segundos y no traía lo único
            // que ella necesita repetirle al paciente que sigue en la línea.
            setRecibo(recibo);
            setMessage("");
            void loadData();
          }}
        />
      )}
    </main>
  );
}
