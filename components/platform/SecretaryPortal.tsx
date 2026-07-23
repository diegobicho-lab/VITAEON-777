"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Plus,
  Search,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  patient: { user: { name: string; email: string } };
  payments: Array<{ provider: string; status: string }>;
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

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
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
  onCreated: (name: string) => void;
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

  const freeSlots = slots.slice(0, 40);

  async function searchVitaeonPatient() {
    if (query.trim().length < 3) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch(`/api/assistants/patients?q=${encodeURIComponent(query)}`);
      const json = (await res.json()) as { data?: PatientResult[] };
      const results = json.data ?? [];
      setPatients(results);
      if (results.length === 0) setError("No se encontró ningún paciente con ese dato.");
    } catch {
      setError("Error al buscar paciente.");
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    setError("");
    if (!slotId) { setError("Selecciona un horario disponible."); return; }
    if (patientType === "guest" && guestName.trim().length < 2) {
      setError("Ingresa el nombre del paciente (mínimo 2 caracteres).");
      return;
    }
    if (patientType === "vitaeon" && !selectedPatient?.patientId) {
      setError("El paciente no tiene perfil activo en VITAEON.");
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

      const json = (await res.json()) as { data?: { patientName?: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error al crear cita.");
      const name = json.data?.patientName ?? (patientType === "guest" ? guestName : selectedPatient?.name ?? "");
      onCreated(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear la cita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="max-h-[95dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#1e9bd4]">Recepción</p>
            <h2 className="mt-1 text-2xl font-bold text-[#071726]">Nueva cita</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {doctor.fullName} · {money(doctor.consultationPriceCents)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 transition hover:bg-slate-200">
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        <div className="mt-6 space-y-5">

          {/* Toggle tipo de paciente */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#071726]">Tipo de paciente</label>
            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 gap-1">
              <button
                onClick={() => { setPatientType("guest"); setSelectedPatient(null); setPatients([]); }}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${patientType === "guest" ? "bg-[#071726] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Presencial / nuevo
              </button>
              <button
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
                <label className="mb-2 block text-sm font-semibold text-[#071726]">
                  Nombre del paciente <span className="font-normal text-red-500">*</span>
                </label>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ej. Juan Pérez García"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#071726]">
                  Teléfono <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="477 123 4567"
                  type="tel"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#071726]">
                Buscar paciente por nombre o correo
              </label>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchVitaeonPatient()}
                  placeholder="Nombre o correo electrónico…"
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
                />
                <button
                  onClick={searchVitaeonPatient}
                  disabled={searching || query.trim().length < 3}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-[#071726] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
                  <button onClick={() => setSelectedPatient(null)} className="rounded-full p-1 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Horario */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#071726]">Horario disponible</label>
            {freeSlots.length === 0 ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No hay horarios libres próximos. El médico debe publicar disponibilidad desde su panel.
              </p>
            ) : (
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
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
            <label className="mb-2 block text-sm font-semibold text-[#071726]">Forma de pago</label>
            <div className="flex gap-2">
              {(["CASH", "TRANSFER"] as const).map((m) => (
                <button
                  key={m}
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
            <label className="mb-2 block text-sm font-semibold text-[#071726]">
              Motivo de consulta <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Seguimiento, dolor de cabeza, revisión anual…"
              rows={2}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
            />
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={submit}
              disabled={saving || !slotId || (patientType === "guest" && guestName.trim().length < 2) || (patientType === "vitaeon" && !selectedPatient?.patientId)}
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
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "PIN incorrecto.");
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

        <p className="mt-6 text-center text-xs text-white/30">
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
  const [dataLoading, setDataLoading] = useState(false);

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

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [slotsRes, apptsRes] = await Promise.all([
        fetch(`/api/secretaria/${token}/slots`),
        fetch(`/api/secretaria/${token}/appointments`)
      ]);
      if (slotsRes.ok) {
        const slotsJson = (await slotsRes.json()) as { data?: { doctor: DoctorInfo; slots: Slot[] } };
        if (slotsJson.data) {
          setDoctor(slotsJson.data.doctor);
          setSlots(slotsJson.data.slots);
        }
      }
      if (apptsRes.ok) {
        const apptsJson = (await apptsRes.json()) as { data?: TodayAppointment[] };
        setTodayAppts(apptsJson.data ?? []);
      }
    } catch { /* silencioso */ }
    setDataLoading(false);
  }, [token]);

  useEffect(() => {
    if (authenticated) void loadData();
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

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf9f7_0%,#ffffff_50%,#eef5f8_100%)] px-4 pb-24 pt-10 sm:px-6 sm:pt-12">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 pb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#1e9bd4]">Panel de secretaría</p>
            {doctor && (
              <>
                <h1 className="mt-2 text-3xl font-bold text-[#071726]">{doctor.fullName}</h1>
                <p className="mt-1 text-sm text-slate-500">{doctor.specialty.name} · {doctor.hospital.name}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              Nueva cita
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-300"
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

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#071726]/5">
                <Calendar className="h-5 w-5 text-[#071726]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#071726]">{todayAppts.length}</p>
                <p className="text-xs text-slate-500">Citas hoy</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#071726]">{freeToday}</p>
                <p className="text-xs text-slate-500">Huecos libres hoy</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                <Users className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#071726]">{slots.length}</p>
                <p className="text-xs text-slate-500">Slots disponibles</p>
              </div>
            </div>
          </div>
        </div>

        {/* Agenda de hoy */}
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-[#071726]">Agenda de hoy</h2>
            <button
              onClick={loadData}
              disabled={dataLoading}
              className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {dataLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              Actualizar
            </button>
          </div>

          {todayAppts.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">Sin citas programadas para hoy.</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 rounded-full bg-[#071726] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Agendar primera cita del día
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {todayAppts.map((appt) => {
                const displayName = appt.guestPatientName ?? appt.patient.user.name;
                const payment = appt.payments[0];
                return (
                  <div
                    key={appt.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#071726]">{displayName}</p>
                        {appt.secretaryCreated && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-600 border border-sky-200">
                            <UserPlus className="h-2.5 w-2.5" />
                            Secretaría
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {fmt(appt.availabilitySlot.startsAt)}
                        {appt.guestPatientPhone ? ` · ${appt.guestPatientPhone}` : ""}
                        {payment ? ` · ${payment.provider === "CASH" ? "Efectivo" : "Transferencia"}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-10 text-center text-xs text-slate-400">
          VITAEON · Panel de secretaría · Acceso restringido
        </p>
      </div>

      {showModal && doctor && (
        <NewAppointmentModal
          token={token}
          slots={slots}
          doctor={doctor}
          onClose={() => setShowModal(false)}
          onCreated={(name) => {
            setShowModal(false);
            setMessage(`✓ Cita de ${name} registrada correctamente.`);
            void loadData();
            setTimeout(() => setMessage(""), 6000);
          }}
        />
      )}
    </main>
  );
}
