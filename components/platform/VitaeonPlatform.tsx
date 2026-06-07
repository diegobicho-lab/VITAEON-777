"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Baby,
  BadgeCheck,
  Bone,
  Brain,
  Calendar,
  ChevronRight,
  CheckCircle2,
  CreditCard,
  Droplets,
  Eye,
  FileCheck2,
  Heart,
  HeartPulse,
  Hospital,
  Leaf,
  Loader2,
  LogIn,
  MapPin,
  Microscope,
  Scissors,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Stethoscope,
  Thermometer,
  Users,
  WalletCards,
  Wind,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
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
    price: "$250 MXN / quincena",
    tone: "Plan profesional",
    description: "Presencia profesional intermedia con prioridad sobre perfiles Oro y renovación automática cada 14 días.",
    benefits: [
      "Todo lo del plan Oro",
      "Prioridad en resultados dentro de su especialidad",
      "Aparece por encima de médicos con plan Oro",
      "Mayor visibilidad en la página",
      "Renovación quincenal con Stripe"
    ]
  },
  {
    medal: "amatista",
    title: "Amatista",
    price: "$399 MXN / quincena",
    tone: "Más exclusivo",
    recommended: true,
    description: "El plan premium para máxima presencia, agenda organizada, prioridad superior y renovación cada 14 días.",
    benefits: [
      "Todo lo del plan Diamante",
      "Prioridad superior a Diamante",
      "Aparece primero dentro de su especialidad",
      "Agenda médica personalizada",
      "Calendario asistido por IA",
      "Mejor visibilidad en sugerencias",
      "Renovación quincenal con Stripe"
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
    return "Tu pago en línea quedó confirmado. Tu cita fue aceptada automáticamente por confirmación de pago.";
  }
  return "Tu ticket de consulta está listo. Revisa el resumen y continúa con el pago seguro para confirmar tu cita.";
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type AiRoute = {
  specialty: string;
  keywords: string[];
  reason: string;
  questions?: string[];
};

const aiRoutes: AiRoute[] = [
  {
    specialty: "Nutrición",
    keywords: ["dieta", "nutricion", "nutrición", "peso", "bajar de peso", "obesidad", "alimentacion", "alimentación", "plan alimenticio", "comer mejor"],
    reason: "Nutrición ayuda a ordenar hábitos, peso, composición corporal y bienestar metabólico con seguimiento personalizado.",
    questions: ["¿Buscas bajar de peso, controlar laboratorio o mejorar hábitos?", "¿Hay diabetes, presión alta o tiroides?"]
  },
  {
    specialty: "Endocrinología",
    keywords: ["diabetes", "glucosa", "azucar", "azúcar", "tiroides", "hormonal", "metabolismo", "resistencia a la insulina", "colesterol", "trigliceridos", "triglicéridos"],
    reason: "Endocrinología valora metabolismo, diabetes, tiroides, resistencia a la insulina y alteraciones hormonales.",
    questions: ["¿Tienes glucosa elevada, cambios de peso o estudios hormonales alterados?"]
  },
  {
    specialty: "Cardiología",
    keywords: ["pecho", "dolor de pecho", "palpit", "corazon", "corazón", "presion", "presión", "hipertension", "hipertensión", "falta de aire", "desmayo"],
    reason: "Cardiología es clave para dolor torácico, palpitaciones, presión alta o síntomas relacionados con corazón y circulación.",
    questions: ["Si el dolor de pecho es intenso, con falta de aire o desmayo, busca urgencias reales."]
  },
  {
    specialty: "Neurología",
    keywords: ["migra", "migraña", "cabeza", "mareo", "temblor", "hormigueo", "memoria", "convulsion", "convulsión", "debilidad", "ciatica", "ciática"],
    reason: "Neurología orienta dolor de cabeza persistente, mareos, hormigueo, temblores, convulsiones o síntomas nerviosos.",
    questions: ["¿El síntoma inició de forma súbita o se acompaña de debilidad?"]
  },
  {
    specialty: "Traumatología",
    keywords: ["cadera", "rodilla", "hombro", "tobillo", "fractura", "trauma", "hueso", "dolor de espalda", "columna", "lesion", "lesión", "esguince"],
    reason: "Traumatología y Ortopedia valoran dolor articular, lesiones, cadera, rodilla, columna, fracturas y movilidad.",
    questions: ["¿Hubo golpe, caída o limitación para caminar o mover la articulación?"]
  },
  {
    specialty: "Medicina de Rehabilitación",
    keywords: ["rehabilitacion", "rehabilitación", "espalda", "columna", "dolor muscular", "movilidad", "terapia fisica", "terapia física", "recuperacion", "recuperación"],
    reason: "Rehabilitación ayuda cuando hay dolor persistente, pérdida de movilidad o recuperación funcional después de lesión."
  },
  {
    specialty: "Dermatología",
    keywords: ["piel", "lunar", "acne", "acné", "mancha", "comezon", "comezón", "roncha", "cabello", "uñas"],
    reason: "Dermatología atiende acné, manchas, lunares, comezón, lesiones de piel, cabello y uñas."
  },
  {
    specialty: "Gastroenterología",
    keywords: ["estomago", "estómago", "gastritis", "reflujo", "colon", "abdomen", "diarrea", "estreñimiento", "higado", "hígado", "nausea", "náusea"],
    reason: "Gastroenterología orienta dolor abdominal, reflujo, gastritis, colon, diarrea, estreñimiento y síntomas digestivos."
  },
  {
    specialty: "Ginecología",
    keywords: ["embarazo", "gine", "menstruacion", "menstruación", "control prenatal", "ovario", "flujo", "colico", "cólico"],
    reason: "Ginecología orienta embarazo, salud femenina, control prenatal, menstruación y síntomas ginecológicos."
  },
  {
    specialty: "Psicología",
    keywords: ["ansiedad", "estres", "estrés", "terapia", "emocional", "duelo", "pareja", "tristeza", "panico", "pánico"],
    reason: "Psicología acompaña ansiedad, estrés, duelo, cambios emocionales y bienestar mental con intervención clínica."
  },
  {
    specialty: "Psiquiatría",
    keywords: ["ansiedad", "depresion", "depresión", "insomnio", "panico", "pánico", "medicamento psiquiatrico", "medicamento psiquiátrico"],
    reason: "Psiquiatría es útil cuando los síntomas emocionales son intensos, persistentes o requieren valoración médica especializada."
  },
  {
    specialty: "Medicina Interna",
    keywords: ["cansancio", "fatiga", "revision", "revisión", "chequeo", "laboratorio", "varios sintomas", "varios síntomas", "presion", "presión", "diabetes", "dolor general"],
    reason: "Medicina Interna integra síntomas generales, enfermedades crónicas, estudios de laboratorio y dirige la ruta hacia otros especialistas."
  },
  {
    specialty: "Neumología",
    keywords: ["tos", "asma", "bronquitis", "neumonia", "neumonía", "respirar", "falta de aire", "pulmon"],
    reason: "Neumología valora tos persistente, asma, bronquitis, falta de aire y enfermedades respiratorias."
  },
  {
    specialty: "Oftalmología",
    keywords: ["ojo", "ojos", "vista", "vision", "visión", "lentes", "ver borroso"],
    reason: "Oftalmología atiende visión borrosa, dolor ocular, cambios visuales y salud de los ojos."
  },
  {
    specialty: "Otorrinolaringología",
    keywords: ["oido", "oído", "garganta", "nariz", "sinusitis", "ronquera", "amigdalas", "amígdalas"],
    reason: "Otorrinolaringología orienta síntomas de oído, nariz, garganta, sinusitis y ronquera."
  },
  {
    specialty: "Urología",
    keywords: ["orina", "urinaria", "prostata", "próstata", "vejiga", "piedra", "calculo", "cálculo"],
    reason: "Urología atiende síntomas urinarios, próstata, vejiga, cálculos y salud urológica."
  },
  {
    specialty: "Nefrología",
    keywords: ["riñon", "riñón", "renal", "creatinina", "proteina en orina", "proteína en orina"],
    reason: "Nefrología valora riñón, función renal, creatinina alterada y problemas urinarios relacionados con riñón."
  },
  {
    specialty: "Pediatría",
    keywords: ["niño", "niña", "bebe", "bebé", "vacunas", "fiebre niño", "pediatria", "pediatría"],
    reason: "Pediatría atiende salud infantil, vacunas, fiebre, crecimiento y seguimiento de niñas y niños."
  },
  {
    specialty: "Reumatología",
    keywords: ["articulaciones", "artritis", "reuma", "dolor articular", "lupus", "inflamacion", "inflamación"],
    reason: "Reumatología valora dolor e inflamación articular, artritis y enfermedades autoinmunes."
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
  PENDING: "Esperando confirmación",
  PENDING_DOCTOR_ACCEPTANCE: "Esperando aceptación médica",
  ACCEPTED: "Cita aceptada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  NO_SHOW: "El médico marcó que el paciente no asistió",
  RESCHEDULE_REQUESTED: "Reagendamiento solicitado",
  CANCELLATION_REQUESTED: "Cancelación solicitada",
  REFUND_PENDING: "Reembolso pendiente de revisión",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
  PAID: "Pago confirmado",
  FAILED: "Fallido"
};

function publicStatus(value: string) {
  return publicStatusLabels[value] ?? value;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function suggestSpecialty(symptom: string) {
  const cleanSymptom = normalizeText(symptom);
  const matches = aiRoutes
    .map((route) => {
      const score = route.keywords.reduce((total, keyword) => {
        const cleanKeyword = normalizeText(keyword);
        if (!cleanSymptom.includes(cleanKeyword)) return total;
        return total + (cleanKeyword.includes(" ") ? 3 : 1);
      }, 0);
      return { ...route, score };
    })
    .filter((route) => route.score > 0)
    .sort((a, b) => b.score - a.score || a.specialty.localeCompare(b.specialty, "es"));

  const fallback = {
    specialty: "Medicina Interna",
    keywords: [],
    reason: "Cuando el síntoma es general, Medicina Interna ayuda a ordenar una valoración integral y definir si necesitas otro especialista.",
    questions: ["Puedes escribir síntomas, servicio, órgano afectado o una frase común como “me duele la cadera”."],
    score: 0
  };
  const primary = matches[0] ?? fallback;
  const alternatives = matches.filter((route) => route.specialty !== primary.specialty).slice(0, 3);
  const redFlag = /dolor.*pecho|pecho.*dolor|falta de aire|desmayo|convulsion|convulsion|sangrado abundante|debilidad.*brazo|emergencia|urgencia/.test(cleanSymptom)
    ? "Si hay dolor intenso, falta de aire, desmayo, sangrado abundante o síntomas súbitos, busca atención de urgencias reales."
    : "";
  return { primary, alternatives, redFlag };
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
  const [paymentLoading, setPaymentLoading] = useState(false);
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
    setPaymentLoading(true);
    try {
      const paymentIntent = await clientApi<{ clientSecret: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({ appointmentId, provider: "STRIPE" })
      });
      if (!paymentIntent.clientSecret) {
        throw new Error("Stripe no devolvió el formulario de pago para esta cita.");
      }
      setClientSecret(paymentIntent.clientSecret);
      window.setTimeout(() => {
        document.getElementById("stripe-payment")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 180);
      return true;
    } catch (caught) {
      const message = caught instanceof Error
        ? caught.message
        : "No pudimos abrir el pago en línea. Intenta de nuevo.";
      console.error("[Appointment online payment error]", caught);
      setPaymentError(message);
      return false;
    } finally {
      setPaymentLoading(false);
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
    const selectedPaymentMethod = paymentMethod;
    setBookingStatus("creating");
    setError("");
    setClientSecret("");
    setPaymentError("");
    setPaymentLoading(false);
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
          paymentMethod: selectedPaymentMethod === "CASH" ? "CASH" : "ONLINE",
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
        paymentMethod: selectedPaymentMethod,
        paymentStatus: payment?.status ?? "PENDING",
        amountCents: payment?.amountCents ?? selectedDoctor.priceCents,
        originalAmountCents: appointment.originalAmountCents,
        discountCents: appointment.discountCents,
        discountLabel: appointment.discountLabel
      };
      setTicket(nextTicket);
      setBookingStatus("success");
      window.setTimeout(() => {
        document.getElementById("appointment-ticket")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);

      if (selectedPaymentMethod === "STRIPE") void startOnlinePayment(appointment.id);

      setDoctors((current) => current.map((doctor) => (
        doctor.id === selectedDoctor.id
          ? { ...doctor, availability: doctor.availability.filter((slot) => slot.id !== selectedSlot.id) }
          : doctor
      )));
      setSelectedDoctor((current) => current && current.id === selectedDoctor.id
        ? { ...current, availability: current.availability.filter((slot) => slot.id !== selectedSlot.id) }
        : current);
      setSelectedSlotId("");
    } catch (caught) {
      setBookingStatus("error");
      setError(caught instanceof Error ? caught.message : "No fue posible crear la cita.");
    }
  }

  async function confirmOnlinePayment(appointmentId: string, paymentIntentId?: string) {
    setPaymentError("");
    const result = await clientApi<{
      appointment: {
        status: string;
        paymentStatus: string;
        acceptedAutomatically: boolean;
        acceptedReason?: string | null;
      };
    }>("/api/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ appointmentId, paymentIntentId })
    });

    setTicket((current) => current
      ? {
          ...current,
          paymentStatus: result.appointment.paymentStatus,
          appointmentStatus: result.appointment.status
        }
      : current);
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

      <main className="px-4 pb-24 pt-28 sm:px-5 sm:pt-32">
        <section className="hero-grid pixieset-section mx-auto grid max-w-7xl gap-10 rounded-[2rem] px-5 py-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16 lg:rounded-[2.5rem] lg:px-12 lg:py-12">
          <div className="soft-reveal">
            {/* Badge con dot pulsante */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-silver/80 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-soft">
              <span className="relative flex h-2 w-2 flex-none">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Beta privada · León, Guanajuato
            </div>

            {/* Eyebrow serif */}
            <p className="mt-5 font-serif text-base italic text-medical/70">Red médica privada</p>

            {/* H1 — propuesta de valor */}
            <h1 className="mt-2 text-4xl font-extrabold leading-[1.09] tracking-tight text-deep sm:text-5xl lg:text-6xl xl:text-7xl">
              Encuentra el{" "}
              <span className="hero-gradient-text">especialista</span>
              {" "}que necesitas
            </h1>

            {/* Subtítulo */}
            <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-500">
              Médicos con cédula profesional verificada, agenda digital y atención privada. Solo en León.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setBookingOpen(true)}
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-[#071726] px-8 py-4 font-semibold text-white shadow-glass transition hover:-translate-y-0.5 hover:bg-[#0d2638] active:scale-[0.98]"
              >
                <Calendar className="h-4 w-4" />
                Agendar cita
              </button>
              <a
                href="#busqueda"
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-silver bg-white px-8 py-4 font-semibold text-deep shadow-soft transition hover:-translate-y-0.5 hover:shadow-premium"
              >
                <Search className="h-4 w-4" />
                Buscar especialista
              </a>
            </div>
            <HeroStats onRepresentativesClick={openRepresentatives} />
          </div>
          <div className="editorial-image relative overflow-hidden rounded-[2rem] bg-[#0c1f2e] shadow-premium">
            <HeroMockup />
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl">
          <IntelligentGuide specialties={specialties} onSpecialtySelect={(id) => chooseSpecialty(id, true)} />
        </section>

        <section id="busqueda" className="specialty-filter-bar glass mx-auto mt-16 max-w-7xl scroll-mt-32 rounded-[2rem] p-5 shadow-premium">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <FieldIcon icon={<Search className="h-4 w-4" />}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Médico, subespecialidad o servicio" className="w-full border-0 bg-transparent p-0 text-sm text-deep shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:shadow-none focus:ring-0" />
            </FieldIcon>
            <FieldIcon icon={<Stethoscope className="h-4 w-4" />}>
              <select value={specialtyId} onChange={(event) => chooseSpecialty(event.target.value)} className="w-full border-0 bg-transparent p-0 text-sm text-deep shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:ring-0">
                <option value="">Todas las especialidades</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                ))}
              </select>
            </FieldIcon>
            <FieldIcon icon={<Hospital className="h-4 w-4" />}>
              <select value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} className="w-full border-0 bg-transparent p-0 text-sm text-deep shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:ring-0">
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
                <button key={suggestion} onClick={() => setQuery(suggestion)} className="rounded-full border border-silver/60 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-soft transition hover:-translate-y-0.5 hover:border-silver hover:text-deep">
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </section>

        <SpecialtiesSection specialties={specialties} selectedId={specialtyId} onSelect={(id) => chooseSpecialty(id, true)} />
        {user?.role === "DOCTOR" && <SubscriptionShowcase />}

        <StateBlock loading={loading || doctorsLoading} error={error} empty={!doctorsLoading && doctors.length === 0} />

        <section className="mx-auto mt-16 grid max-w-7xl gap-6 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px]">
          <div>
            {/* Doctor count header */}
            {doctors.length > 0 && !doctorsLoading && (
              <p className="mb-4 text-sm text-slate-500">
                <span className="font-semibold text-deep">{doctors.length}</span> médico{doctors.length !== 1 ? "s" : ""} encontrado{doctors.length !== 1 ? "s" : ""}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {doctors.map((doctor) => (
                <DoctorCard key={doctor.id} doctor={doctor} selected={selectedDoctor?.id === doctor.id} onSelect={() => selectDoctor(doctor)} />
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-[2rem] border border-silver/70 bg-white shadow-soft lg:sticky lg:top-28">
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
          <section id="appointment-ticket" className={`mx-auto mt-12 max-w-7xl scroll-mt-32 rounded-[2rem] border bg-white p-8 shadow-premium ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "border-amber-100" : "border-emerald-100"}`}>
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className={`text-sm font-semibold uppercase tracking-[0.28em] ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "text-amber-700" : "text-emerald-700"}`}>Ticket VITAEON</p>
                <h2 className="mt-3 text-4xl font-semibold text-deep">
                  Tu ticket de consulta está listo.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Revisa con calma los detalles de tu consulta. Desde aquí puedes continuar al pago seguro y después consultar tu ticket en el panel del paciente.
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
            {ticket.paymentMethod === "STRIPE" && ticket.paymentStatus !== "PAID" && (
              <div className="mt-5 rounded-[1.5rem] border border-silver bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Pago seguro en línea</p>
                    <h3 className="mt-2 text-2xl font-semibold text-deep">
                      {paymentLoading ? "Preparando pago seguro" : clientSecret && stripePromise ? "Pago seguro listo" : "Continúa con pago seguro"}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      {paymentLoading
                        ? "Estamos preparando una experiencia de pago protegida para tu consulta."
                        : clientSecret && stripePromise
                          ? "Completa el pago en el formulario protegido que aparece abajo. Al confirmarse, tu cita quedará pagada y aceptada automáticamente."
                          : "Tu ticket ya fue creado. Para confirmar el pago en línea, abre el formulario seguro de Stripe."}
                    </p>
                  </div>
                  {paymentLoading ? <Loader2 className="h-7 w-7 animate-spin text-medical" /> : <CreditCard className="h-7 w-7 text-medical" />}
                </div>
              </div>
            )}
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
              {ticket.paymentMethod === "STRIPE" && ticket.paymentStatus !== "PAID" && paymentLoading && (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-6 py-3 font-semibold text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" /> Preparando pago
                </span>
              )}
              {ticket.paymentMethod === "STRIPE" && ticket.paymentStatus !== "PAID" && clientSecret && (
                <a href="#stripe-payment" className="inline-flex rounded-full bg-black px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5">
                  Continuar con pago seguro
                </a>
              )}
              {ticket.paymentMethod === "STRIPE" && ticket.paymentStatus !== "PAID" && !clientSecret && !paymentLoading && (
                <button
                  type="button"
                  onClick={() => startOnlinePayment(ticket.appointmentId)}
                  className="inline-flex rounded-full bg-black px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
                >
                  Continuar con pago seguro
                </button>
              )}
              <a href="/dashboard/patient" className="inline-flex rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700">
                Ver mi panel
              </a>
            </div>
            {clientSecret && stripePromise && (
              <div id="stripe-payment" className="mt-6 scroll-mt-32">
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripePaymentForm onPaid={(paymentIntentId) => confirmOnlinePayment(ticket.appointmentId, paymentIntentId)} />
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
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2.5 rounded-full bg-red-600 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(220,38,38,0.35)] transition hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-[0_12px_40px_rgba(220,38,38,0.42)] active:scale-[0.97]"
        aria-label="Buscar cita pronta"
      >
        <Siren className="h-4 w-4" />
        <span className="hidden sm:inline">Cita pronta</span>
        <span className="sm:hidden">Urgente</span>
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
                <input value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} placeholder="Nombre completo" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <select value={authForm.role} onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })} className="rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" disabled={Boolean(authAudience)}>
                  <option value="PATIENT">Paciente</option>
                  <option value="DOCTOR">Médico</option>
                </select>
              </>
            )}
            <input value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="Correo electrónico" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
            <input type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="Contraseña" className="rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
            {error && <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</p>}
            <button type="button" onClick={submitAuth} className="rounded-full bg-[#071726] px-6 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] active:scale-[0.98]">{authMode === "login" ? "Entrar" : "Registrarme"}</button>
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
  const dashboardPath = user
    ? `/dashboard/${user.role === "DOCTOR" ? "doctor" : user.role === "ADMIN" || user.role === "STAFF" ? "admin" : "patient"}`
    : null;

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4 py-3 sm:px-5 sm:py-4">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-5 py-3 shadow-glass sm:px-7 sm:py-4">
        <Link href="/" className="flex select-none items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#071726]">
            <HeartPulse className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-[0.42em] text-deep sm:text-base">VITAEON</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <a href="#busqueda" className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-deep">
            Especialistas
          </a>
          <a href="#especialidades" className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-deep">
            Áreas
          </a>
          {dashboardPath && (
            <a href={dashboardPath} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-deep">
              Mi panel
            </a>
          )}
        </div>
        {user ? (
          <div className="flex items-center gap-2">
            {dashboardPath && (
              <a href={dashboardPath} className="hidden rounded-full border border-silver bg-white px-4 py-2.5 text-sm font-semibold text-deep shadow-soft transition hover:-translate-y-0.5 hover:shadow-premium sm:inline-flex">
                {user.name.split(" ")[0]}
              </a>
            )}
            <button onClick={onLogout} className="rounded-full border border-silver bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-soft transition hover:-translate-y-0.5 hover:text-deep">
              Salir
            </button>
          </div>
        ) : (
          <button onClick={onLogin} className="inline-flex items-center gap-2 rounded-full bg-[#071726] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0d2638]">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Iniciar sesión</span>
            <span className="sm:hidden">Entrar</span>
          </button>
        )}
      </nav>
    </header>
  );
}

function HeroStats({ onRepresentativesClick }: { onRepresentativesClick: () => void }) {
  return (
    <div className="mt-10">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Presentes en</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {["Hospital Ángeles", "Lomas Medical", "HMAS León", "Hospital OHL"].map((name) => (
          <span key={name} className="text-sm font-semibold text-slate-400 transition-colors hover:text-slate-600">{name}</span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-silver/60 pt-4">
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <BadgeCheck className="h-3.5 w-3.5 text-medical" />
          Cédula verificada
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          Agenda digital
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          León, Gto.
        </span>
        <button
          onClick={onRepresentativesClick}
          className="flex items-center gap-1.5 text-sm text-medical/75 underline-offset-2 transition hover:text-medical hover:underline"
        >
          <WalletCards className="h-3.5 w-3.5" />
          Representantes médicos
        </button>
      </div>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative h-[400px] overflow-hidden sm:h-[480px] lg:h-[540px]">
      {/* Animated orbs */}
      <div className="absolute left-[-8%] top-[-12%] h-80 w-80 rounded-full bg-medical/40 blur-[72px] [animation:orbA_9s_ease-in-out_infinite]" />
      <div className="absolute bottom-[0%] right-[-8%] h-72 w-72 rounded-full bg-[#0e5580]/50 blur-[80px] [animation:orbB_11s_ease-in-out_infinite]" />
      <div className="absolute left-[30%] top-[25%] h-60 w-60 rounded-full bg-[#1a80b8]/30 blur-[60px] [animation:orbC_7s_ease-in-out_infinite]" />
      <div className="absolute bottom-[25%] left-[5%] h-44 w-44 rounded-full bg-emerald-800/25 blur-[50px] [animation:orbA_14s_ease-in-out_infinite_reverse]" />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
        {/* Pulse ring */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute h-full w-full animate-ping rounded-full bg-medical/12" style={{ animationDuration: "2.4s" }} />
          <span className="absolute h-[80%] w-[80%] animate-ping rounded-full bg-medical/18" style={{ animationDuration: "2.4s", animationDelay: "0.6s" }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
            <HeartPulse className="h-8 w-8 text-white/85" />
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-2 px-8">
          {[
            { Icon: BadgeCheck, label: "Cédula verificada" },
            { Icon: Calendar,   label: "Agenda digital" },
            { Icon: ShieldCheck, label: "Red privada" },
          ].map(({ Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/65 ring-1 ring-white/15 backdrop-blur-sm"
            >
              <Icon className="h-3 w-3 text-white/50" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Confirmation card */}
      <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl bg-white/94 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-6">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-deep">Médicos verificados</p>
          <p className="text-xs text-slate-500">Cédula profesional · León, Gto.</p>
        </div>
        <span className="relative ml-auto flex h-2 w-2 flex-none">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </div>
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
  const orientation = suggestSpecialty(symptom);
  const matchedSpecialty = specialties.find((specialty) => specialty.name === orientation.primary.specialty);
  const alternativeMatches = orientation.alternatives.map((route) => ({
    route,
    specialty: specialties.find((specialty) => specialty.name === route.specialty)
  }));

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
          <p className="text-sm font-semibold text-deep">Especialidad sugerida: {orientation.primary.specialty}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{orientation.primary.reason}</p>
          {orientation.redFlag && (
            <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
              {orientation.redFlag}
            </p>
          )}
          {alternativeMatches.length > 0 && (
            <div className="mt-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">También podrías considerar</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {alternativeMatches.map(({ route, specialty }) =>
                  specialty ? (
                    <button
                      key={route.specialty}
                      onClick={() => onSpecialtySelect(specialty.id)}
                      className="rounded-full border border-silver bg-slate-50 px-4 py-2 text-xs font-semibold text-deep transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      {route.specialty}
                    </button>
                  ) : (
                    <span key={route.specialty} className="rounded-full border border-silver bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                      {route.specialty}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
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

const SPECIALTY_CATEGORIES: Array<{ id: string; label: string; icon: string; keywords: RegExp }> = [
  { id: "all",        label: "Todas",              icon: "✦", keywords: /.*/ },
  { id: "general",   label: "Medicina general",   icon: "🩺", keywords: /interna|familiar|geriatr/i },
  { id: "corazon",   label: "Corazón y metab.",   icon: "❤️", keywords: /cardio|endocrin|hemato|onco/i },
  { id: "mente",     label: "Mente y neurología", icon: "🧠", keywords: /neuro|psico|psiqu/i },
  { id: "huesos",    label: "Huesos y movilidad", icon: "🦴", keywords: /trauma|ortoped|reuma|rehab|deport/i },
  { id: "digestivo", label: "Digestivo y renal",  icon: "💧", keywords: /gastro|nefro|uro|infecto/i },
  { id: "resp",      label: "Respiratorio y ORL", icon: "🌬️", keywords: /neumo|otorrino|neumolog/i },
  { id: "piel",      label: "Piel y sensorial",   icon: "👁️", keywords: /derma|oftal/i },
  { id: "mujer",     label: "Mujer y familia",    icon: "🌸", keywords: /ginec|pediatr|nutri/i },
  { id: "cirugia",   label: "Cirugía",            icon: "⚕️", keywords: /cirugía|anest|radiolog/i },
];

function categoryOf(name: string): string {
  const n = name.toLowerCase();
  for (const cat of SPECIALTY_CATEGORIES.slice(1)) {
    if (cat.keywords.test(n)) return cat.id;
  }
  return "general";
}

function SpecialtiesSection({ specialties, selectedId, onSelect }: { specialties: Specialty[]; selectedId: string; onSelect: (id: string) => void }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const visibleCategories = useMemo(() => {
    const usedIds = new Set(specialties.map((s) => categoryOf(s.name)));
    return SPECIALTY_CATEGORIES.filter((c) => c.id === "all" || usedIds.has(c.id));
  }, [specialties]);

  const filtered = useMemo(
    () => activeCategory === "all" ? specialties : specialties.filter((s) => categoryOf(s.name) === activeCategory),
    [specialties, activeCategory]
  );

  const activeSpecialty = specialties.find((s) => s.id === (hoveredId ?? selectedId));
  const activeTheme = specialtyThemeFor(activeSpecialty?.name);
  const PreviewIcon = activeTheme.Icon;

  return (
    <section id="especialidades" className="relative mx-auto mt-20 max-w-7xl scroll-mt-24">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-medical">Especialidades</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight text-deep sm:text-5xl">
            Encuentra tu especialista
          </h2>
          <p className="mt-3 max-w-xl text-lg text-slate-500">
            Médicos verificados en León, organizados por área clínica.
          </p>
        </div>
      </div>

      {/* Category tabs — horizontal scroll */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {visibleCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
              activeCategory === cat.id
                ? "bg-[#071726] text-white shadow-soft"
                : "border border-silver/70 bg-white text-slate-600 hover:border-silver hover:bg-slate-50 hover:text-deep"
            }`}
          >
            <span className="mr-1.5">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content: preview image + cards grid */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr]">
        {/* Sticky preview panel — hidden on small screens */}
        <div
          className="specialty-preview relative hidden min-h-[28rem] overflow-hidden rounded-[2rem] shadow-premium lg:block"
          style={{ background: activeTheme.gradient }}
        >
          {/* Watermark icon — large, bottom-right, low opacity */}
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-5">
            <PreviewIcon className="h-52 w-52 text-white opacity-[0.14]" />
          </div>
          {/* Dark overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-7">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.36em] text-white/60">
              VITAEON · {activeCategory !== "all" ? (visibleCategories.find((c) => c.id === activeCategory)?.label ?? "Especialidades") : "Red médica"}
            </p>
            <h3 className="mt-2 text-3xl font-bold leading-tight text-white">
              {activeSpecialty?.name ?? "Selecciona una especialidad"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/70">
              {activeSpecialty?.doctorsCount
                ? `${activeSpecialty.doctorsCount} especialista${activeSpecialty.doctorsCount !== 1 ? "s" : ""} disponible${activeSpecialty.doctorsCount !== 1 ? "s" : ""}`
                : "Especialistas verificados en León, Gto."}
            </p>
            {activeSpecialty && (
              <button
                onClick={() => onSelect(activeSpecialty.id)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-deep transition hover:-translate-y-0.5"
              >
                Ver médicos <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Cards grid */}
        <div>
          {filtered.length === 0 && (
            <div className="rounded-[2rem] border border-dashed border-silver/60 bg-white/60 px-6 py-16 text-center">
              <p className="text-slate-400">Sin especialidades en esta categoría por el momento.</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((specialty) => {
              const isSelected = selectedId === specialty.id;
              const isHovered = hoveredId === specialty.id;
              const theme = specialtyThemeFor(specialty.name);
              const SpecIcon = theme.Icon;
              return (
                <button
                  key={specialty.id}
                  onMouseEnter={() => setHoveredId(specialty.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(specialty.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={() => onSelect(specialty.id)}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                    isSelected
                      ? "border-medical/30 bg-white shadow-[0_8px_32px_rgba(17,109,157,0.12)] ring-2 ring-medical/15"
                      : "border-silver/60 bg-white hover:border-silver hover:shadow-soft"
                  }`}
                >
                  {/* Specialty gradient accent bar at top */}
                  <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: theme.gradient }} />

                  {/* Hover glow using specialty color */}
                  <div
                    className={`absolute inset-0 transition-opacity duration-300 ${isHovered || isSelected ? "opacity-100" : "opacity-0"}`}
                    style={{ background: `linear-gradient(135deg, ${theme.iconBg} 0%, transparent 65%)` }}
                  />

                  <div className="relative flex items-start justify-between gap-3 pt-1">
                    {/* Specialty-themed icon */}
                    <div
                      className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-[transform,box-shadow] duration-300 ${isSelected ? "scale-110 shadow-sm" : "group-hover:scale-105"}`}
                      style={{ backgroundColor: theme.iconBg, color: theme.iconColor }}
                    >
                      <SpecIcon className="h-5 w-5" />
                    </div>
                    {/* Doctors count badge */}
                    {specialty.doctorsCount > 0 && (
                      <span className="flex-none rounded-full border border-silver/50 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                        {specialty.doctorsCount} médico{specialty.doctorsCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="relative mt-3">
                    <h3 className="font-semibold leading-snug text-deep">{specialty.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400 line-clamp-2">
                      {specialty.description ?? "Especialistas certificados y horarios verificados."}
                    </p>
                  </div>

                  {/* Bottom arrow */}
                  <div className={`relative mt-4 flex items-center gap-1.5 text-xs font-semibold transition-colors duration-200 ${isSelected ? "text-medical" : "text-slate-400 group-hover:text-medical"}`}>
                    Ver especialistas
                    <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isHovered ? "translate-x-0.5" : ""}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Show count */}
          {filtered.length > 0 && (
            <p className="mt-4 text-xs text-slate-400">
              Mostrando {filtered.length} especialidad{filtered.length !== 1 ? "es" : ""}
              {activeCategory !== "all" ? ` en ${visibleCategories.find((c) => c.id === activeCategory)?.label}` : " disponibles"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

type SpecialtyTheme = { gradient: string; iconBg: string; iconColor: string; Icon: ElementType };

function specialtyThemeFor(name = ""): SpecialtyTheme {
  const n = name.toLowerCase();
  if (/cardio/.test(n))       return { gradient: "linear-gradient(135deg,#fecdd3,#be123c)",  iconBg: "rgba(254,205,211,.42)", iconColor: "#be123c", Icon: HeartPulse };
  if (/neuro|cereb/.test(n))  return { gradient: "linear-gradient(135deg,#e9d5ff,#7c3aed)",  iconBg: "rgba(233,213,255,.42)", iconColor: "#7c3aed", Icon: Brain };
  if (/psicol|psiqu/.test(n)) return { gradient: "linear-gradient(135deg,#ddd6fe,#5b21b6)",  iconBg: "rgba(221,214,254,.42)", iconColor: "#5b21b6", Icon: Brain };
  if (/trauma|ortop/.test(n)) return { gradient: "linear-gradient(135deg,#fde68a,#d97706)",  iconBg: "rgba(253,230,138,.42)", iconColor: "#d97706", Icon: Bone };
  if (/reuma/.test(n))        return { gradient: "linear-gradient(135deg,#ffedd5,#b45309)",  iconBg: "rgba(255,237,213,.42)", iconColor: "#b45309", Icon: Bone };
  if (/derma/.test(n))        return { gradient: "linear-gradient(135deg,#fbcfe8,#db2777)",  iconBg: "rgba(251,207,232,.42)", iconColor: "#db2777", Icon: Eye };
  if (/oftal/.test(n))        return { gradient: "linear-gradient(135deg,#cffafe,#155e75)",  iconBg: "rgba(207,250,254,.42)", iconColor: "#155e75", Icon: Eye };
  if (/gastro/.test(n))       return { gradient: "linear-gradient(135deg,#a7f3d0,#059669)",  iconBg: "rgba(167,243,208,.42)", iconColor: "#059669", Icon: Activity };
  if (/pediatr/.test(n))      return { gradient: "linear-gradient(135deg,#bae6fd,#0284c7)",  iconBg: "rgba(186,230,253,.42)", iconColor: "#0284c7", Icon: Baby };
  if (/ginec/.test(n))        return { gradient: "linear-gradient(135deg,#fce7f3,#9d174d)",  iconBg: "rgba(252,231,243,.42)", iconColor: "#9d174d", Icon: Heart };
  if (/nutri/.test(n))        return { gradient: "linear-gradient(135deg,#d9f99d,#4d7c0f)",  iconBg: "rgba(217,249,157,.42)", iconColor: "#4d7c0f", Icon: Leaf };
  if (/endocrin/.test(n))     return { gradient: "linear-gradient(135deg,#fed7aa,#c2410c)",  iconBg: "rgba(254,215,170,.42)", iconColor: "#c2410c", Icon: Microscope };
  if (/neumo|pulmon/.test(n)) return { gradient: "linear-gradient(135deg,#e0f2fe,#0369a1)",  iconBg: "rgba(224,242,254,.42)", iconColor: "#0369a1", Icon: Wind };
  if (/\buro/.test(n))        return { gradient: "linear-gradient(135deg,#cffafe,#0e7490)",  iconBg: "rgba(207,250,254,.42)", iconColor: "#0e7490", Icon: Droplets };
  if (/nefro/.test(n))        return { gradient: "linear-gradient(135deg,#99f6e4,#0f766e)",  iconBg: "rgba(153,246,228,.42)", iconColor: "#0f766e", Icon: Droplets };
  if (/onco/.test(n))         return { gradient: "linear-gradient(135deg,#fee2e2,#b91c1c)",  iconBg: "rgba(254,226,226,.42)", iconColor: "#b91c1c", Icon: Microscope };
  if (/hemato/.test(n))       return { gradient: "linear-gradient(135deg,#fecaca,#9f1239)",  iconBg: "rgba(254,202,202,.42)", iconColor: "#9f1239", Icon: Droplets };
  if (/infecto/.test(n))      return { gradient: "linear-gradient(135deg,#bbf7d0,#15803d)",  iconBg: "rgba(187,247,208,.42)", iconColor: "#15803d", Icon: Thermometer };
  if (/otorrino/.test(n))     return { gradient: "linear-gradient(135deg,#ecfdf5,#065f46)",  iconBg: "rgba(236,253,245,.42)", iconColor: "#065f46", Icon: Activity };
  if (/rehab|fisio/.test(n))  return { gradient: "linear-gradient(135deg,#d1fae5,#047857)",  iconBg: "rgba(209,250,229,.42)", iconColor: "#047857", Icon: Activity };
  if (/cirug/.test(n))        return { gradient: "linear-gradient(135deg,#f1f5f9,#334155)",  iconBg: "rgba(241,245,249,.42)", iconColor: "#334155", Icon: Scissors };
  if (/anest/.test(n))        return { gradient: "linear-gradient(135deg,#dbeafe,#1e3a8a)",  iconBg: "rgba(219,234,254,.42)", iconColor: "#1e3a8a", Icon: Zap };
  if (/radio/.test(n))        return { gradient: "linear-gradient(135deg,#f1f5f9,#475569)",  iconBg: "rgba(241,245,249,.42)", iconColor: "#475569", Icon: Zap };
  if (/deporte/.test(n))      return { gradient: "linear-gradient(135deg,#dcfce7,#16a34a)",  iconBg: "rgba(220,252,231,.42)", iconColor: "#16a34a", Icon: Activity };
  if (/geriatr/.test(n))      return { gradient: "linear-gradient(135deg,#f3e8ff,#6b21a8)",  iconBg: "rgba(243,232,255,.42)", iconColor: "#6b21a8", Icon: Users };
  if (/familiar/.test(n))     return { gradient: "linear-gradient(135deg,#dbeafe,#1d4ed8)",  iconBg: "rgba(219,234,254,.42)", iconColor: "#1d4ed8", Icon: Users };
  if (/interna/.test(n))      return { gradient: "linear-gradient(135deg,#bfdbfe,#2563eb)",  iconBg: "rgba(191,219,254,.42)", iconColor: "#2563eb", Icon: Stethoscope };
  return { gradient: "linear-gradient(135deg,#cfe8f5,#116D9D)", iconBg: "rgba(207,232,245,.42)", iconColor: "#116D9D", Icon: Stethoscope };
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
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-silver/60 bg-white px-5 py-3.5 text-slate-400 shadow-soft transition-all focus-within:border-medical/40 focus-within:ring-2 focus-within:ring-medical/10">
      <span className="flex-none">{icon}</span>
      {children}
    </label>
  );
}

function StateBlock({ loading, error, empty }: { loading: boolean; error: string; empty: boolean }) {
  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-7xl">
        <div className="mb-4 flex items-center gap-3 rounded-[1.5rem] border border-silver bg-white px-6 py-4 text-slate-600 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin text-medical" />
          <span className="font-medium">Cargando red médica...</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-64 rounded-[2rem]" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto mt-10 max-w-7xl rounded-[1.5rem] border border-red-100 bg-red-50 p-6 text-red-700">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="mx-auto mt-10 max-w-7xl rounded-[2rem] border border-silver bg-white p-10 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
          <Stethoscope className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-deep">Sin especialistas en esta categoría</h3>
        <p className="mt-2 text-slate-500">Estamos incorporando médicos verificados para la beta privada de VITAEON.</p>
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

      <section className="rounded-[1.75rem] border border-silver bg-white shadow-sm">
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
  const topAchievements = (doctor.achievements.length
    ? doctor.achievements
    : [`${doctor.yearsExperience} años de trayectoria`, `Excelencia en ${doctor.specialty}`]
  ).slice(0, 2);

  return (
    <button
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-[1.75rem] border text-left transition-all duration-300 ${
        selected
          ? "border-medical/30 bg-white shadow-[0_16px_56px_rgba(17,109,157,0.14)] ring-2 ring-medical/12"
          : "border-silver/70 bg-white hover:border-medical/20 hover:shadow-[0_12px_48px_rgba(8,32,51,0.09)]"
      }`}
    >
      {/* Photo strip */}
      <div className="relative overflow-hidden">
        <Image
          src={doctor.imageUrl || "/doctor-diagnosis.jpg"}
          alt={doctor.name}
          width={820}
          height={460}
          className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#071726]/60 via-transparent to-transparent" />

        {/* Top-left badge */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-emerald-700 backdrop-blur-sm">
            <BadgeCheck className="h-3.5 w-3.5" /> Verificado
          </span>
          {doctor.medal !== "oro" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-medical" />
              {doctor.medal === "amatista" ? "Destacado" : "Premium"}
            </span>
          )}
        </div>

        {/* Bottom-left: name over image */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{doctor.specialty}</p>
              <h3 className="mt-0.5 text-xl font-bold leading-tight text-white">{doctor.name}</h3>
            </div>
            <div className="flex flex-none flex-col items-end gap-1.5">
              <MedalShield medal={doctor.medal} compact />
              {doctor.rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                  <Star className="h-3 w-3 fill-current" /> {doctor.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info body */}
      <div className="p-5">
        {/* Subespecialidad */}
        {doctor.subSpecialty && (
          <p className="text-sm leading-5 text-medical">{doctor.subSpecialty}</p>
        )}

        {/* Meta info row */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Hospital className="h-3.5 w-3.5 text-slate-400" />
            {doctor.hospital}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {doctor.city}
          </span>
        </div>

        {/* Achievements */}
        {topAchievements.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {topAchievements.map((item) => (
              <p key={item} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-medical/60" />
                {item}
              </p>
            ))}
          </div>
        )}

        {/* Cédula */}
        {doctor.professionalLicense && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <FileCheck2 className="h-3.5 w-3.5" /> Cédula {doctor.professionalLicense}
          </p>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-silver/40 pt-4">
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${doctor.availability.length > 0 ? "text-emerald-600" : "text-slate-400"}`}>
            <Calendar className="h-3.5 w-3.5" />
            {doctor.availability.length > 0 ? `${doctor.availability.length} horarios libres` : "Sin horarios visibles"}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${selected ? "bg-medical text-white" : "bg-[#071726] text-white group-hover:bg-[#0d2638]"}`}>
            {selected ? "Seleccionado" : "Ver perfil"}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
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
    <div className="p-6 sm:p-7">
      {/* ── Header ─────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-2xl bg-slate-100">
          {doctor.imageUrl
            ? <Image src={doctor.imageUrl} alt={doctor.name} width={128} height={128} className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-medical/70">{doctor.name.charAt(0)}</span>
          }
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <BadgeCheck className="h-3 w-3" /> Verificado
            </span>
            <MedalShield medal={doctor.medal} compact />
          </div>
          <h2 className="mt-1.5 text-2xl font-bold leading-tight text-deep">{doctor.name}</h2>
          {doctor.subSpecialty && (
            <p className="mt-0.5 text-sm font-medium text-medical">{doctor.subSpecialty}</p>
          )}
        </div>
      </div>

      {doctor.bio && (
        <p className="mt-5 text-sm leading-7 text-slate-600">{doctor.bio}</p>
      )}

      {/* ── Stats ──────────────────────────── */}
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-[#071726] p-4 text-center text-white">
          <p className="text-lg font-bold leading-tight">{money(doctor.priceCents)}</p>
          <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-white/55">por consulta</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-lg font-bold leading-tight text-deep">{doctor.consultationDurationMinutes}<span className="text-sm font-normal text-slate-400"> min</span></p>
          <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-slate-400">duración</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-lg font-bold leading-tight text-deep">{doctor.yearsExperience}<span className="text-sm font-normal text-slate-400"> años</span></p>
          <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-slate-400">experiencia</p>
        </div>
      </div>

      {/* ── Credenciales ───────────────────── */}
      <div className="mt-4 rounded-2xl border border-silver/60 bg-slate-50/60 p-4">
        <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Información médica</p>
        <div className="grid gap-2.5">
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <Stethoscope className="h-4 w-4 flex-none text-medical" />
            {doctor.specialty}
          </div>
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <Hospital className="h-4 w-4 flex-none text-slate-400" />
            {doctor.hospital}
          </div>
          {doctor.university && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <FileCheck2 className="h-4 w-4 flex-none text-slate-400" />
              {doctor.university}
            </div>
          )}
          {doctor.professionalLicense && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 flex-none text-emerald-500" />
              Cédula {doctor.professionalLicense}
            </div>
          )}
        </div>
      </div>

      {props.welcomeDiscount && (
        <div className={`mt-4 rounded-2xl border p-5 ${props.welcomeDiscount.eligible ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-silver bg-slate-50 text-slate-600"}`}>
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

      {doctor.practicePhotoUrl && (
        <section className="mt-5 overflow-hidden rounded-2xl border border-silver bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Consultorio</p>
          <Image
            src={doctor.practicePhotoUrl}
            alt={`Consultorio de ${doctor.name}`}
            width={900}
            height={420}
            unoptimized
            className="mt-3 h-56 w-full rounded-xl object-cover transition duration-500 hover:scale-[1.01]"
          />
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Imagen de referencia del espacio donde el médico atiende. La documentación sensible de verificación no se muestra públicamente.
          </p>
        </section>
      )}

      {/* ── Agendar ────────────────────────── */}
      <div className="mt-6 border-t border-silver/50 pt-6">
        <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Agendar consulta</p>

        <div>
          <label className="text-sm font-semibold text-slate-700">Disponibilidad real</label>
          <select value={props.slotId} onChange={(event) => props.setSlotId(event.target.value)} className="mt-2 w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10">
            {doctor.availability.length === 0 && <option value="">Sin horarios publicados</option>}
            {doctor.availability.map((slot) => <option key={slot.id} value={slot.id}>{dateTime(slot.startsAt)}</option>)}
          </select>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold text-slate-700">Motivo de consulta</label>
          <textarea value={props.reason} onChange={(event) => props.setReason(event.target.value)} className="mt-2 min-h-28 w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" placeholder="Describe brevemente el motivo principal." />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => props.setPaymentMethod("CASH")}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold transition-all ${
              props.paymentMethod === "CASH"
                ? "border-[#071726] bg-[#071726] text-white shadow-sm"
                : "border-silver/70 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <WalletCards className="h-4 w-4" />
            Efectivo en consultorio
          </button>
          <button
            onClick={() => props.setPaymentMethod("STRIPE")}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold transition-all ${
              props.paymentMethod === "STRIPE"
                ? "border-medical bg-medical text-white shadow-sm"
                : "border-silver/70 bg-white text-slate-600 hover:border-medical/30"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Pago en línea
          </button>
        </div>

        <button
          onClick={props.createAppointment}
          disabled={props.bookingStatus === "creating" || props.bookingStatus === "success" || doctor.availability.length === 0}
          className={`mt-5 flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-70 ${
            props.bookingStatus === "success" ? "bg-emerald-600" : "bg-medical hover:bg-[#0f6491]"
          }`}
        >
          {props.bookingStatus === "creating" ? <Loader2 className="h-5 w-5 animate-spin" /> : props.bookingStatus === "success" ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
          {props.bookingStatus === "success" ? "Cita creada correctamente" : props.user ? (props.paymentMethod === "STRIPE" ? "Crear cita y continuar al pago" : "Crear cita") : "Inicia sesión para agendar"}
        </button>

        {props.bookingStatus === "success" && (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            Cita creada correctamente. Puedes visualizar tu ticket y detalles de la cita en el panel del paciente.
          </p>
        )}

        <p className="mt-4 text-xs leading-5 text-slate-400">
          La disponibilidad visible proviene de la agenda publicada por el médico. VITAEON bloquea el horario al registrar la cita para evitar dobles reservas.
        </p>
      </div>

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
  return (
    <p className="flex items-start gap-3 text-slate-600">
      <span className="mt-0.5 flex-none text-slate-400">{icon}</span>
      <span>{text}</span>
    </p>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-silver/60 bg-slate-50/80 p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-1.5 font-semibold text-deep">{value}</p>
    </div>
  );
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-silver bg-slate-50/60 px-6 py-10 text-center">
      <h3 className="font-semibold text-deep">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function Modal({ title, children, onClose, size = "normal" }: { title: string; children: ReactNode; onClose: () => void; size?: "normal" | "wide" }) {
  return (
    <div className="modal-shell fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-deep/25 px-4 py-6 backdrop-blur-md sm:px-6">
      <div className={`modal-panel w-full rounded-[2rem] border border-silver/60 bg-white p-6 shadow-premium sm:p-8 ${size === "wide" ? "max-w-6xl" : "max-w-xl"}`}>
        <div className="modal-header mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-deep sm:text-3xl">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-deep"
            aria-label="Cerrar"
          >
            <span className="text-lg leading-none">×</span>
          </button>
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
    {
      number: "01",
      icon: <Search className="h-6 w-6" />,
      title: "Busca por especialidad",
      text: "Filtra médicos verificados por área clínica, hospital y disponibilidad real en León."
    },
    {
      number: "02",
      icon: <BadgeCheck className="h-6 w-6" />,
      title: "Elige especialista",
      text: "Revisa trayectoria, cédula profesional, hospital, precio y horarios publicados."
    },
    {
      number: "03",
      icon: <Calendar className="h-6 w-6" />,
      title: "Agenda con claridad",
      text: "Confirma fecha, método de pago y recibe tu ticket VITAEON al instante."
    }
  ];

  return (
    <section className="mx-auto mt-20 max-w-7xl">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-medical">Cómo funciona</p>
        <h2 className="mt-3 text-4xl font-semibold leading-tight text-deep sm:text-5xl">
          Una ruta médica simple,<br className="hidden sm:block" /> segura y premium.
        </h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {steps.map((step, idx) => (
          <article
            key={step.number}
            className={`stagger-${idx + 1} rounded-[2rem] border border-silver/80 bg-white p-7 shadow-soft transition hover:-translate-y-1 hover:shadow-premium`}
          >
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#071726] text-white">
                {step.icon}
              </span>
              <span className="font-mono text-4xl font-bold text-slate-100">{step.number}</span>
            </div>
            <h3 className="mt-6 text-xl font-semibold text-deep">{step.title}</h3>
            <p className="mt-3 leading-7 text-slate-500">{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="mx-auto mt-20 max-w-7xl">
      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-medical">Confianza paciente</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight text-deep sm:text-5xl">
            Acompañamiento privado desde la primera búsqueda.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-500">
            Cada cita en VITAEON está respaldada por verificación médica, agenda transparente y experiencia digital de alto nivel.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              quote: "La información del especialista y el ticket de cita hacen que el proceso se sienta claro y confiable.",
              author: "Paciente verificado",
              detail: "León, Gto."
            },
            {
              quote: "La agenda visible y la verificación médica ayudan a elegir con más seguridad.",
              author: "Paciente VITAEON",
              detail: "Beta privada"
            }
          ].map((t) => (
            <article key={t.author} className="rounded-[2rem] border border-silver/80 bg-white p-7 shadow-soft">
              <div className="mb-4 flex gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="text-base leading-8 text-slate-600">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-medical/10 text-medical">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-deep">{t.author}</p>
                  <p className="text-xs text-slate-400">{t.detail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "¿Los médicos están verificados?",
      a: "La búsqueda pública muestra solo médicos con estado verificado. Administración revisa cédula y documentos desde el panel interno."
    },
    {
      q: "¿Puedo pagar en efectivo?",
      a: "Sí. El sistema registra efectivo como pago pendiente para liquidarlo directamente en consulta."
    },
    {
      q: "¿VITAEON reemplaza una consulta médica?",
      a: "No. VITAEON facilita búsqueda, agenda y gestión digital; la valoración clínica corresponde al especialista."
    }
  ];

  return (
    <section className="mx-auto mt-20 max-w-7xl">
      <div className="rounded-[2.5rem] border border-silver/70 bg-white px-8 py-10 shadow-soft sm:px-12 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-medical">Preguntas frecuentes</p>
        <h2 className="mt-3 text-3xl font-semibold text-deep sm:text-4xl">Respuestas rápidas</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {items.map(({ q, a }) => (
            <article key={q} className="rounded-2xl border border-silver/60 bg-slate-50/60 p-5">
              <h3 className="font-semibold leading-6 text-deep">{q}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{a}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LegalLinks() {
  const links = [
    { href: "/aviso-de-privacidad", label: "Privacidad" },
    { href: "/terminos", label: "Términos" },
    { href: "/politica-cancelaciones", label: "Cancelaciones" },
    { href: "/politica-reembolsos", label: "Reembolsos" },
    { href: "/consentimiento-datos", label: "Consentimiento" },
    { href: "/urgencias", label: "Urgencias" },
    { href: "/soporte", label: "Soporte" }
  ];

  return (
    <footer className="mx-auto mb-8 mt-20 max-w-7xl">
      <div className="rounded-[2rem] border border-silver/70 bg-white px-6 py-8 shadow-soft sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#071726]">
                <HeartPulse className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold tracking-[0.42em] text-deep">VITAEON</p>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
              Medicina privada, tecnología clínica y experiencia premium para el paciente en León, Guanajuato.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Legal">
            {links.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-full border border-silver/60 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-silver hover:bg-white hover:text-deep hover:shadow-soft"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-silver/40 pt-6 text-center">
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} VITAEON · Red médica privada · León, Guanajuato · México</p>
        </div>
      </div>
    </footer>
  );
}
