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
  Menu,
  Microscope,
  Scissors,
  Search,
  Share2,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Stethoscope,
  Thermometer,
  Users,
  WalletCards,
  Wind,
  X,
  Zap
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { StripePaymentForm } from "@/components/platform/StripePaymentForm";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// Dashboard mockup — hero visual principal
const DashboardMockup = dynamic(
  () => import("@/components/platform/DashboardMockup"),
  { ssr: false, loading: () => null },
);
import { track } from "@vercel/analytics";
import { clientApi } from "@/services/client/api";
import type { CurrentUser, DoctorListItem } from "@/types/domain";

type Specialty = { id: string; name: string; description?: string | null; doctorsCount: number };
type HospitalItem = { id: string; name: string; city: string; address?: string | null; doctorsCount: number };
type PaymentMethod = "CASH" | "STRIPE";
type AuthAudience = "PATIENT" | "DOCTOR";
type MedicalRepresentative = {
  id?: string;
  lab: string;
  focus: string;
  representative: string;
  zone: string;
  phone: string;
  email: string;
  imageUrl?: string | null;
  priceRange?: string | null;
};
type CateringService = {
  id: string;
  name: string;
  description: string;
  cityOrZone: string;
  phone: string;
  email: string;
  imageUrl?: string | null;
  priceRange?: string | null;
  createdAt?: string;
  plan?: "obsidiana";
};
type CommercialDirectoryResponse = {
  representatives: MedicalRepresentative[];
  catering: CateringService[];
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
    medal: "obsidiana",
    title: "Obsidiana",
    price: "$499 MXN / mes",
    tone: "Directorio comercial",
    description: "Suscripción mensual para representantes médicos y servicios de catering que desean aparecer en el directorio comercial de VITAEON.",
    benefits: [
      "Perfil comercial independiente",
      "Aparición en Representantes Médicos / Catering",
      "Sin acceso al panel médico ni funciones clínicas",
      "Renovación mensual automática",
      "Pago procesado de forma segura con Stripe"
    ]
  },
  {
    medal: "diamante",
    title: "Diamante",
    price: "$499 MXN / mes",
    tone: "Plan profesional",
    description: "Presencia profesional con prioridad sobre perfiles Oro y renovación automática cada mes.",
    benefits: [
      "Todo lo del plan Oro",
      "Prioridad en resultados dentro de su especialidad",
      "Aparece por encima de médicos con plan Oro",
      "Mayor visibilidad en búsquedas",
      "Renovación mensual con Stripe"
    ]
  },
  {
    medal: "amatista",
    title: "Amatista",
    price: "$999 MXN / mes",
    tone: "Más exclusivo",
    recommended: true,
    description: "El plan premium con máxima presencia, agenda inteligente asistida por IA real y prioridad superior.",
    benefits: [
      "Todo lo del plan Diamante",
      "Prioridad máxima — aparece primero en su especialidad",
      "Agenda médica con asistente IA real (Claude)",
      "Secretaria virtual con resumen diario inteligente",
      "Búsqueda de medicamentos de referencia",
      "Chat cifrado para derivación de pacientes",
      "Renovación mensual con Stripe"
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
  PENDING: "Pendiente",
  PENDING_DOCTOR_ACCEPTANCE: "Esperando aceptación médica",
  ACCEPTED: "Cita aceptada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Cita completada",
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

function publicAppointmentStatus(value: string) {
  if (value === "PENDING") return "Esperando aceptación médica";
  if (value === "COMPLETED") return "Cita completada";
  if (value === "ACCEPTED") return "Cita aceptada";
  if (value === "CONFIRMED") return "Cita confirmada";
  if (value === "RESCHEDULED") return "Cita reagendada";
  return publicStatus(value);
}

function publicPaymentStatus(value: string, method: PaymentMethod) {
  if (value === "PAID") return method === "STRIPE" ? "Pago en línea confirmado" : "Pago confirmado";
  if (value === "FAILED") return "Pago fallido";
  if (value === "REFUNDED") return "Pago reembolsado";
  if (method === "CASH") return "Pago pendiente en efectivo";
  if (method === "STRIPE") return "Pago en línea pendiente";
  return publicStatus(value);
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

const SUGGESTION_ICONS: Record<string, ReactNode> = {
  "Dolor de rodilla": <Bone className="h-4 w-4" />,
  "Diabetes":         <Activity className="h-4 w-4" />,
  "Bajar de peso":    <Leaf className="h-4 w-4" />,
  "Presión alta":     <HeartPulse className="h-4 w-4" />,
  "Ansiedad":         <Brain className="h-4 w-4" />,
  "Hospital Ángeles": <Hospital className="h-4 w-4" />,
};

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
  const [cateringServices, setCateringServices] = useState<CateringService[]>([]);
  const [commercialDirectoryTab, setCommercialDirectoryTab] = useState<"representatives" | "catering">("representatives");
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
  const [mfaChallengeToken, setMfaChallengeToken] = useState("");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    mfaCode: "",
    role: "PATIENT",
    phone: "",
    medal: "oro" as DoctorListItem["medal"]
  });
  const doctorDetailRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // Parallax cursor del hero
  const heroMouseX = useMotionValue(0);
  const heroMouseY = useMotionValue(0);
  const heroSmoothX = useSpring(heroMouseX, { stiffness: 80, damping: 20 });
  const heroSmoothY = useSpring(heroMouseY, { stiffness: 80, damping: 20 });
  const heroTextX = useTransform(heroSmoothX, [-0.5, 0.5], [-4, 4]);
  const heroTextY = useTransform(heroSmoothY, [-0.5, 0.5], [-3, 3]);
  const heroImageX = useTransform(heroSmoothX, [-0.5, 0.5], [6, -6]);
  const heroImageY = useTransform(heroSmoothY, [-0.5, 0.5], [4, -4]);

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
    return [
      { label: "Dolor de rodilla", helper: "Trauma y ortopedia" },
      { label: "Diabetes", helper: "Endocrino o interna" },
      { label: "Bajar de peso", helper: "Nutrición y metabolismo" },
      { label: "Presión alta", helper: "Interna o cardiología" },
      { label: "Ansiedad", helper: "Salud mental" },
      { label: "Hospital Ángeles", helper: "Buscar por clínica" }
    ].slice(0, 6);
  }, [query, specialtyId, hospitalId]);
  const activeSpecialtyName = useMemo(
    () => specialties.find((specialty) => specialty.id === specialtyId)?.name ?? "",
    [specialties, specialtyId]
  );
  const activeHospitalName = useMemo(
    () => hospitals.find((hospital) => hospital.id === hospitalId)?.name ?? "",
    [hospitals, hospitalId]
  );
  const hasActiveSearch = Boolean(query.trim() || specialtyId || hospitalId);

  function clearSearchFilters() {
    setQuery("");
    setSpecialtyId("");
    setHospitalId("");
  }

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
    track("doctor_viewed", { specialty: doctor.specialty, medal: doctor.medal, hasSlots: doctor.availability.length > 0 });
    if (window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        doctorDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function handleHeroMouseMove(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    heroMouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    heroMouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleHeroMouseLeave() {
    heroMouseX.set(0);
    heroMouseY.set(0);
  }

  function handleSuggestionClick(label: string) {
    setQuery(label);
    track("suggestion_clicked", { label });
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && (query.trim() || specialtyId || hospitalId)) {
      track("search_executed", { query: query.trim(), hasSpecialty: Boolean(specialtyId), hasHospital: Boolean(hospitalId) });
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
    if (representatives.length > 0 || cateringServices.length > 0) return;
    setRepresentativesLoading(true);
    setRepresentativesError("");
    try {
      const data = await clientApi<CommercialDirectoryResponse | MedicalRepresentative[]>("/api/medical-representatives");
      if (Array.isArray(data)) {
        setRepresentatives(data);
        setCateringServices([]);
      } else {
        setRepresentatives(data.representatives);
        setCateringServices(data.catering);
      }
    } catch (caught) {
      setRepresentatives(defaultMedicalRepresentatives);
      setCateringServices([]);
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
    if (mfaChallengeToken) {
      if (!authForm.mfaCode.trim()) {
        setError("Ingresa el código de autenticación.");
        return;
      }
      try {
        const signedUser = await clientApi<CurrentUser>("/api/auth/mfa/verify", {
          method: "POST",
          body: JSON.stringify({ challengeToken: mfaChallengeToken, code: authForm.mfaCode })
        });
        setUser(signedUser);
        setMfaChallengeToken("");
        setAuthOpen(false);
        track("auth_completed", { role: signedUser.role, mode: "mfa" });
        window.setTimeout(() => {
          window.location.href = "/dashboard/admin";
        }, 120);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No fue posible verificar el código.");
      }
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
      const signedUser = await clientApi<CurrentUser | { message: string } | { requiresMfa: true; challengeToken: string }>(path, { method: "POST", body: JSON.stringify(body) });
      if ("requiresMfa" in signedUser) {
        setMfaChallengeToken(signedUser.challengeToken);
        setError("Ingresa el código de Google Authenticator para continuar.");
        return;
      }
      if (!("id" in signedUser)) {
        setError(signedUser.message);
        return;
      }
      setUser(signedUser);
      setAuthOpen(false);
      track("auth_completed", { role: signedUser.role, mode: authMode });
      if (signedUser.role === "DOCTOR") {
        window.setTimeout(() => {
          window.location.href = "/dashboard/doctor";
        }, 120);
      } else if (signedUser.role === "ASSISTANT") {
        window.setTimeout(() => {
          window.location.href = "/dashboard/assistant";
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
      track("payment_started");
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
    track("booking_started", { specialty: selectedDoctor.specialty, paymentMethod: selectedPaymentMethod });
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
      track("booking_completed", { specialty: selectedDoctor.specialty, amountCents: payment?.amountCents ?? selectedDoctor.priceCents, paymentMethod: selectedPaymentMethod });
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
    track("payment_confirmed", { status: result.appointment.paymentStatus });
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
      <ScrollOrbs />
      <Header user={user} onLogin={() => openAuth()} onLogout={logout} />

      <main className="px-4 pb-24 pt-28 sm:px-5 sm:pt-32">
        <section
          className="hero-grid pixieset-section mx-auto grid max-w-7xl gap-10 rounded-[2rem] px-5 py-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16 lg:rounded-[2.5rem] lg:px-12 lg:py-12"
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={handleHeroMouseLeave}
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            style={{ x: heroTextX, y: heroTextY }}
          >
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

            {/* H1 con stagger por segmento */}
            <h1 className="mt-2 text-4xl font-extrabold leading-[1.09] tracking-tight text-deep sm:text-5xl lg:text-6xl xl:text-7xl">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "inline-block" }}
              >
                Médicos privados{" "}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "inline-block" }}
                className="hero-gradient-text"
              >
                verificados
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.48, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "inline-block" }}
              >
                {" "}en León, Gto.
              </motion.span>
            </h1>

            {/* Subtítulo */}
            <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-500">
              Cédula verificada, agenda online y pago digital directo al médico. El directorio médico premium de León, Guanajuato.
            </p>

            {/* CTAs con bloom */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setBookingOpen(true)}
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-[#071726] px-8 py-4 font-semibold text-white shadow-glass transition-all duration-300 hover:-translate-y-1 hover:bg-[#0d2638] hover:shadow-[0_0_0_8px_rgba(7,23,38,0.10),0_16px_40px_rgba(7,23,38,0.30)] active:scale-[0.97]"
              >
                <Calendar className="h-4 w-4" />
                Agendar cita
              </button>
              <a
                href="#busqueda"
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-silver bg-white px-8 py-4 font-semibold text-deep shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-medical/30 hover:shadow-[0_0_0_6px_rgba(17,109,157,0.08),0_8px_32px_rgba(17,109,157,0.12)]"
              >
                <Search className="h-4 w-4" />
                Buscar especialista
              </a>
            </div>
            <HeroStats onRepresentativesClick={openRepresentatives} />
          </motion.div>
          <motion.div style={{ x: heroImageX, y: heroImageY }}>
            <div className="editorial-image relative">
              <div className="dna-halo-ring" aria-hidden="true" />
              <HeroMockup />
            </div>
          </motion.div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl">
          <IntelligentGuide specialties={specialties} onSpecialtySelect={(id) => chooseSpecialty(id, true)} user={user} onLogin={() => openAuth()} />
        </section>

        <section id="busqueda" className="specialty-filter-bar glass mx-auto mt-16 max-w-7xl scroll-mt-32 overflow-hidden rounded-[2rem] shadow-premium">

          {/* ── Header band ─────────────────────────────────────────── */}
          <div className="border-b border-silver/40 bg-gradient-to-br from-[#fafcff] to-[#eef5fb] px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-medical" />
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.36em] text-medical">Buscador asistido</p>
                </div>
                <h2 className="mt-2 text-xl font-bold text-deep sm:text-2xl">¿Qué síntoma o especialista buscas?</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  Escríbelo como lo dirías: &quot;me duele la rodilla&quot;, &quot;diabetes&quot;, &quot;Dr. González&quot;
                </p>
              </div>
              {hasActiveSearch && (
                <button
                  onClick={clearSearchFilters}
                  className="flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-silver/70 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-soft transition hover:-translate-y-0.5 hover:text-deep"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* ── Inputs ──────────────────────────────────────────────── */}
          <div className="p-5 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr]">
              <FieldIcon icon={<Search className="h-4 w-4" />}>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Ej. dolor de cadera, diabetes, Susana, nutrición"
                  className="w-full border-0 bg-transparent p-0 text-sm text-deep shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:shadow-none focus:ring-0"
                />
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

            {/* ── Filtros activos ──────────────────────────────────── */}
            {hasActiveSearch ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[1.4rem] border border-medical/20 bg-medical/5 p-3.5 text-xs">
                <span className="font-bold text-medical">Resultados para:</span>
                {query.trim() && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-medical/10 px-3 py-1 font-semibold text-medical">
                    <Search className="h-3 w-3" />
                    {query.trim()}
                  </span>
                )}
                {activeSpecialtyName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-700">
                    <Stethoscope className="h-3 w-3" />
                    {activeSpecialtyName}
                  </span>
                )}
                {activeHospitalName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                    <Hospital className="h-3 w-3" />
                    {activeHospitalName}
                  </span>
                )}
                <button
                  onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#071726] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#0d2638] active:scale-[0.97]"
                >
                  Ver médicos
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : searchSuggestions.length > 0 && (
              <div className="mt-5">
                <p className="mb-3 px-1 text-[0.63rem] font-bold uppercase tracking-[0.32em] text-slate-400">
                  Búsquedas frecuentes — toca para ir directo
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => handleSuggestionClick(suggestion.label)}
                      className="group flex items-center gap-3 rounded-2xl border border-silver/60 bg-white p-3.5 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-medical/30 hover:shadow-[0_8px_24px_rgba(17,109,157,0.09)]"
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-blue-100/70 text-medical shadow-sm ring-1 ring-medical/10 transition-transform duration-200 group-hover:scale-110">
                        {SUGGESTION_ICONS[suggestion.label] ?? <Search className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-bold text-deep">{suggestion.label}</span>
                        <span className="block truncate text-[0.63rem] text-slate-400">{suggestion.helper}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <SpecialtiesSection specialties={specialties} selectedId={specialtyId} onSelect={(id) => chooseSpecialty(id, true)} />
        {user?.role === "DOCTOR" && <SubscriptionShowcase />}

        <StateBlock loading={loading || doctorsLoading} error={error} empty={!doctorsLoading && doctors.length === 0} onJoinAsDoctor={() => openAuth("DOCTOR")} />

        <section ref={resultsRef as React.Ref<HTMLElement>} className="mx-auto mt-16 scroll-mt-28 grid max-w-7xl gap-6 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px]">
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

          <aside ref={doctorDetailRef} className="h-fit rounded-[2rem] border border-silver/70 bg-white shadow-soft lg:sticky lg:top-28">
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
          <section id="appointment-ticket" className={`mx-auto mt-12 max-w-7xl scroll-mt-32 rounded-[2rem] border bg-white p-5 shadow-premium sm:p-8 ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "border-amber-100" : "border-emerald-100"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-semibold uppercase tracking-[0.28em] ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "text-amber-700" : "text-emerald-700"}`}>Ticket VITAEON</p>
                <h2 className="mt-3 text-3xl font-semibold text-deep sm:text-4xl">
                  Tu ticket de consulta está listo.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Revisa con calma los detalles de tu consulta. Desde aquí puedes continuar al pago seguro y después consultar tu ticket en el panel del paciente.
                </p>
              </div>
              <CheckCircle2 className={`h-10 w-10 ${ticket.paymentMethod === "CASH" || ticket.paymentStatus !== "PAID" ? "text-amber-600" : "text-emerald-600"}`} />
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <Summary label="Médico" value={ticket.doctor} />
              <Summary label="Especialidad" value={ticket.specialty} />
              <Summary label="Hospital" value={ticket.hospital} />
              <Summary label="Paciente" value={ticket.patient} />
              <Summary label="Fecha y hora" value={dateTime(ticket.startsAt)} />
              <Summary label="Duración aproximada" value={`${Math.max(0, Math.round((new Date(ticket.endsAt).getTime() - new Date(ticket.startsAt).getTime()) / 60_000))} minutos`} />
              <Summary label="Pago" value={ticketPaymentLabel(ticket)} />
              <Summary label="Estado de cita" value={publicAppointmentStatus(ticket.appointmentStatus)} />
              <Summary label="Estado de pago" value={publicPaymentStatus(ticket.paymentStatus, ticket.paymentMethod)} />
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
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Agendé mi consulta con ${ticket.doctor} (${ticket.specialty}) el ${dateTime(ticket.startsAt)} a través de VITAEON.mx — El directorio médico premium de León, Gto. 🩺`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("share_whatsapp", { specialty: ticket.specialty })}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-6 py-3 font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100"
              >
                <Share2 className="h-4 w-4" />
                Compartir
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
        <ForDoctors onRegister={() => { setAuthAudience("DOCTOR"); setAuthOpen(true); }} />
        <FAQ />
        <LegalLinks />
      </main>

      {/* ── Botón flotante WhatsApp soporte ── */}
      <a
        href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "5214771234567"}?text=${encodeURIComponent("Hola, tengo una pregunta sobre VITAEON.")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom)+3.5rem+0.75rem)] right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] shadow-[0_6px_24px_rgba(37,211,102,0.40)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(37,211,102,0.55)] active:scale-[0.97]"
        aria-label="Soporte por WhatsApp"
      >
        {/* WhatsApp icon inline SVG */}
        <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      <button
        onClick={() => setUrgentOpen(true)}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 inline-flex items-center gap-2.5 rounded-full bg-[#071726] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(7,23,38,0.35)] transition hover:-translate-y-0.5 hover:bg-[#0d2638] hover:shadow-[0_12px_40px_rgba(7,23,38,0.42)] active:scale-[0.97]"
        aria-label="Buscar cita pronta"
      >
        <Siren className="h-4 w-4" />
        <span className="hidden sm:inline">Cita pronta</span>
        <span className="sm:hidden">Cita</span>
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
                <input value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} placeholder="Nombre completo" autoComplete="name" className="w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
                <select value={authForm.role} onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })} className="w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" disabled={Boolean(authAudience)}>
                  <option value="PATIENT">Paciente</option>
                  <option value="DOCTOR">Médico</option>
                </select>
                {authForm.role === "PATIENT" && (
                  <div>
                    <input
                      value={authForm.phone}
                      onChange={(event) => setAuthForm({ ...authForm, phone: event.target.value })}
                      placeholder="WhatsApp (ej. +52 477 000 0000)"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10"
                    />
                    <p className="mt-1.5 px-1 text-xs text-slate-400">
                      Opcional · Tu recepcionista podrá contactarte por WhatsApp para confirmar citas.
                    </p>
                  </div>
                )}
              </>
            )}
            <input value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="Correo electrónico" type="email" inputMode="email" autoComplete="email" className="w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
            <input type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="Contraseña" autoComplete={authMode === "login" ? "current-password" : "new-password"} className="w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
            {mfaChallengeToken && (
              <input value={authForm.mfaCode} onChange={(event) => setAuthForm({ ...authForm, mfaCode: event.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="Código MFA" inputMode="numeric" autoComplete="one-time-code" className="w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10" />
            )}
            {error && <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</p>}
            <button type="button" onClick={submitAuth} className="w-full rounded-full bg-[#071726] px-6 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] active:scale-[0.98]">{mfaChallengeToken ? "Verificar código" : authMode === "login" ? "Entrar" : "Registrarme"}</button>
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
        <Modal title="Representantes Médicos / Catering" onClose={() => setRepresentativesOpen(false)} size="wide">
          <div className="grid gap-5">
            <p className="leading-7 text-slate-600">
              Directorio profesional para conectar médicos con representantes y servicios de catering activos dentro de VITAEON.
            </p>
            <div className="flex rounded-full border border-silver bg-slate-50 p-1 shadow-sm">
              {[
                { id: "representatives", label: "Representantes Médicos" },
                { id: "catering", label: "Catering" }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCommercialDirectoryTab(item.id as "representatives" | "catering")}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition sm:flex-none sm:px-4 ${
                    commercialDirectoryTab === item.id
                      ? "bg-white text-deep shadow-sm"
                      : "text-slate-500 hover:text-deep"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {representativesLoading && <p className="rounded-3xl bg-slate-50 p-5 text-slate-600">Cargando laboratorios...</p>}
            {representativesError && <p className="rounded-3xl bg-red-50 p-5 text-red-700">{representativesError}</p>}
            {commercialDirectoryTab === "representatives" && (
              <div className="grid gap-4">
                {(representativesError ? defaultMedicalRepresentatives : representatives).map((item) => (
                  <article key={`${item.lab}-${item.email}`} className="representative-option rounded-[1.5rem] border border-silver bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-premium">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Farmacéutica</p>
                        <h3 className="mt-2 text-2xl font-semibold text-deep">{item.lab}</h3>
                      </div>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">Obsidiana activa</span>
                    </div>
                    <p className="mt-2 leading-6 text-slate-600">{item.focus}</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600">
                      <Line icon={<BadgeCheck className="h-5 w-5" />} text={item.representative} />
                      <Line icon={<MapPin className="h-5 w-5" />} text={item.zone} />
                      <Line icon={<LogIn className="h-5 w-5" />} text={item.phone} />
                      <Line icon={<FileCheck2 className="h-5 w-5" />} text={item.email} />
                      {item.priceRange && <Line icon={<CreditCard className="h-5 w-5" />} text={item.priceRange} />}
                    </div>
                  </article>
                ))}
                {!representativesLoading && !representativesError && representatives.length === 0 && (
                  <p className="rounded-[1.5rem] border border-dashed border-silver bg-slate-50 p-6 text-slate-600">
                    Aún no hay representantes médicos activos.
                  </p>
                )}
              </div>
            )}
            {commercialDirectoryTab === "catering" && (
              <div className="grid gap-4">
                {cateringServices.map((item) => (
                  <article key={item.id} className="rounded-[1.5rem] border border-silver bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-premium">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Catering médico</p>
                        <h3 className="mt-2 text-2xl font-semibold text-deep">{item.name}</h3>
                      </div>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">Obsidiana activa</span>
                    </div>
                    <p className="mt-2 leading-6 text-slate-600">{item.description}</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600">
                      <Line icon={<Leaf className="h-5 w-5" />} text={item.cityOrZone} />
                      <Line icon={<LogIn className="h-5 w-5" />} text={item.phone} />
                      <Line icon={<FileCheck2 className="h-5 w-5" />} text={item.email} />
                      {item.priceRange && <Line icon={<CreditCard className="h-5 w-5" />} text={item.priceRange} />}
                    </div>
                  </article>
                ))}
                {!representativesLoading && cateringServices.length === 0 && (
                  <p className="rounded-[1.5rem] border border-dashed border-silver bg-slate-50 p-6 text-slate-600">
                    Próximamente habrá servicios de catering disponibles.
                  </p>
                )}
              </div>
            )}
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
    ? `/dashboard/${user.role === "DOCTOR" ? "doctor" : user.role === "ADMIN" || user.role === "STAFF" ? "admin" : user.role === "ASSISTANT" ? "assistant" : "patient"}`
    : null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-silver bg-white shadow-soft transition hover:bg-slate-50 md:hidden"
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X className="h-4 w-4 text-deep" /> : <Menu className="h-4 w-4 text-deep" />}
          </button>
          {user ? (
            <>
              {dashboardPath && (
                <a href={dashboardPath} className="hidden rounded-full border border-silver bg-white px-4 py-2.5 text-sm font-semibold text-deep shadow-soft transition hover:-translate-y-0.5 hover:shadow-premium sm:inline-flex">
                  {user.name.split(" ")[0]}
                </a>
              )}
              <button onClick={onLogout} className="rounded-full border border-silver bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-soft transition hover:-translate-y-0.5 hover:text-deep">
                Salir
              </button>
            </>
          ) : (
            <button onClick={onLogin} className="inline-flex items-center gap-2 rounded-full bg-[#071726] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0d2638]">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Iniciar sesión</span>
              <span className="sm:hidden">Entrar</span>
            </button>
          )}
        </div>
      </nav>
      {mobileMenuOpen && (
        <div className="mx-auto mt-2 max-w-7xl rounded-[1.5rem] border border-silver/70 bg-white/95 px-2 py-2 shadow-premium backdrop-blur-md md:hidden">
          <a
            href="#busqueda"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-deep"
          >
            <Search className="h-4 w-4 text-medical" />
            Especialistas
          </a>
          <a
            href="#especialidades"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-deep"
          >
            <Stethoscope className="h-4 w-4 text-medical" />
            Áreas médicas
          </a>
          {dashboardPath && (
            <a
              href={dashboardPath}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-deep transition hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4 text-medical" />
              Mi panel
            </a>
          )}
        </div>
      )}
    </header>
  );
}

function HeroStats({ onRepresentativesClick }: { onRepresentativesClick: () => void }) {
  return (
    <div className="mt-10">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Médicos en hospitales de León</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {["Hospital Ángeles", "Aranda de la Parra", "Médica Campestre", "Christus Muguerza"].map((name) => (
          <span key={name} className="text-sm font-semibold text-slate-400 transition-colors hover:text-slate-600">{name}</span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-silver/60 pt-4">
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <BadgeCheck className="h-3.5 w-3.5 text-medical" />
          Cédula verificada
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <CreditCard className="h-3.5 w-3.5 text-medical" />
          Pago digital al médico
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          Agenda online
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
          Representantes / Catering
        </button>
      </div>
    </div>
  );
}

function ScrollOrbs() {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className={`absolute left-[-6%] top-[22%] h-[420px] w-[420px] rounded-full bg-medical blur-[90px] transition-all duration-[1800ms] ease-out ${
          past ? "opacity-[0.10] translate-x-0" : "opacity-0 translate-x-[180px]"
        }`}
      />
      <div
        className={`absolute right-[-6%] top-[32%] h-[360px] w-[360px] rounded-full bg-[#0e5580] blur-[90px] transition-all duration-[1800ms] ease-out ${
          past ? "opacity-[0.10] translate-x-0" : "opacity-0 -translate-x-[180px]"
        }`}
      />
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative flex h-[400px] items-center justify-center sm:h-[480px] lg:h-[540px]">

      {/* ── Morphing blob — SIN CAMBIOS ── */}
      <div
        className="absolute inset-[4%] overflow-hidden shadow-[0_28px_90px_rgba(7,23,38,0.5)] [animation:blobMorph_9s_ease-in-out_infinite]"
        style={{ backgroundColor: "#071e30" }}
      >
        <div className="absolute left-[-10%] top-[-15%] h-72 w-72 rounded-full bg-medical/40 blur-[64px] [animation:orbA_9s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-5%] right-[-10%] h-64 w-64 rounded-full bg-[#0e5580]/50 blur-[72px] [animation:orbB_11s_ease-in-out_infinite]" />
        <div className="absolute left-[25%] top-[20%] h-52 w-52 rounded-full bg-[#1a80b8]/22 blur-[48px] [animation:orbC_7s_ease-in-out_infinite]" />
      </div>

      {/* ── Dashboard mockup ── */}
      <div className="relative z-10" style={{ height: "92%", aspectRatio: "2 / 3" }}>
        <DashboardMockup />
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

type GuideResult = {
  specialty: string;
  reason: string;
  alternatives: string[];
  redFlag: string | null;
  aiGenerated: boolean;
};

function IntelligentGuide({
  specialties,
  onSpecialtySelect,
  user,
  onLogin
}: {
  specialties: Specialty[];
  onSpecialtySelect: (id: string) => void;
  user: CurrentUser | null;
  onLogin: () => void;
}) {
  const [symptom, setSymptom] = useState("");
  const [aiResult, setAiResult] = useState<GuideResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* Resultado de keywords (instantáneo mientras escribe) */
  const keywords = suggestSpecialty(symptom);
  const keywordResult: GuideResult = {
    specialty: keywords.primary.specialty,
    reason: keywords.primary.reason,
    alternatives: keywords.alternatives.map((a) => a.specialty),
    redFlag: keywords.redFlag ?? null,
    aiGenerated: false
  };

  /* Usar resultado IA si existe, si no el de keywords */
  const result = aiResult ?? keywordResult;
  const matchedSpecialty = specialties.find((s) => s.name === result.specialty);
  const alternativeSpecialties = result.alternatives
    .map((name) => ({ name, specialty: specialties.find((s) => s.name === name) }))
    .filter((a) => a.specialty);

  async function askAI() {
    if (!symptom.trim() || symptom.length < 3) return;
    setLoading(true);
    setError("");
    setAiResult(null);
    try {
      const res = await fetch("/api/patient-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptom })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Error al consultar la IA");
      setAiResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible consultar la IA. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  /* Limpiar resultado IA si cambia el síntoma */
  function handleSymptomChange(value: string) {
    setSymptom(value);
    setAiResult(null);
    setError("");
  }

  return (
    <div className="ai-orientation-card premium-card grid gap-8 rounded-[2rem] p-7 lg:grid-cols-[0.72fr_1fr] lg:items-center">
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-medical">
          <Brain className="h-5 w-5" /> Orientador inteligente
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-deep">Dinos qué te duele</h2>
        <p className="mt-3 leading-7 text-slate-600">
          Esta orientación no sustituye una valoración médica. Te ayudamos a encontrar el especialista más adecuado según tus síntomas.
        </p>
        {/* Badge IA */}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-xs font-semibold text-violet-700">Potenciado por Claude IA · Anthropic</span>
        </div>
      </div>

      <div className="rounded-[1.6rem] bg-slate-50 p-4">
        {/* Input */}
        <label className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm">
          <Search className="h-5 w-5 text-deep" />
          <input
            value={symptom}
            onChange={(e) => handleSymptomChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && user && askAI()}
            placeholder="Ej. dolor de pecho, migraña, piel, ansiedad"
            className="w-full bg-transparent outline-none"
          />
        </label>

        {/* Botón IA o CTA login */}
        <div className="mt-3">
          {user ? (
            <button
              onClick={askAI}
              disabled={loading || symptom.length < 3}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Consultando con IA…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Consultar con IA</>
              )}
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              <LogIn className="h-4 w-4" />
              Inicia sesión para consultar con IA
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{error}</p>
        )}

        {/* Resultado */}
        <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
          {/* Badge de fuente */}
          <div className="mb-3 flex items-center gap-2">
            {result.aiGenerated ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[0.68rem] font-semibold text-violet-700">
                <Sparkles className="h-3 w-3" /> Generado por IA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[0.68rem] font-semibold text-slate-500">
                <Zap className="h-3 w-3" /> Orientación rápida
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-deep">Especialidad sugerida: {result.specialty}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{result.reason}</p>

          {result.redFlag && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
              <p className="text-sm font-bold text-red-700">⚠️ Posible emergencia médica</p>
              <p className="mt-1 text-sm leading-5 text-red-600">{result.redFlag}</p>
              <a
                href="/urgencias"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
              >
                Ver guía de urgencias →
              </a>
            </div>
          )}

          {alternativeSpecialties.length > 0 && (
            <div className="mt-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">También podrías considerar</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {alternativeSpecialties.map(({ name, specialty }) =>
                  specialty ? (
                    <button
                      key={name}
                      onClick={() => onSpecialtySelect(specialty.id)}
                      className="rounded-full border border-silver bg-slate-50 px-4 py-2 text-xs font-semibold text-deep transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      {name}
                    </button>
                  ) : (
                    <span key={name} className="rounded-full border border-silver bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                      {name}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {matchedSpecialty && (
            <button
              onClick={() => onSpecialtySelect(matchedSpecialty.id)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white sm:inline-flex sm:w-auto sm:justify-start"
            >
              Ver especialistas recomendados <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {/* Disclaimer */}
          <p className="mt-4 text-[0.68rem] leading-5 text-slate-400">
            Esta orientación {result.aiGenerated ? "generada por IA " : ""}no constituye un diagnóstico médico. Consulta siempre con un profesional de la salud.
          </p>
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
          <h2 className="mt-3 text-3xl font-bold leading-tight text-deep sm:text-4xl">
            Encuentra tu especialista
          </h2>
          <p className="mt-3 max-w-xl text-lg text-slate-500">
            Médicos verificados en León, organizados por área clínica.
          </p>
        </div>
      </div>

      {/* Category tabs — horizontal scroll */}
      <div className="scroll-fade-x no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
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
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
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

function StateBlock({ loading, error, empty, onJoinAsDoctor }: { loading: boolean; error: string; empty: boolean; onJoinAsDoctor?: () => void }) {
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
        <h3 className="text-lg font-semibold text-deep">Incorporando especialistas a la beta privada</h3>
        <p className="mt-2 max-w-md mx-auto text-slate-500">
          Estamos sumando médicos verificados en León, Gto. en tiempo real. Si eres especialista y quieres estar entre los primeros, únete ahora.
        </p>
        {onJoinAsDoctor && (
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={onJoinAsDoctor}
              className="inline-flex items-center gap-2 rounded-full bg-[#071726] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638]"
            >
              <Stethoscope className="h-4 w-4" />
              Soy médico en León — Unirme
            </button>
            <a href="#busqueda" className="text-sm font-semibold text-medical hover:underline underline-offset-2">
              Ver especialidades disponibles
            </a>
          </div>
        )}
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
              {doctor.medal === "amatista" ? "Destacado" : doctor.medal === "obsidiana" ? "Obsidiana" : "Premium"}
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
              {doctor.rating != null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                  <Star className="h-3 w-3 fill-current" /> {doctor.rating.toFixed(1)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs text-white/70 backdrop-blur-sm">
                  Sin reseñas
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

        {/* Precio de consulta */}
        {doctor.priceCents > 0 && (
          <div className="mt-3.5 inline-flex items-center gap-2 rounded-2xl bg-slate-50/80 px-3.5 py-2 text-sm font-semibold text-deep ring-1 ring-silver/60">
            <CreditCard className="h-3.5 w-3.5 text-medical" />
            {money(doctor.priceCents)}
            <span className="font-normal text-slate-400 text-xs">/ consulta</span>
          </div>
        )}

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
            {doctor.availability.length > 0
              ? `Próximo: ${dateTime(doctor.availability[0].startsAt)}`
              : "Sin horarios visibles"}
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
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-[#071726] p-3 text-center text-white sm:p-4">
          <p className="break-all text-base font-bold leading-tight sm:text-lg">{money(doctor.priceCents)}</p>
          <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-white/55">por consulta</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-center sm:p-4">
          <p className="text-base font-bold leading-tight text-deep sm:text-lg">{doctor.consultationDurationMinutes}<span className="text-sm font-normal text-slate-400"> min</span></p>
          <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-slate-400">duración</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-center sm:p-4">
          <p className="text-base font-bold leading-tight text-deep sm:text-lg">{doctor.yearsExperience}<span className="text-sm font-normal text-slate-400"> años</span></p>
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
        <h2 className="mt-3 text-3xl font-semibold leading-tight text-deep sm:text-4xl">
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
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-deep sm:text-4xl">
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
      <div className="rounded-[2.5rem] border border-silver/70 bg-white px-5 py-8 shadow-soft sm:px-8 sm:py-10 lg:px-12 lg:py-14">
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

/* ── Sección "Para médicos" ─────────────────────────────────── */
function ForDoctors({ onRegister }: { onRegister: () => void }) {
  const benefits = [
    {
      icon: <Users className="h-6 w-6" />,
      title: "Más pacientes nuevos",
      desc: "Tu perfil verificado aparece en búsquedas de especialidad dentro de León. Pacientes reales encuentran tu disponibilidad y agendan directamente."
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Agenda organizada",
      desc: "Publica horarios, acepta citas, bloquea días y ve el historial de cada paciente desde un solo panel diseñado para médicos privados."
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: "Asistente IA real",
      desc: "Plan Amatista incluye un asistente impulsado por Claude que analiza tu agenda, prioriza tu día y prepara tu siguiente consulta."
    }
  ];

  const plans = [
    {
      name: "Oro",
      price: "Gratis",
      sub: "Para siempre",
      color: "border-amber-200/70 bg-amber-50/40",
      badge: "bg-amber-100 text-amber-700",
      items: ["Perfil médico público", "Una especialidad", "Un hospital", "Fotografía profesional", "Visibilidad normal"]
    },
    {
      name: "Diamante",
      price: "$499",
      sub: "MXN / mes",
      color: "border-sky-200/70 bg-sky-50/40",
      badge: "bg-sky-100 text-sky-700",
      items: ["Todo lo del plan Oro", "Prioridad en resultados", "Aparece sobre médicos Oro", "Mayor visibilidad en búsquedas"]
    },
    {
      name: "Amatista",
      price: "$999",
      sub: "MXN / mes",
      color: "border-violet-200/70 bg-violet-50/40 ring-2 ring-violet-200",
      badge: "bg-violet-100 text-violet-700",
      recommended: true,
      items: [
        "Todo lo del plan Diamante",
        "Prioridad máxima en su especialidad",
        "Asistente IA real (Claude)",
        "Secretaria virtual con resumen diario",
        "Chat cifrado para derivaciones"
      ]
    }
  ];

  return (
    <section className="mx-auto mt-24 max-w-7xl">
      {/* Header */}
      <div className="rounded-[2.5rem] bg-[#071726] px-7 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7dd3fc]">Para médicos en León</p>
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
          Tu consulta merece una presencia digital de primer nivel.
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/60">
          Perfil verificado, agenda en línea y un asistente con IA real que organiza tu día. Todo en una plataforma construida exclusivamente para médicos privados en León.
        </p>

        {/* Beneficios */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e9bd4]/20 text-[#7dd3fc]">
                {b.icon}
              </div>
              <h3 className="mt-4 font-semibold text-white">{b.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Planes */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-2xl border bg-white p-5 ${p.color}`}>
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.badge}`}>{p.name}</span>
                {p.recommended && (
                  <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">Recomendado</span>
                )}
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-deep">{p.price}</span>
                <span className="ml-1 text-sm text-slate-500">{p.sub}</span>
              </div>
              <ul className="mt-4 space-y-2">
                {p.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-medical" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onRegister}
            className="inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-8 py-4 font-semibold text-deep shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-50 active:scale-[0.98]"
          >
            <Stethoscope className="h-4 w-4" />
            Crear perfil gratuito
          </button>
          <a
            href="/precios"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-4 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Ver todos los planes
            <ChevronRight className="h-4 w-4" />
          </a>
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
