"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Image from "next/image";
import {
  AlertTriangle,
  BadgeCheck,
  Brain,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  HeartPulse,
  Hospital,
  Loader2,
  LogIn,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Siren,
  WalletCards
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { StripePaymentForm } from "@/components/platform/StripePaymentForm";
import { clientApi } from "@/services/client/api";
import type { CurrentUser, DoctorListItem } from "@/types/domain";

type Specialty = { id: string; name: string; description?: string | null; doctorsCount: number };
type HospitalItem = { id: string; name: string; city: string; address?: string | null; doctorsCount: number };
type PaymentMethod = "CASH" | "STRIPE";
type AuthAudience = "PATIENT" | "DOCTOR";
type MedicalRepresentative = {
  lab: string;
  focus: string;
  representative: string;
  zone: string;
  phone: string;
  email: string;
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
    createdAt: string;
  }>;
};

type WelcomeDiscountQuote = {
  eligible: boolean;
  discountCents?: number;
  finalAmountCents?: number;
  label?: string;
  headline?: string;
  explanation?: string;
  message?: string;
};

const defaultMedicalRepresentatives: MedicalRepresentative[] = [
  {
    lab: "Aspen",
    focus: "Cardiometabolismo, dolor y medicina interna",
    representative: "Lic. Mariana Aranda",
    zone: "León, Guanajuato",
    phone: "+52 477 120 8842",
    email: "mariana.aranda@aspen-vitaeon.mx"
  },
  {
    lab: "AstraZeneca",
    focus: "Cardiología, neumología, oncología y metabolismo",
    representative: "Dr. Rodrigo Salvatierra",
    zone: "Bajío médico",
    phone: "+52 477 318 2047",
    email: "rodrigo.salvatierra@az-vitaeon.mx"
  },
  {
    lab: "Sanofi",
    focus: "Diabetes, vacunas, inmunología y atención crónica",
    representative: "Lic. Andrea Ledesma",
    zone: "León y corredor industrial",
    phone: "+52 477 590 7311",
    email: "andrea.ledesma@sanofi-vitaeon.mx"
  }
];

const doctorSubscriptionPlans: Array<{
  medal: DoctorListItem["medal"];
  title: string;
  price: string;
  tone: string;
  recommended?: boolean;
  description: string;
  benefits: string[];
}> = [
  {
    medal: "oro",
    title: "Oro",
    price: "$0 MXN",
    tone: "Plan inicial",
    description: "Perfil médico básico para aparecer en una especialidad y un hospital dentro de VITAEON.",
    benefits: [
      "Perfil médico básico",
      "Aparecer en la especialidad seleccionada",
      "Elegir un hospital",
      "Subir fotografía personal",
      "Escribir títulos médicos",
      "Visibilidad normal en resultados"
    ]
  },
  {
    medal: "diamante",
    title: "Diamante",
    price: "$250 MXN",
    tone: "Plan profesional",
    description: "Presencia profesional intermedia con prioridad sobre perfiles Oro en resultados.",
    benefits: [
      "Todo lo del plan Oro",
      "Prioridad en resultados dentro de su especialidad",
      "Aparece por encima de médicos con plan Oro",
      "Mayor visibilidad en la página"
    ]
  },
  {
    medal: "amatista",
    title: "Amatista",
    price: "$399 MXN",
    tone: "Más exclusivo",
    recommended: true,
    description: "El plan premium para máxima presencia, agenda organizada y prioridad superior.",
    benefits: [
      "Todo lo del plan Diamante",
      "Prioridad superior a Diamante",
      "Aparece primero dentro de su especialidad",
      "Agenda médica personalizada",
      "Calendario asistido por IA",
      "Mejor visibilidad en sugerencias"
    ]
  }
];

type Ticket = {
  appointmentId: string;
  patient: string;
  doctor: string;
  specialty: string;
  hospital: string;
  startsAt: string;
  endsAt: string;
  appointmentStatus: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  amountCents: number;
  originalAmountCents?: number;
  discountCents?: number;
  discountLabel?: string | null;
};

function ticketPaymentLabel(ticket: Ticket) {
  if (ticket.paymentMethod === "CASH") return "Pago pendiente en efectivo";
  return ticket.paymentStatus === "PAID" ? "Pago en línea confirmado" : "Pago en línea registrado";
}

function ticketConfirmationMessage(ticket: Ticket) {
  if (ticket.paymentMethod === "CASH") {
    return "Tu cita fue registrada correctamente. El pago aparece como pendiente en efectivo.";
  }
  if (ticket.paymentStatus === "PAID") {
    return "Tu pago en línea quedó confirmado. La cita está pendiente de aceptación médica.";
  }
  return "Tu cita fue registrada correctamente con pago en línea. Puedes visualizar tu ticket y detalles de la cita en el panel del paciente.";
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const aiRoutes = [
  {
    specialty: "Nutrición",
    keywords: ["dieta", "nutricion", "nutrición", "peso", "bajar de peso", "alimentacion", "alimentación"],
    reason: "Nutrición ayuda a crear una ruta segura para hábitos, peso, metabolismo y bienestar sostenido."
  },
  {
    specialty: "Endocrinología",
    keywords: ["diabetes", "glucosa", "azucar", "azúcar", "tiroides", "hormonal", "metabolismo"],
    reason: "Endocrinología valora metabolismo, diabetes, tiroides y alteraciones hormonales con enfoque especializado."
  },
  {
    specialty: "Cardiología",
    keywords: ["pecho", "palpit", "corazon", "corazón", "presion", "presión", "hipertension", "hipertensión"],
    reason: "Los síntomas cardiovasculares requieren valoración prioritaria. Si hay dolor intenso, falta de aire o desmayo, busca urgencias reales."
  },
  {
    specialty: "Neurología",
    keywords: ["migra", "cabeza", "mareo", "temblor", "hormigueo", "memoria", "espalda", "columna"],
    reason: "Los síntomas neurológicos se benefician de una ruta diagnóstica estructurada."
  },
  {
    specialty: "Traumatología",
    keywords: ["cadera", "rodilla", "fractura", "trauma", "hueso", "dolor de espalda", "columna"],
    reason: "Traumatología y Ortopedia valoran dolor articular, lesiones, cadera, rodilla, columna y movilidad."
  },
  {
    specialty: "Medicina de Rehabilitación",
    keywords: ["rehabilitacion", "rehabilitación", "espalda", "columna", "dolor muscular", "movilidad"],
    reason: "Rehabilitación ayuda cuando hay dolor, pérdida de movilidad o recuperación funcional."
  },
  {
    specialty: "Dermatología",
    keywords: ["piel", "lunar", "acne", "acné", "mancha", "comezon", "comezón"],
    reason: "Los cambios de piel deben revisarse con criterio clínico y tecnología dermatológica."
  },
  {
    specialty: "Gastroenterología",
    keywords: ["estomago", "estómago", "gastritis", "reflujo", "colon", "abdomen"],
    reason: "Los síntomas digestivos suelen requerir evaluación especializada y plan de seguimiento."
  },
  {
    specialty: "Ginecología",
    keywords: ["embarazo", "gine", "menstruacion", "menstruación", "control prenatal"],
    reason: "Ginecología orienta embarazo, salud femenina, control prenatal y síntomas ginecológicos."
  },
  {
    specialty: "Psicología",
    keywords: ["ansiedad", "estres", "estrés", "terapia", "emocional"],
    reason: "Psicología puede acompañar ansiedad, estrés y bienestar emocional con intervención clínica."
  },
  {
    specialty: "Psiquiatría",
    keywords: ["ansiedad", "depresion", "depresión", "insomnio", "panico", "pánico"],
    reason: "La salud mental requiere atención profesional, confidencial y con acompañamiento continuo."
  }
];

function money(cents: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const publicStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  PENDING_DOCTOR_ACCEPTANCE: "Pendiente de aceptación médica",
  ACCEPTED: "Aceptada por el médico",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  NO_SHOW: "El médico marcó que el paciente no asistió",
  RESCHEDULE_REQUESTED: "Reagendamiento solicitado",
  CANCELLATION_REQUESTED: "Cancelación solicitada",
  REFUND_PENDING: "Reembolso pendiente de revisión",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
  PAID: "Pagado",
  FAILED: "Fallido"
};

function publicStatus(value: string) {
  return publicStatusLabels[value] ?? value;
}

function suggestSpecialty(symptom: string) {
  const cleanSymptom = symptom.toLowerCase();
  return aiRoutes.find((route) => route.keywords.some((keyword) => cleanSymptom.includes(keyword))) ?? {
    specialty: "Medicina Interna",
    keywords: [],
    reason: "Cuando el síntoma es general, Medicina Interna ayuda a ordenar la ruta clínica inicial."
  };
}

export default function VitaeonPlatform() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorListItem | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [authAudience, setAuthAudience] = useState<AuthAudience | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [representativesOpen, setRepresentativesOpen] = useState(false);
  const [representatives, setRepresentatives] = useState<MedicalRepresentative[]>([]);
  const [representativesLoading, setRepresentativesLoading] = useState(false);
  const [representativesError, setRepresentativesError] = useState("");
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [urgentSpecialtyId, setUrgentSpecialtyId] = useState("");
  const [urgentResults, setUrgentResults] = useState<DoctorListItem[]>([]);
  const [urgentLoading, setUrgentLoading] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<"idle" | "creating" | "success" | "error">("idle");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [reason, setReason] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [welcomeDiscount, setWelcomeDiscount] = useState<WelcomeDiscountQuote | null>(null);
  const [reviews, setReviews] = useState<ReviewSummary | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "PATIENT",
    phone: "",
    medal: "oro" as DoctorListItem["medal"]
  });

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError("");
      try {
        const [me, specialtiesData, hospitalsData] = await Promise.allSettled([
          clientApi<CurrentUser>("/api/auth/me"),
          clientApi<Specialty[]>("/api/specialties"),
          clientApi<HospitalItem[]>("/api/hospitals")
        ]);
        if (me.status === "fulfilled") setUser(me.value);
        if (specialtiesData.status === "fulfilled") setSpecialties(specialtiesData.value);
        if (hospitalsData.status === "fulfilled") setHospitals(hospitalsData.value);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No fue posible iniciar VITAEON.");
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    async function loadDoctors() {
      setDoctorsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (specialtyId) params.set("specialtyId", specialtyId);
        if (hospitalId) params.set("hospitalId", hospitalId);
        if (query.trim()) params.set("query", query.trim());
        const data = await clientApi<DoctorListItem[]>(`/api/doctors?${params.toString()}`);
        setDoctors(data);
        setSelectedDoctor((current) => current && data.some((doctor) => doctor.id === current.id) ? current : data[0] ?? null);
      } catch (caught) {
        setDoctors([]);
        setSelectedDoctor(null);
        setError(caught instanceof Error ? caught.message : "No fue posible cargar médicos.");
      } finally {
        setDoctorsLoading(false);
      }
    }
    loadDoctors();
  }, [specialtyId, hospitalId, query]);

  const selectedSlot = useMemo(
    () => selectedDoctor?.availability.find((slot) => slot.id === selectedSlotId) ?? selectedDoctor?.availability[0],
    [selectedDoctor, selectedSlotId]
  );
  const searchSuggestions = useMemo(() => {
    if (query.trim().length > 1 || specialtyId || hospitalId) return [];
    return ["Susana", "Medicina Interna", "Dolor de cadera", "Diabetes", "Nutrición", "Hospital Ángeles", "León"].slice(0, 6);
  }, [query, specialtyId, hospitalId]);

  useEffect(() => {
    setSelectedSlotId(selectedDoctor?.availability[0]?.id ?? "");
  }, [selectedDoctor]);

  useEffect(() => {
    async function loadDoctorContext() {
      if (!selectedDoctor) {
        setWelcomeDiscount(null);
        setReviews(null);
        return;
      }
      setReviewMessage("");
      const [reviewData, discountData] = await Promise.allSettled([
        clientApi<ReviewSummary>(`/api/reviews?doctorId=${selectedDoctor.id}`),
        clientApi<WelcomeDiscountQuote>(`/api/discounts/welcome?doctorId=${selectedDoctor.id}`)
      ]);
      setReviews(reviewData.status === "fulfilled" ? reviewData.value : null);
      setWelcomeDiscount(discountData.status === "fulfilled" ? discountData.value : null);
    }
    loadDoctorContext();
  }, [selectedDoctor, user]);

  function chooseSpecialty(value: string, openBookingFlow = false) {
    setSpecialtyId(value);
    if (openBookingFlow) {
      setSelectedDoctor(null);
      setSelectedSlotId("");
    }
    if (openBookingFlow) {
      setBookingOpen(true);
    } else {
      window.setTimeout(() => document.getElementById("busqueda")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }

  function changeBookingSpecialty(value: string) {
    setSpecialtyId(value);
    setSelectedDoctor(null);
    setSelectedSlotId("");
  }

  function selectDoctor(doctor: DoctorListItem) {
    setSelectedDoctor(doctor);
    setSelectedSlotId(doctor.availability[0]?.id ?? "");
    setSpecialtyId(doctor.specialtyId);
    setHospitalId(doctor.hospitalId);
  }

  function openAuth(audience?: AuthAudience) {
    setAuthAudience(audience ?? null);
    setAuthMode("login");
    setAuthForm((current) => ({ ...current, role: audience ?? current.role }));
    setAuthOpen(true);
  }

  function chooseAuthAudience(audience: AuthAudience, mode: "login" | "register" = "register") {
    setError("");
    setAuthAudience(audience);
    setAuthMode(mode);
    setAuthForm((current) => ({ ...current, role: audience }));
  }

  function toggleAuthMode() {
    setError("");
    setAuthMode((current) => current === "login" ? "register" : "login");
    setAuthAudience((current) => current ?? "PATIENT");
    setAuthForm((current) => ({ ...current, role: current.role || "PATIENT" }));
  }

  async function openRepresentatives() {
    setRepresentativesOpen(true);
    if (representatives.length > 0) return;
    setRepresentativesLoading(true);
    setRepresentativesError("");
    try {
      setRepresentatives(await clientApi<MedicalRepresentative[]>("/api/medical-representatives"));
    } catch (caught) {
      setRepresentatives(defaultMedicalRepresentatives);
      setRepresentativesError(caught instanceof Error ? caught.message : "No fue posible cargar representantes médicos.");
    } finally {
      setRepresentativesLoading(false);
    }
  }

  async function loadUrgentAvailability(nextSpecialtyId = urgentSpecialtyId) {
    setUrgentSpecialtyId(nextSpecialtyId);
    setUrgentResults([]);
    if (!nextSpecialtyId) return;
    setUrgentLoading(true);
    setError("");
    try {
      const data = await clientApi<DoctorListItem[]>(`/api/urgent-availability?specialtyId=${nextSpecialtyId}`);
      setUrgentResults(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar urgencias.");
    } finally {
      setUrgentLoading(false);
    }
  }

  function selectUrgentDoctor(doctor: DoctorListItem) {
    selectDoctor(doctor);
    setUrgentOpen(false);
    setBookingOpen(true);
  }

  async function submitAuth() {
    setError("");
    if (!authForm.email.trim() || !authForm.password.trim()) {
      setError("Ingresa tu correo y contraseña para continuar.");
      return;
    }
    if (authMode === "register" && !authForm.name.trim()) {
      setError("Ingresa tu nombre completo para crear tu cuenta.");
      return;
    }
    const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      authMode === "login"
        ? { email: authForm.email, password: authForm.password }
        : {
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
            role: authForm.role,
            phone: authForm.phone || undefined,
            medal: authForm.role === "DOCTOR" ? authForm.medal : undefined
          };
    try {
      const signedUser = await clientApi<CurrentUser>(path, { method: "POST", body: JSON.stringify(body) });
      setUser(signedUser);
      setAuthOpen(false);
      if (signedUser.role === "DOCTOR") {
        window.setTimeout(() => {
          window.location.href = "/dashboard/doctor";
        }, 120);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible iniciar sesión.");
    }
  }

  async function logout() {
    await clientApi<{ signedOut: boolean }>("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
    setUser(null);
  }

  async function startOnlinePayment(appointmentId: string) {
    setPaymentError("");
    setClientSecret("");
    try {
      const paymentIntent = await clientApi<{ clientSecret: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({ appointmentId, provider: "STRIPE" })
      });
      setClientSecret(paymentIntent.clientSecret);
      return true;
    } catch (caught) {
      const message = caught instanceof Error
        ? caught.message
        : "No pudimos abrir el pago en línea. Intenta de nuevo.";
      console.error("[Appointment online payment error]", caught);
      setPaymentError(message);
      return false;
    }
  }

  async function createAppointment() {
    if (!selectedDoctor || !selectedSlot) {
      setError("Selecciona un médico y un horario disponible antes de confirmar la cita.");
      return;
    }
    if (!user) {
      openAuth("PATIENT");
      return;
    }
    setBookingStatus("creating");
    setError("");
    setClientSecret("");
    setPaymentError("");
    try {
      const appointment = await clientApi<{
        id: string;
        originalAmountCents: number;
        discountCents: number;
        discountLabel?: string | null;
        doctor: { fullName: string; specialty?: { name: string }; hospital?: { name: string } };
        availabilitySlot: { startsAt: string; endsAt: string };
        payments: Array<{ status: string; amountCents: number }>;
      }>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          availabilitySlotId: selectedSlot.id,
          paymentMethod: paymentMethod === "CASH" ? "CASH" : "ONLINE",
          reason: reason || undefined
        })
      });

      const payment = appointment.payments[0];
      const nextTicket: Ticket = {
        appointmentId: appointment.id,
        patient: user.name,
        doctor: selectedDoctor.name,
        specialty: selectedDoctor.specialty,
        hospital: selectedDoctor.hospital,
        startsAt: appointment.availabilitySlot.startsAt,
        endsAt: appointment.availabilitySlot.endsAt,
        appointmentStatus: "PENDING_DOCTOR_ACCEPTANCE",
        paymentMethod,
        paymentStatus: payment?.status ?? "PENDING",
        amountCents: payment?.amountCents ?? selectedDoctor.priceCents,
        originalAmountCents: appointment.originalAmountCents,
        discountCents: appointment.discountCents,
        discountLabel: appointment.discountLabel
      };
      setTicket(nextTicket);

      if (paymentMethod === "STRIPE") await startOnlinePayment(appointment.id);

      setDoctors((current) => current.map((doctor) => (
        doctor.id === selectedDoctor.id
          ? { ...doctor, availability: doctor.availability.filter((slot) => slot.id !== selectedSlot.id) }
          : doctor
      )));
      setSelectedDoctor((current) => current && current.id === selectedDoctor.id
        ? { ...current, availability: current.availability.filter((slot) => slot.id !== selectedSlot.id) }
        : current);
      setSelectedSlotId("");
      setBookingStatus("success");
    } catch (caught) {
      setBookingStatus("error");
      setError(caught instanceof Error ? caught.message : "No fue posible crear la cita.");
    }
  }

  async function submitReview() {
    if (!selectedDoctor) return;
    setReviewMessage("");
    try {
      await clientApi("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ doctorId: selectedDoctor.id, rating: reviewRating, comment: reviewComment })
      });
      setReviewComment("");
      setReviewRating(5);
      setReviewMessage("Gracias. Tu opinión quedó registrada para este perfil médico.");
      setReviews(await clientApi<ReviewSummary>(`/api/reviews?doctorId=${selectedDoctor.id}`));
    } catch (caught) {
      setReviewMessage(caught instanceof Error ? caught.message : "No fue posible publicar la opinión.");
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#ffffff_45%,#eef5f8_100%)] text-ink">
      <Header user={user} onLogin={() => openAuth()} onLogout={logout} />

      <main className="px-5 pb-24 pt-32">
        <section className="hero-grid pixieset-section mx-auto grid max-w-7xl gap-12 rounded-[2.5rem] px-0 py-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8">
          <div className="soft-reveal">
            <div className="inline-flex items-center gap-3 rounded-full border border-silver bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm">
              <ShieldCheck className="h-5 w-5" />
              Red médica privada con especialistas verificados
            </div>
            <h1 className="mt-9 text-6xl font-semibold tracking-tight text-deep md:text-8xl">VITAEON</h1>
            <p className="mt-7 max-w-3xl text-2xl leading-relaxed text-slate-600">
              Conectando León en una sola red médica privada para priorizar la salud, el bienestar y el acceso a especialistas verificados con una experiencia clínica premium.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <button onClick={() => setBookingOpen(true)} className="rounded-full bg-black px-8 py-4 font-semibold text-white shadow-glass transition hover:-translate-y-0.5 hover:bg-deep">
                Agendar cita
              </button>
              <a href="#especialidades" className="rounded-full border border-silver bg-white px-8 py-4 text-center font-semibold text-deep shadow-sm transition hover:-translate-y-0.5">
                Explorar especialidades
              </a>
            </div>
            <HeroStats onRepresentativesClick={openRepresentatives} />
          </div>
          <div className="editorial-image relative overflow-hidden rounded-[2rem] border border-silver bg-white shadow-premium">
            <video className="h-[540px] w-full object-cover" autoPlay muted loop playsInline poster="/doctor-diagnosis.jpg">
              <source src="/vitaeon-hero.mov" type="video/quicktime" />
            </video>
            <div className="absolute bottom-6 left-6 right-6 rounded-[2rem] bg-white/90 p-6 shadow-glass backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Ruta clínica personalizada</p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-deep">Diagnóstico inteligente</h2>
                <HeartPulse className="h-8 w-8" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl">
          <IntelligentGuide specialties={specialties} onSpecialtySelect={(id) => chooseSpecialty(id, true)} />
        </section>

        <section id="busqueda" className="specialty-filter-bar glass mx-auto mt-16 max-w-7xl rounded-[2rem] p-5 shadow-premium">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            <FieldIcon icon={<Search className="h-5 w-5" />}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar médico, subespecialidad o servicio" className="w-full bg-transparent outline-none" />
            </FieldIcon>
            <FieldIcon icon={<Stethoscope className="h-5 w-5" />}>
	              <select value={specialtyId} onChange={(event) => chooseSpecialty(event.target.value)} className="w-full bg-transparent outline-none">
                <option value="">Todas las especialidades</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                ))}
              </select>
            </FieldIcon>
            <FieldIcon icon={<Hospital className="h-5 w-5" />}>
              <select value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} className="w-full bg-transparent outline-none">
                <option value="">Todos los hospitales</option>
                {hospitals.map((hospital) => (
                  <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                ))}
              </select>
            </FieldIcon>
          </div>
          {searchSuggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {searchSuggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => setQuery(suggestion)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:text-deep">
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </section>

        <SpecialtiesSection specialties={specialties} selectedId={specialtyId} onSelect={(id) => chooseSpecialty(id, true)} />
        {user?.role === "DOCTOR" && <SubscriptionShowcase />}

        <StateBlock loading={loading || doctorsLoading} error={error} empty={!doctorsLoading && doctors.length === 0} />

        <section className="mx-auto mt-12 grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="doctor-results-grid grid gap-5">
            {doctors.map((doctor) => (
	              <DoctorCard key={doctor.id} doctor={doctor} selected={selectedDoctor?.id === doctor.id} onSelect={() => selectDoctor(doctor)} />
            ))}
          </div>

          <aside className="h-fit rounded-[2rem] border border-silver bg-white p-6 shadow-premium lg:sticky lg:top-32">
            {selectedDoctor ? (
              <DoctorDetail
                doctor={selectedDoctor}
                slotId={selectedSlotId}
                setSlotId={setSelectedSlotId}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                reason={reason}
                setReason={setReason}
                createAppointment={createAppointment}
                bookingStatus={bookingStatus}
                user={user}
                welcomeDiscount={welcomeDiscount}
                reviews={reviews}
                reviewRating={reviewRating}
                setReviewRating={setReviewRating}
                reviewComment={reviewComment}
                setReviewComment={setReviewComment}
                reviewMessage={reviewMessage}
                submitReview={submitReview}
              />
            ) : (
              <EmptyCard title="Sin selección médica" text="Elige una especialidad para ver médicos verificados conforme se incorporen a la beta privada." />
            )}
          </aside>
        </section>

        {ticket && (
          <section className={`mx-auto mt-12 max-w-7xl rounded-[2rem] border bg-white p-8 shadow-premium ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "border-amber-100" : "border-emerald-100"}`}>
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className={`text-sm font-semibold uppercase tracking-[0.28em] ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "text-amber-700" : "text-emerald-700"}`}>Ticket VITAEON</p>
                <h2 className="mt-3 text-4xl font-semibold text-deep">
                  Cita creada correctamente.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Puedes visualizar tu ticket y detalles de la cita en el panel del paciente.
                </p>
              </div>
              <CheckCircle2 className={`h-10 w-10 ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "text-amber-600" : "text-emerald-600"}`} />
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Summary label="Médico" value={ticket.doctor} />
              <Summary label="Especialidad" value={ticket.specialty} />
              <Summary label="Hospital" value={ticket.hospital} />
              <Summary label="Paciente" value={ticket.patient} />
              <Summary label="Fecha y hora" value={dateTime(ticket.startsAt)} />
              <Summary label="Duración aproximada" value={`${Math.max(0, Math.round((new Date(ticket.endsAt).getTime() - new Date(ticket.startsAt).getTime()) / 60_000))} minutos`} />
              <Summary label="Pago" value={ticketPaymentLabel(ticket)} />
              <Summary label="Estado de cita" value={publicStatus(ticket.appointmentStatus)} />
              <Summary label="Estado de pago" value={publicStatus(ticket.paymentStatus)} />
              {ticket.discountCents ? <Summary label="Descuento" value={`-${money(ticket.discountCents)}`} /> : null}
              <Summary label="Total" value={money(ticket.amountCents)} />
            </div>
            {ticket.discountLabel && (
              <p className="mt-5 rounded-3xl bg-emerald-50 p-5 text-sm font-semibold text-emerald-700">
                {ticket.discountLabel}. Precio regular: {money(ticket.originalAmountCents ?? ticket.amountCents)}. Total con descuento: {money(ticket.amountCents)}.
              </p>
            )}
            <p className={`mt-6 rounded-3xl p-5 text-sm font-semibold ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
              {ticketConfirmationMessage(ticket)}
            </p>
            {ticket.paymentMethod === "STRIPE" && ticket.paymentStatus !== "PAID" && paymentError && (
              <p className="mt-4 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
                {paymentError}
              </p>
            )}
            {ticket.paymentMethod === "STRIPE" && ticket.paymentStatus !== "PAID" && clientSecret && !stripePromise && (
              <p className="mt-4 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
                El formulario de pago seguro no está disponible porque falta configurar la clave pública de Stripe.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {ticket.paymentMethod === "STRIPE" && ticket.paymentStatus !== "PAID" && clientSecret && (
                <a href="#stripe-payment" className="inline-flex rounded-full bg-black px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5">
                  Pagar ahora
                </a>
              )}
              {ticket.paymentMethod === "STRIPE" && ticket.paymentStatus !== "PAID" && !clientSecret && (
                <button
                  type="button"
                  onClick={() => startOnlinePayment(ticket.appointmentId)}
                  className="inline-flex rounded-full bg-black px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
                >
                  Reintentar pago en línea
                </button>
              )}
              <a href="/dashboard/patient" className="inline-flex rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700">
                Ver mi panel
              </a>
            </div>
            {clientSecret && stripePromise && (
              <div id="stripe-payment" className="mt-6">
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripePaymentForm onPaid={() => setTicket((current) => current ? { ...current, paymentStatus: "PAID", appointmentStatus: "PENDING_DOCTOR_ACCEPTANCE" } : current)} />
              </Elements>
              </div>
            )}
          </section>
        )}

        <HowItWorks />
        <Testimonials />
        <FAQ />
        <LegalLinks />
      </main>

      <button
        onClick={() => setUrgentOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-600/92 px-4 py-3 text-sm font-semibold text-white shadow-premium backdrop-blur transition hover:-translate-y-0.5 hover:bg-red-700"
        aria-label="Buscar cita pronta"
      >
        <Siren className="h-4 w-4" />
        Cita pronta
      </button>

      {authOpen && (
        <Modal title={authAudience ? (authAudience === "DOCTOR" ? "Acceso médico" : "Acceso paciente") : "Elige cómo entrar"} onClose={() => setAuthOpen(false)}>
          {!authAudience ? (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <button type="button" onClick={() => chooseAuthAudience("PATIENT", "register")} className="rounded-[1.5rem] border border-silver bg-slate-50 p-5 text-left transition hover:-translate-y-1 hover:bg-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Paciente</p>
                  <h3 className="mt-3 text-2xl font-semibold text-deep">Crear cuenta frecuente</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Agenda, guarda favoritos y consulta tickets desde tu panel.</p>
                </button>
                <button type="button" onClick={() => chooseAuthAudience("DOCTOR", "register")} className="rounded-[1.5rem] border border-silver bg-slate-50 p-5 text-left transition hover:-translate-y-1 hover:bg-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Médico</p>
                  <h3 className="mt-3 text-2xl font-semibold text-deep">Unirme a VITAEON</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Revisa suscripciones, verificación y cómo funciona la red.</p>
                </button>
              </div>
              <button type="button" onClick={() => chooseAuthAudience("PATIENT", "login")} className="rounded-full border border-silver bg-white px-6 py-4 text-sm font-semibold text-deep transition hover:-translate-y-0.5 hover:shadow-premium">
                Ya tengo una cuenta
              </button>
            </div>
          ) : (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 rounded-full bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => { setError(""); setAuthMode("register"); }}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${authMode === "register" ? "bg-white text-deep shadow-sm" : "text-slate-500"}`}
              >
                Registrarme
              </button>
              <button
                type="button"
                onClick={() => { setError(""); setAuthMode("login"); }}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${authMode === "login" ? "bg-white text-deep shadow-sm" : "text-slate-500"}`}
              >
                Ya tengo cuenta
              </button>
            </div>
            {authAudience === "DOCTOR" && (
              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Suscripciones médicas</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {doctorSubscriptionPlans.map((plan) => (
                    <button
                      type="button"
                      key={plan.title}
                      onClick={() => setAuthForm({ ...authForm, medal: plan.medal })}
                      className={`rounded-[1.35rem] text-left transition hover:-translate-y-0.5 ${authForm.medal === plan.medal ? "ring-4 ring-medical/15" : ""}`}
                    >
                      <PlanMiniCard plan={plan} />
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm font-semibold text-deep">Plan seleccionado: {authForm.medal.toUpperCase()}</p>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Crea tu perfil, registra cédula y documentos, elige suscripción y administración revisará tu verificación antes de mostrarte públicamente.
                </p>
              </div>
            )}
            {authMode === "register" && (
              <>
                <input value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} placeholder="Nombre completo" className="rounded-3xl bg-slate-50 px-5 py-4 outline-none" />
                <select value={authForm.role} onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })} className="rounded-3xl bg-slate-50 px-5 py-4 outline-none" disabled={Boolean(authAudience)}>
                  <option value="PATIENT">Paciente</option>
                  <option value="DOCTOR">Médico</option>
                </select>
              </>
            )}
            <input value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="Correo electrónico" className="rounded-3xl bg-slate-50 px-5 py-4 outline-none" />
            <input type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="Contraseña" className="rounded-3xl bg-slate-50 px-5 py-4 outline-none" />
            {error && <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</p>}
            <button type="button" onClick={submitAuth} className="rounded-full bg-black px-6 py-4 font-semibold text-white">{authMode === "login" ? "Entrar" : "Registrarme"}</button>
            <button type="button" onClick={toggleAuthMode} className="text-sm font-semibold text-medical">
              {authMode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
            </button>
            {authMode === "login" && (
              <a href="/recuperar-contrasena" className="text-sm font-semibold text-slate-500">
                Recuperar contraseña
              </a>
            )}
            <button type="button" onClick={() => { setError(""); setAuthAudience(null); }} className="text-sm font-semibold text-slate-500">
              Cambiar tipo de acceso
            </button>
          </div>
          )}
        </Modal>
      )}

      {representativesOpen && (
        <Modal title="Representantes médicos" onClose={() => setRepresentativesOpen(false)} size="wide">
          <div className="grid gap-4">
            <p className="leading-7 text-slate-600">
              Directorio inicial de laboratorios y representantes para contacto profesional dentro de la red VITAEON.
            </p>
            {representativesLoading && <p className="rounded-3xl bg-slate-50 p-5 text-slate-600">Cargando laboratorios...</p>}
            {representativesError && <p className="rounded-3xl bg-red-50 p-5 text-red-700">{representativesError}</p>}
            {(representatives.length ? representatives : defaultMedicalRepresentatives).map((item) => (
              <article key={`${item.lab}-${item.email}`} className="representative-option rounded-[1.5rem] border border-silver bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Farmacéutica</p>
                <h3 className="mt-2 text-2xl font-semibold text-deep">{item.lab}</h3>
                <p className="mt-2 leading-6 text-slate-600">{item.focus}</p>
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <Line icon={<BadgeCheck className="h-5 w-5" />} text={item.representative} />
                  <Line icon={<MapPin className="h-5 w-5" />} text={item.zone} />
                  <Line icon={<LogIn className="h-5 w-5" />} text={item.phone} />
                  <Line icon={<FileCheck2 className="h-5 w-5" />} text={item.email} />
                </div>
              </article>
            ))}
          </div>
        </Modal>
      )}

      {bookingOpen && (
        <Modal title="Agendar cita" onClose={() => setBookingOpen(false)} size="wide">
          <BookingFlow
            specialties={specialties}
            specialtyId={specialtyId}
            setSpecialtyId={changeBookingSpecialty}
            doctors={doctors}
            selectedDoctor={selectedDoctor}
            selectDoctor={selectDoctor}
            doctorsLoading={doctorsLoading}
            slotId={selectedSlotId}
            setSlotId={setSelectedSlotId}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            reason={reason}
            setReason={setReason}
            createAppointment={createAppointment}
            bookingStatus={bookingStatus}
            user={user}
            welcomeDiscount={welcomeDiscount}
            reviews={reviews}
            reviewRating={reviewRating}
            setReviewRating={setReviewRating}
            reviewComment={reviewComment}
            setReviewComment={setReviewComment}
            reviewMessage={reviewMessage}
            submitReview={submitReview}
          />
        </Modal>
      )}

      {urgentOpen && (
        <Modal title="Atención cercana" onClose={() => setUrgentOpen(false)} size="wide">
          <UrgentCareModal
            specialties={specialties}
            specialtyId={urgentSpecialtyId}
            onSpecialtyChange={loadUrgentAvailability}
            loading={urgentLoading}
            doctors={urgentResults}
            onSelectDoctor={selectUrgentDoctor}
          />
        </Modal>
      )}
    </div>
  );
}

function Header({ user, onLogin, onLogout }: { user: CurrentUser | null; onLogin: () => void; onLogout: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-5 py-4">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-7 py-4 shadow-glass">
        <div className="flex items-center gap-4">
          <HeartPulse className="h-6 w-6 text-white" />
          <span className="font-semibold tracking-[0.45em] text-deep">VITAEON</span>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <a href="#busqueda" className="text-sm font-semibold text-slate-600">Especialistas</a>
          {user && <a href={`/dashboard/${user.role === "DOCTOR" ? "doctor" : user.role === "ADMIN" || user.role === "STAFF" ? "admin" : "patient"}`} className="text-sm font-semibold text-slate-600">Panel</a>}
        </div>
        {user ? (
          <button onClick={onLogout} className="rounded-full border border-silver bg-white px-5 py-3 font-semibold text-deep shadow-sm">Salir</button>
        ) : (
          <button onClick={onLogin} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 font-semibold text-white shadow-sm">
            <LogIn className="h-4 w-4" /> Iniciar sesión
          </button>
        )}
      </nav>
    </header>
  );
}

function HeroStats({ onRepresentativesClick }: { onRepresentativesClick: () => void }) {
  return (
    <div className="hero-stats mt-12 grid gap-4 sm:grid-cols-3">
      <div className="hero-bubble hero-medal-bubble rounded-3xl border border-silver bg-white/92 p-5 text-center shadow-sm">
        <div className="flex justify-center gap-3">
          <MedalShield medal="oro" compact />
          <MedalShield medal="diamante" compact />
          <MedalShield medal="amatista" compact />
        </div>
        <p className="mt-4 font-serif text-lg italic leading-7 text-deep">Médicos que forjan tu bienestar</p>
      </div>
      <div className="hero-bubble map-mini rounded-3xl border border-silver bg-white/92 p-5 text-center shadow-sm">
        <span className="map-pin mx-auto" />
        <p className="mt-5 font-semibold text-deep">León, Gto.</p>
      </div>
      <button onClick={onRepresentativesClick} className="hero-bubble rounded-3xl border border-silver bg-white/92 p-5 text-center shadow-sm transition hover:-translate-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-medical">Representantes médicos</p>
        <p className="mt-3 font-semibold text-deep">Farmacéuticas y contacto profesional</p>
      </button>
    </div>
  );
}

function MedalShield({ medal, label, compact = false }: { medal: DoctorListItem["medal"]; label?: string; compact?: boolean }) {
  return (
    <span className={`medal shield-medal shield-medal-${medal} ${compact ? "medal-compact" : ""}`} title={label ?? medal}>
      <ShieldCheck className="h-4 w-4" />
      {!compact && label && <span>{label}</span>}
    </span>
  );
}

function PlanMiniCard({ plan }: { plan: (typeof doctorSubscriptionPlans)[number] }) {
  return (
    <article className={`doctor-plan-mini ${plan.recommended ? "doctor-plan-mini-featured" : ""}`}>
      {plan.recommended && <span className="doctor-plan-ribbon">Recomendado</span>}
      <MedalShield medal={plan.medal} compact />
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-medical">{plan.tone}</p>
      <h3 className="mt-1 text-xl font-semibold text-deep">{plan.title}</h3>
      <p className="mt-1 font-semibold text-deep">{plan.price}</p>
    </article>
  );
}

function PlanCard({ plan }: { plan: (typeof doctorSubscriptionPlans)[number] }) {
  return (
    <article className={`doctor-plan-card premium-card rounded-[2rem] p-6 ${plan.recommended ? "doctor-plan-featured" : ""}`}>
      {plan.recommended && <span className="doctor-plan-ribbon">Más completo</span>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">{plan.tone}</p>
          <h3 className="mt-3 text-3xl font-semibold text-deep">{plan.title}</h3>
        </div>
        <MedalShield medal={plan.medal} compact />
      </div>
      <p className="mt-4 text-2xl font-semibold text-deep">{plan.price}</p>
      <p className="mt-3 leading-7 text-slate-600">{plan.description}</p>
      <div className="mt-6 grid gap-3">
        {plan.benefits.map((benefit) => (
          <p key={benefit} className="flex gap-3 text-sm leading-6 text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-medical" />
            <span>{benefit}</span>
          </p>
        ))}
      </div>
    </article>
  );
}

function IntelligentGuide({ specialties, onSpecialtySelect }: { specialties: Specialty[]; onSpecialtySelect: (id: string) => void }) {
  const [symptom, setSymptom] = useState("");
  const suggestion = suggestSpecialty(symptom);
  const matchedSpecialty = specialties.find((specialty) => specialty.name === suggestion.specialty);

  return (
    <div className="ai-orientation-card premium-card grid gap-8 rounded-[2rem] p-7 lg:grid-cols-[0.72fr_1fr] lg:items-center">
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-medical">
          <Brain className="h-5 w-5" /> Orientador inteligente
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-deep">Dinos qué te duele</h2>
        <p className="mt-3 leading-7 text-slate-600">
          Esta orientación no sustituye una valoración médica. Te ayudamos a encontrar el especialista más adecuado según tu búsqueda.
        </p>
      </div>
      <div className="rounded-[1.6rem] bg-slate-50 p-4">
        <label className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm">
          <Search className="h-5 w-5 text-deep" />
          <input
            value={symptom}
            onChange={(event) => setSymptom(event.target.value)}
            placeholder="Ej. dolor de pecho, migraña, piel, ansiedad"
            className="w-full bg-transparent outline-none"
          />
        </label>
        <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-deep">Especialidad sugerida: {suggestion.specialty}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{suggestion.reason}</p>
          {matchedSpecialty && (
            <button onClick={() => onSpecialtySelect(matchedSpecialty.id)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">
              Ver especialistas recomendados <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecialtiesSection({ specialties, selectedId, onSelect }: { specialties: Specialty[]; selectedId: string; onSelect: (id: string) => void }) {
  const [previewId, setPreviewId] = useState(selectedId);
  const activeId = previewId || selectedId;
  const activeSpecialty = specialties.find((item) => item.id === activeId) ?? specialties.find((item) => item.id === selectedId);
  const activeImage = specialtyImageFor(activeSpecialty?.name);

  useEffect(() => {
    if (selectedId) setPreviewId(selectedId);
  }, [selectedId]);

  return (
    <section id="especialidades" className="specialty-flow relative mx-auto mt-16 rounded-[2.5rem] px-5 py-14">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.36em] text-medical">Especialidades</p>
        <h2 className="mt-4 max-w-5xl text-5xl font-semibold leading-tight text-deep">
          Todas las áreas médicas en una red privada de excelencia en León, Guanajuato.
        </h2>
        <p className="mt-5 font-serif text-2xl italic text-slate-500">Desliza y explora con calma</p>
        <div className="specialty-content mt-10 grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="specialty-preview overflow-hidden rounded-[2rem] border border-silver shadow-premium">
            <Image key={activeImage.src} src={activeImage.src} alt={`Especialidad ${activeSpecialty?.name ?? "VITAEON"}`} width={1000} height={720} className="h-full min-h-[24rem] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-deep/72 via-deep/10 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.34em]">VITAEON INDEX</p>
              <h3 className="mt-3 text-4xl font-semibold">{activeSpecialty?.name ?? "Vista de especialidad"}</h3>
              <p className="mt-3 max-w-xl text-lg leading-8 text-white/86">
                Explora perfiles seleccionados con criterio clínico, disponibilidad real y atención en León.
              </p>
            </div>
          </div>
          <div className="specialty-card-grid grid gap-5 md:grid-cols-2">
            {specialties.map((specialty) => {
              const cardImage = specialtyImageFor(specialty.name);
              return (
              <button
                key={specialty.id}
                onMouseEnter={() => setPreviewId(specialty.id)}
                onFocus={() => setPreviewId(specialty.id)}
                onClick={() => onSelect(specialty.id)}
                className={`specialty-motion-card premium-card rounded-[2rem] p-6 text-left ${selectedId === specialty.id ? "ring-4 ring-medical/15" : ""}`}
                style={{ "--card-photo": `url(${cardImage.src})`, "--card-position": cardImage.position } as CSSProperties}
              >
                <span className="specialty-card-photo" />
                <HeartPulse className="h-8 w-8 text-medical" />
                <h3 className="mt-8 text-2xl font-semibold text-deep">{specialty.name}</h3>
                <p className="mt-3 leading-7 text-slate-600">{specialty.description ?? "Especialistas certificados, hospitales afiliados y horarios verificados."}</p>
              </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function specialtyImageFor(name = "") {
  const normalized = name.toLowerCase();
  if (/(cirugía|ortopedia|trauma|anest|radiolog|rehabilitación|deporte)/i.test(normalized)) {
    return { src: "/doctor-diagnosis.jpg", position: "center" };
  }
  if (/(pediatr|gine|derma|psicolo|psiqu|nutri|geriatr|familiar)/i.test(normalized)) {
    return { src: "/clinic-consultation.jpg", position: "center" };
  }
  if (/(cardio|neuro|medicina interna|endo|gastro|neumo|uro|nefro|onco|hemato|infecto|reuma|oftal|otorrino)/i.test(normalized)) {
    return { src: "/doctor-diagnosis.jpg", position: "center top" };
  }
  return { src: "/clinic-consultation.jpg", position: "center" };
}

function SubscriptionShowcase() {
  return (
    <section id="suscripciones" className="mx-auto mt-16 max-w-7xl">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Suscripciones médicas</p>
      <h2 className="mt-3 max-w-4xl text-4xl font-semibold text-deep">Distintivos premium para médicos que desean crecer con orden, presencia y confianza.</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {doctorSubscriptionPlans.map((plan) => <PlanCard key={plan.title} plan={plan} />)}
      </div>
    </section>
  );
}

function FieldIcon({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <label className="flex items-center gap-4 rounded-3xl bg-slate-50 px-5 py-4 text-slate-500">{icon}{children}</label>;
}

function StateBlock({ loading, error, empty }: { loading: boolean; error: string; empty: boolean }) {
  if (loading) return <div className="mx-auto mt-10 flex max-w-7xl items-center gap-3 rounded-3xl bg-white p-5 text-slate-600 shadow-sm"><Loader2 className="h-5 w-5 animate-spin" /> Cargando red médica...</div>;
  if (error) return <div className="mx-auto mt-10 max-w-7xl rounded-3xl border border-red-100 bg-red-50 p-5 text-red-700">{error}</div>;
  if (empty) {
    return (
      <div className="mx-auto mt-10 max-w-7xl rounded-3xl bg-white p-6 text-slate-600 shadow-sm">
        Aún no hay especialistas disponibles en esta categoría. Estamos incorporando médicos verificados para la beta privada de VITAEON.
      </div>
    );
  }
  return null;
}

function BookingFlow(props: {
  specialties: Specialty[];
  specialtyId: string;
  setSpecialtyId: (value: string) => void;
  doctors: DoctorListItem[];
  selectedDoctor: DoctorListItem | null;
  selectDoctor: (doctor: DoctorListItem) => void;
  doctorsLoading: boolean;
  slotId: string;
  setSlotId: (value: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (value: PaymentMethod) => void;
  reason: string;
  setReason: (value: string) => void;
  createAppointment: () => void;
  bookingStatus: string;
  user: CurrentUser | null;
  welcomeDiscount: WelcomeDiscountQuote | null;
  reviews: ReviewSummary | null;
  reviewRating: number;
  setReviewRating: (value: number) => void;
  reviewComment: string;
  setReviewComment: (value: string) => void;
  reviewMessage: string;
  submitReview: () => void;
}) {
  const selectedSpecialtyName = props.specialties.find((specialty) => specialty.id === props.specialtyId)?.name ?? "Todas las especialidades";

  return (
    <div className="booking-flow grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[1.75rem] bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Especialidad seleccionada</p>
        <select
          value={props.specialtyId}
          onChange={(event) => props.setSpecialtyId(event.target.value)}
          className="mt-3 w-full rounded-3xl bg-white px-5 py-4 font-semibold text-deep outline-none"
        >
          <option value="">Todas las especialidades</option>
          {props.specialties.map((specialty) => (
            <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
          ))}
        </select>
        <div className="mt-5 flex items-center gap-3 rounded-3xl bg-white p-4 text-slate-600 shadow-sm">
          <Stethoscope className="h-5 w-5 text-medical" />
          <span>{selectedSpecialtyName}</span>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Doctores disponibles</p>
          <div className="booking-doctor-list mt-4 grid gap-3">
            {props.doctorsLoading && (
              <div className="flex items-center gap-3 rounded-3xl bg-white p-5 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando médicos disponibles...
              </div>
            )}
            {!props.doctorsLoading && props.doctors.length === 0 && (
              <div className="rounded-3xl bg-white p-5 text-slate-600">
                Aún no hay especialistas disponibles en esta categoría. Estamos incorporando médicos verificados para la beta privada de VITAEON.
              </div>
            )}
            {props.doctors.map((doctor) => (
              <button
                key={doctor.id}
                onClick={() => props.selectDoctor(doctor)}
                className={`booking-doctor-option rounded-3xl border p-4 text-left transition ${props.selectedDoctor?.id === doctor.id ? "border-medical bg-white shadow-sm ring-4 ring-medical/10" : "border-silver bg-white/80 hover:bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-deep">{doctor.name}</p>
                    <p className="mt-1 text-sm text-medical">{doctor.specialty}</p>
                    <p className="mt-2 text-sm text-slate-600">{doctor.hospital}</p>
                  </div>
                  <MedalShield medal={doctor.medal} compact />
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {doctor.availability.length} horarios visibles para paciente
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-silver bg-white p-6 shadow-sm">
        {props.selectedDoctor ? (
          <DoctorDetail
            doctor={props.selectedDoctor}
            slotId={props.slotId}
            setSlotId={props.setSlotId}
            paymentMethod={props.paymentMethod}
            setPaymentMethod={props.setPaymentMethod}
            reason={props.reason}
            setReason={props.setReason}
            createAppointment={props.createAppointment}
            bookingStatus={props.bookingStatus}
            user={props.user}
            welcomeDiscount={props.welcomeDiscount}
            reviews={props.reviews}
            reviewRating={props.reviewRating}
            setReviewRating={props.setReviewRating}
            reviewComment={props.reviewComment}
            setReviewComment={props.setReviewComment}
            reviewMessage={props.reviewMessage}
            submitReview={props.submitReview}
          />
        ) : (
          <EmptyCard
            title="Selecciona un médico"
            text="Al elegir un doctor se autocompletan especialidad, hospital, precio, duración y horarios disponibles."
          />
        )}
      </section>
    </div>
  );
}

function DoctorCard({ doctor, selected, onSelect }: { doctor: DoctorListItem; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`doctor-card-game premium-card overflow-hidden rounded-[2rem] border text-left ${selected ? "border-medical ring-4 ring-medical/10" : "border-silver"}`}>
      <div className="relative overflow-hidden">
        <Image src={doctor.imageUrl || "/doctor-diagnosis.jpg"} alt={doctor.name} width={820} height={520} className="h-64 w-full object-cover" />
        <span className="absolute left-5 top-5 rounded-full bg-black/78 px-5 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-white">
          Selección médica
        </span>
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-semibold text-deep">{doctor.name}</h3>
              <MedalShield medal={doctor.medal} compact />
            </div>
            <p className="mt-1 text-medical">{doctor.specialty}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-2 font-semibold text-amber-700"><Star className="h-4 w-4 fill-current" /> {doctor.rating.toFixed(2)}</span>
        </div>
        <p className="mt-5 leading-7 text-slate-600">{doctor.subSpecialty}</p>
        <div className="mt-5 rounded-[1.5rem] border border-silver/80 bg-white/64 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-medical">Logros</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            {(doctor.achievements.length ? doctor.achievements : [`${doctor.yearsExperience} años de trayectoria`, `Excelencia en ${doctor.specialty}`]).slice(0, 3).map((achievement) => (
              <p key={achievement} className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-current text-amber-600" />
                {achievement}
              </p>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-3 text-slate-600">
          <Line icon={<Hospital className="h-5 w-5" />} text={doctor.hospital} />
          <Line icon={<MapPin className="h-5 w-5" />} text={doctor.city} />
          <Line icon={<Calendar className="h-5 w-5" />} text={`${doctor.availability.length} horarios disponibles`} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {doctor.medal !== "oro" && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <Sparkles className="h-4 w-4" /> {doctor.medal === "amatista" ? "Perfil destacado" : "Mayor visibilidad por plan"}
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="h-4 w-4" /> Médico verificado
          </span>
          {doctor.professionalLicense && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <FileCheck2 className="h-4 w-4" /> Cédula {doctor.professionalLicense}
            </span>
          )}
        </div>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">
          Ver disponibilidad <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

function UrgentCareModal(props: {
  specialties: Specialty[];
  specialtyId: string;
  onSpecialtyChange: (value: string) => void;
  loading: boolean;
  doctors: DoctorListItem[];
  onSelectDoctor: (doctor: DoctorListItem) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.68fr_1.32fr]">
      <section className="rounded-[1.75rem] bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-6 w-6 text-red-600" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-600">Cita pronta</p>
            <h3 className="mt-2 text-2xl font-semibold text-deep">Atención cercana disponible</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Te mostramos los horarios más cercanos disponibles. VITAEON no sustituye servicios de urgencias médicas reales.
            </p>
          </div>
        </div>
        <select value={props.specialtyId} onChange={(event) => props.onSpecialtyChange(event.target.value)} className="mt-5 w-full rounded-3xl bg-white px-5 py-4 font-semibold text-deep outline-none">
          <option value="">Selecciona especialidad</option>
          {props.specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}
        </select>
      </section>
      <section className="grid gap-4">
        {props.loading && <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-5 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" /> Buscando disponibilidad más próxima...</div>}
        {!props.loading && props.specialtyId && props.doctors.length === 0 && (
          <EmptyCard title="Sin horarios cercanos" text="No hay espacios abiertos para esta especialidad en este momento. Prueba otra especialidad o agenda una consulta regular." />
        )}
        {!props.specialtyId && <EmptyCard title="Selecciona una especialidad" text="Ordenaremos médicos por el horario disponible más cercano." />}
        {props.doctors.map((doctor) => (
          <button key={doctor.id} onClick={() => props.onSelectDoctor(doctor)} className="rounded-[1.5rem] border border-silver bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-premium">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-600">Próximo horario</p>
                <h3 className="mt-2 text-2xl font-semibold text-deep">{doctor.name}</h3>
                <p className="mt-1 text-medical">{doctor.specialty} · {doctor.hospital}</p>
                <p className="mt-3 text-sm font-semibold text-slate-600">{doctor.availability[0] ? dateTime(doctor.availability[0].startsAt) : "Sin horario visible"}</p>
              </div>
              <MedalShield medal={doctor.medal} compact />
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}

function DoctorDetail(props: {
  doctor: DoctorListItem;
  slotId: string;
  setSlotId: (value: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (value: PaymentMethod) => void;
  reason: string;
  setReason: (value: string) => void;
  createAppointment: () => void;
  bookingStatus: string;
  user: CurrentUser | null;
  welcomeDiscount: WelcomeDiscountQuote | null;
  reviews: ReviewSummary | null;
  reviewRating: number;
  setReviewRating: (value: number) => void;
  reviewComment: string;
  setReviewComment: (value: string) => void;
  reviewMessage: string;
  submitReview: () => void;
}) {
  const { doctor } = props;
  const finalPrice = props.welcomeDiscount?.eligible
    ? props.welcomeDiscount.finalAmountCents ?? doctor.priceCents
    : doctor.priceCents;
  return (
    <div>
      <div className="flex items-center gap-3">
        <BadgeCheck className="h-6 w-6 text-medical" />
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Médico verificado</p>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <h2 className="text-4xl font-semibold text-deep">{doctor.name}</h2>
        <MedalShield medal={doctor.medal} compact />
      </div>
      <p className="mt-2 text-lg text-medical">{doctor.subSpecialty}</p>
      <p className="mt-5 leading-7 text-slate-600">{doctor.bio}</p>
      <div className="mt-6 grid gap-3">
        <Line icon={<Stethoscope className="h-5 w-5" />} text={`Especialidad: ${doctor.specialty}`} />
        <Line icon={<Clock className="h-5 w-5" />} text={`${doctor.consultationDurationMinutes} minutos`} />
        <Line icon={<WalletCards className="h-5 w-5" />} text={money(doctor.priceCents)} />
        <Line icon={<Sparkles className="h-5 w-5" />} text={`${doctor.yearsExperience} años de experiencia`} />
        <Line icon={<Hospital className="h-5 w-5" />} text={doctor.hospital} />
        {doctor.university && <Line icon={<FileCheck2 className="h-5 w-5" />} text={`Universidad: ${doctor.university}`} />}
        {doctor.professionalLicense && <Line icon={<FileCheck2 className="h-5 w-5" />} text={`Cédula profesional ${doctor.professionalLicense}`} />}
      </div>
      {props.welcomeDiscount && (
        <div className={`mt-6 rounded-[1.5rem] border p-5 ${props.welcomeDiscount.eligible ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-silver bg-slate-50 text-slate-600"}`}>
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5" />
            {props.welcomeDiscount.headline ?? props.welcomeDiscount.message ?? "Descuento de bienvenida para pacientes nuevos"}
          </p>
          {props.welcomeDiscount.explanation && <p className="mt-3 text-sm leading-6">{props.welcomeDiscount.explanation}</p>}
          {props.welcomeDiscount.eligible && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Summary label="Precio regular" value={money(doctor.priceCents)} />
              <Summary label="Descuento 35%" value={`-${money(props.welcomeDiscount.discountCents ?? 0)}`} />
              <Summary label="Total" value={money(finalPrice)} />
            </div>
          )}
        </div>
      )}
      <DoctorLocationCard doctor={doctor} />
      <div className="mt-7">
        <label className="font-semibold text-slate-700">Disponibilidad real</label>
        <select value={props.slotId} onChange={(event) => props.setSlotId(event.target.value)} className="mt-3 w-full rounded-3xl bg-slate-50 px-5 py-4 outline-none">
          {doctor.availability.length === 0 && <option value="">Sin horarios publicados</option>}
          {doctor.availability.map((slot) => <option key={slot.id} value={slot.id}>{dateTime(slot.startsAt)}</option>)}
        </select>
      </div>
      <div className="mt-5">
        <label className="font-semibold text-slate-700">Motivo de consulta</label>
        <textarea value={props.reason} onChange={(event) => props.setReason(event.target.value)} className="mt-3 min-h-28 w-full rounded-3xl bg-slate-50 px-5 py-4 outline-none" placeholder="Describe brevemente el motivo principal." />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button onClick={() => props.setPaymentMethod("CASH")} className={`rounded-3xl border px-5 py-4 font-semibold ${props.paymentMethod === "CASH" ? "border-black bg-black text-white" : "border-silver bg-white"}`}>Efectivo pendiente</button>
        <button onClick={() => props.setPaymentMethod("STRIPE")} className={`rounded-3xl border px-5 py-4 font-semibold ${props.paymentMethod === "STRIPE" ? "border-black bg-black text-white" : "border-silver bg-white"}`}>Pago en línea</button>
      </div>
      <button
        onClick={props.createAppointment}
        disabled={props.bookingStatus === "creating" || props.bookingStatus === "success" || doctor.availability.length === 0}
        className={`mt-6 flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 font-semibold text-white transition disabled:opacity-80 ${props.bookingStatus === "success" ? "bg-emerald-600" : "bg-black hover:bg-deep"}`}
      >
        {props.bookingStatus === "creating" ? <Loader2 className="h-5 w-5 animate-spin" /> : props.bookingStatus === "success" ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
        {props.bookingStatus === "success" ? "Cita creada correctamente" : props.user ? (props.paymentMethod === "STRIPE" ? "Crear cita y continuar al pago" : "Crear cita") : "Inicia sesión para agendar"}
      </button>
      {props.bookingStatus === "success" && (
        <p className="mt-4 rounded-3xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          Cita creada correctamente. Puedes visualizar tu ticket y detalles de la cita en el panel del paciente.
        </p>
      )}
      <p className="mt-4 text-sm leading-6 text-slate-500">
        La disponibilidad visible proviene de la agenda publicada por el médico. VITAEON bloquea el horario al registrar la cita para evitar dobles reservas.
      </p>
      <DoctorReviews
        reviews={props.reviews}
        rating={props.reviewRating}
        setRating={props.setReviewRating}
        comment={props.reviewComment}
        setComment={props.setReviewComment}
        message={props.reviewMessage}
        onSubmit={props.submitReview}
        canReview={props.user?.role === "PATIENT"}
      />
    </div>
  );
}

function DoctorLocationCard({ doctor }: { doctor: DoctorListItem }) {
  const links = [
    doctor.instagramUrl ? ["Instagram", doctor.instagramUrl] : null,
    doctor.facebookUrl ? ["Facebook", doctor.facebookUrl] : null,
    doctor.linkedinUrl ? ["LinkedIn", doctor.linkedinUrl] : null,
    doctor.websiteUrl ? ["Sitio web", doctor.websiteUrl] : null,
    doctor.whatsappUrl ? ["WhatsApp profesional", doctor.whatsappUrl] : null
  ].filter(Boolean) as Array<[string, string]>;

  if (!doctor.officeAddress && !doctor.officeReference && !doctor.professionalPhone && links.length === 0) return null;

  return (
    <section className="mt-6 rounded-[1.5rem] border border-silver bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Información profesional y ubicación</p>
      <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
        {doctor.officeAddress && <Line icon={<MapPin className="h-5 w-5" />} text={doctor.officeAddress} />}
        {doctor.officeReference && <Line icon={<Hospital className="h-5 w-5" />} text={doctor.officeReference} />}
        {doctor.cityState && <Line icon={<MapPin className="h-5 w-5" />} text={doctor.cityState} />}
        {doctor.professionalPhone && <Line icon={<LogIn className="h-5 w-5" />} text={doctor.professionalPhone} />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {doctor.mapsUrl && <a href={doctor.mapsUrl} target="_blank" rel="noreferrer" className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-deep">Ver mapa</a>}
        {links.map(([label, href]) => (
          <a key={label} href={href} target="_blank" rel="noreferrer" className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-deep">
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}

function DoctorReviews(props: {
  reviews: ReviewSummary | null;
  rating: number;
  setRating: (value: number) => void;
  comment: string;
  setComment: (value: string) => void;
  message: string;
  onSubmit: () => void;
  canReview: boolean;
}) {
  return (
    <section className="mt-8 rounded-[1.5rem] border border-silver bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Opiniones de pacientes</p>
          <h3 className="mt-2 text-2xl font-semibold text-deep">
            {(props.reviews?.average ?? 0).toFixed(1)} estrellas
          </h3>
          <p className="mt-1 text-sm text-slate-600">{props.reviews?.total ?? 0} opiniones registradas</p>
        </div>
        <div className="flex gap-1 text-amber-500">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} className={`h-5 w-5 ${(props.reviews?.average ?? 0) >= index + 1 ? "fill-current" : ""}`} />
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {(props.reviews?.reviews ?? []).slice(0, 3).map((review) => (
          <article key={review.id} className="rounded-3xl bg-slate-50 p-4">
            <p className="font-semibold text-deep">{review.patientName}</p>
            <p className="mt-1 text-sm text-amber-600">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{review.comment}</p>
            {review.doctorReply && <p className="mt-3 rounded-2xl bg-white p-3 text-sm leading-6 text-slate-600">Respuesta médica: {review.doctorReply}</p>}
          </article>
        ))}
        {props.reviews?.total === 0 && <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">Este perfil aún no tiene opiniones publicadas.</p>}
      </div>
      <div className="mt-5 rounded-3xl bg-slate-50 p-4">
        <p className="font-semibold text-deep">Dejar opinión</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Solo pacientes con cita completada pueden publicar reseñas.</p>
        <select value={props.rating} onChange={(event) => props.setRating(Number(event.target.value))} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 outline-none">
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} estrellas</option>)}
        </select>
        <textarea value={props.comment} onChange={(event) => props.setComment(event.target.value)} placeholder="Escribe una opinión clara y respetuosa." className="mt-3 min-h-24 w-full rounded-2xl bg-white px-4 py-3 outline-none" />
        <button onClick={props.onSubmit} disabled={!props.canReview} className="mt-3 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          Publicar opinión
        </button>
        {props.message && <p className="mt-3 text-sm font-semibold text-slate-600">{props.message}</p>}
      </div>
    </section>
  );
}

function Line({ icon, text }: { icon: ReactNode; text: string }) {
  return <p className="flex items-center gap-3">{icon}<span>{text}</span></p>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl bg-slate-50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p><p className="mt-2 font-semibold text-deep">{value}</p></div>;
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return <div className="rounded-3xl bg-slate-50 p-6"><h3 className="font-semibold text-deep">{title}</h3><p className="mt-2 text-slate-600">{text}</p></div>;
}

function Modal({ title, children, onClose, size = "normal" }: { title: string; children: ReactNode; onClose: () => void; size?: "normal" | "wide" }) {
  return (
    <div className="modal-shell fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-deep/30 px-5 py-6 backdrop-blur-sm">
      <div className={`modal-panel w-full rounded-[2rem] border border-silver bg-white p-7 shadow-premium ${size === "wide" ? "max-w-6xl" : "max-w-xl"}`}>
        <div className="modal-header mb-6 flex items-center justify-between gap-4">
          <h2 className="text-3xl font-semibold text-deep">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-slate-50 px-4 py-2 font-semibold">Cerrar</button>
        </div>
        <div className="modal-scroll representatives-panel">
          {children}
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["1", "Busca por especialidad", "Filtra médicos verificados por área clínica, hospital y disponibilidad."],
    ["2", "Elige especialista", "Revisa trayectoria, cédula, hospital, precio y horarios reales."],
    ["3", "Agenda con claridad", "Confirma fecha, método de pago y recibe tu ticket VITAEON."]
  ];

  return (
    <section className="mx-auto mt-16 max-w-7xl">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Cómo funciona</p>
      <h2 className="mt-3 text-4xl font-semibold text-deep">Una ruta médica simple, segura y premium.</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {steps.map(([number, title, text]) => (
          <article key={number} className="rounded-[2rem] border border-silver bg-white p-6 shadow-premium">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black font-semibold text-white">{number}</span>
            <h3 className="mt-6 text-2xl font-semibold text-deep">{title}</h3>
            <p className="mt-3 leading-7 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="mx-auto mt-16 grid max-w-7xl gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Confianza paciente</p>
        <h2 className="mt-3 text-4xl font-semibold text-deep">Acompañamiento privado desde la primera búsqueda.</h2>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <article className="rounded-[2rem] border border-silver bg-white p-6 shadow-premium">
          <p className="leading-7 text-slate-600">&ldquo;La información del especialista y el ticket de cita hacen que el proceso se sienta claro y confiable.&rdquo;</p>
          <p className="mt-5 font-semibold text-deep">Paciente verificado</p>
        </article>
        <article className="rounded-[2rem] border border-silver bg-white p-6 shadow-premium">
          <p className="leading-7 text-slate-600">&ldquo;La agenda visible y la verificación médica ayudan a elegir con más seguridad.&rdquo;</p>
          <p className="mt-5 font-semibold text-deep">Paciente VITAEON</p>
        </article>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    ["¿Los médicos están verificados?", "La búsqueda pública muestra médicos con estado verificado. Administración puede revisar cédula y documentos desde el panel."],
    ["¿Puedo pagar en efectivo?", "Sí. El sistema registra efectivo como pago pendiente para liquidarlo en consulta."],
    ["¿VITAEON reemplaza una consulta médica?", "No. VITAEON facilita búsqueda, agenda y gestión; la valoración clínica corresponde al especialista."]
  ];

  return (
    <section className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-silver bg-white p-8 shadow-premium">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Preguntas frecuentes</p>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {items.map(([question, answer]) => (
          <article key={question} className="rounded-3xl bg-slate-50 p-5">
            <h3 className="font-semibold text-deep">{question}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LegalLinks() {
  return (
    <footer className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-silver bg-white p-6 shadow-premium">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold tracking-[0.35em] text-deep">VITAEON</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Medicina privada, tecnología clínica y experiencia premium para el paciente.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
          <a href="/aviso-de-privacidad" className="rounded-full bg-slate-50 px-4 py-2 transition hover:bg-white hover:shadow-sm">Aviso de privacidad</a>
          <a href="/terminos" className="rounded-full bg-slate-50 px-4 py-2 transition hover:bg-white hover:shadow-sm">Términos</a>
          <a href="/politica-cancelaciones" className="rounded-full bg-slate-50 px-4 py-2 transition hover:bg-white hover:shadow-sm">Cancelaciones</a>
          <a href="/politica-reembolsos" className="rounded-full bg-slate-50 px-4 py-2 transition hover:bg-white hover:shadow-sm">Reembolsos</a>
          <a href="/consentimiento-datos" className="rounded-full bg-slate-50 px-4 py-2 transition hover:bg-white hover:shadow-sm">Consentimiento</a>
          <a href="/urgencias" className="rounded-full bg-slate-50 px-4 py-2 transition hover:bg-white hover:shadow-sm">Urgencias</a>
          <a href="/soporte" className="rounded-full bg-slate-50 px-4 py-2 transition hover:bg-white hover:shadow-sm">Soporte</a>
        </div>
      </div>
    </footer>
  );
}
