"use client";

import { Calendar, CheckCircle2, Clock, Loader2, Search, UserPlus, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { clientApi } from "@/services/client/api";

/* ── Tipos ──────────────────────────────────────────────────── */

type DoctorInfo = {
  id: string;
  fullName: string;
  specialty: string;
  hospital: string;
  medal: string;
  consultationPriceCents: number;
  consultationDurationMinutes: number;
  imageUrl?: string | null;
};

type AssistantMe = {
  assistantId: string;
  doctor: DoctorInfo;
};

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  appointment: { id: string; status: string } | null;
};

type Appointment = {
  id: string;
  status: string;
  reason?: string | null;
  availabilitySlot: { startsAt: string; endsAt: string };
  doctor: { fullName: string; specialty: { name: string } };
  patient: { phone?: string | null; user: { name: string; email: string } };
  payments: Array<{ status: string; provider: string; amountCents: number }>;
};

type PatientResult = {
  userId: string;
  patientId: string | null;
  name: string;
  email: string;
  phone: string | null;
};

/* ── Helpers ────────────────────────────────────────────────── */

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

function money(cents: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

function isToday(value: string) {
  const d = new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Genera URL de WhatsApp a partir de un número (limpia todo excepto dígitos y +) */
function whatsappUrl(phone: string, message?: string) {
  const clean = phone.replace(/[^\d+]/g, "");
  const base = `https://wa.me/${clean.replace(/^\+/, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

function readableStatus(status: string) {
  const map: Record<string, string> = {
    ACCEPTED: "Aceptada",
    CONFIRMED: "Confirmada",
    COMPLETED: "Completada",
    PENDING: "Pendiente",
    PENDING_DOCTOR_ACCEPTANCE: "Pendiente de aceptación",
    CANCELLED: "Cancelada",
    AUTO_CANCELLED: "Cancelada automáticamente",
    NO_SHOW: "No se presentó",
    RESCHEDULE_REQUESTED: "Reagendamiento solicitado",
    RESCHEDULED: "Reagendada",
    CANCELLATION_REQUESTED: "Cancelación solicitada",
    REFUND_PENDING: "Reembolso pendiente",
    REFUNDED: "Reembolsada"
  };
  return map[status] ?? status;
}

function StatusBadge({ status }: { status: string }) {
  const success = ["ACCEPTED", "CONFIRMED", "COMPLETED"].includes(status);
  const danger = ["CANCELLED", "AUTO_CANCELLED", "NO_SHOW"].includes(status);
  const tone = success
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : danger
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  const dot = success ? "bg-emerald-500" : danger ? "bg-red-500" : "bg-amber-500";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {readableStatus(status)}
    </span>
  );
}

/* ── Sección de horarios del doctor ─────────────────────────── */

function ScheduleSection({
  slots,
  appointments,
  onBook
}: {
  slots: Slot[];
  appointments: Appointment[];
  onBook: (slotId: string) => void;
}) {
  const now = new Date();
  const todayStart = startOfDay(now);

  // Mapa de appointment.id → appointment completa (para obtener nombre del paciente)
  const apptById = new Map(appointments.map((a) => [a.id, a]));

  // Solo slots activos desde hoy en adelante
  const relevant = slots
    .filter((s) => s.isActive && new Date(s.startsAt) >= todayStart)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // Agrupar por fecha (clave: "2026-07-28")
  const grouped = new Map<string, Slot[]>();
  for (const s of relevant) {
    const d = new Date(s.startsAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }

  const dayFmt = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const timeFmt = new Intl.DateTimeFormat("es-MX", { timeStyle: "short" });

  return (
    <section className="mb-8 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-[#071726]">Horarios del doctor</h2>
      <p className="mt-1 text-sm text-slate-500">
        Horarios publicados. Los libres se pueden agendar directamente desde aquí.
      </p>

      {grouped.size === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center">
          <Clock className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">
            El médico no tiene horarios publicados próximamente. Debe agregarlos desde su panel.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {[...grouped.entries()].map(([key, daySlots]) => {
            const date = new Date(daySlots[0].startsAt);
            const todayLabel = isToday(daySlots[0].startsAt);
            const dayLabel = todayLabel
              ? `Hoy — ${dayFmt.format(date)}`
              : dayFmt.format(date).replace(/^\w/, (c) => c.toUpperCase());

            return (
              <div key={key}>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.22em] text-[#1e9bd4]">
                  {dayLabel}
                </p>
                <div className="grid gap-2">
                  {daySlots.map((slot) => {
                    const isPast = new Date(slot.startsAt) < now;
                    const appt = slot.appointment ? apptById.get(slot.appointment.id) : undefined;
                    const isFree = !slot.appointment;

                    return (
                      <div
                        key={slot.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5 transition ${
                          isPast
                            ? "bg-slate-50 opacity-40"
                            : isFree
                              ? "border border-emerald-100 bg-emerald-50"
                              : "border border-slate-100 bg-slate-50/70"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              isPast ? "bg-slate-300" : isFree ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <div>
                            <p className="text-sm font-semibold text-[#071726]">
                              {timeFmt.format(new Date(slot.startsAt))}
                              {" – "}
                              {timeFmt.format(new Date(slot.endsAt))}
                            </p>
                            {appt ? (
                              <>
                                <p className="mt-0.5 text-xs font-semibold text-[#071726]">{appt.patient.user.name}</p>
                                {appt.patient.phone && (
                                  <p className="mt-0.5 text-xs text-slate-500">{appt.patient.phone}</p>
                                )}
                                {appt.reason && (
                                  <p className="mt-0.5 text-xs italic text-slate-400">"{appt.reason}"</p>
                                )}
                              </>
                            ) : isFree && !isPast ? (
                              <p className="mt-0.5 text-xs text-emerald-600 font-medium">Disponible</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {appt?.patient.phone && (
                            <a
                              href={whatsappUrl(appt.patient.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                              title="Contactar por WhatsApp"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              WhatsApp
                            </a>
                          )}
                          {isFree && !isPast ? (
                            <button
                              onClick={() => onBook(slot.id)}
                              className="rounded-full bg-[#071726] px-4 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638]"
                            >
                              Agendar →
                            </button>
                          ) : appt ? (
                            <StatusBadge status={appt.status} />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Modal de nueva cita ────────────────────────────────────── */

function NewAppointmentModal({
  slots,
  doctorName,
  priceCents,
  initialSlotId,
  onClose,
  onCreated
}: {
  slots: Slot[];
  doctorName: string;
  priceCents: number;
  initialSlotId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState(initialSlotId ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [reason, setReason] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const freeSlots = slots
    .filter((s) => s.isActive && !s.appointment && new Date(s.startsAt) > new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 40);

  const timeFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

  async function searchPatient() {
    if (query.trim().length < 3) return;
    setSearching(true);
    setError("");
    try {
      const results = await clientApi<PatientResult[]>(`/api/assistants/patients?q=${encodeURIComponent(query)}`);
      setPatients(results);
      if (results.length === 0) setError("No se encontró ningún paciente con ese dato.");
    } catch {
      setError("Error al buscar paciente. Intenta de nuevo.");
    } finally {
      setSearching(false);
    }
  }

  async function createAppointment() {
    if (!selectedPatient?.patientId) {
      setError("El paciente no tiene perfil activo en VITAEON.");
      return;
    }
    if (!selectedSlotId) {
      setError("Selecciona un horario disponible.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await clientApi("/api/assistants/appointments", {
        method: "POST",
        body: JSON.stringify({
          patientId: selectedPatient.patientId,
          availabilitySlotId: selectedSlotId,
          paymentMethod,
          reason: reason.trim() || undefined
        })
      });
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible crear la cita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1e9bd4]">Recepción</p>
            <h2 className="mt-1 text-2xl font-bold text-[#071726]">Nueva cita</h2>
            <p className="mt-0.5 text-sm text-slate-500">Con {doctorName} · {money(priceCents)}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 transition hover:bg-slate-200">
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {/* Búsqueda de paciente */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#071726]">
              Buscar paciente por nombre o correo
            </label>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPatient()}
                placeholder="Nombre o correo electrónico..."
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
              />
              <button
                onClick={searchPatient}
                disabled={searching || query.trim().length < 3}
                className="flex shrink-0 items-center gap-2 rounded-full bg-[#071726] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d2638] disabled:opacity-50"
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
                      : <XCircle className="h-4 w-4 text-amber-500" />}
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
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="rounded-full p-1 text-slate-400 transition hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Selección de horario */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#071726]">
              Horario disponible
            </label>
            {freeSlots.length === 0 ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No hay horarios libres próximos. El médico debe publicar disponibilidad desde su panel.
              </p>
            ) : (
              <select
                value={selectedSlotId}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
              >
                <option value="">-- Selecciona un horario --</option>
                {freeSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {timeFmt.format(new Date(s.startsAt))}{isToday(s.startsAt) ? " · HOY" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Forma de pago */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#071726]">Forma de pago</label>
            <div className="flex gap-3">
              {(["CASH", "TRANSFER"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition ${
                    paymentMethod === method
                      ? "border-[#071726] bg-[#071726] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {method === "CASH" ? "Efectivo" : "Transferencia"}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo (opcional) */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#071726]">
              Motivo de consulta <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Seguimiento, dolor de cabeza, revisión..."
              rows={2}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10"
            />
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={createAppointment}
              disabled={saving || !selectedPatient || !selectedSlotId}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#071726] py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] disabled:opacity-50"
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

/* ── Dashboard principal ────────────────────────────────────── */

export function AssistantDashboardClient() {
  const [me, setMe] = useState<AssistantMe | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [bookSlotId, setBookSlotId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [meData, apptData, slotData] = await Promise.all([
        clientApi<AssistantMe>("/api/assistants/me"),
        clientApi<Appointment[]>("/api/appointments"),
        clientApi<Slot[]>("/api/availability")
      ]);
      setMe(meData);
      setAppointments(apptData);
      setSlots(slotData);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function openModal(slotId?: string) {
    setBookSlotId(slotId);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setBookSlotId(undefined);
  }

  const todayAppointments = appointments.filter(
    (a) => isToday(a.availabilitySlot.startsAt) &&
      !["CANCELLED", "AUTO_CANCELLED", "REFUNDED"].includes(a.status)
  ).sort(
    (a, b) => new Date(a.availabilitySlot.startsAt).getTime() - new Date(b.availabilitySlot.startsAt).getTime()
  );

  const upcomingAppointments = appointments.filter(
    (a) => new Date(a.availabilitySlot.startsAt) > new Date() &&
      !isToday(a.availabilitySlot.startsAt) &&
      !["CANCELLED", "AUTO_CANCELLED", "REFUNDED"].includes(a.status)
  ).sort(
    (a, b) => new Date(a.availabilitySlot.startsAt).getTime() - new Date(b.availabilitySlot.startsAt).getTime()
  ).slice(0, 20);

  const freeToday = slots.filter(
    (s) => s.isActive && !s.appointment && isToday(s.startsAt) && new Date(s.startsAt) > new Date()
  ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fbfd]">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#1e9bd4]" />
          <span className="text-sm font-medium">Cargando panel de asistente…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf9f7_0%,#ffffff_50%,#eef5f8_100%)] px-4 pb-24 pt-10 sm:px-6 sm:pt-12">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#1e9bd4]">Panel de asistente</p>
            {me ? (
              <>
                <h1 className="mt-2 text-3xl font-bold text-[#071726]">{me.doctor.fullName}</h1>
                <p className="mt-1 text-sm text-slate-500">{me.doctor.specialty} · {me.doctor.hospital}</p>
              </>
            ) : (
              <h1 className="mt-2 text-3xl font-bold text-[#071726]">Recepción médica</h1>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openModal()}
              disabled={!me}
              className="flex items-center gap-2 rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] disabled:opacity-40"
            >
              <UserPlus className="h-4 w-4" />
              Nueva cita
            </button>
            <button
              onClick={load}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Actualizar
            </button>
            <button
              onClick={logout}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {message && (
          <div className={`mb-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
            message.startsWith("✓")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {message}
          </div>
        )}

        {/* Tarjetas de resumen */}
        {me && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#071726]/5">
                  <Calendar className="h-5 w-5 text-[#071726]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#071726]">{todayAppointments.length}</p>
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
                  <CheckCircle2 className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#071726]">{upcomingAppointments.length}</p>
                  <p className="text-xs text-slate-500">Próximas citas</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Horarios del doctor — agenda de disponibilidad */}
        {me && (
          <ScheduleSection
            slots={slots}
            appointments={appointments}
            onBook={(slotId) => openModal(slotId)}
          />
        )}

        {/* Citas de hoy */}
        <section className="mb-8 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#071726]">Agenda de hoy</h2>

          {todayAppointments.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center">
              <p className="text-sm text-slate-400">Sin citas programadas para hoy.</p>
              <button
                onClick={() => openModal()}
                disabled={!me}
                className="mt-4 rounded-full bg-[#071726] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-40"
              >
                Agendar primera cita del día
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {todayAppointments.map((appt) => {
                const payment = appt.payments[0];
                return (
                  <div
                    key={appt.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#071726]">{appt.patient.user.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(
                          new Date(appt.availabilitySlot.startsAt)
                        )}
                        {payment ? ` · ${payment.provider === "CASH" ? "Efectivo" : payment.provider === "TRANSFER" ? "Transferencia" : "En línea"}` : ""}
                        {appt.patient.phone ? ` · ${appt.patient.phone}` : ""}
                      </p>
                      {appt.reason && (
                        <p className="mt-1 text-xs italic text-slate-400">"{appt.reason}"</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {appt.patient.phone && (
                        <a
                          href={whatsappUrl(appt.patient.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                          title="Contactar por WhatsApp"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </a>
                      )}
                      <StatusBadge status={appt.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Próximas citas */}
        {upcomingAppointments.length > 0 && (
          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#071726]">Próximas citas</h2>
            <div className="mt-5 grid gap-3">
              {upcomingAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#071726]">{appt.patient.user.name}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {dateTime(appt.availabilitySlot.startsAt)}
                      {appt.patient.phone ? ` · ${appt.patient.phone}` : ""}
                    </p>
                    {appt.reason && (
                      <p className="mt-1 text-xs italic text-slate-400">"{appt.reason}"</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {appt.patient.phone && (
                      <a
                        href={whatsappUrl(appt.patient.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                        title="Contactar por WhatsApp"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </a>
                    )}
                    <StatusBadge status={appt.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Branding */}
        <p className="mt-12 text-center text-xs text-slate-400">
          VITAEON · Panel de asistente médico · Acceso restringido
        </p>
      </div>

      {/* Modal nueva cita */}
      {showModal && me && (
        <NewAppointmentModal
          slots={slots}
          doctorName={me.doctor.fullName}
          priceCents={me.doctor.consultationPriceCents}
          initialSlotId={bookSlotId}
          onClose={closeModal}
          onCreated={() => {
            closeModal();
            setMessage("✓ Cita creada correctamente. El paciente recibió una notificación por correo.");
            void load();
          }}
        />
      )}
    </main>
  );
}
