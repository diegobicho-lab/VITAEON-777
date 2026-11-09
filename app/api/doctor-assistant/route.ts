import Anthropic from "@anthropic-ai/sdk";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { CLINIC_TIME_ZONE } from "@/lib/clinic-time";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { doctorAssistantSchema } from "@/lib/validation/schemas";

/* ── Anthropic client (lazy — sólo se usa en plan Amatista) ─── */
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurado.");
  return new Anthropic({ apiKey });
}

/**
 * Modelos en orden de preferencia.
 *
 * El primero es el de mayor capacidad (plan Amatista). Si la cuenta no tiene
 * acceso a él o la API rechaza algún parámetro, se reintenta con el segundo
 * antes de recurrir a la respuesta de emergencia: una degradación de calidad
 * es aceptable, perder el asistente por completo no.
 */
const ASSISTANT_MODELS = [
  { model: "claude-opus-4-8", effort: "medium" as const },
  { model: "claude-haiku-4-5", effort: undefined }
];

/* ── Respuesta de emergencia si no hay API key ──────────────── */
function fallbackResponse(prompt: string, context?: string) {
  const text = `${prompt} ${context ?? ""}`.toLowerCase();
  const wantsOpenings = ["hueco", "libre", "disponible", "agenda", "organizar"].some((w) => text.includes(w));
  return {
    title: "Secretaria médica",
    specialty: "Agenda",
    priority: wantsOpenings
      ? "Revisar huecos disponibles y confirmar pacientes pendientes antes de abrir nuevos horarios."
      : "Priorizar la próxima cita, pendientes de confirmación y recordatorios del día.",
    checklist: [
      "Revisar la cita más próxima y preparar expediente.",
      "Identificar pacientes que requieren confirmación.",
      "Ordenar horarios libres por cercanía.",
      "Registrar cambios de agenda antes de notificar al paciente.",
    ],
    note: "El asistente con IA no está disponible en este momento; esta es una guía general."
  };
}

/* ── GET — resumen del día ──────────────────────────────────── */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR")
    return fail("FORBIDDEN", "Solo médicos pueden ver su asistente de agenda.", 403);

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, medal: true, subscriptionStatus: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal !== "amatista" || doctor.subscriptionStatus !== "ACTIVE")
    return fail("PLAN_UPGRADE_REQUIRED", "La secretaria médica virtual está disponible en el plan Amatista activo.", 402);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const week = new Date(now.getTime() + 7 * 86_400_000);

  const [nextAppointment, todaySlots, upcomingSlots, notifications] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        availabilitySlot: { startsAt: { gte: now } },
        status: { in: ["PENDING", "PENDING_DOCTOR_ACCEPTANCE", "ACCEPTED", "CONFIRMED"] }
      },
      include: {
        patient: { include: { user: { select: { name: true, email: true } } } },
        availabilitySlot: true,
        payments: true
      },
      orderBy: { availabilitySlot: { startsAt: "asc" } }
    }),
    prisma.availabilitySlot.findMany({
      where: { doctorId: doctor.id, startsAt: { gte: now, lte: tomorrow } },
      include: { appointment: { include: { patient: { include: { user: { select: { name: true } } } } } } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.availabilitySlot.findMany({
      where: { doctorId: doctor.id, startsAt: { gte: now, lte: week } },
      include: { appointment: true },
      orderBy: { startsAt: "asc" }
    }),
    prisma.notification.findMany({
      where: { userId: user.id, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);

  const pendingConfirmations = upcomingSlots.filter(
    (s) => s.appointment?.status === "PENDING_DOCTOR_ACCEPTANCE" || s.appointment?.status === "PENDING"
  ).length;
  const freeSlots = upcomingSlots.filter((s) => s.isActive && !s.appointment).slice(0, 5);

  return ok({
    nextAppointment: nextAppointment
      ? {
          patientName: nextAppointment.patient.user.name,
          startsAt: nextAppointment.availabilitySlot.startsAt,
          status: nextAppointment.status,
          paymentStatus: nextAppointment.payments[0]?.status ?? "PENDING"
        }
      : null,
    todaySummary: {
      total: todaySlots.length,
      booked: todaySlots.filter((s) => s.appointment).length,
      available: todaySlots.filter((s) => s.isActive && !s.appointment).length
    },
    pendingConfirmations,
    remindersToPrepare: upcomingSlots.filter((s) => s.appointment && s.startsAt > now).slice(0, 5).length,
    suggestedFreeSlots: freeSlots.map((s) => ({ id: s.id, startsAt: s.startsAt, endsAt: s.endsAt })),
    notifications,
    deliveryChannels: ["internal"],
    externalDeliveryPending: ["email", "whatsapp", "sms", "push"]
  });
}

/* ── POST — pregunta al asistente ──────────────────────────── */
export async function POST(request: Request) {
  const limit = await rateLimitByIp("doctor-assistant", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed)
    return fail("RATE_LIMITED", "Demasiadas consultas al asistente. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || (user.role !== "DOCTOR" && user.role !== "ADMIN" && user.role !== "STAFF"))
    return fail("FORBIDDEN", "No tienes acceso al asistente médico.", 403);

  if (user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { medal: true, subscriptionStatus: true }
    });
    if (!doctor || doctor.medal !== "amatista" || doctor.subscriptionStatus !== "ACTIVE")
      return fail("PLAN_UPGRADE_REQUIRED", "El asistente con IA está disponible para médicos con plan Amatista activo.", 402);
  }

  const body = await request.json().catch(() => null);
  const parsed = doctorAssistantSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Solicitud inválida.", 422, parsed.error.flatten());

  const { prompt, context } = parsed.data;

  /* ── Contexto real de agenda ─── */
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86_400_000);
  const doctor = await prisma.doctor.findFirst({
    where: { userId: user.id },
    include: {
      specialty: { select: { name: true } },
      appointments: {
        where: {
          availabilitySlot: { startsAt: { gte: now, lte: week } },
          status: { notIn: ["CANCELLED", "AUTO_CANCELLED", "REFUNDED", "COMPLETED"] }
        },
        include: {
          availabilitySlot: true,
          patient: { include: { user: { select: { name: true } } } },
          payments: { select: { status: true, provider: true } }
        },
        orderBy: { availabilitySlot: { startsAt: "asc" } },
        take: 12
      },
      availabilitySlots: {
        where: { startsAt: { gte: now, lte: week }, isActive: true, appointment: { is: null } },
        orderBy: { startsAt: "asc" },
        take: 8
      }
    }
  });

  /**
   * Contexto de agenda para el asistente.
   *
   * Antes se formateaban las fechas sin `timeZone`, así que el modelo recibía
   * horas en UTC del servidor: una consulta de las 16:00 en México llegaba
   * como "22:00" y el asistente razonaba sobre un horario inexistente.
   *
   * Se incluye además el momento actual del consultorio y el detalle real de
   * cada cita (paciente, estado en español, pago), porque sin eso el modelo
   * solo puede devolver recomendaciones genéricas.
   */
  const fechaHora = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: CLINIC_TIME_ZONE
    }).format(d);

  const estadoEsLegible: Record<string, string> = {
    PENDING: "pendiente",
    PENDING_DOCTOR_ACCEPTANCE: "pendiente de que la aceptes",
    ACCEPTED: "aceptada",
    CONFIRMED: "confirmada",
    RESCHEDULED: "reagendada",
    RESCHEDULE_REQUESTED: "el paciente pidió reagendar",
    CANCELLATION_REQUESTED: "el paciente pidió cancelar",
    REFUND_PENDING: "devolución pendiente",
    NO_SHOW: "el paciente no asistió"
  };

  const pagoLegible: Record<string, string> = {
    PAID: "pagada",
    PENDING: "pago pendiente",
    FAILED: "pago fallido",
    REFUNDED: "devuelta"
  };

  const agendaContext = doctor
    ? [
        `Momento actual en el consultorio: ${fechaHora(now)} (zona ${CLINIC_TIME_ZONE}).`,
        `Médico: ${doctor.fullName}. Especialidad: ${doctor.specialty?.name ?? "Especialista"}.`,
        "",
        doctor.appointments.length === 0
          ? "No tiene ninguna cita agendada en los próximos 7 días."
          : [
              `Citas en los próximos 7 días (${doctor.appointments.length}):`,
              ...doctor.appointments.map((a) => {
                const paciente = a.patient?.user?.name ?? a.guestPatientName ?? "Paciente sin nombre";
                const estado = estadoEsLegible[a.status] ?? a.status.toLowerCase();
                const pago = a.payments[0] ? pagoLegible[a.payments[0].status] ?? "" : "sin pago registrado";
                return `- ${fechaHora(a.availabilitySlot.startsAt)} · ${paciente} · ${estado} · ${pago}`;
              })
            ].join("\n"),
        "",
        doctor.availabilitySlots.length === 0
          ? "No tiene horarios libres publicados esta semana."
          : `Horarios libres esta semana (${doctor.availabilitySlots.length}): ${doctor.availabilitySlots
              .slice(0, 5)
              .map((slot) => fechaHora(slot.startsAt))
              .join(" · ")}`
      ].join("\n")
    : "";

  /* ── Llamada real a Claude ─── */
  let aiResponse: { title: string; specialty: string; priority: string; checklist: string[]; note: string };
  /** Modelo que realmente respondió, o "fallback" si ninguno lo hizo. */
  let usedModel = "fallback";

  try {
    const anthropic = getAnthropic();
    const systemPrompt = `Eres la secretaria médica virtual de VITAEON, plataforma médica privada en León, Guanajuato.
Trabajas para un médico especialista del plan Amatista: espera el criterio de una secretaria con años de experiencia, no respuestas genéricas.

CÓMO TRABAJAS
- Razona SOBRE LOS DATOS del contexto de agenda. Cita nombres de pacientes, días y horas concretas que aparezcan ahí.
- Usa siempre la hora del consultorio que te doy en el contexto. Nunca la recalcules ni la conviertas.
- Prioriza por riesgo operativo en este orden: (1) citas pendientes de que el médico las acepte, porque el paciente está esperando; (2) solicitudes de cancelar o reagendar, que tienen plazo; (3) pagos pendientes o fallidos; (4) huecos libres que se pueden llenar; (5) el resto.
- Si el médico pregunta algo que los datos no responden, dilo con claridad y propón cómo averiguarlo. Es mejor que inventarlo.
- Cada acción del checklist debe ser ejecutable hoy y referirse a algo real: "Acepta la cita de Laura Méndez del jueves 14:00" sirve; "Revisa tu agenda" no sirve.
- Si la agenda está vacía, no finjas trabajo: enfoca el checklist en publicar horarios, completar el perfil y captar pacientes.

LÍMITES
- No das diagnósticos, tratamientos ni dosis. Si te lo piden, redirige al criterio clínico del médico.
- No prometes acciones que tú no puedes ejecutar: tú sugieres, el médico confirma en la plataforma.
- No menciones datos de un paciente al hablar de otro.

FORMATO
Responde SOLO con un JSON válido, sin markdown ni texto alrededor:
{
  "title": "Título corto (máx 6 palabras)",
  "specialty": "Área de la agenda que atiendes",
  "priority": "La prioridad más urgente, con el dato concreto que la justifica (1-2 oraciones)",
  "checklist": ["Acción concreta 1", "Acción concreta 2", "Acción concreta 3", "Acción concreta 4"],
  "note": "Advertencia, límite o dato que el médico debe saber. Cadena vacía si no hay nada que añadir."
}`;

    const userMessage = `${agendaContext ? `Contexto de agenda:\n${agendaContext}\n\n` : ""}${context ? `Contexto adicional: ${context}\n\n` : ""}Pregunta del médico: ${prompt}`;

    let lastError: unknown = null;
    let parsed: typeof aiResponse | null = null;

    for (const candidate of ASSISTANT_MODELS) {
      try {
        const message = await anthropic.messages.create({
          model: candidate.model,
          max_tokens: 1024,
          ...(candidate.effort ? { output_config: { effort: candidate.effort } } : {}),
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }]
        });

        const rawText = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
        const jsonStart = rawText.indexOf("{");
        const jsonEnd = rawText.lastIndexOf("}");
        const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? rawText.slice(jsonStart, jsonEnd + 1) : rawText;
        const result = JSON.parse(jsonText);

        /* Asegurar estructura mínima antes de aceptar la respuesta. */
        if (!result.title || !Array.isArray(result.checklist) || result.checklist.length === 0) {
          throw new Error("Respuesta de IA con estructura incompleta");
        }

        parsed = result;
        usedModel = candidate.model;
        break;
      } catch (error) {
        lastError = error;
        // Se registra el modelo y el tipo de fallo, nunca la llave ni el
        // contenido clínico del contexto.
        console.error(`[Doctor assistant] fallo con ${candidate.model}`, error);
      }
    }

    if (!parsed) throw lastError ?? new Error("Sin respuesta de IA");
    aiResponse = parsed;
  } catch (error) {
    console.error("[Doctor assistant AI error]", error);
    aiResponse = fallbackResponse(prompt, context);
    usedModel = "fallback";
  }

  await auditLog({
    actorUserId: user.id,
    action: "USE_DOCTOR_ASSISTANT",
    entityType: "DoctorAssistant",
    metadata: { assistantMode: usedModel, prompt: prompt.slice(0, 80) }
  });

  return ok({ ...aiResponse, aiDegraded: usedModel === "fallback" });
}
