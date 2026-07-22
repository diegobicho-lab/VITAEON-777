"use client";

import { BadgeCheck, Brain, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, FileText, Hash, Loader2, MessageCircle, Pill, Printer, Search, Send, ShieldCheck, Stethoscope, Tag, Trash2, Upload, Users, Wallet, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ClinicalResourcesSection } from "@/components/platform/ClinicalResourcesSection";
import { DoctorAssistantsSection } from "@/components/platform/DoctorAssistantsSection";
import DoctorOnboardingWizard, { type WizardData } from "@/components/platform/DoctorOnboardingWizard";
import { clientApi } from "@/services/client/api";

type Appointment = {
  id: string;
  status: string;
  acceptedByDoctor?: boolean;
  acceptedAutomatically?: boolean;
  acceptedReason?: string | null;
  cancellationReason?: string | null;
  refundRequested?: boolean;
  refundReason?: string | null;
  doctorRefundDecision?: string | null;
  reschedulePreferred?: boolean;
  previousStartTime?: string | null;
  previousEndTime?: string | null;
  rescheduledAt?: string | null;
  originalAmountCents?: number;
  discountCents?: number;
  discountLabel?: string | null;
  availabilitySlot: { startsAt: string; endsAt: string };
  doctor: { fullName: string; specialty: { name: string }; hospital: { name: string } };
  patient: { id: string; dateOfBirth?: string | null; user: { name: string; email: string } };
  payments: Array<{ status: string; provider: string; amountCents: number }>;
};

type DoctorProfile = {
  id: string;
  fullName: string;
  specialtyId: string;
  hospitalId: string;
  subSpecialty: string;
  bio: string;
  imageUrl?: string | null;
  practicePhotoUrl?: string | null;
  professionalLicensePhotoUrl?: string | null;
  university?: string | null;
  professionalLicense?: string | null;
  officeAddress?: string | null;
  officeReference?: string | null;
  cityState?: string | null;
  mapsUrl?: string | null;
  professionalPhone?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  whatsappUrl?: string | null;
  affiliateCodeLast4?: string | null;
  affiliateDiscountEnabled: boolean;
  stripeAccountId?: string | null;
  stripeOnboardingCompleted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  bankAccountLast4?: string | null;
  consultationPriceCents: number;
  consultationDurationMinutes: number;
  verificationStatus: string;
  verifiedAt?: string | null;
  medal: "oro" | "obsidiana" | "diamante" | "amatista";
  subscriptionStatus: string;
  achievements: string[];
  certifications: string[];
  legalDeclarationAccepted: boolean;
  hospital: { name: string };
  specialty: { name: string };
};

type SpecialtyOption = {
  id: string;
  name: string;
};

type HospitalOption = {
  id: string;
  name: string;
  city: string;
};

type Verification = {
  id: string;
  status: string;
  professionalLicense: string;
  specialtyBoard?: string | null;
  documentUrls: string[];
  doctor: {
    fullName: string;
    specialty: { name: string };
    hospital: { name: string };
    user?: { email: string };
  };
};

type AuditLog = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  actor?: { email: string; name: string } | null;
};

type PatientSummary = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  appointmentsCount: number;
  isActive: boolean;
  createdAt: string;
};

type PaymentSummary = {
  id: string;
  provider: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  appointment: {
    id: string;
    status: string;
    startsAt: string;
    doctor: string;
    specialty: string;
    hospital: string;
    patient?: { name: string; email: string };
  };
};

type SubscriptionPaymentSummary = {
  id: string;
  plan: DoctorProfile["medal"];
  status: string;
  provider: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  doctor: {
    id: string;
    fullName: string;
    email: string;
    subscriptionStatus: string;
  };
};

type AdminDoctorSummary = {
  id: string;
  fullName: string;
  email?: string | null;
  isActive: boolean;
  specialty: string;
  hospital: string;
  verificationStatus: string;
  professionalLicense?: string | null;
  appointmentsCount: number;
  availabilityCount: number;
};

type DoctorOption = {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
};

type DoctorAgenda = {
  summary: { totalSlots: number; booked: number; available: number };
  days: Array<{
    date: string;
    total: number;
    booked: number;
    available: number;
    slots: Array<{
      id: string;
      startsAt: string;
      endsAt: string;
      isActive: boolean;
      repeatBatchId?: string | null;
      generatedByMonthlyRepeat?: boolean;
      repeatLabel?: string | null;
      appointment: null | {
        id: string;
        status: string;
        reason?: string | null;
        patientName: string;
        patientEmail: string;
        specialty: string;
        paymentStatus: string;
        paymentProvider: string;
      };
    }>;
  }>;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type SecretarySummary = {
  nextAppointment: null | {
    patientName: string;
    startsAt: string;
    status: string;
    paymentStatus: string;
  };
  todaySummary: { total: number; booked: number; available: number };
  pendingConfirmations: number;
  remindersToPrepare: number;
  suggestedFreeSlots: Array<{ id: string; startsAt: string; endsAt: string }>;
  notifications: NotificationItem[];
  deliveryChannels: string[];
  externalDeliveryPending: string[];
};

type MedicationResult = {
  status: "ready" | "integration_pending";
  disclaimer: string;
  results: Array<{
    name: string;
    activeSubstance?: string;
    presentations: string[];
    indications: string;
    contraindications: string;
    warnings: string;
    referenceDose?: string;
    source: string;
    sourceUrl?: string;
  }>;
};

type MedicalConversation = {
  id: string;
  title: string;
  status: string;
  patientAlias?: string | null;
  clinicalSummary?: string | null;
  createdByDoctor: { id: string; fullName: string };
  recipientDoctor?: { id: string; fullName: string } | null;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    sender?: { name: string; role: string } | null;
  }>;
};

type AssistantResponse = {
  title: string;
  specialty: string;
  priority: string;
  checklist: string[];
  note: string;
};

type ReviewSummary = {
  average: number;
  total: number;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    doctorReply?: string | null;
    status: string;
    patientName: string;
    doctorName?: string;
    createdAt: string;
  }>;
};

type MarketplaceListingSummary = {
  id: string;
  type: string;
  name: string;
  description: string;
  cityOrZone: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  subscriptionStatus: string;
  createdAt: string;
};

type ObsidianProfile = {
  id: string;
  serviceType: "MEDICAL_REPRESENTATIVE" | "CATERING";
  businessName: string;
  description: string;
  cityOrZone: string;
  priceRange?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  status: string;
  subscriptionStatus: string;
  createdAt: string;
  updatedAt: string;
};

type ClinicalHistoryRecord = {
  id: string;
  patientId: string;
  appointmentId: string;
  identificationCard?: string | null;
  ethnicGroup?: string | null;
  hereditaryFamilyHistory?: string | null;
  nonPathologicalHistory?: string | null;
  pathologicalHistory?: string | null;
  surgicalHistory?: string | null;
  fractureHistory?: string | null;
  gynecoObstetricHistory?: string | null;
  consultationReason?: string | null;
  currentCondition?: string | null;
  systemsReview?: string | null;
  physicalExam?: string | null;
  labsAndImaging?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  diagnosesOrClinicalProblems?: string | null;
  therapeuticIndication?: string | null;
  plan?: string | null;
  prognosis?: string | null;
  healthStatus?: string | null;
  additionalMedicalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  patient: { user: { name: string; email: string } };
  appointment: { availabilitySlot: { startsAt: string; endsAt: string } };
};

type PrescriptionTemplateRecord = {
  id: string;
  doctorName: string;
  specialty: string;
  professionalLicense?: string | null;
  phone?: string | null;
  officeAddress?: string | null;
  headerImageUrl?: string | null;
  signatureImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PrescriptionTemplateResponse = {
  template: PrescriptionTemplateRecord | null;
  defaults: {
    doctorName: string;
    specialty: string;
    professionalLicense: string;
    phone: string;
    officeAddress: string;
  };
};

type PrescriptionRecord = {
  id: string;
  patientId: string;
  appointmentId: string;
  templateId?: string | null;
  patientAge?: string | null;
  diagnosis?: string | null;
  medicationInstructions?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  generalRecommendations?: string | null;
  additionalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  patient: { user: { name: string; email: string } };
  appointment: { availabilitySlot: { startsAt: string; endsAt: string } };
  template?: PrescriptionTemplateRecord | null;
};

const planLabels = {
  oro: "Oro",
  obsidiana: "Obsidiana",
  diamante: "Diamante",
  amatista: "Amatista"
};

const doctorPlans = [
  {
    id: "oro",
    name: "Oro",
    price: "$0 MXN",
    description: "Perfil básico, especialidad, hospital, fotografía, títulos médicos y visibilidad normal."
  },
  {
    id: "obsidiana",
    name: "Obsidiana",
    price: "$499 MXN / mes",
    description: "Suscripción comercial para representantes médicos y servicios de catering. Permite aparecer en el directorio comercial de VITAEON sin acceso al panel médico."
  },
  {
    id: "diamante",
    name: "Diamante",
    price: "$499 MXN / mes",
    description: "Todo Oro, con prioridad sobre perfiles Oro, mayor presencia en resultados y renovación mensual automática."
  },
  {
    id: "amatista",
    name: "Amatista",
    price: "$999 MXN / mes",
    description: "Prioridad máxima, asistente IA real (Claude), agenda personalizada, calendario inteligente y renovación mensual automática."
  }
] satisfies Array<{ id: DoctorProfile["medal"]; name: string; price: string; description: string }>;

const emptyClinicalForm = {
  identificationCard: "",
  ethnicGroup: "",
  hereditaryFamilyHistory: "",
  nonPathologicalHistory: "",
  pathologicalHistory: "",
  surgicalHistory: "",
  fractureHistory: "",
  gynecoObstetricHistory: "",
  consultationReason: "",
  currentCondition: "",
  systemsReview: "",
  physicalExam: "",
  labsAndImaging: "",
  diagnosis: "",
  treatment: "",
  diagnosesOrClinicalProblems: "",
  therapeuticIndication: "",
  plan: "",
  prognosis: "",
  healthStatus: "",
  additionalMedicalNotes: ""
};

const emptyPrescriptionTemplateForm = {
  doctorName: "",
  specialty: "",
  professionalLicense: "",
  phone: "",
  officeAddress: "",
  headerImageUrl: "",
  signatureImageUrl: ""
};

const emptyPrescriptionForm = {
  id: "",
  patientAge: "",
  diagnosis: "",
  medicationInstructions: "",
  dosage: "",
  frequency: "",
  duration: "",
  generalRecommendations: "",
  additionalNotes: ""
};

type ClinicalFormState = typeof emptyClinicalForm;
type PrescriptionTemplateFormState = typeof emptyPrescriptionTemplateForm;
type PrescriptionFormState = typeof emptyPrescriptionForm;

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function money(cents: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

function shortTime(value: string | Date) {
  return new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date(value));
}

function durationLabel(startsAt: string, endsAt: string) {
  const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000));
  return `${minutes} min`;
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printableText(value?: string | null) {
  return escapeHtml(value || "Sin registro").replaceAll("\n", "<br />");
}

function openPrintWindow(title: string, body: string) {
  const printWindow = window.open("", "_blank", "width=920,height=720");
  if (!printWindow) return false;
  printWindow.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 18mm; }
          body { color: #082033; font-family: Arial, sans-serif; line-height: 1.55; margin: 0; }
          h1 { font-size: 24px; margin: 0 0 8px; }
          h2 { border-top: 1px solid #dce8ef; font-size: 15px; letter-spacing: .12em; margin: 24px 0 8px; padding-top: 14px; text-transform: uppercase; }
          p { margin: 0 0 8px; }
          .muted { color: #5b6b7f; }
          .header { align-items: center; border-bottom: 1px solid #dce8ef; display: flex; gap: 18px; margin-bottom: 20px; padding-bottom: 16px; }
          .header img { max-height: 86px; max-width: 220px; object-fit: contain; }
          .grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .box { border: 1px solid #dce8ef; border-radius: 16px; padding: 14px; }
          .signature { margin-top: 42px; max-height: 110px; max-width: 240px; object-fit: contain; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>${body}</body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}

function calculateAgeLabel(dateOfBirth?: string | null) {
  if (!dateOfBirth) return "";
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? `${age} años` : "";
}

function buildTimePreview(startTime: string, endTime: string, durationMinutes: 45 | 60) {
  if (!startTime || !endTime || endTime <= startTime) return [];
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const base = new Date(2026, 0, 1, startHour, startMinute, 0, 0);
  const end = new Date(2026, 0, 1, endHour, endMinute, 0, 0);
  const values: string[] = [];
  for (let cursor = base; new Date(cursor.getTime() + durationMinutes * 60_000) <= end; cursor = new Date(cursor.getTime() + durationMinutes * 60_000)) {
    values.push(new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(cursor));
  }
  return values;
}

const appointmentLabels: Record<string, string> = {
  PENDING: "Pendiente",
  PENDING_DOCTOR_ACCEPTANCE: "Esperando aceptación médica",
  ACCEPTED: "Cita aceptada",
  CONFIRMED: "Confirmada",
  RESCHEDULED: "Reagendada",
  COMPLETED: "Cita completada",
  NO_SHOW: "El médico marcó que el paciente no asistió",
  RESCHEDULE_REQUESTED: "Reagendamiento solicitado",
  CANCELLATION_REQUESTED: "Cancelación solicitada",
  REFUND_PENDING: "Reembolso pendiente de revisión",
  AUTO_CANCELLED: "Cita cancelada automáticamente por vencimiento",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
  PAID: "Pago confirmado",
  FAILED: "Fallido",
  PENDING_PAYMENT: "Pago pendiente",
  VERIFIED: "Médico verificado",
  REJECTED: "Rechazado",
  IN_REVIEW: "En revisión",
  UNVERIFIED: "No verificado",
  ACTIVE: "Activo",
  INACTIVO: "Inactivo",
  ACTIVO: "Activo"
};

const pendingAppointmentStatuses = [
  "PENDING",
  "PENDING_DOCTOR_ACCEPTANCE",
  "RESCHEDULE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "REFUND_PENDING"
];

const confirmedAppointmentStatuses = [
  "ACCEPTED",
  "CONFIRMED",
  "RESCHEDULED"
];

function readableStatus(value: string) {
  return appointmentLabels[value] ?? value.replaceAll("_", " ").toLowerCase();
}

function statusTextColor(status: string) {
  if (["ACCEPTED","CONFIRMED","COMPLETED","PAID"].includes(status)) return "text-emerald-700";
  if (["CANCELLED","FAILED","REJECTED","NO_SHOW","AUTO_CANCELLED"].includes(status)) return "text-red-700";
  if (["REFUND_PENDING","CANCELLATION_REQUESTED","RESCHEDULE_REQUESTED"].includes(status)) return "text-sky-700";
  return "text-amber-700";
}

function appointmentAccentBg(status: string) {
  if (["ACCEPTED","CONFIRMED","COMPLETED","PAID"].includes(status)) return "bg-emerald-400";
  if (["CANCELLED","FAILED","REJECTED","NO_SHOW","AUTO_CANCELLED"].includes(status)) return "bg-red-400";
  if (["REFUND_PENDING","CANCELLATION_REQUESTED","RESCHEDULE_REQUESTED"].includes(status)) return "bg-sky-400";
  return "bg-amber-400";
}

function appointmentReadableStatus(value: string) {
  if (value === "PENDING") return "Esperando aceptación médica";
  if (value === "COMPLETED") return "Cita completada";
  if (value === "ACCEPTED") return "Cita aceptada";
  if (value === "CONFIRMED") return "Cita confirmada";
  if (value === "RESCHEDULED") return "Cita reagendada";
  return readableStatus(value);
}

function Badge({ value }: { value: string }) {
  const success = ["ACCEPTED", "CONFIRMED", "COMPLETED", "PAID", "VERIFIED", "ACTIVE", "ACTIVO"].includes(value);
  const danger = ["CANCELLED", "FAILED", "REJECTED", "NO_SHOW", "AUTO_CANCELLED"].includes(value);
  const refund = ["REFUND_PENDING", "CANCELLATION_REQUESTED", "RESCHEDULE_REQUESTED"].includes(value);
  const tone = success
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : danger
      ? "border-red-200 bg-red-50 text-red-700"
      : refund
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const dot = success ? "bg-emerald-500" : danger ? "bg-red-500" : refund ? "bg-sky-500" : "bg-amber-500";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold leading-none ${tone}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {readableStatus(value)}
    </span>
  );
}

function paymentReadableStatus(status: string, provider: string) {
  if (status === "FAILED") return "Pago fallido";
  if (status === "REFUNDED") return "Pago reembolsado";
  if (provider === "STRIPE" && status === "PAID") return "Pago Stripe realizado";
  if (provider === "STRIPE") return "Pago Stripe pendiente";
  if (provider === "CASH" && status === "PAID") return "Pago en efectivo realizado";
  if (provider === "CASH") return "Pago en efectivo pendiente";
  if (provider === "TRANSFER" && status === "PAID") return "Transferencia confirmada";
  if (provider === "TRANSFER") return "Transferencia pendiente";
  return readableStatus(status);
}

function paymentProviderLabel(provider?: string) {
  if (provider === "STRIPE") return "Pago en línea";
  if (provider === "CASH") return "Efectivo";
  if (provider === "TRANSFER") return "Transferencia";
  if (provider === "MERCADO_PAGO") return "Mercado Pago";
  return "Pago pendiente";
}

function PaymentBadge({ status, provider }: { status: string; provider: string }) {
  const paid = status === "PAID";
  const failed = status === "FAILED";
  const refunded = status === "REFUNDED";
  const tone = paid
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : failed
      ? "border-red-200 bg-red-50 text-red-700"
      : refunded
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const dot = paid ? "bg-emerald-500" : failed ? "bg-red-500" : refunded ? "bg-sky-500" : "bg-amber-500";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold leading-none ${tone}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {paymentReadableStatus(status, provider)}
    </span>
  );
}

// ─── Plan activation card ─────────────────────────────────────────────────────
const planActivatingConfig = {
  amatista: {
    gradient: "bg-gradient-to-br from-[#2d1b69] via-[#4c1d95] to-[#6d28d9]",
    accent: "text-violet-300",
    ring: "bg-violet-400/20",
    dot: "bg-violet-300/80",
    label: "Plan Amatista",
    iconColor: "text-violet-200",
  },
  diamante: {
    gradient: "bg-gradient-to-br from-[#071726] via-[#0a3d5c] to-[#0a7abf]",
    accent: "text-sky-300",
    ring: "bg-sky-400/20",
    dot: "bg-sky-300/80",
    label: "Plan Diamante",
    iconColor: "text-sky-200",
  },
  obsidiana: {
    gradient: "bg-gradient-to-br from-[#0a0a0f] via-[#111827] to-[#1e293b]",
    accent: "text-amber-400",
    ring: "bg-amber-400/15",
    dot: "bg-amber-400/70",
    label: "Plan Obsidiana",
    iconColor: "text-amber-300",
  },
} as const;

function PlanActivatingCard({ plan }: { plan: keyof typeof planActivatingConfig | null }) {
  const cfg = plan ? planActivatingConfig[plan] : planActivatingConfig.diamante;
  return (
    <section className={`relative overflow-hidden rounded-[1.75rem] ${cfg.gradient} p-10 text-white`}>
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/[0.03]" />

      <div className="relative flex flex-col items-center text-center">
        {/* Pulsing icon */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className={`absolute h-32 w-32 animate-ping rounded-full ${cfg.ring}`} style={{ animationDuration: "2.2s" }} />
          <div className={`absolute h-20 w-20 animate-pulse rounded-full ${cfg.ring}`} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
            <CreditCard className={`h-7 w-7 ${cfg.iconColor}`} />
          </div>
        </div>

        <p className={`text-xs font-semibold uppercase tracking-[0.32em] ${cfg.accent}`}>Verificando con Stripe</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">
          Activando {plan ? cfg.label : "tu plan"}
        </h2>
        <p className="mt-4 max-w-sm text-base leading-7 text-white/70">
          Tu pago fue recibido. Estamos confirmando la activación. Esto toma solo unos momentos.
        </p>

        {/* Animated bouncing dots */}
        <div className="mt-8 flex items-center gap-2.5">
          {([0, 160, 320] as const).map((delay) => (
            <div
              key={delay}
              className={`h-2 w-2 animate-bounce rounded-full ${cfg.dot}`}
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>

        <p className="mt-10 text-xs text-white/35">
          No cierres esta ventana · Tu pago está seguro con Stripe
        </p>
      </div>
    </section>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function Shell({ eyebrow, title, children, headerExtra }: { eyebrow: string; title: string; children: ReactNode; headerExtra?: ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#eef4f9_0%,#f4f8fc_40%,#edf2f7_100%)] px-4 pb-24 pt-28 text-ink sm:px-6 sm:pt-32">
      <section className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-silver/40 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-medical">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold text-deep sm:text-4xl">{title}</h1>
          {headerExtra}
        </header>
        {children}
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-silver/60 bg-white px-5 py-4 text-slate-500 shadow-soft">
        <Loader2 className="h-5 w-5 animate-spin text-medical" />
        <span className="text-sm font-medium">Cargando información segura...</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-[1.5rem]" />)}
      </div>
    </div>
  );
}

export function PatientDashboardClient() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setAppointments(await clientApi<Appointment[]>("/api/appointments"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar tus citas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function refreshOnFocus() {
      if (document.visibilityState === "visible") {
        void load();
      }
    }
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => document.removeEventListener("visibilitychange", refreshOnFocus);
  }, []);

  async function updatePatientAppointment(id: string, action: "REQUEST_CANCELLATION" | "REQUEST_RESCHEDULE") {
    await clientApi(`/api/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        action,
        cancellationReason: action === "REQUEST_CANCELLATION" ? "Cancelación solicitada por paciente desde panel." : undefined
      })
    });
    await load();
  }

  const totalCitas = appointments.length;
  const completadas = appointments.filter((a) => a.status === "COMPLETED").length;
  const activas = appointments.filter((a) => ["PENDING", "ACCEPTED", "CONFIRMED"].includes(a.status)).length;

  return (
    <Shell
      eyebrow="Pacientes"
      title="Tu expediente premium"
      headerExtra={!loading && !error && appointments.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="flex flex-col rounded-2xl border border-silver/60 bg-white/80 px-5 py-3 shadow-sm">
            <span className="text-2xl font-bold text-deep">{totalCitas}</span>
            <span className="mt-0.5 text-xs text-slate-500">Citas totales</span>
          </div>
          <div className="flex flex-col rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-3">
            <span className="text-2xl font-bold text-emerald-700">{completadas}</span>
            <span className="mt-0.5 text-xs text-emerald-600">Completadas</span>
          </div>
          <div className="flex flex-col rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-3">
            <span className="text-2xl font-bold text-amber-700">{activas}</span>
            <span className="mt-0.5 text-xs text-amber-600">Activas</span>
          </div>
        </div>
      ) : undefined}
    >
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : (
        <div className="mt-8 grid gap-5">
          {appointments.length === 0 && <EmptyState text="Aún no tienes citas registradas." />}
          {appointments.map((appointment) => (
            <article key={appointment.id} className="relative overflow-hidden rounded-[1.75rem] border border-silver/70 bg-white/95 shadow-[0_4px_24px_rgba(8,32,51,0.05)] transition-shadow duration-300 hover:shadow-[0_12px_48px_rgba(8,32,51,0.09)]">
              {/* Status accent strip */}
              <div className={`absolute inset-y-0 left-0 w-1 ${appointmentAccentBg(appointment.status)}`} />
              <div className="p-6 pl-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-deep sm:text-2xl">{appointment.doctor.fullName}</h2>
                    <p className="mt-1.5 text-sm text-slate-500">{appointment.doctor.specialty.name} · {appointment.doctor.hospital.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge value={appointment.status} />
                    <PaymentBadge status={appointment.payments[0]?.status ?? "PENDING"} provider={appointment.payments[0]?.provider ?? "PENDING"} />
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="h-4 w-4 shrink-0 text-medical" />
                  {dateTime(appointment.availabilitySlot.startsAt)}
                </p>

                {/* Ticket ficha */}
                <div className="mt-5 overflow-hidden rounded-2xl border border-silver/60 bg-white">
                  <div className="border-b border-silver/50 bg-slate-50/80 px-5 py-2.5">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-slate-400">Ticket de cita</p>
                  </div>
                  <div className="divide-y divide-silver/40 px-5">
                    <div className="flex items-center gap-3 py-3">
                      <Hash className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="w-24 shrink-0 text-xs text-slate-400 sm:w-28">Folio</span>
                      <span className="truncate font-mono text-xs text-slate-600">{appointment.id}</span>
                    </div>
                    <div className="flex items-center gap-3 py-3">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="w-24 shrink-0 text-xs text-slate-400 sm:w-28">Estado de cita</span>
                      <span className={`text-xs font-semibold ${statusTextColor(appointment.status)}`}>{appointmentReadableStatus(appointment.status)}</span>
                    </div>
                    <div className="flex items-center gap-3 py-3">
                      <CreditCard className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="w-24 shrink-0 text-xs text-slate-400 sm:w-28">Pago</span>
                      <span className="text-xs text-slate-600">{paymentProviderLabel(appointment.payments[0]?.provider)} · {money(appointment.payments[0]?.amountCents ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-3 py-3">
                      <Wallet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="w-24 shrink-0 text-xs text-slate-400 sm:w-28">Estado de pago</span>
                      <span className="text-xs text-slate-600">{paymentReadableStatus(appointment.payments[0]?.status ?? "PENDING", appointment.payments[0]?.provider ?? "PENDING")}</span>
                    </div>
                    {appointment.discountCents ? (
                      <div className="flex items-center gap-3 py-3">
                        <Tag className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="w-24 shrink-0 text-xs text-slate-400 sm:w-28">{appointment.discountLabel}</span>
                        <span className="text-xs font-semibold text-emerald-700">-{money(appointment.discountCents)}</span>
                      </div>
                    ) : null}
                  </div>
                  {appointment.status === "COMPLETED" && (
                    <div className="mx-4 mb-4 mt-2 flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Consulta finalizada. El médico marcó esta cita como completada.
                    </div>
                  )}
                  {appointment.acceptedAutomatically && (
                    <div className="mx-4 mb-4 mt-2 flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Pago confirmado. Tu cita fue aceptada automáticamente por confirmación en línea.
                    </div>
                  )}
                  <p className="px-5 pb-4 pt-1 text-xs leading-5 text-slate-400">
                    Tu ticket de cita fue creado correctamente. Puedes consultarlo en tu panel de paciente en la sección Mis citas.
                  </p>
                </div>

                {appointment.status === "NO_SHOW" && (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button onClick={() => updatePatientAppointment(appointment.id, "REQUEST_RESCHEDULE")} className="w-full rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] sm:w-auto">Solicitar reagendar</button>
                    <button onClick={() => updatePatientAppointment(appointment.id, "REQUEST_CANCELLATION")} className="w-full rounded-full border border-silver/70 bg-white px-5 py-3 text-sm font-semibold text-deep shadow-soft transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:w-auto">Solicitar devolución/cancelación</button>
                  </div>
                )}
                {!["CANCELLED", "COMPLETED", "REFUND_PENDING", "REFUNDED", "NO_SHOW"].includes(appointment.status) && (
                  <button onClick={() => updatePatientAppointment(appointment.id, "REQUEST_CANCELLATION")} className="mt-5 w-full rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep transition hover:bg-red-50 hover:text-red-700 sm:w-auto">Solicitar cancelación</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function DoctorDashboardClient() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agenda, setAgenda] = useState<DoctorAgenda | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [secretarySummary, setSecretarySummary] = useState<SecretarySummary | null>(null);
  const [conversations, setConversations] = useState<MedicalConversation[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantResponse, setAssistantResponse] = useState<AssistantResponse | null>(null);
  const [recipientDoctorId, setRecipientDoctorId] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [patientAlias, setPatientAlias] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [fullName, setFullName] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [medal, setMedal] = useState<DoctorProfile["medal"]>("oro");
  const [professionalLicense, setProfessionalLicense] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [subSpecialty, setSubSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [practicePhotoUrl, setPracticePhotoUrl] = useState("");
  const [professionalLicensePhotoUrl, setProfessionalLicensePhotoUrl] = useState("");
  const [university, setUniversity] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [officeReference, setOfficeReference] = useState("");
  const [cityState, setCityState] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [professionalPhone, setProfessionalPhone] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [affiliateCode, setAffiliateCode] = useState("");
  const [doctorReviews, setDoctorReviews] = useState<ReviewSummary | null>(null);
  const [reviewReply, setReviewReply] = useState("");
  const [activeSection, setActiveSection] = useState<"resumen" | "agenda" | "disponibilidad" | "perfil" | "suscripcion" | "cobros" | "opiniones" | "recursos" | "notificaciones" | "asistentes">("resumen");
  const [achievementsText, setAchievementsText] = useState("");
  const [certificationsText, setCertificationsText] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [price, setPrice] = useState("");
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockEndTime, setBlockEndTime] = useState("13:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<45 | 60>(45);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [selectedCalendarDates, setSelectedCalendarDates] = useState<string[]>([]);
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [lastRepeatBatchId, setLastRepeatBatchId] = useState("");
  const [medicationQuery, setMedicationQuery] = useState("");
  const [medicationResult, setMedicationResult] = useState<MedicationResult | null>(null);
  const [cancellationModal, setCancellationModal] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [activeAmatistaTool, setActiveAmatistaTool] = useState<"historias" | "recetario" | null>(null);
  const [clinicalHistories, setClinicalHistories] = useState<ClinicalHistoryRecord[]>([]);
  const [clinicalSearch, setClinicalSearch] = useState("");
  const [selectedClinicalAppointmentId, setSelectedClinicalAppointmentId] = useState("");
  const [clinicalForm, setClinicalForm] = useState<ClinicalFormState>({ ...emptyClinicalForm });
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [clinicalStatus, setClinicalStatus] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [prescriptionSearch, setPrescriptionSearch] = useState("");
  const [selectedPrescriptionAppointmentId, setSelectedPrescriptionAppointmentId] = useState("");
  const [prescriptionTemplate, setPrescriptionTemplate] = useState<PrescriptionTemplateFormState>({ ...emptyPrescriptionTemplateForm });
  const [prescriptionTemplateId, setPrescriptionTemplateId] = useState("");
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormState>({ ...emptyPrescriptionForm });
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);
  const [prescriptionStatus, setPrescriptionStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [activatingPlan, setActivatingPlan] = useState<keyof typeof planActivatingConfig | null>(null);
  const [additionalLocations, setAdditionalLocations] = useState<Array<{ id: string; notes?: string | null; hospital: { id: string; name: string; city: string } }>>([]);
  const [newLocHospitalId, setNewLocHospitalId] = useState("");
  const [newLocNotes, setNewLocNotes] = useState("");
  const [message, setMessage] = useState("");
  const [subscriptionAction, setSubscriptionAction] = useState("");
  const assistantEnabled = medal === "amatista";
  const collaborationEnabled = medal === "amatista";
  const amatistaToolsEnabled = medal === "amatista" && profile?.subscriptionStatus === "ACTIVE";
  // Historias clínicas y recetario disponibles para todos los planes salvo Obsidiana
  const clinicalToolsEnabled = medal !== "obsidiana";
  const activeDoctorAppointments = appointments.filter((appointment) => !["CANCELLED", "COMPLETED", "NO_SHOW", "REFUNDED", "AUTO_CANCELLED"].includes(appointment.status));

  function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  async function load(month = calendarMonth) {
    setLoading(true);
    try {
    const [doctor, appointmentData, agendaData, doctorData, specialtyData, hospitalData, notificationData, reviewData] = await Promise.all([
      clientApi<DoctorProfile>("/api/doctors/me"),
      clientApi<Appointment[]>("/api/appointments"),
      clientApi<DoctorAgenda>(`/api/doctor-agenda?month=${monthKey(month)}`),
      clientApi<Array<{ id: string; name: string; specialty: string; hospital: string }>>("/api/doctors"),
      clientApi<SpecialtyOption[]>("/api/specialties"),
      clientApi<HospitalOption[]>("/api/hospitals"),
      clientApi<NotificationItem[]>("/api/notifications"),
      clientApi<ReviewSummary>("/api/reviews?mine=true")
    ]);
    setProfile(doctor);
    setFullName(doctor.fullName);
    setSpecialtyId(doctor.specialtyId);
    setHospitalId(doctor.hospitalId);
    setMedal(doctor.medal);
    setSubSpecialty(doctor.subSpecialty);
    setBio(doctor.bio);
    setImageUrl(doctor.imageUrl ?? "");
    setPracticePhotoUrl(doctor.practicePhotoUrl ?? "");
    setProfessionalLicensePhotoUrl(doctor.professionalLicensePhotoUrl ?? "");
    setUniversity(doctor.university ?? "");
    setOfficeAddress(doctor.officeAddress ?? "");
    setOfficeReference(doctor.officeReference ?? "");
    setCityState(doctor.cityState ?? "");
    setMapsUrl(doctor.mapsUrl ?? "");
    setProfessionalPhone(doctor.professionalPhone ?? "");
    setInstagramUrl(doctor.instagramUrl ?? "");
    setFacebookUrl(doctor.facebookUrl ?? "");
    setLinkedinUrl(doctor.linkedinUrl ?? "");
    setWebsiteUrl(doctor.websiteUrl ?? "");
    setWhatsappUrl(doctor.whatsappUrl ?? "");
    setAffiliateCode("");
    setProfessionalLicense(doctor.professionalLicense ?? "");
    setAchievementsText(doctor.achievements.join("\n"));
    setCertificationsText(doctor.certifications.join("\n"));
    setLegalAccepted(doctor.legalDeclarationAccepted);
    setPrice(String(Math.round(doctor.consultationPriceCents / 100)));
    setAppointments(appointmentData);
    setAgenda(agendaData);
    setDoctorOptions(doctorData.filter((item) => item.id !== doctor.id));
    setSpecialties(specialtyData);
    setHospitals(hospitalData);
    setNotifications(notificationData);
    setDoctorReviews(reviewData);
    if (doctor.medal === "amatista") {
      const conversationData = await clientApi<MedicalConversation[]>("/api/doctor-conversations").catch(() => []);
      setConversations(conversationData);
      const secretary = await clientApi<SecretarySummary>("/api/doctor-assistant").catch(() => null);
      setSecretarySummary(secretary);
    } else {
      setConversations([]);
      setSecretarySummary(null);
    }
    /* Consultorios adicionales */
    const locationData = await clientApi<Array<{ id: string; notes?: string | null; hospital: { id: string; name: string; city: string } }>>("/api/doctor-locations").catch(() => []);
    setAdditionalLocations(locationData);

    /* Mostrar wizard si el perfil está incompleto (médico recién registrado) */
    const profileIncomplete = !doctor.professionalLicense || !doctor.bio || doctor.bio.length < 40;
    setShowWizard(profileIncomplete);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible cargar el panel médico.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Lee ?subscription=success|cancelled que Stripe añade al redirigir de vuelta.
    const params = new URLSearchParams(window.location.search);
    const subscriptionResult = params.get("subscription");
    // Limpia el parámetro de la URL sin recargar la página.
    if (subscriptionResult) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    void (async () => {
      await load();

      if (subscriptionResult === "cancelled") {
        setActiveSection("suscripcion");
        setMessage("El pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.");
        return;
      }

      if (subscriptionResult !== "success") return;

      // Volvemos de Stripe — mostramos la tarjeta de activación y hacemos polling
      // en background hasta 75 intentos × 4 s = 5 min.  Sin recargas: la tarjeta
      // se transforma en mensaje de éxito en cuanto el webhook actualiza la DB.
      const planParam = params.get("plan");
      const validPlan = (planParam && planParam in planActivatingConfig) ? planParam as keyof typeof planActivatingConfig : null;
      setActivatingPlan(validPlan);
      setActiveSection("suscripcion");
      setMessage("");

      let pollAttempts = 0;
      const MAX_POLL = 75; // 5 min máximo

      const pollActivation = async () => {
        pollAttempts++;
        try {
          const doc = await clientApi<DoctorProfile>("/api/doctors/me");
          if (doc.subscriptionStatus === "ACTIVE" && doc.medal !== "oro") {
            const planLabel = doc.medal in planActivatingConfig ? planActivatingConfig[doc.medal as keyof typeof planActivatingConfig].label : `Plan ${doc.medal}`;
            setMedal(doc.medal);
            setProfile(doc);
            setActivatingPlan(null);
            setMessage(`✓ ¡${planLabel} activo! Tu perfil ya aparece con prioridad en búsquedas.`);
            void load();
            return;
          }
        } catch { /* continúa */ }
        if (pollAttempts < MAX_POLL) {
          setTimeout(() => void pollActivation(), 4000);
        } else {
          // Después de 5 min sin respuesta — mensaje sin recarga
          setActivatingPlan(null);
          setMessage(
            "Tu pago fue registrado, pero la activación está tardando más de lo esperado. Recarga la página en un momento o contacta soporte si el plan no cambia."
          );
        }
      };

      setTimeout(() => void pollActivation(), 4000);
    })();

    // La carga inicial corre una sola vez; los cambios de mes refrescan la agenda desde el calendario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleWizardComplete(data: WizardData) {
    const priceCents = data.consultationPriceCents ? parseInt(data.consultationPriceCents, 10) : undefined;
    const durationMins = data.consultationDurationMinutes ? parseInt(data.consultationDurationMinutes, 10) : undefined;
    const yearsExp = data.yearsExperience ? parseInt(data.yearsExperience, 10) : undefined;
    const certificationsList = data.certifications?.trim() ? [data.certifications.trim()] : undefined;

    await clientApi("/api/doctors/me", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: data.fullName || undefined,
        specialtyId: data.specialtyId || undefined,
        hospitalId: data.hospitalId || undefined,
        subSpecialty: data.subSpecialty || undefined,
        professionalLicense: data.professionalLicense || undefined,
        university: data.university || undefined,
        yearsExperience: yearsExp,
        consultationPriceCents: priceCents,
        consultationDurationMinutes: durationMins,
        bio: data.bio || undefined,
        officeAddress: data.officeAddress || undefined,
        professionalPhone: data.professionalPhone || undefined,
        instagramUrl: data.instagramUrl || undefined,
        linkedinUrl: data.linkedinUrl || undefined,
        whatsappUrl: data.whatsappUrl || undefined,
        certifications: certificationsList,
        legalDeclarationAccepted: true
      })
    });

    setShowWizard(false);
    await load();

    if (data.plan !== "oro") {
      // Inicia el checkout de Stripe directamente — si falla, aterriza en la
      // pestaña de suscripción con el mensaje de error visible.
      try {
        await checkoutPlan(data.plan as DoctorProfile["medal"]);
      } catch (err) {
        setMessage(
          err instanceof Error
            ? err.message
            : "No fue posible iniciar el pago del plan. Ve a Suscripción para intentarlo de nuevo."
        );
        setActiveSection("suscripcion");
      }
    } else {
      setMessage("¡Perfil completado con éxito! Publica tu disponibilidad para recibir pacientes.");
    }
  }

  async function addLocation() {
    setMessage("");
    if (!newLocHospitalId) { setMessage("Selecciona un hospital para agregar."); return; }
    await clientApi("/api/doctor-locations", {
      method: "POST",
      body: JSON.stringify({ hospitalId: newLocHospitalId, notes: newLocNotes || undefined })
    });
    setNewLocHospitalId("");
    setNewLocNotes("");
    setMessage("Consultorio adicional agregado.");
    const locationData = await clientApi<typeof additionalLocations>("/api/doctor-locations").catch(() => []);
    setAdditionalLocations(locationData);
  }

  async function removeLocation(locationId: string) {
    setMessage("");
    await clientApi(`/api/doctor-locations?id=${encodeURIComponent(locationId)}`, { method: "DELETE" });
    setMessage("Consultorio eliminado.");
    const locationData = await clientApi<typeof additionalLocations>("/api/doctor-locations").catch(() => []);
    setAdditionalLocations(locationData);
  }

  async function toggleAvailability(slotId: string, isActive: boolean) {
    setMessage("");
    await clientApi("/api/availability", { method: "PATCH", body: JSON.stringify({ slotId, isActive }) });
    setMessage(isActive ? "Horario activado para pacientes." : "Horario marcado como no disponible.");
    await load();
  }

  async function deleteAvailability(slotId: string) {
    setMessage("");
    await clientApi("/api/availability", { method: "DELETE", body: JSON.stringify({ slotId }) });
    setMessage("Horario eliminado del calendario.");
    await load();
  }

  async function markSelectedDayUnavailable() {
    setMessage("");
    const selectedDay = agenda?.days.find((day) => day.date === selectedCalendarDate);
    const activeFreeSlots = selectedDay?.slots.filter((slot) => slot.isActive && !slot.appointment) ?? [];
    if (activeFreeSlots.length === 0) {
      setMessage("El día seleccionado no tiene horarios libres activos para ocultar.");
      return;
    }
    await Promise.all(activeFreeSlots.map((slot) => clientApi("/api/availability", { method: "PATCH", body: JSON.stringify({ slotId: slot.id, isActive: false }) })));
    setMessage("Día marcado como no disponible para pacientes.");
    await load();
  }

  async function createCalendarBlocks(repeat = false) {
    setMessage("");
    if (!repeat && selectedCalendarDates.length === 0) {
      setMessage("Selecciona uno o varios días del calendario para publicar horarios.");
      return;
    }
    if (repeat && !window.confirm("Se repetirá esta disponibilidad semanal durante el próximo mes. ¿Deseas continuar?")) {
      return;
    }
    const response = await clientApi<{ created: number; requested: number; repeatBatchId?: string | null }>("/api/availability/bulk", {
      method: "POST",
      body: JSON.stringify({
        dates: repeat ? undefined : selectedCalendarDates,
        startTime: blockStartTime,
        endTime: blockEndTime,
        durationMinutes: slotDurationMinutes,
        repeatWeekdays: repeat ? repeatWeekdays : undefined
      })
    });
    if (repeat && response.repeatBatchId) setLastRepeatBatchId(response.repeatBatchId);
    setMessage(`Calendario actualizado: ${response.created} de ${response.requested} horarios publicados en bloques de ${slotDurationMinutes} minutos.`);
    await load();
  }

  async function revertMonthlyRepeat(repeatBatchId = lastRepeatBatchId) {
    setMessage("");
    if (!repeatBatchId) {
      setMessage("No hay una repetición mensual reciente para revertir.");
      return;
    }
    const response = await clientApi<{ deleted: number }>("/api/availability", {
      method: "DELETE",
      body: JSON.stringify({ repeatBatchId })
    });
    setLastRepeatBatchId("");
    setMessage(`Disponibilidad repetida revertida: ${response.deleted} horario(s) eliminado(s).`);
    await load();
  }

  async function uploadDoctorImage(kind: "profile" | "office" | "license", file?: File) {
    if (!file) return;
    setMessage("");
    const fieldByKind = {
      profile: "imageUrl",
      office: "practicePhotoUrl",
      license: "professionalLicensePhotoUrl"
    } as const;
    const labelByKind = {
      profile: "Foto principal",
      office: "Foto de consultorio",
      license: "Imagen de cédula"
    } as const;
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    const response = await clientApi<{ url: string }>("/api/uploads/images", {
      method: "POST",
      body: form
    });
    if (kind === "profile") setImageUrl(response.url);
    if (kind === "office") setPracticePhotoUrl(response.url);
    if (kind === "license") setProfessionalLicensePhotoUrl(response.url);
    setProfile((current) => current ? { ...current, [fieldByKind[kind]]: response.url } : current);
    setMessage(`${labelByKind[kind]} cargada y guardada en tu perfil. Ya puedes revisar la vista previa.`);
  }

  async function checkoutPlan(plan: DoctorProfile["medal"]) {
    setMessage("");
    const response = await clientApi<{ checkoutUrl?: string; status?: string }>("/api/subscriptions/checkout", {
      method: "POST",
      body: JSON.stringify({ plan })
    });
    if (response.checkoutUrl) {
      window.location.href = response.checkoutUrl;
      return;
    }
    setMedal(plan);
    setMessage("Plan actualizado correctamente.");
    await load();
  }

  async function cancelSubscriptionRenewal() {
    const confirmed = window.confirm("¿Quieres cancelar la renovación automática de tu suscripción? Tu acceso seguirá activo hasta terminar el periodo pagado.");
    if (!confirmed) return;
    setSubscriptionAction("cancel");
    setMessage("");
    try {
      const response = await clientApi<{ message: string }>("/api/subscriptions/cancel", {
        method: "POST",
        body: JSON.stringify({ plan: medal })
      });
      setMessage(response.message);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "No fue posible cancelar la renovación.");
    } finally {
      setSubscriptionAction("");
    }
  }

  async function updateAppointment(id: string, action: "ACCEPT" | "COMPLETE" | "MARK_NO_SHOW" | "REQUEST_CANCELLATION" | "APPROVE_REFUND" | "REJECT_REFUND", reason?: string) {
    await clientApi(`/api/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        action,
        cancellationReason: action === "REQUEST_CANCELLATION" ? reason || "Cancelación solicitada por médico desde agenda clínica." : undefined,
        refundReason: action === "APPROVE_REFUND" || action === "REJECT_REFUND" ? reason : undefined
      })
    });
    if (action === "REQUEST_CANCELLATION") {
      setMessage("Solicitud de cancelación enviada correctamente.");
    } else if (action === "APPROVE_REFUND") {
      setMessage("Devolución aprobada correctamente.");
    } else if (action === "REJECT_REFUND") {
      setMessage("Solicitud de devolución marcada como no aprobada.");
    } else if (action === "ACCEPT") {
      setMessage("Cita aceptada o reagendada al horario disponible más cercano.");
    }
    await load();
  }

  function openCancellationRequest(appointment: Appointment) {
    setCancellationModal(appointment);
    setCancellationReason("");
    setMessage("");
  }

  async function submitCancellationRequest() {
    if (!cancellationModal) return;
    const reason = cancellationReason.trim();
    if (reason.length < 6) {
      setMessage("Escribe un motivo de cancelación claro antes de enviar la solicitud.");
      return;
    }
    await updateAppointment(cancellationModal.id, "REQUEST_CANCELLATION", reason);
    setCancellationModal(null);
    setCancellationReason("");
  }

  async function startConnectOnboarding() {
    setMessage("");
    const response = await clientApi<{ url: string }>("/api/stripe/connect/onboarding", { method: "POST" });
    window.location.href = response.url;
  }

  async function refreshConnectStatus() {
    setMessage("");
    await clientApi("/api/stripe/connect/status");
    setMessage("Estado de cobros actualizado.");
    await load();
  }

  async function submitVerification() {
    setMessage("");
    await clientApi("/api/medical-verifications", {
      method: "POST",
      body: JSON.stringify({
        professionalLicense,
        documents: documentUrl ? [documentUrl] : []
      })
    });
    setProfessionalLicense("");
    setDocumentUrl("");
    setMessage("Verificación enviada a revisión administrativa.");
    await load();
  }

  async function updateProfile() {
    setMessage("");
    if (!legalAccepted) {
      setMessage("Debes aceptar que tu información profesional es real y verificable antes de guardar tu perfil.");
      return;
    }

    await clientApi("/api/doctors/me", {
      method: "PATCH",
      body: JSON.stringify({
        fullName,
        specialtyId,
        hospitalId,
        medal,
        bio,
        subSpecialty,
        achievements: achievementsText.split("\n").map((item) => item.trim()).filter(Boolean),
        certifications: certificationsText.split("\n").map((item) => item.trim()).filter(Boolean),
        imageUrl: imageUrl || undefined,
        practicePhotoUrl: practicePhotoUrl || undefined,
        professionalLicensePhotoUrl: professionalLicensePhotoUrl || undefined,
        university: university || undefined,
        officeAddress: officeAddress || undefined,
        officeReference: officeReference || undefined,
        cityState: cityState || undefined,
        mapsUrl: mapsUrl || undefined,
        professionalPhone: professionalPhone || undefined,
        instagramUrl: instagramUrl || undefined,
        facebookUrl: facebookUrl || undefined,
        linkedinUrl: linkedinUrl || undefined,
        websiteUrl: websiteUrl || undefined,
        whatsappUrl: whatsappUrl || undefined,
        professionalLicense: professionalLicense || undefined,
        legalDeclarationAccepted: legalAccepted,
        affiliateCode: affiliateCode || undefined,
        consultationPriceCents: Math.round(Number(price) * 100)
      })
    });
    setAffiliateCode("");
    setMessage("Perfil profesional actualizado.");
    await load();
  }

  async function replyToReview(reviewId: string) {
    if (!reviewReply.trim()) return;
    await clientApi("/api/reviews", {
      method: "PATCH",
      body: JSON.stringify({ reviewId, doctorReply: reviewReply })
    });
    setReviewReply("");
    setMessage("Respuesta publicada en la opinión del paciente.");
    await load();
  }

  async function askAssistant() {
    setMessage("");
    if (!assistantEnabled) {
      setMessage("El asistente de agenda está disponible al actualizar al plan Amatista.");
      return;
    }
    const response = await clientApi<AssistantResponse>("/api/doctor-assistant", {
      method: "POST",
      body: JSON.stringify({ prompt: assistantPrompt, context: profile?.subSpecialty })
    });
    setAssistantResponse(response);
  }

  async function searchMedicationReference() {
    setMessage("");
    if (!assistantEnabled) {
      setMessage("La búsqueda de medicamentos está disponible en el plan Amatista.");
      return;
    }
    const response = await clientApi<MedicationResult>("/api/medications/search", {
      method: "POST",
      body: JSON.stringify({ query: medicationQuery })
    });
    setMedicationResult(response);
  }

  async function createConversation() {
    setMessage("");
    if (!collaborationEnabled) {
      setMessage("La colaboración médica es una función premium incluida únicamente en el Plan Amatista.");
      return;
    }
    await clientApi("/api/doctor-conversations", {
      method: "POST",
      body: JSON.stringify({
        recipientDoctorId: recipientDoctorId || undefined,
        title: conversationTitle,
        patientAlias: patientAlias || undefined,
        clinicalSummary: clinicalSummary || undefined,
        initialMessage: chatMessage || undefined
      })
    });
    setConversationTitle("");
    setPatientAlias("");
    setClinicalSummary("");
    setChatMessage("");
    setRecipientDoctorId("");
    setMessage("Conversación médica creada.");
    await load();
  }

  async function sendConversationMessage(conversationId: string) {
    if (!chatMessage.trim()) return;
    if (!collaborationEnabled) {
      setMessage("La colaboración médica es una función premium incluida únicamente en el Plan Amatista.");
      return;
    }
    await clientApi(`/api/doctor-conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: chatMessage })
    });
    setChatMessage("");
    await load();
  }

  async function openAmatistaTool(tool: "historias" | "recetario") {
    setMessage("");
    if (!clinicalToolsEnabled) {
      setMessage("Herramientas clínicas no disponibles en el perfil Obsidiana.");
      return;
    }
    setActiveAmatistaTool(tool);
    if (tool === "historias") await loadClinicalHistories();
    if (tool === "recetario") await Promise.all([loadPrescriptionTemplate(), loadPrescriptions()]);
  }

  async function loadClinicalHistories(query = clinicalSearch) {
    setClinicalLoading(true);
    setClinicalStatus("");
    try {
      const records = await clientApi<ClinicalHistoryRecord[]>(`/api/clinical-histories?q=${encodeURIComponent(query)}`);
      setClinicalHistories(records);
      if (records.length === 0 && query.trim()) setClinicalStatus("No se encontraron historias clínicas para este paciente.");
    } catch (error) {
      setClinicalStatus(error instanceof Error ? error.message : "No fue posible cargar historias clínicas.");
    } finally {
      setClinicalLoading(false);
    }
  }

  function selectClinicalAppointment(appointmentId: string) {
    setSelectedClinicalAppointmentId(appointmentId);
    const appointment = activeDoctorAppointments.find((item) => item.id === appointmentId);
    const existing = appointment ? clinicalHistories.find((history) => history.patientId === appointment.patient.id) : undefined;
    if (existing) {
      openClinicalHistory(existing);
      return;
    }
    setClinicalForm({ ...emptyClinicalForm });
    setClinicalStatus("Sin historia clínica");
  }

  function openClinicalHistory(history: ClinicalHistoryRecord) {
    setSelectedClinicalAppointmentId(history.appointmentId);
    setClinicalForm({
      identificationCard: history.identificationCard ?? "",
      ethnicGroup: history.ethnicGroup ?? "",
      consultationReason: history.consultationReason ?? "",
      hereditaryFamilyHistory: history.hereditaryFamilyHistory ?? "",
      nonPathologicalHistory: history.nonPathologicalHistory ?? "",
      pathologicalHistory: history.pathologicalHistory ?? "",
      surgicalHistory: history.surgicalHistory ?? "",
      fractureHistory: history.fractureHistory ?? "",
      gynecoObstetricHistory: history.gynecoObstetricHistory ?? "",
      currentCondition: history.currentCondition ?? "",
      systemsReview: history.systemsReview ?? "",
      physicalExam: history.physicalExam ?? "",
      labsAndImaging: history.labsAndImaging ?? "",
      diagnosis: history.diagnosis ?? "",
      treatment: history.treatment ?? "",
      diagnosesOrClinicalProblems: history.diagnosesOrClinicalProblems ?? "",
      therapeuticIndication: history.therapeuticIndication ?? "",
      plan: history.plan ?? "",
      prognosis: history.prognosis ?? "",
      healthStatus: history.healthStatus ?? "",
      additionalMedicalNotes: history.additionalMedicalNotes ?? ""
    });
    setClinicalStatus(`Historia clínica guardada. Última actualización: ${dateTime(history.updatedAt)}`);
  }

  async function saveClinicalHistory() {
    if (!selectedClinicalAppointmentId) {
      setClinicalStatus("Selecciona un paciente con cita activa antes de guardar.");
      return;
    }
    const appointment = activeDoctorAppointments.find((item) => item.id === selectedClinicalAppointmentId);
    if (!appointment) {
      setClinicalStatus("La cita seleccionada ya no está activa.");
      return;
    }
    setClinicalLoading(true);
    setClinicalStatus("");
    try {
      const saved = await clientApi<ClinicalHistoryRecord>("/api/clinical-histories", {
        method: "POST",
        body: JSON.stringify({
          patientId: appointment.patient.id,
          appointmentId: appointment.id,
          ...clinicalForm
        })
      });
      setClinicalStatus(`Historia clínica guardada. Última actualización: ${dateTime(saved.updatedAt)}`);
      await loadClinicalHistories();
    } catch (error) {
      setClinicalStatus(error instanceof Error ? error.message : "No fue posible guardar la historia clínica.");
    } finally {
      setClinicalLoading(false);
    }
  }

  async function exportClinicalHistoryPdf() {
    const appointment = activeDoctorAppointments.find((item) => item.id === selectedClinicalAppointmentId);
    const history = appointment ? clinicalHistories.find((item) => item.patientId === appointment.patient.id) : undefined;
    if (!appointment || !history) {
      setClinicalStatus("Guarda la historia clínica antes de exportar el PDF.");
      return;
    }
    setClinicalStatus("Generando PDF con IA... esto puede tomar unos segundos.");
    try {
      const response = await fetch(`/api/clinical-histories/${history.id}/export`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? "No fue posible generar el PDF.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (appointment.patient.user.name ?? "paciente").replace(/\s+/g, "-");
      a.download = `historial-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setClinicalStatus("PDF generado y descargado correctamente.");
    } catch (error) {
      setClinicalStatus(error instanceof Error ? error.message : "Error al generar el PDF.");
    }
  }

  function printClinicalHistory() {
    const appointment = activeDoctorAppointments.find((item) => item.id === selectedClinicalAppointmentId);
    if (!appointment) {
      setClinicalStatus("Selecciona una historia clínica antes de imprimir.");
      return;
    }
    const sections = [
      ["Ficha de identificación", clinicalForm.identificationCard],
      ["Grupo étnico (cuando aplique)", clinicalForm.ethnicGroup],
      ["Motivo de consulta", clinicalForm.consultationReason],
      ["Antecedentes heredo familiares", clinicalForm.hereditaryFamilyHistory],
      ["Antecedentes personales no patológicos", clinicalForm.nonPathologicalHistory],
      ["Antecedentes personales patológicos", clinicalForm.pathologicalHistory],
      ["Antecedentes quirúrgicos", clinicalForm.surgicalHistory],
      ["Antecedentes de fracturas", clinicalForm.fractureHistory],
      ["Antecedentes ginecoobstétricos (cuando aplique)", clinicalForm.gynecoObstetricHistory],
      ["Padecimiento actual", clinicalForm.currentCondition],
      ["Interrogatorio por aparatos y sistemas", clinicalForm.systemsReview],
      ["Exploración física", clinicalForm.physicalExam],
      ["Resultados previos y actuales de laboratorio, gabinete y otros", clinicalForm.labsAndImaging],
      ["Diagnóstico", clinicalForm.diagnosis],
      ["Tratamiento", clinicalForm.treatment],
      ["Diagnósticos o problemas clínicos", clinicalForm.diagnosesOrClinicalProblems],
      ["Pronóstico", clinicalForm.prognosis],
      ["Indicación terapéutica", clinicalForm.therapeuticIndication],
      ["Plan de seguimiento", clinicalForm.plan],
      ["Estado de salud", clinicalForm.healthStatus],
      ["Notas médicas adicionales", clinicalForm.additionalMedicalNotes]
    ];
    const body = `
      <div class="header">
        <div>
          <h1>Historia clínica orientada</h1>
          <p class="muted">VITAEON · Estructura guía alineada a NOM-004-SSA3-2012 para consulta general/especialidad</p>
        </div>
      </div>
      <div class="grid">
        <div class="box"><strong>Paciente</strong><br />${escapeHtml(appointment.patient.user.name)}</div>
        <div class="box"><strong>Cita</strong><br />${escapeHtml(dateTime(appointment.availabilitySlot.startsAt))}</div>
        <div class="box"><strong>Médico</strong><br />${escapeHtml(profile?.fullName ?? "")}</div>
        <div class="box"><strong>Especialidad</strong><br />${escapeHtml(profile?.specialty.name ?? "")}</div>
      </div>
      ${sections.map(([label, value]) => `<h2>${escapeHtml(label)}</h2><p>${printableText(value)}</p>`).join("")}
    `;
    openPrintWindow("Historia clínica VITAEON", body);
  }

  async function loadPrescriptionTemplate() {
    setPrescriptionLoading(true);
    setPrescriptionStatus("");
    try {
      const response = await clientApi<PrescriptionTemplateResponse>("/api/prescription-template");
      setPrescriptionTemplateId(response.template?.id ?? "");
      setPrescriptionTemplate({
        doctorName: response.template?.doctorName ?? response.defaults.doctorName,
        specialty: response.template?.specialty ?? response.defaults.specialty,
        professionalLicense: response.template?.professionalLicense ?? response.defaults.professionalLicense,
        phone: response.template?.phone ?? response.defaults.phone,
        officeAddress: response.template?.officeAddress ?? response.defaults.officeAddress,
        headerImageUrl: response.template?.headerImageUrl ?? "",
        signatureImageUrl: response.template?.signatureImageUrl ?? ""
      });
    } catch (error) {
      setPrescriptionStatus(error instanceof Error ? error.message : "No fue posible cargar el recetario.");
    } finally {
      setPrescriptionLoading(false);
    }
  }

  async function loadPrescriptions(query = prescriptionSearch) {
    setPrescriptionLoading(true);
    setPrescriptionStatus("");
    try {
      const records = await clientApi<PrescriptionRecord[]>(`/api/prescriptions?q=${encodeURIComponent(query)}`);
      setPrescriptions(records);
      if (records.length === 0 && query.trim()) setPrescriptionStatus("No se encontraron recetas para este paciente.");
    } catch (error) {
      setPrescriptionStatus(error instanceof Error ? error.message : "No fue posible cargar recetas.");
    } finally {
      setPrescriptionLoading(false);
    }
  }

  function selectPrescriptionAppointment(appointmentId: string) {
    setSelectedPrescriptionAppointmentId(appointmentId);
    const appointment = activeDoctorAppointments.find((item) => item.id === appointmentId);
    const existing = prescriptions.find((prescription) => prescription.appointmentId === appointmentId);
    if (existing) {
      openPrescription(existing);
      return;
    }
    setPrescriptionForm({
      ...emptyPrescriptionForm,
      patientAge: calculateAgeLabel(appointment?.patient.dateOfBirth)
    });
    setPrescriptionStatus("Receta nueva lista para edición.");
  }

  function openPrescription(prescription: PrescriptionRecord) {
    setSelectedPrescriptionAppointmentId(prescription.appointmentId);
    setPrescriptionForm({
      id: prescription.id,
      patientAge: prescription.patientAge ?? "",
      diagnosis: prescription.diagnosis ?? "",
      medicationInstructions: prescription.medicationInstructions ?? "",
      dosage: prescription.dosage ?? "",
      frequency: prescription.frequency ?? "",
      duration: prescription.duration ?? "",
      generalRecommendations: prescription.generalRecommendations ?? "",
      additionalNotes: prescription.additionalNotes ?? ""
    });
    if (prescription.template) {
      setPrescriptionTemplateId(prescription.template.id);
      setPrescriptionTemplate({
        doctorName: prescription.template.doctorName,
        specialty: prescription.template.specialty,
        professionalLicense: prescription.template.professionalLicense ?? "",
        phone: prescription.template.phone ?? "",
        officeAddress: prescription.template.officeAddress ?? "",
        headerImageUrl: prescription.template.headerImageUrl ?? "",
        signatureImageUrl: prescription.template.signatureImageUrl ?? ""
      });
    }
    setPrescriptionStatus(`Receta guardada. Última actualización: ${dateTime(prescription.updatedAt)}`);
  }

  async function savePrescriptionTemplate() {
    setPrescriptionLoading(true);
    setPrescriptionStatus("");
    try {
      const saved = await clientApi<PrescriptionTemplateRecord>("/api/prescription-template", {
        method: "POST",
        body: JSON.stringify(prescriptionTemplate)
      });
      setPrescriptionTemplateId(saved.id);
      setPrescriptionStatus("Configuración del recetario guardada.");
    } catch (error) {
      setPrescriptionStatus(error instanceof Error ? error.message : "No fue posible guardar el recetario.");
    } finally {
      setPrescriptionLoading(false);
    }
  }

  async function uploadPrescriptionAsset(kind: "prescription-header" | "prescription-signature", file?: File) {
    if (!file) return;
    setPrescriptionStatus("");
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    try {
      const response = await clientApi<{ url: string }>("/api/uploads/images", {
        method: "POST",
        body: form
      });
      setPrescriptionTemplate({
        ...prescriptionTemplate,
        [kind === "prescription-header" ? "headerImageUrl" : "signatureImageUrl"]: response.url
      });
      setPrescriptionStatus("Imagen cargada. Guarda la configuración del recetario.");
    } catch (error) {
      setPrescriptionStatus(error instanceof Error ? error.message : "No fue posible subir la imagen.");
    }
  }

  async function savePrescription() {
    if (!selectedPrescriptionAppointmentId) {
      setPrescriptionStatus("Selecciona un paciente con cita activa antes de guardar la receta.");
      return;
    }
    const appointment = activeDoctorAppointments.find((item) => item.id === selectedPrescriptionAppointmentId);
    if (!appointment) {
      setPrescriptionStatus("La cita seleccionada ya no está activa.");
      return;
    }
    setPrescriptionLoading(true);
    setPrescriptionStatus("");
    try {
      const saved = await clientApi<PrescriptionRecord>("/api/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          ...prescriptionForm,
          id: prescriptionForm.id || undefined,
          patientId: appointment.patient.id,
          appointmentId: appointment.id,
          templateId: prescriptionTemplateId || undefined
        })
      });
      setPrescriptionForm({
        id: saved.id,
        patientAge: saved.patientAge ?? "",
        diagnosis: saved.diagnosis ?? "",
        medicationInstructions: saved.medicationInstructions ?? "",
        dosage: saved.dosage ?? "",
        frequency: saved.frequency ?? "",
        duration: saved.duration ?? "",
        generalRecommendations: saved.generalRecommendations ?? "",
        additionalNotes: saved.additionalNotes ?? ""
      });
      setPrescriptionStatus(`Receta guardada. Última actualización: ${dateTime(saved.updatedAt)}`);
      await loadPrescriptions();
    } catch (error) {
      setPrescriptionStatus(error instanceof Error ? error.message : "No fue posible guardar la receta.");
    } finally {
      setPrescriptionLoading(false);
    }
  }

  function printPrescription() {
    const appointment = activeDoctorAppointments.find((item) => item.id === selectedPrescriptionAppointmentId);
    if (!appointment) {
      setPrescriptionStatus("Selecciona una receta antes de imprimir.");
      return;
    }
    const body = `
      <div class="header">
        ${prescriptionTemplate.headerImageUrl ? `<img src="${escapeHtml(prescriptionTemplate.headerImageUrl)}" alt="Encabezado" />` : ""}
        <div>
          <h1>${escapeHtml(prescriptionTemplate.doctorName || profile?.fullName || "VITAEON")}</h1>
          <p class="muted">${escapeHtml(prescriptionTemplate.specialty || profile?.specialty.name || "")}</p>
          <p class="muted">Cédula: ${escapeHtml(prescriptionTemplate.professionalLicense || "No registrada")}</p>
          <p class="muted">${escapeHtml(prescriptionTemplate.phone || "")} ${prescriptionTemplate.officeAddress ? `· ${escapeHtml(prescriptionTemplate.officeAddress)}` : ""}</p>
        </div>
      </div>
      <div class="grid">
        <div class="box"><strong>Paciente</strong><br />${escapeHtml(appointment.patient.user.name)}</div>
        <div class="box"><strong>Edad</strong><br />${escapeHtml(prescriptionForm.patientAge || "No registrada")}</div>
        <div class="box"><strong>Fecha</strong><br />${escapeHtml(new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date()))}</div>
        <div class="box"><strong>Cita</strong><br />${escapeHtml(dateTime(appointment.availabilitySlot.startsAt))}</div>
      </div>
      <h2>Diagnóstico</h2><p>${printableText(prescriptionForm.diagnosis)}</p>
      <h2>Medicamento / indicaciones</h2><p>${printableText(prescriptionForm.medicationInstructions)}</p>
      <div class="grid">
        <div class="box"><strong>Dosis</strong><br />${printableText(prescriptionForm.dosage)}</div>
        <div class="box"><strong>Frecuencia</strong><br />${printableText(prescriptionForm.frequency)}</div>
        <div class="box"><strong>Duración</strong><br />${printableText(prescriptionForm.duration)}</div>
        <div class="box"><strong>Recomendaciones</strong><br />${printableText(prescriptionForm.generalRecommendations)}</div>
      </div>
      <h2>Notas adicionales</h2><p>${printableText(prescriptionForm.additionalNotes)}</p>
      ${prescriptionTemplate.signatureImageUrl ? `<img class="signature" src="${escapeHtml(prescriptionTemplate.signatureImageUrl)}" alt="Firma" />` : "<p style=\"margin-top:56px\">______________________________<br />Firma del médico</p>"}
    `;
    openPrintWindow("Receta médica VITAEON", body);
  }

  const sections = [
    ["resumen", "Resumen"],
    ["agenda", "Agenda clínica"],
    ["disponibilidad", "Disponibilidad"],
    ["perfil", "Perfil profesional"],
    ["suscripcion", "Suscripción"],
    ["cobros", "Cobros"],
    ["opiniones", "Opiniones"],
    ["recursos", "Recursos Clínicos"],
    ["notificaciones", "Notificaciones"],
    ["asistentes", "Asistentes"]
  ] as const;

  const onboardingItems = [
    {
      title: "Perfil profesional completo",
      detail: "Nombre, especialidad, hospital, cédula, universidad, biografía y dirección.",
      done: Boolean(profile?.fullName && profile?.specialtyId && profile?.hospitalId && profile?.professionalLicense && profile?.university && profile?.bio && profile?.officeAddress),
      section: "perfil",
      action: "Completar perfil"
    },
    {
      title: "Declaración legal aceptada",
      detail: "Confirma que la información profesional es real, verificable y te pertenece.",
      done: Boolean(profile?.legalDeclarationAccepted),
      section: "perfil",
      action: "Aceptar declaración"
    },
    {
      title: "Fotografías y cédula visibles",
      detail: "Agrega foto profesional, consultorio y cédula para revisión administrativa.",
      done: Boolean(profile?.imageUrl && profile?.practicePhotoUrl && profile?.professionalLicensePhotoUrl),
      section: "perfil",
      action: "Subir imágenes"
    },
    {
      title: "Disponibilidad mensual publicada",
      detail: "Publica horarios reales para que pacientes puedan agendar sin fricción.",
      done: Boolean((agenda?.summary.available ?? 0) > 0),
      section: "disponibilidad",
      action: "Configurar horarios"
    },
    {
      title: "Cobros de citas configurados",
      detail: "Conecta Stripe para recibir pagos de consultas directamente en tu cuenta.",
      done: Boolean(profile?.stripeAccountId && profile?.chargesEnabled && profile?.payoutsEnabled),
      section: "cobros",
      action: "Configurar cobros"
    },
    {
      title: "Verificación médica aprobada",
      detail: profile?.verificationStatus === "IN_REVIEW" ? "Tu perfil está en revisión administrativa." : "El administrador debe aprobar el perfil antes de publicarlo.",
      done: profile?.verificationStatus === "VERIFIED",
      section: "perfil",
      action: "Revisar verificación"
    }
  ] satisfies Array<{
    title: string;
    detail: string;
    done: boolean;
    section: typeof activeSection;
    action: string;
  }>;
  const completedOnboarding = onboardingItems.filter((item) => item.done).length;
  const onboardingProgress = Math.round((completedOnboarding / onboardingItems.length) * 100);
  const readyForPilot = completedOnboarding === onboardingItems.length && profile?.subscriptionStatus === "ACTIVE";

  return (
    <Shell eyebrow="Médicos" title="Panel médico">
      {/* Wizard de onboarding — aparece automáticamente cuando el perfil está incompleto */}
      {showWizard && !loading && (
        <DoctorOnboardingWizard
          specialties={specialties}
          hospitals={hospitals}
          initialData={{
            fullName,
            specialtyId,
            hospitalId,
            subSpecialty,
            professionalLicense,
            university,
            consultationPriceCents: String(profile?.consultationPriceCents ?? 100000),
            consultationDurationMinutes: String(profile?.consultationDurationMinutes ?? 45),
            bio,
            officeAddress,
            professionalPhone,
            instagramUrl,
            linkedinUrl,
            whatsappUrl,
            certifications: profile?.certifications[0] ?? "",
            plan: (medal === "diamante" || medal === "amatista") ? medal : "oro"
          }}
          onComplete={handleWizardComplete}
          onSkip={() => setShowWizard(false)}
        />
      )}
      {loading ? <LoadingState /> : (
        <div className="mt-8 grid gap-6">
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <BadgeCheck className="h-8 w-8 text-medical" />
                <h2 className="mt-4 text-3xl font-semibold text-deep">{profile?.fullName}</h2>
                <p className="mt-2 text-slate-600">{profile?.specialty.name} · {profile?.hospital.name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge value={profile?.verificationStatus ?? "IN_REVIEW"} />
                <Badge value={`PLAN ${planLabels[medal]}`} />
                <Badge value={profile?.subscriptionStatus ?? "PENDING"} />
              </div>
            </div>
            <nav className="scroll-fade-x mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Secciones del panel">
              {sections.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${activeSection === id ? "bg-[#071726] text-white shadow-soft" : "border border-silver/60 bg-white/80 text-slate-600 hover:border-silver hover:bg-white hover:text-deep"}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {message && <p className="mt-5 rounded-2xl border border-medical/20 bg-medical/5 px-5 py-4 text-sm font-semibold text-medical">{message}</p>}
          </section>

          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Onboarding beta privada</p>
                <h2 className="mt-2 text-2xl font-semibold text-deep">
                  {readyForPilot ? "Perfil listo para recibir pacientes reales" : "Completa tu alta antes del primer paciente"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Esta guía prepara al médico piloto para operar en VITAEON con perfil verificable, agenda publicada y cobros seguros.
                </p>
              </div>
              <Badge value={readyForPilot ? "ACTIVE" : profile?.verificationStatus ?? "IN_REVIEW"} />
            </div>
            <div className="mt-6 overflow-hidden rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-medical transition-all duration-700" style={{ width: `${onboardingProgress}%` }} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">{completedOnboarding} de {onboardingItems.length} pasos completados</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {onboardingItems.map((item) => (
                <article key={item.title} className={`rounded-3xl border p-4 transition ${item.done ? "border-emerald-100 bg-emerald-50/70" : "border-silver bg-slate-50"}`}>
                  <div className="flex items-start gap-3">
                    {item.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Clock className="mt-0.5 h-5 w-5 shrink-0 text-medical" />}
                    <div>
                      <p className="font-semibold text-deep">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                    </div>
                  </div>
                  {!item.done && (
                    <button
                      onClick={() => setActiveSection(item.section)}
                      className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-deep shadow-sm transition hover:bg-black hover:text-white"
                    >
                      {item.action}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>

          {activeSection === "resumen" && (
            <section className="dashboard-card rounded-[1.75rem] border-silver/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-medical">Resumen clínico</p>
                  <h2 className="mt-2 text-2xl font-bold text-deep">Tu operación de hoy</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Agenda, disponibilidad y alertas principales en una vista ligera.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-medical/10">
                  <Calendar className="h-5 w-5 text-medical" />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <MetricMini label="Citas" value={String(appointments.length)} />
                <MetricMini label="Pendientes" value={String(appointments.filter((item) => pendingAppointmentStatuses.includes(item.status)).length)} />
                <MetricMini label="Confirmadas" value={String(appointments.filter((item) => confirmedAppointmentStatuses.includes(item.status)).length)} />
                <MetricMini label="Notificaciones" value={String(notifications.filter((item) => !item.isRead).length)} />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-silver/40 bg-slate-50/60 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Próximas citas</p>
                  <div className="mt-3 grid gap-2.5">
                    {appointments.slice(0, 3).map((appointment) => {
                      const s = appointment.status;
                      const isOk  = ["ACCEPTED","CONFIRMED","COMPLETED","PAID"].includes(s);
                      const isErr = ["CANCELLED","FAILED","REJECTED","NO_SHOW","AUTO_CANCELLED"].includes(s);
                      const isRef = ["REFUND_PENDING","CANCELLATION_REQUESTED","RESCHEDULE_REQUESTED"].includes(s);
                      const accent = isOk ? "border-l-emerald-400" : isErr ? "border-l-red-400" : isRef ? "border-l-sky-400" : "border-l-amber-400";
                      return (
                        <div key={appointment.id} className={`overflow-hidden rounded-2xl border-l-4 bg-white px-4 py-3.5 shadow-sm ${accent}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-deep">{appointment.patient.user.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{dateTime(appointment.availabilitySlot.startsAt)}</p>
                            </div>
                            <Badge value={appointment.status} />
                          </div>
                        </div>
                      );
                    })}
                    {appointments.length === 0 && <EmptyState text="No hay citas asignadas." />}
                  </div>
                </div>
                <div className="rounded-3xl border border-silver/40 bg-slate-50/60 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Alertas</p>
                  <div className="mt-3 grid gap-2.5">
                    {notifications.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm">
                        <div className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-medical" />
                        <div>
                          <p className="text-sm font-semibold leading-snug text-deep">{item.title}</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.message}</p>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && <EmptyState text="Sin alertas pendientes." />}
                  </div>
                </div>
              </div>
            </section>
          )}

          {(activeSection === "agenda" || activeSection === "disponibilidad") && (
            <DoctorAgendaPanel
              agenda={agenda}
              month={calendarMonth}
              selectedDate={selectedCalendarDate}
              selectedDates={selectedCalendarDates}
              startTime={blockStartTime}
              endTime={blockEndTime}
              durationMinutes={slotDurationMinutes}
              repeatWeekdays={repeatWeekdays}
              lastRepeatBatchId={lastRepeatBatchId}
              showConfigurator={activeSection === "disponibilidad"}
              onMonthChange={(date) => {
                setCalendarMonth(date);
                load(date).catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible cambiar de mes."));
              }}
              onSelectDate={(date) => {
                setSelectedCalendarDate(date);
                setSelectedCalendarDates((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort());
              }}
              onClearSelectedDates={() => setSelectedCalendarDates([])}
              onStartTimeChange={setBlockStartTime}
              onEndTimeChange={setBlockEndTime}
              onDurationChange={setSlotDurationMinutes}
              onRepeatWeekdaysChange={setRepeatWeekdays}
              onCreateBlocks={createCalendarBlocks}
              onRevertMonthlyRepeat={revertMonthlyRepeat}
              onToggleSlot={toggleAvailability}
              onDeleteSlot={deleteAvailability}
              onMarkDayUnavailable={markSelectedDayUnavailable}
              onAcceptAppointment={(id) => updateAppointment(id, "ACCEPT")}
              onCompleteAppointment={(id) => updateAppointment(id, "COMPLETE")}
              onNoShowAppointment={(id) => updateAppointment(id, "MARK_NO_SHOW")}
              onCancelAppointment={(id) => {
                const appointment = appointments.find((item) => item.id === id);
                if (appointment) openCancellationRequest(appointment);
              }}
            />
          )}

          {activeSection === "agenda" && (
            <AppointmentList
              appointments={appointments}
              onAccept={(id) => updateAppointment(id, "ACCEPT")}
              onComplete={(id) => updateAppointment(id, "COMPLETE")}
              onNoShow={(id) => updateAppointment(id, "MARK_NO_SHOW")}
              onCancel={openCancellationRequest}
              onApproveRefund={(appointment) => updateAppointment(appointment.id, "APPROVE_REFUND", appointment.refundReason ?? appointment.cancellationReason ?? "Devolución aprobada por médico.")}
              onRejectRefund={(appointment) => updateAppointment(appointment.id, "REJECT_REFUND", appointment.refundReason ?? appointment.cancellationReason ?? "Devolución no aprobada por médico.")}
            />
          )}

          {activeSection === "suscripcion" && activatingPlan && (
            <PlanActivatingCard plan={activatingPlan} />
          )}

          {activeSection === "suscripcion" && !activatingPlan && (
            <section className="dashboard-card rounded-[1.75rem] border-silver/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Suscripción médica</p>
                  <h2 className="mt-2 text-2xl font-semibold text-deep">Plan activo: {planLabels[medal]}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {medal === "obsidiana"
                      ? "Obsidiana es una suscripción comercial para representantes médicos y catering. No otorga acceso a funciones clínicas ni al panel médico."
                      : "Elige Oro gratis o paga Obsidiana/Diamante/Amatista con checkout seguro."}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-medical" />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {doctorPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => checkoutPlan(plan.id).catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible iniciar el pago del plan."))}
                    className={`rounded-[1.5rem] border p-5 text-left transition hover:-translate-y-0.5 ${medal === plan.id ? "border-medical bg-slate-50 ring-4 ring-medical/10" : "border-silver bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-semibold text-deep">{plan.name}</p>
                      <Badge value={medal === plan.id ? "ACTIVO" : plan.id === "oro" ? "GRATIS" : "CHECKOUT"} />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-medical">{plan.price}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>
                    <p className="mt-5 text-sm font-semibold text-deep">{plan.id === "oro" ? "Activar plan gratuito" : "Pagar con Stripe"}</p>
                  </button>
                ))}
              </div>
              <p className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Las renovaciones de Obsidiana, Diamante y Amatista se procesan en Stripe Billing con la cuenta principal configurada en backend. VITAEON no guarda tarjetas ni expone datos financieros.
              </p>
              {medal !== "oro" && (
                <div className="mt-5 rounded-[1.5rem] border border-rose-100 bg-rose-50/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">Control de suscripción</p>
                      <h3 className="mt-2 text-xl font-semibold text-deep">Cancelar renovación automática</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Puedes cancelar en cualquier momento. Tu plan seguirá disponible hasta terminar el periodo ya pagado y no se hará el siguiente cobro automático.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={cancelSubscriptionRenewal}
                      disabled={subscriptionAction === "cancel"}
                      className="rounded-full border border-rose-100 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:-translate-y-0.5 disabled:opacity-60"
                    >
                      {subscriptionAction === "cancel" ? "Cancelando..." : "Cancelar renovación"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeSection === "cobros" && (
            <section className="dashboard-card rounded-[1.75rem] border-silver/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Cobros y cuenta bancaria</p>
                  <h2 className="mt-2 text-2xl font-semibold text-deep">Recibe pagos de citas en línea</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Los pagos de citas se envían al médico mediante Stripe Connect. Las suscripciones médicas se procesan por separado en la cuenta principal de VITAEON.
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-medical" />
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Estado de cuenta</p>
                  <h3 className="mt-3 text-2xl font-semibold text-deep">
                    {!profile?.stripeAccountId
                      ? "Cuenta no configurada"
                      : profile.chargesEnabled && profile.payoutsEnabled
                        ? "Cuenta activa para recibir pagos"
                        : "Configuración pendiente"}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge value={profile?.chargesEnabled ? "COBROS ACTIVOS" : "COBROS PENDIENTES"} />
                    <Badge value={profile?.payoutsEnabled ? "PAGOS ACTIVOS" : "PAGOS PENDIENTES"} />
                    {profile?.bankAccountLast4 && <Badge value={`BANCO ****${profile.bankAccountLast4}`} />}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={() => startConnectOnboarding().catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible abrir Stripe Connect."))}
                      className="rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638]"
                    >
                      {profile?.stripeAccountId ? "Actualizar datos de cobro" : "Configurar cuenta de cobro"}
                    </button>
                    {profile?.stripeAccountId && (
                      <button
                        onClick={() => refreshConnectStatus().catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible actualizar el estado."))}
                        className="rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep"
                      >
                        Actualizar estado
                      </button>
                    )}
                  </div>
                </div>
                <div className="rounded-3xl border border-silver bg-white p-5">
                  <ShieldCheck className="h-7 w-7 text-medical" />
                  <h3 className="mt-4 text-xl font-semibold text-deep">Seguridad financiera</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Tus datos bancarios son gestionados de forma segura mediante Stripe. VITAEON no almacena tu información bancaria completa ni datos de tarjetas.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Si tu cuenta aún está pendiente, los pacientes verán un aviso antes de intentar pagar en línea.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeSection === "perfil" && (
            <>
            <section className="dashboard-card rounded-[1.75rem] border-silver/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Perfil público</p>
                  <h2 className="mt-2 text-2xl font-semibold text-deep">Información profesional</h2>
                </div>
                <ShieldCheck className="h-8 w-8 text-medical" />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nombre profesional visible" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Precio MXN" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <select value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)} className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10">
                  {specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}
                </select>
                <select value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10">
                  {hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · {hospital.city}</option>)}
                </select>
                <input value={professionalLicense} onChange={(event) => setProfessionalLicense(event.target.value)} placeholder="Cédula profesional visible" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={university} onChange={(event) => setUniversity(event.target.value)} placeholder="Universidad o institución formadora" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Biografía profesional" className="min-h-28 rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 lg:col-span-2" />
                <input value={subSpecialty} onChange={(event) => setSubSpecialty(event.target.value)} placeholder="Subespecialidad, posgrado o enfoque clínico" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 lg:col-span-2" />
                <textarea value={achievementsText} onChange={(event) => setAchievementsText(event.target.value)} placeholder="Títulos profesionales y logros, uno por línea" className="min-h-24 rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <textarea value={certificationsText} onChange={(event) => setCertificationsText(event.target.value)} placeholder="Posgrados y certificaciones, uno por línea" className="min-h-24 rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={officeAddress} onChange={(event) => setOfficeAddress(event.target.value)} placeholder="Dirección del consultorio" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={officeReference} onChange={(event) => setOfficeReference(event.target.value)} placeholder="Piso, consultorio o referencia" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={cityState} onChange={(event) => setCityState(event.target.value)} placeholder="Ciudad y estado" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={mapsUrl} onChange={(event) => setMapsUrl(event.target.value)} placeholder="Google Maps o ubicación" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={professionalPhone} onChange={(event) => setProfessionalPhone(event.target.value)} placeholder="Teléfono profesional opcional" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="Instagram profesional" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={facebookUrl} onChange={(event) => setFacebookUrl(event.target.value)} placeholder="Facebook profesional" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} placeholder="LinkedIn" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="Sitio web" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={whatsappUrl} onChange={(event) => setWhatsappUrl(event.target.value)} placeholder="WhatsApp profesional" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <div className="rounded-3xl bg-slate-50 px-4 py-3 lg:col-span-2">
                  <label className="text-sm font-semibold text-slate-600">Código promocional del médico</label>
                  <input value={affiliateCode} onChange={(event) => setAffiliateCode(event.target.value)} placeholder="Código de afiliación autorizado" className="mt-2 w-full bg-transparent outline-none" />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Solo campañas autorizadas activan beneficios para pacientes. Estado actual: {profile?.affiliateDiscountEnabled ? `campaña activa terminada en ${profile.affiliateCodeLast4 ?? "****"}` : "sin campaña activa"}.
                  </p>
                </div>
                <label className="rounded-3xl border border-silver bg-white px-4 py-3 text-sm font-semibold text-deep">
                  <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Subir foto principal</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadDoctorImage("profile", event.target.files?.[0]).catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible subir la imagen."))} className="hidden" />
                </label>
                <label className="rounded-3xl border border-silver bg-white px-4 py-3 text-sm font-semibold text-deep">
                  <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Subir foto de consultorio</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadDoctorImage("office", event.target.files?.[0]).catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible subir la imagen."))} className="hidden" />
                </label>
                <label className="rounded-3xl border border-silver bg-white px-4 py-3 text-sm font-semibold text-deep">
                  <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Subir imagen de cédula</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadDoctorImage("license", event.target.files?.[0]).catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible subir la imagen."))} className="hidden" />
                </label>
                <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
                  <div className="rounded-2xl border border-silver bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Foto principal</p>
                    {imageUrl ? (
                      <Image src={imageUrl} alt="Vista previa perfil" width={360} height={120} unoptimized className="h-24 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50 text-xs font-semibold text-slate-400">Sin imagen</div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-silver bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Consultorio</p>
                    {practicePhotoUrl ? (
                      <Image src={practicePhotoUrl} alt="Vista previa consultorio" width={360} height={120} unoptimized className="h-24 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50 text-xs font-semibold text-slate-400">Sin imagen</div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-silver bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cédula</p>
                    {professionalLicensePhotoUrl ? (
                      <Image src={professionalLicensePhotoUrl} alt="Vista previa cédula" width={360} height={120} unoptimized className="h-24 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50 text-xs font-semibold text-slate-400">Sin imagen</div>
                    )}
                  </div>
                </div>
                <label className="rounded-3xl border border-silver bg-slate-50 p-4 text-sm leading-6 text-slate-700 lg:col-span-2">
                  <span className="block font-semibold text-deep">Declaración profesional obligatoria</span>
                  <span className="mt-2 block">Declaro bajo protesta de decir verdad que la información profesional proporcionada es real, comprobable y me pertenece.</span>
                  <span className="mt-4 flex items-start gap-3 font-semibold text-deep">
                    <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-1 h-4 w-4 rounded border-silver" />
                    <span>Acepto que mi información profesional es real y verificable.</span>
                  </span>
                </label>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button onClick={updateProfile} className="w-full rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] sm:w-auto">Guardar perfil</button>
                <input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} placeholder="Referencia privada para verificación" className="w-full rounded-full bg-slate-50 px-4 py-3 outline-none sm:max-w-xs" />
                <button onClick={submitVerification} className="w-full rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep sm:w-auto">Enviar verificación</button>
              </div>
            </section>

            {/* Consultorios adicionales */}
            <section className="dashboard-card rounded-[1.75rem] border-silver/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Consultorios adicionales</p>
                  <h2 className="mt-2 text-2xl font-semibold text-deep">Otros hospitales donde practicas</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    Registra los hospitales o clínicas adicionales donde atiendes pacientes. Aparecerán en tu perfil público. Máximo 5.
                  </p>
                </div>
              </div>

              {/* Lista de consultorios actuales */}
              <div className="mt-5 grid gap-3">
                {additionalLocations.length === 0 && (
                  <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Sin consultorios adicionales registrados. Tu consultorio principal es {profile?.hospital.name}.
                  </p>
                )}
                {additionalLocations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-deep">{loc.hospital.name}</p>
                      <p className="text-sm text-slate-500">{loc.hospital.city}{loc.notes ? ` · ${loc.notes}` : ""}</p>
                    </div>
                    <button
                      onClick={() => removeLocation(loc.id).catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible eliminar el consultorio."))}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>

              {/* Formulario para agregar */}
              {additionalLocations.length < 5 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <select
                    value={newLocHospitalId}
                    onChange={(event) => setNewLocHospitalId(event.target.value)}
                    className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-sm text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10"
                  >
                    <option value="">Selecciona hospital…</option>
                    {hospitals
                      .filter((h) => h.id !== hospitalId && !additionalLocations.some((l) => l.hospital.id === h.id))
                      .map((h) => (
                        <option key={h.id} value={h.id}>{h.name} · {h.city}</option>
                      ))}
                  </select>
                  <input
                    value={newLocNotes}
                    onChange={(event) => setNewLocNotes(event.target.value)}
                    placeholder="Notas: consultorio, piso, torre… (opcional)"
                    className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-sm text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10"
                  />
                  <button
                    onClick={() => addLocation().catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible agregar el consultorio."))}
                    className="rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638]"
                  >
                    Agregar
                  </button>
                </div>
              )}
            </section>
            </>
          )}

          {activeSection === "opiniones" && (
            <DoctorReviewPanel reviews={doctorReviews} reply={reviewReply} setReply={setReviewReply} onReply={replyToReview} />
          )}

          {activeSection === "recursos" && <ClinicalResourcesSection />}

          {activeSection === "asistentes" && (
            <DoctorAssistantsSection
              plan={profile?.medal ?? "oro"}
              onMessage={setMessage}
            />
          )}

          {activeSection === "notificaciones" && (
            <div className="grid gap-6">
              <section className="dashboard-card rounded-[1.75rem] border-silver/70">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Herramientas clínicas</p>
                    <h2 className="mt-2 text-2xl font-semibold text-deep">Documentación médica privada</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Crea historias clínicas orientadas y recetas imprimibles para pacientes con cita activa, con acceso protegido por médico. Incluido en todos los planes.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <button
                    onClick={() => openAmatistaTool("historias").catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible abrir historias clínicas."))}
                    className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-premium ${activeAmatistaTool === "historias" ? "border-medical bg-sky-50/50" : "border-silver bg-white"}`}
                  >
                    <FileText className="h-7 w-7 text-medical" />
                    <p className="mt-4 font-semibold text-deep">Historias clínicas orientadas</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Crea, actualiza y busca historias clínicas privadas para pacientes con cita activa.</p>
                    <span className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Abrir historias clínicas</span>
                  </button>
                  <button
                    onClick={() => openAmatistaTool("recetario").catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible abrir el recetario."))}
                    className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-premium ${activeAmatistaTool === "recetario" ? "border-medical bg-sky-50/50" : "border-silver bg-white"}`}
                  >
                    <Printer className="h-7 w-7 text-medical" />
                    <p className="mt-4 font-semibold text-deep">Recetario médico</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Configura tu recetario digital y genera recetas listas para imprimir.</p>
                    <span className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Abrir recetario</span>
                  </button>
                </div>
                {amatistaToolsEnabled && (
                  <p className="mt-5 rounded-3xl bg-sky-50 p-4 text-sm leading-6 text-sky-700">
                    Plan Amatista: próximamente tendrás exportación PDF de historias y resúmenes clínicos con IA.
                  </p>
                )}
              </section>

              {activeAmatistaTool === "historias" && (
                <AmatistaClinicalHistoryPanel
                  appointments={activeDoctorAppointments}
                  histories={clinicalHistories}
                  search={clinicalSearch}
                  setSearch={setClinicalSearch}
                  selectedAppointmentId={selectedClinicalAppointmentId}
                  form={clinicalForm}
                  setForm={setClinicalForm}
                  status={clinicalStatus}
                  loading={clinicalLoading}
                  onSearch={() => loadClinicalHistories()}
                  onSelectAppointment={selectClinicalAppointment}
                  onOpenHistory={openClinicalHistory}
                  onSave={saveClinicalHistory}
                  onPrint={printClinicalHistory}
                  isAmatista={amatistaToolsEnabled}
                  onExportPdf={exportClinicalHistoryPdf}
                />
              )}

              {activeAmatistaTool === "recetario" && (
                <AmatistaPrescriptionPanel
                  appointments={activeDoctorAppointments}
                  prescriptions={prescriptions}
                  search={prescriptionSearch}
                  setSearch={setPrescriptionSearch}
                  selectedAppointmentId={selectedPrescriptionAppointmentId}
                  template={prescriptionTemplate}
                  setTemplate={setPrescriptionTemplate}
                  form={prescriptionForm}
                  setForm={setPrescriptionForm}
                  status={prescriptionStatus}
                  loading={prescriptionLoading}
                  onSearch={() => loadPrescriptions()}
                  onSelectAppointment={selectPrescriptionAppointment}
                  onOpenPrescription={openPrescription}
                  onSaveTemplate={savePrescriptionTemplate}
                  onUploadAsset={uploadPrescriptionAsset}
                  onSave={savePrescription}
                  onPrint={printPrescription}
                />
              )}

              <DoctorAssistantPanel prompt={assistantPrompt} setPrompt={setAssistantPrompt} response={assistantResponse} onAsk={askAssistant} locked={!assistantEnabled} secretary={secretarySummary} notifications={notifications} />
              <MedicationSearchPanel query={medicationQuery} setQuery={setMedicationQuery} result={medicationResult} onSearch={searchMedicationReference} locked={!assistantEnabled} />
              <MedicalChatPanel conversations={conversations} doctors={doctorOptions} recipientDoctorId={recipientDoctorId} setRecipientDoctorId={setRecipientDoctorId} conversationTitle={conversationTitle} setConversationTitle={setConversationTitle} patientAlias={patientAlias} setPatientAlias={setPatientAlias} clinicalSummary={clinicalSummary} setClinicalSummary={setClinicalSummary} chatMessage={chatMessage} setChatMessage={setChatMessage} onCreate={createConversation} onSend={sendConversationMessage} locked={!collaborationEnabled} onUpgrade={() => checkoutPlan("amatista").catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible iniciar Amatista."))} />
            </div>
          )}
          {cancellationModal && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-deep/35 px-4 backdrop-blur-sm">
              <div className="w-full max-w-xl rounded-[2rem] border border-silver bg-white p-6 shadow-premium">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-medical">Solicitud de cancelación</p>
                    <h3 className="mt-2 text-2xl font-semibold text-deep">{cancellationModal.patient.user.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{dateTime(cancellationModal.availabilitySlot.startsAt)} · {cancellationModal.doctor.specialty.name}</p>
                  </div>
                  <button onClick={() => setCancellationModal(null)} className="rounded-full bg-slate-50 px-4 py-2 font-semibold text-deep">Cerrar</button>
                </div>
                <textarea
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                  placeholder="Motivo de cancelación para revisión administrativa"
                  className="mt-5 min-h-32 w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10"
                />
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Esta acción crea una solicitud pendiente. Primero se intentará reagendar; una devolución queda como segunda opción de revisión, sin mezclar pagos de suscripciones.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button onClick={() => submitCancellationRequest().catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible enviar la solicitud."))} className="w-full rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] sm:w-auto">
                    Enviar solicitud
                  </button>
                  <button onClick={() => setCancellationModal(null)} className="w-full rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep sm:w-auto">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

export function AdminDashboardClient() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorSummary[]>([]);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPaymentSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [reviews, setReviews] = useState<ReviewSummary | null>(null);
  const [listings, setListings] = useState<MarketplaceListingSummary[]>([]);
  const [specialtyName, setSpecialtyName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalCity, setHospitalCity] = useState("León, Guanajuato");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [verificationData, appointmentData, doctorData, paymentData, subscriptionPaymentData, patientData, logData, reviewData, listingData] = await Promise.all([
        clientApi<Verification[]>("/api/medical-verifications"),
        clientApi<Appointment[]>("/api/appointments"),
        clientApi<{ doctors: AdminDoctorSummary[]; pagination: { page: number; pageSize: number; total: number; totalPages: number; hasNextPage: boolean } }>("/api/admin/doctors"),
        clientApi<PaymentSummary[]>("/api/payments"),
        clientApi<SubscriptionPaymentSummary[]>("/api/subscription-payments"),
        clientApi<PatientSummary[]>("/api/patients"),
        clientApi<AuditLog[]>("/api/audit-logs"),
        clientApi<ReviewSummary>("/api/reviews"),
        clientApi<MarketplaceListingSummary[]>("/api/admin/marketplace-listings")
      ]);
      setVerifications(verificationData);
      setAppointments(appointmentData);
      setDoctors(doctorData.doctors);
      setPayments(paymentData);
      setSubscriptionPayments(subscriptionPaymentData);
      setPatients(patientData);
      setLogs(logData);
      setReviews(reviewData);
      setListings(listingData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar administración.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function review(verificationId: string, status: "VERIFIED" | "REJECTED") {
    await clientApi("/api/medical-verifications", { method: "PATCH", body: JSON.stringify({ verificationId, status }) });
    await load();
  }

  async function createSpecialty() {
    setMessage("");
    await clientApi("/api/specialties", { method: "POST", body: JSON.stringify({ name: specialtyName }) });
    setSpecialtyName("");
    setMessage("Especialidad creada.");
    await load();
  }

  async function createHospital() {
    setMessage("");
    await clientApi("/api/hospitals", { method: "POST", body: JSON.stringify({ name: hospitalName, city: hospitalCity }) });
    setHospitalName("");
    setMessage("Hospital creado.");
    await load();
  }

  async function moderateReview(reviewId: string, status: "PUBLISHED" | "REJECTED") {
    await clientApi("/api/reviews", { method: "PATCH", body: JSON.stringify({ reviewId, status }) });
    setMessage(status === "PUBLISHED" ? "Opinión aprobada." : "Opinión rechazada.");
    await load();
  }

  async function toggleDoctorActive(doctorId: string, isActive: boolean) {
    await clientApi("/api/admin/doctors", { method: "PATCH", body: JSON.stringify({ doctorId, isActive }) });
    setMessage(isActive ? "Perfil médico activado." : "Perfil médico pausado.");
    await load();
  }

  async function togglePatientActive(patientId: string, isActive: boolean) {
    await clientApi("/api/patients", { method: "PATCH", body: JSON.stringify({ patientId, isActive }) });
    setMessage(isActive ? "Paciente beta activado." : "Paciente beta pausado.");
    await load();
  }

  async function deleteListing(id: string, name: string) {
    if (!window.confirm(`¿Eliminar permanentemente "${name}"? Esta acción no se puede deshacer.`)) return;
    await clientApi(`/api/admin/marketplace-listings?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setMessage(`Registro "${name}" eliminado.`);
    await load();
  }

  return (
    <Shell eyebrow="Administración" title="Centro de control VITAEON">
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : (
        <div className="mt-8 grid gap-6">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <Metric icon={<ShieldCheck />} label="Verificaciones" value={String(verifications.length)} />
            <Metric icon={<Calendar />} label="Citas" value={String(appointments.length)} />
            <Metric icon={<BadgeCheck />} label="Médicos" value={String(doctors.length)} />
            <Metric icon={<CreditCard />} label="Pagos" value={String(payments.length)} />
            <Metric icon={<CreditCard />} label="Suscripciones" value={money(subscriptionPayments.filter((payment) => payment.status === "PAID").reduce((total, payment) => total + payment.amountCents, 0))} />
            <Metric icon={<Users />} label="Pacientes" value={String(patients.length)} />
            <Metric icon={<MessageCircle />} label="Opiniones" value={String(reviews?.total ?? 0)} />
            <Metric icon={<Clock />} label="Auditoría" value={String(logs.length)} />
          </div>
          <BetaPrivateMode
            doctors={doctors}
            patients={patients}
            appointments={appointments}
            payments={payments}
            subscriptionPayments={subscriptionPayments}
            reviews={reviews}
            logs={logs}
          />
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Seguimiento clínico sensible</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Solicitudes que requieren revisión administrativa o seguimiento del equipo VITAEON.
            </p>
            <div className="mt-5 grid gap-3">
              {appointments.filter((appointment) => ["REFUND_PENDING", "CANCELLATION_REQUESTED", "RESCHEDULE_REQUESTED", "NO_SHOW"].includes(appointment.status)).length === 0 && (
                <EmptyState text="No hay reembolsos, cancelaciones o reagendamientos pendientes." />
              )}
              {appointments
                .filter((appointment) => ["REFUND_PENDING", "CANCELLATION_REQUESTED", "RESCHEDULE_REQUESTED", "NO_SHOW"].includes(appointment.status))
                .slice(0, 12)
                .map((appointment) => (
                  <article key={appointment.id} className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-deep">{appointment.patient.user.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {appointment.doctor.fullName} · {dateTime(appointment.availabilitySlot.startsAt)}
                        </p>
                        {appointment.cancellationReason && <p className="mt-2 text-sm text-slate-600">{appointment.cancellationReason}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge value={appointment.status} />
                        <Badge value={appointment.payments[0]?.status ?? "PENDING"} />
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Verificación médica</h2>
            <div className="mt-5 grid gap-4">
              {verifications.length === 0 && <EmptyState text="No hay verificaciones pendientes." />}
              {verifications.map((verification) => (
                <article key={verification.id} className="rounded-3xl bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-deep">{verification.doctor.fullName}</h3>
                      <p className="mt-1 text-slate-600">{verification.doctor.specialty.name} · {verification.professionalLicense}</p>
                    </div>
                    <Badge value={verification.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => review(verification.id, "VERIFIED")} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 font-semibold text-white"><CheckCircle2 className="h-4 w-4" /> Aprobar</button>
                    <button onClick={() => review(verification.id, "REJECTED")} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 font-semibold text-white"><XCircle className="h-4 w-4" /> Rechazar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Catálogos clínicos</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="font-semibold text-deep">Nueva especialidad</p>
                <input value={specialtyName} onChange={(event) => setSpecialtyName(event.target.value)} placeholder="Ej. Cardiología pediátrica" className="mt-4 w-full rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <button onClick={createSpecialty} className="mt-4 rounded-full bg-black px-5 py-3 font-semibold text-white">Crear especialidad</button>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="font-semibold text-deep">Nuevo hospital o clínica</p>
                <input value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} placeholder="Nombre del hospital" className="mt-4 w-full rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <input value={hospitalCity} onChange={(event) => setHospitalCity(event.target.value)} placeholder="Ciudad" className="mt-3 w-full rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <button onClick={createHospital} className="mt-4 rounded-full bg-black px-5 py-3 font-semibold text-white">Crear hospital</button>
              </div>
            </div>
            {message && <p className="mt-4 text-sm font-semibold text-medical">{message}</p>}
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Médicos registrados</h2>
            <div className="mt-5 grid gap-3">
              {doctors.length === 0 && <EmptyState text="No hay médicos registrados." />}
              {doctors.slice(0, 12).map((doctor) => (
                <div key={doctor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-semibold text-deep">{doctor.fullName}</p>
                    <p className="mt-1 text-sm text-slate-600">{doctor.specialty} · {doctor.hospital} · {doctor.appointmentsCount} citas · {doctor.isActive ? "Activo" : "Pausado"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge value={doctor.verificationStatus} />
                    <button
                      onClick={() => toggleDoctorActive(doctor.id, !doctor.isActive)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${doctor.isActive ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {doctor.isActive ? "Pausar" : "Activar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Citas recientes</h2>
            <div className="mt-5 grid gap-3">
              {appointments.length === 0 && <EmptyState text="No hay citas registradas." />}
              {appointments.slice(0, 10).map((appointment) => (
                <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-semibold text-deep">{appointment.doctor.fullName}</p>
                    <p className="mt-1 text-sm text-slate-600">{appointment.patient.user.name} · {dateTime(appointment.availabilitySlot.startsAt)}</p>
                  </div>
                  <Badge value={appointment.status} />
                </div>
              ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Pagos recientes</h2>
            <div className="mt-5 grid gap-3">
              {payments.length === 0 && <EmptyState text="No hay pagos registrados." />}
              {payments.slice(0, 10).map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-semibold text-deep">{payment.appointment.doctor}</p>
                    <p className="mt-1 text-sm text-slate-600">{payment.provider} · {money(payment.amountCents)} · {dateTime(payment.appointment.startsAt)}</p>
                  </div>
                  <Badge value={payment.status} />
                </div>
              ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Ingresos por suscripciones médicas</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Trazabilidad administrativa de planes Oro, Obsidiana, Diamante y Amatista procesados desde backend/Stripe.</p>
            <div className="mt-5 grid gap-3">
              {subscriptionPayments.length === 0 && <EmptyState text="No hay pagos de suscripción registrados." />}
              {subscriptionPayments.slice(0, 10).map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-semibold text-deep">{payment.doctor.fullName}</p>
                    <p className="mt-1 text-sm text-slate-600">Plan {planLabels[payment.plan]} · {payment.provider} · {money(payment.amountCents)}</p>
                  </div>
                  <Badge value={payment.status} />
                </div>
              ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Pacientes</h2>
            <div className="mt-5 grid gap-3">
              {patients.length === 0 && <EmptyState text="No hay pacientes registrados." />}
              {patients.slice(0, 10).map((patient) => (
                <div key={patient.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-semibold text-deep">{patient.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{patient.email} · {patient.appointmentsCount} citas · {patient.isActive ? "Activo" : "Pausado"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge value={patient.isActive ? "ACTIVO" : "PAUSADO"} />
                    <button
                      onClick={() => togglePatientActive(patient.id, !patient.isActive)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${patient.isActive ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {patient.isActive ? "Pausar" : "Activar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Opiniones y moderación</h2>
            <div className="mt-5 grid gap-3">
              {(reviews?.reviews ?? []).length === 0 && <EmptyState text="No hay opiniones registradas." />}
              {(reviews?.reviews ?? []).slice(0, 10).map((review) => (
                <article key={review.id} className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-deep">{review.doctorName}</p>
                      <p className="mt-1 text-sm text-slate-600">{review.patientName} · {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
                    </div>
                    <Badge value={review.status} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p>
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => moderateReview(review.id, "PUBLISHED")} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Aprobar</button>
                    <button onClick={() => moderateReview(review.id, "REJECTED")} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white">Rechazar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Directorio comercial</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Representantes médicos y catering registrados en VITAEON. Puedes eliminar entradas de prueba o inactivas.
            </p>
            <div className="mt-5 grid gap-3">
              {listings.length === 0 && <EmptyState text="No hay entradas en el directorio comercial." />}
              {listings.map((listing) => (
                <div key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-semibold text-deep">{listing.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {listing.type === "MEDICAL_REPRESENTATIVE" ? "Representante médico" : "Catering"} · {listing.cityOrZone}
                      {listing.phone ? ` · ${listing.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge value={listing.status} />
                    <button
                      onClick={() => deleteListing(listing.id, listing.name)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="dashboard-card rounded-[1.75rem] border-silver/70">
            <h2 className="text-2xl font-semibold text-deep">Últimos accesos y acciones</h2>
            <div className="mt-5 grid gap-3">
              {logs.slice(0, 12).map((log) => (
                <div key={log.id} className="flex flex-wrap justify-between gap-3 rounded-3xl bg-slate-50 p-4 text-sm">
                  <span className="font-semibold text-deep">{log.action}</span>
                  <span className="text-slate-500">{dateTime(log.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function BetaPrivateMode({
  doctors,
  patients,
  appointments,
  payments,
  subscriptionPayments,
  reviews,
  logs
}: {
  doctors: AdminDoctorSummary[];
  patients: PatientSummary[];
  appointments: Appointment[];
  payments: PaymentSummary[];
  subscriptionPayments: SubscriptionPaymentSummary[];
  reviews: ReviewSummary | null;
  logs: AuditLog[];
}) {
  const verifiedDoctors = doctors.filter((doctor) => doctor.verificationStatus === "VERIFIED").length;
  const pausedDoctors = doctors.filter((doctor) => !doctor.isActive).length;
  const pausedPatients = patients.filter((patient) => !patient.isActive).length;
  const completedAppointments = appointments.filter((appointment) => appointment.status === "COMPLETED").length;
  const pendingPayments = payments.filter((payment) => payment.status === "PENDING").length;
  const confirmedPayments = payments.filter((payment) => payment.status === "PAID").length;
  const pendingSubscriptionPayments = subscriptionPayments.filter((payment) => payment.status === "PENDING").length;
  const confirmedSubscriptionPayments = subscriptionPayments.filter((payment) => payment.status === "PAID").length;
  const reschedules = appointments.filter((appointment) => appointment.status === "RESCHEDULE_REQUESTED").length;
  const cancellations = appointments.filter((appointment) => appointment.status === "CANCELLATION_REQUESTED").length;
  const refunds = appointments.filter((appointment) => appointment.status === "REFUND_PENDING").length;
  const relevantErrors = logs.filter((log) => /FAILED|ERROR|REJECTED|RATE_LIMIT|FORBIDDEN/i.test(log.action)).length;
  const betaRows = [
    ["Médicos registrados", doctors.length],
    ["Médicos verificados", verifiedDoctors],
    ["Médicos pausados", pausedDoctors],
    ["Pacientes registrados", patients.length],
    ["Pacientes pausados", pausedPatients],
    ["Citas creadas", appointments.length],
    ["Citas completadas", completedAppointments],
    ["Pagos pendientes", pendingPayments + pendingSubscriptionPayments],
    ["Pagos confirmados", confirmedPayments + confirmedSubscriptionPayments],
    ["Reagendamientos solicitados", reschedules],
    ["Cancelaciones solicitadas", cancellations],
    ["Reembolsos pendientes", refunds],
    ["Opiniones publicadas", reviews?.total ?? 0],
    ["Eventos sensibles registrados", relevantErrors]
  ] satisfies Array<[string, number]>;

  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Modo Beta Privada</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Estado operativo para piloto en León, Guanajuato</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Lectura rápida para operar con médicos y pacientes reales sin mezclar datos demo ni perfiles incompletos.
          </p>
        </div>
        <Badge value={refunds || cancellations || reschedules ? "IN_REVIEW" : "ACTIVE"} />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {betaRows.map(([label, value]) => (
          <div key={label} className="rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-deep">{value}</p>
          </div>
        ))}
      </div>
      {doctors.length === 0 && patients.length === 0 && appointments.length === 0 && (
        <div className="mt-5">
          <EmptyState text="Aún no hay datos reales de beta. Invita médicos verificados y pacientes piloto para comenzar la operación controlada." />
        </div>
      )}
    </section>
  );
}

function DoctorAgendaPanel({
  agenda,
  month,
  selectedDate,
  selectedDates,
  startTime,
  endTime,
  durationMinutes,
  repeatWeekdays,
  lastRepeatBatchId,
  showConfigurator,
  onMonthChange,
  onSelectDate,
  onClearSelectedDates,
  onStartTimeChange,
  onEndTimeChange,
  onDurationChange,
  onRepeatWeekdaysChange,
  onCreateBlocks,
  onRevertMonthlyRepeat,
  onToggleSlot,
  onDeleteSlot,
  onMarkDayUnavailable,
  onAcceptAppointment,
  onCompleteAppointment,
  onNoShowAppointment,
  onCancelAppointment
}: {
  agenda: DoctorAgenda | null;
  month: Date;
  selectedDate: string;
  selectedDates: string[];
  startTime: string;
  endTime: string;
  durationMinutes: 45 | 60;
  repeatWeekdays: number[];
  lastRepeatBatchId: string;
  showConfigurator: boolean;
  onMonthChange: (date: Date) => void;
  onSelectDate: (value: string) => void;
  onClearSelectedDates: () => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onDurationChange: (value: 45 | 60) => void;
  onRepeatWeekdaysChange: (value: number[]) => void;
  onCreateBlocks: (repeat?: boolean) => void;
  onRevertMonthlyRepeat: (repeatBatchId?: string) => void;
  onToggleSlot: (slotId: string, isActive: boolean) => void;
  onDeleteSlot: (slotId: string) => void;
  onMarkDayUnavailable: () => void;
  onAcceptAppointment: (appointmentId: string) => void;
  onCompleteAppointment: (appointmentId: string) => void;
  onNoShowAppointment: (appointmentId: string) => void;
  onCancelAppointment: (appointmentId: string) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const calendarStart = new Date(first);
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());
  const dayMap = new Map((agenda?.days ?? []).map((day) => [day.date, day]));
  const cells = Array.from({ length: 42 }, (_, index) => {
    const value = new Date(calendarStart);
    value.setDate(calendarStart.getDate() + index);
    return value;
  });
  const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(month);
  const selectedDay = selectedDate ? dayMap.get(selectedDate) : null;
  const preview = buildTimePreview(startTime, endTime, durationMinutes);
  const todayKey = new Date().toISOString().slice(0, 10);

  function shiftMonth(direction: number) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + direction, 1));
  }

  function toggleWeekday(day: number) {
    onRepeatWeekdaysChange(
      repeatWeekdays.includes(day) ? repeatWeekdays.filter((item) => item !== day) : [...repeatWeekdays, day].sort()
    );
  }

  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Agenda clínica</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Calendario mensual de pacientes</h2>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-medical/10">
          <Calendar className="h-5 w-5 text-medical" />
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricMini label="Horarios" value={String(agenda?.summary.totalSlots ?? 0)} />
        <MetricMini label="Ocupados" value={String(agenda?.summary.booked ?? 0)} />
        <MetricMini label="Libres" value={String(agenda?.summary.available ?? 0)} />
      </div>
      <div className="mt-6 rounded-[1.5rem] border border-silver/40 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => shiftMonth(-1)} className="rounded-full border border-silver bg-white p-3 text-deep"><ChevronLeft className="h-4 w-4" /></button>
          <p className="text-lg font-semibold text-deep">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</p>
          <button onClick={() => shiftMonth(1)} className="rounded-full border border-silver bg-white p-3 text-deep"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
          {["D", "L", "M", "X", "J", "V", "S"].map((day, i) => (
            <span key={i}>
              <span className="sm:hidden">{day}</span>
              <span className="hidden sm:inline">{["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][i]}</span>
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const day = dayMap.get(key);
            const outside = date.getMonth() !== month.getMonth();
            const selected = selectedDates.includes(key);
            const past = key < todayKey;
            const status = day ? day.booked > 0 && day.available > 0 ? "Parcial" : day.booked > 0 ? "Ocupado" : day.available > 0 ? "Disponible" : "No disp." : "Sin horarios";
            return (
              <button
                key={key}
                onClick={() => !past && onSelectDate(key)}
                disabled={past}
                className={`min-h-[3.5rem] rounded-xl border p-1.5 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-24 sm:rounded-2xl sm:p-3 ${selected ? "border-medical bg-white ring-2 ring-medical/10 sm:ring-4" : "border-silver bg-white"} ${outside ? "opacity-45" : ""}`}
              >
                <span className="text-xs font-semibold text-deep sm:text-sm">{date.getDate()}</span>
                <span className={`mt-1 flex items-center gap-0.5 text-[9px] font-semibold sm:mt-3 sm:gap-1 sm:text-[11px] ${status === "Disponible" ? "text-emerald-600" : status === "Ocupado" ? "text-red-500" : status === "Parcial" ? "text-amber-600" : "text-slate-400"}`}>
                  <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${status === "Disponible" ? "bg-emerald-400" : status === "Ocupado" ? "bg-red-400" : status === "Parcial" ? "bg-amber-400" : "bg-slate-300"}`} />
                  <span className="hidden sm:inline">{status}</span>
                </span>
                {day?.booked ? <span className="mt-0.5 hidden text-[11px] text-medical sm:block">{day.booked} cita(s)</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className={`mt-5 grid gap-4 ${showConfigurator ? "lg:grid-cols-[0.9fr_1.1fr]" : ""}`}>
        {showConfigurator && (
        <div className="rounded-3xl border border-silver/40 bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Configurar horarios</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Selecciona uno o varios días del mes. VITAEON generará horarios en zona America/Mexico_City, en bloques de {durationMinutes} minutos.
          </p>
          <div className="mt-4 rounded-3xl bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-deep">
                {selectedDates.length === 0
                  ? "Ningún día seleccionado"
                  : selectedDates.length === 1
                    ? "1 día seleccionado"
                    : `${selectedDates.length} días seleccionados`}
              </p>
              <button onClick={onClearSelectedDates} className="rounded-full border border-silver px-3 py-2 text-xs font-semibold text-deep">Limpiar</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedDates.slice(0, 8).map((date) => <span key={date} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{date}</span>)}
              {selectedDates.length > 8 && <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">+{selectedDates.length - 8}</span>}
              {selectedDates.length === 0 && <span className="text-sm text-slate-500">Elige días directamente en el calendario.</span>}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              Inicio
              <input type="time" value={startTime} onChange={(event) => onStartTimeChange(event.target.value)} className="rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              Fin
              <input type="time" value={endTime} onChange={(event) => onEndTimeChange(event.target.value)} className="rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              Duración
              <select value={durationMinutes} onChange={(event) => onDurationChange(Number(event.target.value) as 45 | 60)} className="rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10">
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </label>
          </div>
          <div className="mt-4 rounded-3xl bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Vista previa</p>
            {preview.length === 0 ? (
              <p className="mt-2 text-sm text-red-600">La hora final debe ser posterior a la inicial.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {preview.map((time) => <span key={time} className="rounded-full bg-medical/10 px-3 py-1 text-xs font-semibold text-medical">{time}</span>)}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button disabled={selectedDates.length === 0 || preview.length === 0} onClick={() => onCreateBlocks(false)} className="rounded-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-50">Guardar en días seleccionados</button>
            <button disabled={!selectedDate || !selectedDay} onClick={onMarkDayUnavailable} className="rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep disabled:opacity-50">Marcar día no disponible</button>
          </div>
          <div className="mt-5 border-t border-silver pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Repetir por semana</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["D", "L", "M", "M", "J", "V", "S"].map((label, index) => (
                <button key={`${label}-${index}`} onClick={() => toggleWeekday(index)} className={`h-10 w-10 rounded-full border text-sm font-semibold transition ${repeatWeekdays.includes(index) ? "border-transparent bg-black text-white" : "border-silver bg-white text-deep hover:border-medical/40"}`}>{label}</button>
              ))}
            </div>
            <p className="mt-3 rounded-2xl bg-white p-3 text-xs leading-5 text-slate-600">
              Se repetirá esta disponibilidad semanal durante el próximo mes. Puedes revertir solo los horarios generados, sin tocar horarios manuales ni citas ya agendadas.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={repeatWeekdays.length === 0 || preview.length === 0} onClick={() => onCreateBlocks(true)} className="rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep disabled:opacity-50">Publicar repetición mensual</button>
              <button disabled={!lastRepeatBatchId} onClick={() => onRevertMonthlyRepeat(lastRepeatBatchId)} className="rounded-full border border-red-100 bg-red-50 px-5 py-3 font-semibold text-red-700 disabled:opacity-50">Revertir repetición</button>
            </div>
          </div>
        </div>
        )}
        <div className="rounded-3xl border border-silver/40 bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Detalle del día</p>
          {!selectedDay ? <EmptyState text="No hay horarios en el día seleccionado." /> : (
            <div className="mt-4 grid gap-3">
              {selectedDay.slots.map((slot) => (
                <div key={slot.id} className={`overflow-hidden rounded-2xl border-l-4 bg-white p-4 shadow-sm ${
                  slot.appointment?.status && ["ACCEPTED","CONFIRMED","COMPLETED","PAID"].includes(slot.appointment.status) ? "border-l-emerald-400" :
                  slot.appointment?.status && ["CANCELLED","FAILED","REJECTED","NO_SHOW","AUTO_CANCELLED"].includes(slot.appointment.status) ? "border-l-red-400" :
                  slot.appointment?.status && ["REFUND_PENDING","CANCELLATION_REQUESTED","RESCHEDULE_REQUESTED"].includes(slot.appointment.status) ? "border-l-sky-400" :
                  slot.appointment?.status ? "border-l-amber-400" :
                  slot.isActive ? "border-l-emerald-300" : "border-l-slate-200"
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-deep">{new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date(slot.startsAt))}</p>
                    <Badge value={slot.appointment?.status ?? (slot.isActive ? "DISPONIBLE" : "NO DISPONIBLE")} />
                  </div>
                  {slot.appointment ? (
                    <div className="mt-3 rounded-2xl border border-silver bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-deep">{slot.appointment.patientName}</p>
                          <p className="mt-1 text-sm text-slate-600">{shortTime(slot.startsAt)} · {durationLabel(slot.startsAt, slot.endsAt)} · {slot.appointment.specialty}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge value={slot.appointment.status} />
                          <PaymentBadge status={slot.appointment.paymentStatus} provider={slot.appointment.paymentProvider} />
                        </div>
                      </div>
                      {slot.appointment.reason && <p className="mt-3 text-sm leading-6 text-slate-600">Motivo de consulta: {slot.appointment.reason}</p>}
                      {!["COMPLETED", "CANCELLED", "AUTO_CANCELLED", "REFUND_PENDING", "REFUNDED"].includes(slot.appointment.status) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {["PENDING", "PENDING_DOCTOR_ACCEPTANCE", "RESCHEDULE_REQUESTED"].includes(slot.appointment.status) && (
                            <button onClick={() => slot.appointment && onAcceptAppointment(slot.appointment.id)} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">Aceptar cita</button>
                          )}
                          {["ACCEPTED", "CONFIRMED", "RESCHEDULED"].includes(slot.appointment.status) && (
                            <>
                              <button onClick={() => slot.appointment && onCompleteAppointment(slot.appointment.id)} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">Completar cita</button>
                              <button onClick={() => slot.appointment && onNoShowAppointment(slot.appointment.id)} className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">Paciente no llegó</button>
                            </>
                          )}
                          <button onClick={() => slot.appointment && onCancelAppointment(slot.appointment.id)} className="rounded-full border border-silver bg-white px-4 py-2 text-xs font-semibold text-deep">Solicitar cancelación</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => onToggleSlot(slot.id, !slot.isActive)} className="rounded-full border border-silver bg-white px-3 py-2 text-xs font-semibold text-deep">
                        {slot.isActive ? "Marcar no disponible" : "Activar"}
                      </button>
                      <button onClick={() => onDeleteSlot(slot.id)} className="rounded-full border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const clinicalFields = [
  ["identificationCard", "Ficha de identificación"],
  ["ethnicGroup", "Grupo étnico (cuando aplique)"],
  ["consultationReason", "Motivo de consulta"],
  ["hereditaryFamilyHistory", "Antecedentes heredo familiares"],
  ["nonPathologicalHistory", "Antecedentes personales no patológicos"],
  ["pathologicalHistory", "Antecedentes personales patológicos"],
  ["surgicalHistory", "Antecedentes quirúrgicos"],
  ["fractureHistory", "Antecedentes de fracturas"],
  ["gynecoObstetricHistory", "Antecedentes ginecoobstétricos (cuando aplique)"],
  ["currentCondition", "Padecimiento actual"],
  ["systemsReview", "Interrogatorio por aparatos y sistemas"],
  ["physicalExam", "Exploración física"],
  ["labsAndImaging", "Resultados previos y actuales de laboratorio, gabinete y otros"],
  ["diagnosis", "Diagnóstico"],
  ["treatment", "Tratamiento"],
  ["diagnosesOrClinicalProblems", "Diagnósticos o problemas clínicos"],
  ["prognosis", "Pronóstico"],
  ["therapeuticIndication", "Indicación terapéutica"],
  ["plan", "Plan de seguimiento"],
  ["healthStatus", "Estado de salud"],
  ["additionalMedicalNotes", "Notas médicas adicionales"]
] as const;

function AmatistaClinicalHistoryPanel({
  appointments,
  histories,
  search,
  setSearch,
  selectedAppointmentId,
  form,
  setForm,
  status,
  loading,
  onSearch,
  onSelectAppointment,
  onOpenHistory,
  onSave,
  onPrint,
  isAmatista,
  onExportPdf
}: {
  appointments: Appointment[];
  histories: ClinicalHistoryRecord[];
  search: string;
  setSearch: (value: string) => void;
  selectedAppointmentId: string;
  form: ClinicalFormState;
  setForm: (value: ClinicalFormState) => void;
  status: string;
  loading: boolean;
  onSearch: () => void;
  onSelectAppointment: (id: string) => void;
  onOpenHistory: (history: ClinicalHistoryRecord) => void;
  onSave: () => void;
  onPrint: () => void;
  isAmatista: boolean;
  onExportPdf: () => Promise<void>;
}) {
  const [exporting, setExporting] = useState(false);
  const selectedAppointment = appointments.find((appointment) => appointment.id === selectedAppointmentId);
  const selectedHistory = selectedAppointment ? histories.find((history) => history.patientId === selectedAppointment.patient.id) : undefined;

  async function handleExportPdf() {
    setExporting(true);
    try {
      await onExportPdf();
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Historias clínicas orientadas</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Registro clínico privado</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Cada historia queda ligada al paciente y solo al médico que la crea. Se actualiza desde citas activas y usa como guía los apartados mínimos de historia clínica de la NOM-004-SSA3-2012.
          </p>
        </div>
        <Stethoscope className="h-8 w-8 text-medical" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-4">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="font-semibold text-deep">Buscar historias guardadas</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-white px-4 py-3">
                <Search className="h-5 w-5 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre del paciente..."
                  className="min-w-0 flex-1 bg-transparent outline-none"
                />
              </div>
              <button onClick={onSearch} disabled={loading} className="rounded-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-50">
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {histories.map((history) => (
                <article key={history.id} className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-deep">{history.patient.user.name}</p>
                  <p className="mt-1 text-sm text-slate-600">Cita: {dateTime(history.appointment.availabilitySlot.startsAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">Última actualización: {dateTime(history.updatedAt)}</p>
                  <button onClick={() => onOpenHistory(history)} className="mt-3 rounded-full border border-silver px-4 py-2 text-sm font-semibold text-deep">Abrir historia</button>
                </article>
              ))}
              {histories.length === 0 && (
                <p className="rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600">
                  {status === "No se encontraron historias clínicas para este paciente." ? status : "Aún no hay historias clínicas guardadas."}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="font-semibold text-deep">Paciente con cita activa</p>
            <select
              value={selectedAppointmentId}
              onChange={(event) => onSelectAppointment(event.target.value)}
              className="mt-3 w-full rounded-full bg-white px-4 py-3 outline-none"
            >
              <option value="">Seleccionar paciente...</option>
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.patient.user.name} · {dateTime(appointment.availabilitySlot.startsAt)}
                </option>
              ))}
            </select>
            {appointments.length === 0 && <p className="mt-3 text-sm text-slate-500">No hay citas activas disponibles para crear historias clínicas.</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-silver bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-deep">{selectedAppointment?.patient.user.name ?? "Sin paciente seleccionado"}</p>
              <p className="mt-1 text-sm text-slate-600">
                {selectedAppointment ? dateTime(selectedAppointment.availabilitySlot.startsAt) : "Selecciona una cita activa para empezar."}
              </p>
            </div>
            <Badge value={selectedHistory ? "Historia clínica guardada" : "Sin historia clínica"} />
          </div>

          {status && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-medical">{status}</p>}

          <div className="mt-5 grid gap-4">
            {clinicalFields.map(([field, label]) => (
              <label key={field} className="block">
                <span className="text-sm font-semibold text-deep">{label}</span>
                <textarea
                  value={form[field]}
                  onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                  className="mt-2 min-h-24 w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-4 text-sm leading-6 outline-none"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={onSave} disabled={loading} className="rounded-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-50">
              {selectedHistory ? "Actualizar historia clínica" : "Guardar historia clínica"}
            </button>
            <button onClick={onPrint} className="rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep">
              Imprimir
            </button>
            {isAmatista && (
              <button
                onClick={handleExportPdf}
                disabled={exporting || !selectedHistory}
                className="rounded-full bg-medical px-5 py-3 font-semibold text-white disabled:opacity-50"
                title={!selectedHistory ? "Guarda la historia clínica antes de exportar" : ""}
              >
                {exporting ? "Generando PDF..." : "Exportar PDF con IA"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const prescriptionFields = [
  ["diagnosis", "Diagnóstico"],
  ["medicationInstructions", "Medicamento / indicaciones"],
  ["dosage", "Dosis"],
  ["frequency", "Frecuencia"],
  ["duration", "Duración"],
  ["generalRecommendations", "Recomendaciones generales"],
  ["additionalNotes", "Notas adicionales"]
] as const;

function AmatistaPrescriptionPanel({
  appointments,
  prescriptions,
  search,
  setSearch,
  selectedAppointmentId,
  template,
  setTemplate,
  form,
  setForm,
  status,
  loading,
  onSearch,
  onSelectAppointment,
  onOpenPrescription,
  onSaveTemplate,
  onUploadAsset,
  onSave,
  onPrint
}: {
  appointments: Appointment[];
  prescriptions: PrescriptionRecord[];
  search: string;
  setSearch: (value: string) => void;
  selectedAppointmentId: string;
  template: PrescriptionTemplateFormState;
  setTemplate: (value: PrescriptionTemplateFormState) => void;
  form: PrescriptionFormState;
  setForm: (value: PrescriptionFormState) => void;
  status: string;
  loading: boolean;
  onSearch: () => void;
  onSelectAppointment: (id: string) => void;
  onOpenPrescription: (prescription: PrescriptionRecord) => void;
  onSaveTemplate: () => void;
  onUploadAsset: (kind: "prescription-header" | "prescription-signature", file?: File) => void;
  onSave: () => void;
  onPrint: () => void;
}) {
  const selectedAppointment = appointments.find((appointment) => appointment.id === selectedAppointmentId);

  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Recetario médico</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Receta lista para impresión</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Configura tu encabezado profesional y genera recetas imprimibles para pacientes con cita activa.
          </p>
        </div>
        <Printer className="hidden h-8 w-8 text-medical sm:block" />
      </div>

      {status && <p className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm font-semibold text-medical">{status}</p>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="font-semibold text-deep">Configuración del recetario</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ["doctorName", "Nombre del médico"],
                ["specialty", "Especialidad"],
                ["professionalLicense", "Cédula profesional"],
                ["phone", "Teléfono"],
                ["officeAddress", "Dirección del consultorio"]
              ] as const).map(([field, label]) => (
                <label key={field} className={field === "officeAddress" ? "sm:col-span-2" : ""}>
                  <span className="text-sm font-semibold text-deep">{label}</span>
                  <input
                    value={template[field]}
                    onChange={(event) => setTemplate({ ...template, [field]: event.target.value })}
                    className="mt-2 w-full rounded-full bg-white px-4 py-3 outline-none"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-full border border-silver bg-white px-4 py-2 text-sm font-semibold text-deep">
                Subir encabezado
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => onUploadAsset("prescription-header", event.target.files?.[0])} />
              </label>
              <label className="cursor-pointer rounded-full border border-silver bg-white px-4 py-2 text-sm font-semibold text-deep">
                Subir firma/sello
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => onUploadAsset("prescription-signature", event.target.files?.[0])} />
              </label>
              <button onClick={onSaveTemplate} disabled={loading} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar recetario</button>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="font-semibold text-deep">Buscar recetas guardadas</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-white px-4 py-3">
                <Search className="h-5 w-5 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre del paciente..."
                  className="min-w-0 flex-1 bg-transparent outline-none"
                />
              </div>
              <button onClick={onSearch} disabled={loading} className="rounded-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-50">Buscar</button>
            </div>
            <div className="mt-4 grid gap-3">
              {prescriptions.map((prescription) => (
                <article key={prescription.id} className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-deep">{prescription.patient.user.name}</p>
                  <p className="mt-1 text-sm text-slate-600">Cita: {dateTime(prescription.appointment.availabilitySlot.startsAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">Última actualización: {dateTime(prescription.updatedAt)}</p>
                  <button onClick={() => onOpenPrescription(prescription)} className="mt-3 rounded-full border border-silver px-4 py-2 text-sm font-semibold text-deep">Abrir receta</button>
                </article>
              ))}
              {prescriptions.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-slate-600">Aún no hay recetas guardadas para este médico.</p>}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-silver bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold text-deep">Paciente con cita activa</span>
              <select
                value={selectedAppointmentId}
                onChange={(event) => onSelectAppointment(event.target.value)}
                className="mt-2 w-full rounded-full bg-slate-50 px-4 py-3 outline-none"
              >
                <option value="">Seleccionar paciente...</option>
                {appointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {appointment.patient.user.name} · {dateTime(appointment.availabilitySlot.startsAt)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold text-deep">Paciente</span>
              <input value={selectedAppointment?.patient.user.name ?? ""} readOnly className="mt-2 w-full rounded-full bg-slate-50 px-4 py-3 outline-none" />
            </label>
            <label>
              <span className="text-sm font-semibold text-deep">Edad</span>
              <input value={form.patientAge} onChange={(event) => setForm({ ...form, patientAge: event.target.value })} className="mt-2 w-full rounded-full bg-slate-50 px-4 py-3 outline-none" />
            </label>
          </div>

          <div className="mt-5 grid gap-4">
            {prescriptionFields.map(([field, label]) => (
              <label key={field} className="block">
                <span className="text-sm font-semibold text-deep">{label}</span>
                <textarea
                  value={form[field]}
                  onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                  className="mt-2 min-h-20 w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-4 text-sm leading-6 outline-none"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-silver/50 bg-slate-50/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">Vista previa</p>
            <p className="mt-3 text-xl font-semibold text-deep">{template.doctorName || "Nombre del médico"}</p>
            <p className="text-sm text-slate-600">{template.specialty || "Especialidad"} · Cédula {template.professionalLicense || "no registrada"}</p>
            <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600">
              <p><span className="font-semibold text-deep">Paciente:</span> {selectedAppointment?.patient.user.name ?? "Sin seleccionar"}</p>
              <p><span className="font-semibold text-deep">Diagnóstico:</span> {form.diagnosis || "Pendiente"}</p>
              <p><span className="font-semibold text-deep">Indicaciones:</span> {form.medicationInstructions || "Pendiente"}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={onSave} disabled={loading} className="rounded-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-50">Guardar receta</button>
            <button onClick={onPrint} className="rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep">Vista previa / imprimir</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DoctorAssistantPanel({
  prompt,
  setPrompt,
  response,
  onAsk,
  locked,
  secretary,
  notifications
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  response: AssistantResponse | null;
  onAsk: () => void;
  locked: boolean;
  secretary: SecretarySummary | null;
  notifications: NotificationItem[];
}) {
  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Panel de agenda</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Agenda clínica inteligente</h2>
        </div>
        <Brain className="h-8 w-8 text-medical" />
      </div>
      {secretary && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <MetricMini label="Citas hoy" value={String(secretary.todaySummary.booked)} />
          <MetricMini label="Pendientes" value={String(secretary.pendingConfirmations)} />
          <MetricMini label="Huecos libres" value={String(secretary.todaySummary.available)} />
        </div>
      )}
      {secretary?.nextAppointment && (
        <div className="mt-5 rounded-2xl border border-silver/50 bg-slate-50/60 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-medical">Próxima cita</p>
          <p className="mt-2 font-semibold text-deep">{secretary.nextAppointment.patientName}</p>
          <p className="mt-1 text-sm text-slate-600">{dateTime(secretary.nextAppointment.startsAt)} · {secretary.nextAppointment.status} · {secretary.nextAppointment.paymentStatus}</p>
        </div>
      )}
      {!locked && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="font-semibold text-deep">Notificaciones internas</p>
            <div className="mt-3 grid gap-2">
              {(notifications.length ? notifications : secretary?.notifications ?? []).slice(0, 5).map((item) => (
                <p key={item.id} className="rounded-2xl bg-white p-3 text-sm leading-6 text-slate-600">
                  <span className="font-semibold text-deep">{item.title}</span><br />{item.message}
                </p>
              ))}
              {notifications.length === 0 && !secretary?.notifications.length && <p className="text-sm text-slate-500">Sin notificaciones pendientes.</p>}
            </div>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="font-semibold text-deep">Canales preparados</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Interno activo. Email, WhatsApp, SMS y push quedan listos para proveedor externo, sin simular envíos reales.</p>
          </div>
        </div>
      )}
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ej. Organiza mis citas pendientes, detecta huecos libres o resume mi agenda de hoy..."
        disabled={locked}
        className="mt-5 min-h-28 w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 disabled:opacity-55"
      />
      {locked && (
        <p className="mt-4 rounded-3xl bg-amber-50 p-4 text-sm leading-6 text-amber-700">
          Esta asistencia de agenda está incluida en el plan Amatista.
        </p>
      )}
      <button onClick={onAsk} className="mt-4 rounded-full bg-black px-5 py-3 font-semibold text-white">Pedir apoyo de agenda</button>
      {response && (
        <div className="mt-5 rounded-2xl border border-silver/50 bg-slate-50/60 p-5">
          <p className="font-semibold text-deep">{response.title}: {response.specialty}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{response.priority}</p>
          <div className="mt-4 grid gap-2">
            {response.checklist.map((item) => (
              <p key={item} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="h-4 w-4 text-medical" /> {item}</p>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">{response.note}</p>
        </div>
      )}
    </section>
  );
}

function MedicationSearchPanel({
  query,
  setQuery,
  result,
  onSearch,
  locked
}: {
  query: string;
  setQuery: (value: string) => void;
  result: MedicationResult | null;
  onSearch: () => void;
  locked: boolean;
}) {
  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Referencia farmacológica</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Búsqueda de medicamentos</h2>
        </div>
        <Pill className="h-8 w-8 text-medical" />
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej. ibuprofeno"
          disabled={locked}
          className="min-w-0 flex-1 rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 disabled:opacity-55"
        />
        <button onClick={onSearch} className="rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638]">Buscar</button>
      </div>
      {locked && (
        <p className="mt-4 rounded-3xl bg-amber-50 p-4 text-sm leading-6 text-amber-700">
          La búsqueda avanzada de medicamentos está incluida en el plan Amatista.
        </p>
      )}
      {result && result.status === "integration_pending" && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Próximamente disponible</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            La integración con una fuente farmacológica autorizada (COFEPRIS / PLM) está en configuración.
            Mientras tanto, consulta el Vademécum PLM, Micromedex o la ficha técnica oficial del fabricante.
          </p>
          <p className="mt-3 text-xs text-amber-600">
            Esta función se activará automáticamente cuando el administrador configure{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">MEDICATION_API_URL</code>.
          </p>
        </div>
      )}
      {result && result.status === "ready" && (
        <div className="mt-5 rounded-2xl border border-silver/50 bg-slate-50/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">Fuente conectada</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{result.disclaimer}</p>
          <div className="mt-4 grid gap-3">
            {result.results.map((item) => (
              <article key={`${item.name}-${item.source}`} className="rounded-2xl bg-white p-4">
                <p className="font-semibold text-deep">{item.name}</p>
                {item.activeSubstance && <p className="mt-1 text-sm text-slate-600">Sustancia activa: {item.activeSubstance}</p>}
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.indications}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600"><span className="font-semibold text-deep">Contraindicaciones:</span> {item.contraindications}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600"><span className="font-semibold text-deep">Advertencias:</span> {item.warnings}</p>
                <p className="mt-3 text-xs font-semibold text-slate-500">Fuente: {item.source}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MedicalChatPanel(props: {
  conversations: MedicalConversation[];
  doctors: DoctorOption[];
  recipientDoctorId: string;
  setRecipientDoctorId: (value: string) => void;
  conversationTitle: string;
  setConversationTitle: (value: string) => void;
  patientAlias: string;
  setPatientAlias: (value: string) => void;
  clinicalSummary: string;
  setClinicalSummary: (value: string) => void;
  chatMessage: string;
  setChatMessage: (value: string) => void;
  onCreate: () => void;
  onSend: (id: string) => void;
  locked: boolean;
  onUpgrade: () => void;
}) {
  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Colaboración médica</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Chat para derivaciones y coordinación</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {props.locked && <Badge value="Disponible exclusivamente en Plan Amatista" />}
          <MessageCircle className="h-8 w-8 text-medical" />
        </div>
      </div>
      {props.locked && (
        <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <p className="font-semibold text-amber-800">Función premium Amatista</p>
          <p className="mt-2 text-sm leading-6 text-amber-700">
            La colaboración médica es una función premium incluida únicamente en el Plan Amatista.
          </p>
          <button onClick={props.onUpgrade} className="mt-4 rounded-full bg-black px-5 py-3 font-semibold text-white">
            Mejorar a Amatista
          </button>
        </div>
      )}
      <div className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4">
        <select disabled={props.locked} value={props.recipientDoctorId} onChange={(event) => props.setRecipientDoctorId(event.target.value)} className="rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 disabled:opacity-55">
          <option value="">Seleccionar médico destinatario</option>
          {props.doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.specialty} · {doctor.hospital}</option>
          ))}
        </select>
        <input disabled={props.locked} value={props.conversationTitle} onChange={(event) => props.setConversationTitle(event.target.value)} placeholder="Título de la conversación" className="rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 disabled:opacity-55" />
        <input disabled={props.locked} value={props.patientAlias} onChange={(event) => props.setPatientAlias(event.target.value)} placeholder="Alias del paciente, sin exponer datos innecesarios" className="rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 disabled:opacity-55" />
        <textarea disabled={props.locked} value={props.clinicalSummary} onChange={(event) => props.setClinicalSummary(event.target.value)} placeholder="Resumen clínico breve para la derivación" className="min-h-24 rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 disabled:opacity-55" />
        <textarea disabled={props.locked} value={props.chatMessage} onChange={(event) => props.setChatMessage(event.target.value)} placeholder="Mensaje inicial o respuesta" className="min-h-20 rounded-2xl border border-silver/60 bg-white px-4 py-3 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10 disabled:opacity-55" />
        <button disabled={props.locked} onClick={props.onCreate} className="rounded-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-50">Crear conversación</button>
      </div>
      <div className="mt-5 grid gap-4">
        {props.conversations.length === 0 && <EmptyState text="Aún no hay conversaciones médicas." />}
        {props.conversations.slice(0, 6).map((conversation) => (
          <article key={conversation.id} className="rounded-3xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-deep">{conversation.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {conversation.createdByDoctor.fullName}
                  {conversation.recipientDoctor ? ` → ${conversation.recipientDoctor.fullName}` : ""}
                </p>
              </div>
              <Badge value={conversation.status} />
            </div>
            {(conversation.patientAlias || conversation.clinicalSummary) && (
              <p className="mt-3 text-sm leading-6 text-slate-600">{conversation.patientAlias ? `${conversation.patientAlias}: ` : ""}{conversation.clinicalSummary}</p>
            )}
            <div className="mt-4 grid gap-2">
              {conversation.messages.slice(-3).map((message) => (
                <p key={message.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-deep">{message.sender?.name ?? "Sistema"}:</span> {message.body}
                </p>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <input disabled={props.locked} value={props.chatMessage} onChange={(event) => props.setChatMessage(event.target.value)} placeholder="Responder conversación" className="min-w-0 flex-1 rounded-full bg-white px-4 py-3 outline-none disabled:opacity-55" />
              <button disabled={props.locked} onClick={() => props.onSend(conversation.id)} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Enviar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DoctorReviewPanel({
  reviews,
  reply,
  setReply,
  onReply
}: {
  reviews: ReviewSummary | null;
  reply: string;
  setReply: (value: string) => void;
  onReply: (id: string) => void;
}) {
  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Opiniones recibidas</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">{(reviews?.average ?? 0).toFixed(1)} promedio</h2>
          <p className="mt-1 text-sm text-slate-600">{reviews?.total ?? 0} opiniones de pacientes</p>
        </div>
        <div className="text-amber-500">★★★★★</div>
      </div>
      <div className="mt-5 grid gap-4">
        {(reviews?.reviews ?? []).length === 0 && <EmptyState text="Aún no tienes opiniones publicadas." />}
        {(reviews?.reviews ?? []).slice(0, 6).map((review) => (
          <article key={review.id} className="rounded-3xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-deep">{review.patientName}</p>
                <p className="mt-1 text-sm text-amber-600">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
              </div>
              <Badge value={review.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p>
            {review.doctorReply ? (
              <p className="mt-3 rounded-2xl bg-white p-3 text-sm leading-6 text-slate-600">Tu respuesta: {review.doctorReply}</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Responder opinión" className="min-w-0 flex-1 rounded-full bg-white px-4 py-3 outline-none" />
                <button onClick={() => onReply(review.id)} className="rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638]">Responder</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-silver/50 bg-white p-5 shadow-sm transition hover:shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold tabular-nums text-deep">{value}</p>
      <div className="mt-3 h-[3px] w-8 rounded-full bg-medical/50" />
    </div>
  );
}

function AppointmentList({
  appointments,
  onAccept,
  onComplete,
  onNoShow,
  onCancel,
  onApproveRefund,
  onRejectRefund
}: {
  appointments: Appointment[];
  onAccept: (id: string) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
  onCancel: (appointment: Appointment) => void;
  onApproveRefund: (appointment: Appointment) => void;
  onRejectRefund: (appointment: Appointment) => void;
}) {
  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Citas clínicas</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Tickets de pacientes</h2>
        </div>
        <Calendar className="h-8 w-8 text-medical" />
      </div>
      <div className="mt-5 grid gap-4">
        {appointments.length === 0 && <EmptyState text="No hay citas asignadas." />}
        {appointments.map((appointment) => (
          <article key={appointment.id} className="rounded-3xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-deep">{appointment.patient.user.name}</h3>
                <p className="mt-1 text-slate-600">{dateTime(appointment.availabilitySlot.startsAt)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Duración aproximada: {durationLabel(appointment.availabilitySlot.startsAt, appointment.availabilitySlot.endsAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge value={appointment.status} />
                <Badge value={appointment.payments[0]?.status ?? "PENDING"} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MetricMini label="Pago" value={appointment.payments[0]?.provider ?? "PENDIENTE"} />
              <MetricMini label="Importe" value={money(appointment.payments[0]?.amountCents ?? 0)} />
              <MetricMini label="Especialidad" value={appointment.doctor.specialty.name} />
            </div>
            {appointment.cancellationReason && <p className="mt-3 text-sm text-red-600">Motivo: {appointment.cancellationReason}</p>}
            {appointment.reschedulePreferred && <p className="mt-3 text-sm text-slate-600">Prioridad sugerida: reagendar antes de cancelar o devolver.</p>}
            {appointment.acceptedAutomatically && (
              <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                Cita pagada y aceptada automáticamente por pago en línea.
              </p>
            )}
            {appointment.refundRequested && appointment.doctorRefundDecision !== "approved" && (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">Solicitud de devolución pendiente de decisión médica</p>
                {appointment.refundReason && <p className="mt-1 text-sm text-amber-700">{appointment.refundReason}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => onApproveRefund(appointment)} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Aprobar devolución</button>
                  <button onClick={() => onRejectRefund(appointment)} className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800">No aprobar devolución</button>
                </div>
              </div>
            )}
            {!["COMPLETED", "CANCELLED", "REFUNDED"].includes(appointment.status) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {["PENDING", "PENDING_DOCTOR_ACCEPTANCE", "RESCHEDULE_REQUESTED"].includes(appointment.status) && (
                  <button onClick={() => onAccept(appointment.id)} className="rounded-full bg-black px-4 py-2 font-semibold text-white">
                    {appointment.status === "RESCHEDULE_REQUESTED" ? "Aceptar y asignar horario cercano" : "Aceptar cita"}
                  </button>
                )}
                {["ACCEPTED", "CONFIRMED", "RESCHEDULED"].includes(appointment.status) && (
                  <>
                    <button onClick={() => onComplete(appointment.id)} className="rounded-full bg-black px-4 py-2 font-semibold text-white">Completar cita</button>
                    <button onClick={() => onNoShow(appointment.id)} className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 font-semibold text-amber-700">Paciente no llegó</button>
                  </>
                )}
                <button onClick={() => onCancel(appointment)} className="rounded-full border border-silver px-4 py-2 font-semibold text-deep">Solicitar cancelación</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ObsidianDashboardClient() {
  const [profile, setProfile] = useState<ObsidianProfile | null>(null);
  const [serviceType, setServiceType] = useState<ObsidianProfile["serviceType"]>("MEDICAL_REPRESENTATIVE");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [cityOrZone, setCityOrZone] = useState("León, Guanajuato");
  const [priceRange, setPriceRange] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscriptionAction, setSubscriptionAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activatingPlan, setActivatingPlan] = useState<keyof typeof planActivatingConfig | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionResult = params.get("subscription");
    const planParam = params.get("plan");
    if (subscriptionResult) window.history.replaceState({}, "", window.location.pathname);

    loadProfile().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar tu perfil Obsidiana.");
      setLoading(false);
    });

    if (subscriptionResult !== "success") return;

    const validPlan = (planParam && planParam in planActivatingConfig) ? planParam as keyof typeof planActivatingConfig : "obsidiana" as const;
    setActivatingPlan(validPlan);

    let pollAttempts = 0;
    const MAX_POLL = 75;

    const pollActivation = async () => {
      pollAttempts++;
      try {
        const data = await clientApi<ObsidianProfile | null>("/api/obsidiana-profile");
        if (data?.subscriptionStatus === "ACTIVE") {
          setActivatingPlan(null);
          setMessage(`✓ ¡${planActivatingConfig[validPlan].label} activo! Tu perfil comercial ya aparece en el directorio.`);
          return;
        }
      } catch { /* continúa */ }
      if (pollAttempts < MAX_POLL) {
        setTimeout(() => void pollActivation(), 4000);
      } else {
        setActivatingPlan(null);
        setMessage("Tu pago fue registrado, pero la activación está tardando más de lo esperado. Recarga la página o contacta soporte.");
      }
    };

    setTimeout(() => void pollActivation(), 4000);
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");
    const data = await clientApi<ObsidianProfile | null>("/api/obsidiana-profile");
    if (data) {
      setProfile(data);
      setServiceType(data.serviceType);
      setBusinessName(data.businessName);
      setDescription(data.description);
      setCityOrZone(data.cityOrZone);
      setPriceRange(data.priceRange ?? "");
      setContactName(data.contactName ?? "");
      setPhone(data.phone ?? "");
      setEmail(data.email ?? "");
      setLogoUrl(data.logoUrl ?? "");
      setIsActive(data.isActive);
    }
    setLoading(false);
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    setMessage("");
    setError("");
    const form = new FormData();
    form.append("kind", "commercial-logo");
    form.append("file", file);
    const response = await clientApi<{ url: string }>("/api/uploads/images", {
      method: "POST",
      body: form
    });
    setLogoUrl(response.url);
    setMessage("Logo cargado correctamente. Guarda el perfil para publicarlo.");
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = await clientApi<ObsidianProfile>("/api/obsidiana-profile", {
        method: "PUT",
        body: JSON.stringify({
          serviceType,
          businessName,
          description,
          cityOrZone,
          priceRange,
          contactName,
          phone,
          email: email || undefined,
          logoUrl,
          isActive
        })
      });
      setProfile(saved);
      setMessage("Perfil Obsidiana guardado correctamente.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar el perfil Obsidiana.");
    } finally {
      setSaving(false);
    }
  }

  async function changeSubscription(plan: DoctorProfile["medal"]) {
    setSubscriptionAction(plan);
    setMessage("");
    setError("");
    try {
      const response = await clientApi<{ checkoutUrl?: string; status?: string }>("/api/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({ plan })
      });
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }
      setMessage("Suscripción actualizada correctamente. Te llevaremos al panel correspondiente.");
      window.location.href = plan === "obsidiana" ? "/dashboard/obsidiana" : "/dashboard/doctor";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cambiar la suscripción.");
    } finally {
      setSubscriptionAction("");
    }
  }

  async function cancelSubscriptionRenewal() {
    const confirmed = window.confirm("¿Quieres cancelar la renovación automática de Obsidiana? Tu acceso seguirá activo hasta terminar el periodo pagado.");
    if (!confirmed) return;
    setSubscriptionAction("cancel");
    setMessage("");
    setError("");
    try {
      const response = await clientApi<{ message: string }>("/api/subscriptions/cancel", {
        method: "POST",
        body: JSON.stringify({ plan: "obsidiana" })
      });
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cancelar la renovación.");
    } finally {
      setSubscriptionAction("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7fbfd] px-4 pb-24 pt-28 text-deep sm:px-5 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm font-semibold text-slate-500 transition hover:text-deep">Volver al inicio</Link>

        <section className="mt-8 rounded-[2rem] border border-silver/70 bg-white p-6 shadow-premium md:p-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Panel Obsidiana</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-deep md:text-5xl">Representantes Médicos / Catering</h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Administra tu perfil comercial para aparecer en el directorio de VITAEON sin acceder al panel médico.
              </p>
            </div>
            <div className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
              {profile ? `Estado: ${profile.status}` : "Perfil pendiente"}
            </div>
          </div>

          {activatingPlan && (
            <div className="mt-8">
              <PlanActivatingCard plan={activatingPlan} />
            </div>
          )}

          {loading && !activatingPlan && (
            <div className="mt-8 flex items-center gap-3 rounded-3xl bg-slate-50 p-5 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando tu perfil comercial...
            </div>
          )}

          {!loading && !activatingPlan && (
            <>
            <section className="mt-8 rounded-[1.75rem] border border-silver/70 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-medical">Suscripción Obsidiana</p>
                  <h2 className="mt-2 text-2xl font-semibold text-deep">Representantes médicos y catering</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Obsidiana mantiene activo tu perfil comercial dentro de VITAEON. Desde aquí puedes cambiar a otro plan o cancelar la renovación automática cuando lo necesites.
                  </p>
                </div>
                <Badge value="Obsidiana activa" />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-deep">Cambiar a otra suscripción</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Si tu cuenta pasará de perfil comercial a médico, elige un plan médico. VITAEON te llevará al flujo correspondiente sin mezclar el panel Obsidiana con el panel médico.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {doctorPlans.filter((plan) => plan.id !== "obsidiana").map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => changeSubscription(plan.id)}
                        disabled={subscriptionAction.length > 0}
                        className="rounded-full border border-silver bg-white px-5 py-3 text-sm font-semibold text-deep transition hover:-translate-y-0.5 hover:border-medical/40 disabled:opacity-60"
                      >
                        {subscriptionAction === plan.id ? "Abriendo..." : `Cambiar a ${plan.name}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-rose-100 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-deep">Cancelar suscripción</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Puedes cancelar la renovación automática en cualquier momento. Tu acceso continúa hasta finalizar el periodo ya pagado.
                  </p>
                  <button
                    type="button"
                    onClick={cancelSubscriptionRenewal}
                    disabled={subscriptionAction.length > 0}
                    className="mt-4 rounded-full border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {subscriptionAction === "cancel" ? "Cancelando..." : "Cancelar renovación"}
                  </button>
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.75rem] border border-silver/70 bg-white p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-sm font-semibold text-slate-600">Tipo de servicio</span>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {[
                        { id: "MEDICAL_REPRESENTATIVE", label: "Representante médico" },
                        { id: "CATERING", label: "Catering" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setServiceType(item.id as ObsidianProfile["serviceType"])}
                          className={`rounded-full border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                            serviceType === item.id ? "border-deep bg-deep text-white" : "border-silver bg-white text-deep"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </label>
                  <Field label="Nombre comercial o representante" value={businessName} onChange={setBusinessName} placeholder="Ej. Aspen León / Banquetes..." />
                  <Field label="Ciudad o zona" value={cityOrZone} onChange={setCityOrZone} placeholder="León, Guanajuato" />
                  <Field label="Teléfono de contacto" value={phone} onChange={setPhone} placeholder="477..." />
                  <Field label="Correo opcional" value={email} onChange={setEmail} placeholder="contacto@..." />
                  <Field label="Precio o rango de cobro" value={priceRange} onChange={setPriceRange} placeholder="Ej. Desde $250 / evento" />
                  <Field label="Nombre de contacto opcional" value={contactName} onChange={setContactName} placeholder="Nombre de quien atiende" />
                  <label className="sm:col-span-2">
                    <span className="text-sm font-semibold text-slate-600">Descripción</span>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Describe de forma clara lo que ofreces a la red médica."
                      className="mt-2 min-h-36 w-full rounded-3xl bg-slate-50 px-5 py-4 outline-none transition focus:bg-white focus:ring-2 focus:ring-medical/20"
                    />
                  </label>
                  <label className="sm:col-span-2 flex items-center gap-3 rounded-3xl bg-slate-50 px-5 py-4">
                    <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-5 w-5 accent-medical" />
                    <span className="font-semibold text-deep">Mostrar públicamente cuando esté aprobado y con suscripción activa</span>
                  </label>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-silver px-5 py-3 font-semibold text-deep transition hover:-translate-y-0.5">
                    <Upload className="h-5 w-5" />
                    Subir logo o imagen
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadLogo(event.target.files?.[0]).catch((caught) => setError(caught instanceof Error ? caught.message : "No fue posible subir el logo."))} className="hidden" />
                  </label>
                  <button onClick={saveProfile} disabled={saving} className="rounded-full bg-black px-6 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60">
                    {saving ? "Guardando..." : "Guardar perfil"}
                  </button>
                </div>
              </div>

              <aside className="rounded-[1.75rem] border border-silver/70 bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Vista previa</p>
                <div className="mt-5 rounded-[1.5rem] bg-white p-5 shadow-sm">
                  <div className="relative h-36 overflow-hidden rounded-[1.25rem] bg-slate-100">
                    {logoUrl ? (
                      <Image src={logoUrl} alt="Logo Obsidiana" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">Logo opcional</div>
                    )}
                  </div>
                  <div className="mt-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold text-deep">{businessName || "Nombre comercial"}</h2>
                      <p className="mt-1 text-sm font-semibold text-medical">{serviceType === "CATERING" ? "Catering" : "Representante médico"}</p>
                    </div>
                    <Badge value={isActive ? "Activo" : "Inactivo"} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{description || "Tu descripción aparecerá aquí."}</p>
                  <div className="mt-5 grid gap-3 text-sm text-slate-600">
                    <p><strong>Zona:</strong> {cityOrZone || "Pendiente"}</p>
                    <p><strong>Contacto:</strong> {phone || "Pendiente"}</p>
                    {priceRange && <p><strong>Rango:</strong> {priceRange}</p>}
                  </div>
                </div>
              </aside>
            </div>
            </>
          )}

          {message && <div className="mt-6 rounded-2xl bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">{message}</div>}
          {error && <ErrorState message={error} />}
        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="dashboard-stat rounded-[1.75rem]">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-medical/10 text-medical">
        {icon}
      </div>
      <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-3xl font-bold text-deep">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-full bg-slate-50 px-5 py-3.5 outline-none transition focus:bg-white focus:ring-2 focus:ring-medical/20"
      />
    </label>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-none text-red-500">!</span>
        <p>{message}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-silver/60 bg-slate-50/60 px-6 py-10 text-center">
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
