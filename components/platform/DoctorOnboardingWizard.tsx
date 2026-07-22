"use client";

/**
 * DoctorOnboardingWizard — Guía paso a paso para que un médico recién registrado
 * complete su perfil en menos de 10 minutos.
 *
 * 5 pasos:
 *  1. Información básica (nombre, especialidad, hospital)
 *  2. Datos profesionales (cédula, universidad, años de experiencia)
 *  3. Tu consulta (precio, duración, biografía)
 *  4. Contacto y ubicación (dirección, teléfono, redes sociales)
 *  5. Plan — elección de suscripción
 *
 * Se muestra automáticamente cuando el perfil médico está incompleto.
 */

import {
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Instagram,
  Linkedin,
  Loader2,
  MapPin,
  Phone,
  Star,
  Stethoscope,
  User,
  X
} from "lucide-react";
import { useState } from "react";

/* ── Tipos ──────────────────────────────────────────────────── */
type Plan = "oro" | "diamante" | "amatista";

export interface WizardData {
  /* Paso 1 */
  fullName: string;
  specialtyId: string;
  hospitalId: string;
  subSpecialty: string;
  /* Paso 2 */
  professionalLicense: string;
  university: string;
  yearsExperience: string;
  certifications: string;
  /* Paso 3 */
  consultationPriceCents: string;
  consultationDurationMinutes: string;
  bio: string;
  /* Paso 4 */
  officeAddress: string;
  professionalPhone: string;
  instagramUrl: string;
  linkedinUrl: string;
  whatsappUrl: string;
  /* Paso 5 */
  plan: Plan;
}

interface Specialty { id: string; name: string }
interface Hospital  { id: string; name: string }

interface Props {
  specialties: Specialty[];
  hospitals:   Hospital[];
  initialData: Partial<WizardData>;
  onComplete: (data: WizardData) => Promise<void>;
  onSkip: () => void;
}

/* ── Steps config ──────────────────────────────────────────── */
const STEPS = [
  { number: 1, label: "Básico",      icon: <User className="h-4 w-4" /> },
  { number: 2, label: "Profesional", icon: <BadgeCheck className="h-4 w-4" /> },
  { number: 3, label: "Consulta",    icon: <Stethoscope className="h-4 w-4" /> },
  { number: 4, label: "Contacto",    icon: <MapPin className="h-4 w-4" /> },
  { number: 5, label: "Plan",        icon: <Star className="h-4 w-4" /> }
];

const PLANS: Array<{
  id: Plan; name: string; price: string; period: string;
  badge: string; features: string[]; recommended?: boolean;
}> = [
  {
    id: "oro",
    name: "Oro",
    price: "Gratis",
    period: "para siempre",
    badge: "bg-amber-100 text-amber-700",
    features: ["Perfil público verificado", "Una especialidad", "Un hospital", "Visibilidad normal"]
  },
  {
    id: "diamante",
    name: "Diamante",
    price: "$499 MXN",
    period: "por mes",
    badge: "bg-sky-100 text-sky-700",
    features: ["Todo el plan Oro", "Prioridad en búsquedas", "Agenda online", "Aparece sobre perfiles Oro"]
  },
  {
    id: "amatista",
    name: "Amatista",
    price: "$999 MXN",
    period: "por mes",
    badge: "bg-violet-600 text-white",
    recommended: true,
    features: [
      "Todo el plan Diamante",
      "Prioridad máxima en resultados",
      "Asistente IA real (Claude)",
      "Secretaria virtual con resumen diario",
      "Chat cifrado de derivaciones"
    ]
  }
];

/* ── Componente principal ───────────────────────────────────── */
export default function DoctorOnboardingWizard({
  specialties,
  hospitals,
  initialData,
  onComplete,
  onSkip
}: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<WizardData>({
    fullName: "",
    specialtyId: "",
    hospitalId: "",
    subSpecialty: "",
    professionalLicense: "",
    university: "",
    yearsExperience: "",
    certifications: "",
    consultationPriceCents: "100000",
    consultationDurationMinutes: "45",
    bio: "",
    officeAddress: "",
    professionalPhone: "",
    instagramUrl: "",
    linkedinUrl: "",
    whatsappUrl: "",
    plan: "oro",
    ...initialData
  });

  function set(key: keyof WizardData, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function validate(): string | null {
    if (step === 1) {
      if (data.fullName.trim().length < 3)       return "Ingresa tu nombre completo (mínimo 3 caracteres).";
      if (data.fullName.trim().length > 120)     return "El nombre no puede exceder 120 caracteres.";
      if (!data.specialtyId)                     return "Selecciona tu especialidad.";
      if (!data.hospitalId)                      return "Selecciona tu hospital o clínica.";
      if (data.subSpecialty.trim().length < 3)   return "La subespecialidad debe tener al menos 3 caracteres.";
      if (data.subSpecialty.trim().length > 120) return "La subespecialidad no puede exceder 120 caracteres.";
    }
    if (step === 2) {
      if (data.professionalLicense.trim().length < 4)  return "La cédula profesional debe tener al menos 4 caracteres.";
      if (data.professionalLicense.trim().length > 80)  return "La cédula profesional no puede exceder 80 caracteres.";
      if (!data.university.trim())                      return "Ingresa tu universidad de titulación.";
      if (data.university.trim().length > 180)          return "La universidad no puede exceder 180 caracteres.";
      if (!data.yearsExperience)                        return "Ingresa tus años de experiencia.";
      if (data.certifications && data.certifications.trim().length > 160)
        return "Las certificaciones no pueden exceder 160 caracteres.";
    }
    if (step === 3) {
      if (!data.consultationPriceCents) return "Ingresa el precio de tu consulta.";
      if (!data.bio.trim() || data.bio.length < 40)
        return "Escribe una presentación de al menos 40 caracteres.";
    }
    return null;
  }

  function next() {
    const err = validate();
    if (err) { setError(err); return; }
    if (step < 5) setStep((s) => s + 1);
  }

  async function finish() {
    setSaving(true);
    setError("");
    try {
      await onComplete(data);
    } catch (err) {
      // Show the actual API error so the user (and developer) know what to fix.
      setError(err instanceof Error ? err.message : "Ocurrió un error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071726]/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-[0_32px_80px_rgba(7,23,38,0.30)]">

        {/* Skip */}
        <button
          onClick={onSkip}
          className="absolute right-5 top-5 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Omitir wizard"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="border-b border-slate-100 px-7 pb-5 pt-7">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#1e9bd4]">
            Completa tu perfil
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#071726]">
            {STEPS[step - 1].label} — Paso {step} de {STEPS.length}
          </h2>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#1e9bd4] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step pills */}
          <div className="mt-3 flex gap-2">
            {STEPS.map((s) => (
              <div
                key={s.number}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  s.number === step
                    ? "bg-[#071726] text-white"
                    : s.number < step
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-50 text-slate-400"
                }`}
              >
                {s.number < step ? <CheckCircle2 className="h-3 w-3" /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto px-7 py-6">
          {/* Error pinned at the top so it's always visible regardless of scroll position */}
          {error && (
            <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          {step === 1 && (
            <div className="grid gap-4">
              <Label text="Nombre completo">
                <Input
                  value={data.fullName}
                  onChange={(v) => set("fullName", v)}
                  placeholder="Dr. Juan García López"
                  icon={<User className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="Especialidad">
                <select
                  value={data.specialtyId}
                  onChange={(e) => set("specialtyId", e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:ring-2 focus:ring-[#1e9bd4]/10"
                >
                  <option value="">Selecciona tu especialidad…</option>
                  {specialties.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Label>
              <Label text="Hospital o clínica principal">
                <select
                  value={data.hospitalId}
                  onChange={(e) => set("hospitalId", e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:ring-2 focus:ring-[#1e9bd4]/10"
                >
                  <option value="">Selecciona un hospital…</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </Label>
              <Label text="Subespecialidad / Enfoque">
                <Input
                  value={data.subSpecialty}
                  onChange={(v) => set("subSpecialty", v)}
                  placeholder="Ej: Cardiología intervencionista"
                  maxLength={120}
                  icon={<Stethoscope className="h-4 w-4 text-slate-400" />}
                />
                <p className="mt-1 text-right text-xs text-slate-400">{data.subSpecialty.length} / 120</p>
              </Label>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <Label text="Cédula profesional">
                <Input
                  value={data.professionalLicense}
                  onChange={(v) => set("professionalLicense", v)}
                  placeholder="12345678"
                  icon={<BadgeCheck className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="Universidad de titulación">
                <Input
                  value={data.university}
                  onChange={(v) => set("university", v)}
                  placeholder="Universidad de Guanajuato"
                  icon={<Building2 className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="Años de experiencia">
                <Input
                  value={data.yearsExperience}
                  onChange={(v) => set("yearsExperience", v)}
                  placeholder="12"
                  type="number"
                  icon={<Briefcase className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="Certificaciones (opcional)" hint="Ej: Consejo Mexicano de Cardiología">
                <Input
                  value={data.certifications}
                  onChange={(v) => set("certifications", v)}
                  placeholder="Certificaciones y logros"
                  maxLength={160}
                  icon={<Star className="h-4 w-4 text-slate-400" />}
                />
                <p className="mt-1 text-right text-xs text-slate-400">{data.certifications.length} / 160</p>
              </Label>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <Label text="Precio de consulta (MXN)" hint="Ej: 1000 para $1,000 MXN">
                <Input
                  value={String(Number(data.consultationPriceCents) / 100)}
                  onChange={(v) => set("consultationPriceCents", String(Math.round(Number(v) * 100)))}
                  placeholder="1000"
                  type="number"
                  icon={<CreditCard className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="Duración de consulta (minutos)">
                <select
                  value={data.consultationDurationMinutes}
                  onChange={(e) => set("consultationDurationMinutes", e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:ring-2 focus:ring-[#1e9bd4]/10"
                >
                  {[20, 30, 40, 45, 50, 60, 90].map((m) => (
                    <option key={m} value={m}>{m} minutos</option>
                  ))}
                </select>
              </Label>
              <Label text="Presentación profesional" hint="Mínimo 40 caracteres. Describe tu experiencia y enfoque.">
                <textarea
                  value={data.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  rows={4}
                  placeholder="Especialista en… con X años de experiencia en… Me enfoco en…"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:ring-2 focus:ring-[#1e9bd4]/10"
                />
                <p className="mt-1 text-right text-xs text-slate-400">{data.bio.length} / 40 mín.</p>
              </Label>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4">
              <Label text="Dirección del consultorio" hint="Opcional pero mejora tu visibilidad en búsquedas">
                <Input
                  value={data.officeAddress}
                  onChange={(v) => set("officeAddress", v)}
                  placeholder="Blvd. Campestre 123, Col. Jardines del Moral"
                  icon={<MapPin className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="Teléfono profesional">
                <Input
                  value={data.professionalPhone}
                  onChange={(v) => set("professionalPhone", v)}
                  placeholder="+52 477 123 4567"
                  type="tel"
                  icon={<Phone className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="WhatsApp (URL o número)">
                <Input
                  value={data.whatsappUrl}
                  onChange={(v) => set("whatsappUrl", v)}
                  placeholder="https://wa.me/524771234567"
                  icon={<Phone className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="Instagram (URL, opcional)">
                <Input
                  value={data.instagramUrl}
                  onChange={(v) => set("instagramUrl", v)}
                  placeholder="https://instagram.com/drjuangarcia"
                  icon={<Instagram className="h-4 w-4 text-slate-400" />}
                />
              </Label>
              <Label text="LinkedIn (URL, opcional)">
                <Input
                  value={data.linkedinUrl}
                  onChange={(v) => set("linkedinUrl", v)}
                  placeholder="https://linkedin.com/in/drjuangarcia"
                  icon={<Linkedin className="h-4 w-4 text-slate-400" />}
                />
              </Label>
            </div>
          )}

          {step === 5 && (
            <div className="grid gap-3">
              <p className="text-sm leading-6 text-slate-500">
                Puedes empezar con el plan Oro gratuito y cambiar en cualquier momento desde tu panel.
              </p>
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set("plan", p.id)}
                  className={`relative rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                    data.plan === p.id
                      ? "border-[#1e9bd4]/50 bg-[#e8f6fc] ring-2 ring-[#1e9bd4]/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {p.recommended && (
                    <span className="absolute right-3 top-3 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Recomendado
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.badge}`}>{p.name}</span>
                    <span className="font-bold text-[#071726]">{p.price}</span>
                    <span className="text-xs text-slate-400">{p.period}</span>
                    {data.plan === p.id && (
                      <CheckCircle2 className="ml-auto h-4 w-4 flex-shrink-0 text-[#1e9bd4]" />
                    )}
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-slate-500">
                        <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#1e9bd4]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Para planes Diamante y Amatista se abrirá un checkout seguro de Stripe después de crear tu perfil.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-7 py-5">
          <button
            type="button"
            onClick={() => step > 1 ? setStep((s) => s - 1) : onSkip()}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            {step > 1 ? "Atrás" : "Omitir"}
          </button>

          <div className="flex items-center gap-2">
            {/* Dots */}
            {STEPS.map((s) => (
              <div
                key={s.number}
                className={`rounded-full transition ${
                  s.number === step ? "h-2 w-5 bg-[#071726]" : "h-2 w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={step === 5 ? finish : next}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[#071726] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0d2638] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === 5 ? (
              <><Calendar className="h-4 w-4" /> Guardar y activar</>
            ) : (
              <>Siguiente <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-componentes ────────────────────────────────────────── */
function Label({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#071726]">{text}</label>
      {hint && <p className="mb-2 text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  icon
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
          {icon}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3.5 text-sm text-[#071726] outline-none transition focus:border-[#1e9bd4]/40 focus:bg-white focus:ring-2 focus:ring-[#1e9bd4]/10 ${
          icon ? "pl-10 pr-4" : "px-4"
        }`}
      />
    </div>
  );
}
