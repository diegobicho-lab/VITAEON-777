import Anthropic from "@anthropic-ai/sdk";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { doctorAssistantSchema } from "@/lib/validation/schemas";

/* ── Anthropic client (lazy — sólo se usa en plan Amatista) ─── */
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurado.");
  return new Anthropic({ apiKey });
}

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
    note: "Configura ANTHROPIC_API_KEY en Vercel para activar el asistente con IA real."
  };
}

/* ── GET — resumen del día ──────────────────────────────────── */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR")
    return fail("FORBIDDEN", "Solo médicos pueden ver su asistente de agenda.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true, medal: true } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal !== "amatista")
    return fail("PLAN_UPGRADE_REQUIRED", "La secretaria médica virtual está disponible en el plan Amatista.", 402);

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
    const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { medal: true } });
    if (!doctor || doctor.medal !== "amatista")
      return fail("PLAN_UPGRADE_REQUIRED", "El asistente con IA está disponible para médicos con plan Amatista.", 402);
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
          status: { in: ["PENDING", "PENDING_DOCTOR_ACCEPTANCE", "ACCEPTED"] }
        },
        include: { availabilitySlot: true },
        orderBy: { availabilitySlot: { startsAt: "asc" } },
        take: 5
      }
    }
  });

  const agendaContext = doctor
    ? `Médico: ${doctor.fullName}, Especialidad: ${doctor.specialty?.name ?? "Especialista"}.
Citas próximas esta semana: ${doctor.appointments.length}.
${doctor.appointments.map((a) => `- ${new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(a.availabilitySlot.startsAt)} (${a.status})`).join("\n")}`
    : "";

  /* ── Llamada real a Claude ─── */
  let aiResponse: { title: string; specialty: string; priority: string; checklist: string[]; note: string };

  try {
    const anthropic = getAnthropic();
    const systemPrompt = `Eres la secretaria médica virtual de VITAEON, una plataforma médica privada en León, Guanajuato.
Ayudas a médicos especialistas a organizar su agenda, gestionar citas y priorizar su día.
Responde siempre en español, de forma profesional, concisa y útil.
Tu respuesta debe ser un JSON válido con esta estructura exacta:
{
  "title": "Título corto de la respuesta (máx 6 palabras)",
  "specialty": "Área de la agenda que atiendes",
  "priority": "Una prioridad clara para hoy (1-2 oraciones)",
  "checklist": ["Acción 1", "Acción 2", "Acción 3", "Acción 4"],
  "note": "Nota opcional sobre canales externos o limitaciones"
}
No incluyas markdown ni texto fuera del JSON.`;

    const userMessage = `${agendaContext ? `Contexto de agenda:\n${agendaContext}\n\n` : ""}${context ? `Contexto adicional: ${context}\n\n` : ""}Pregunta del médico: ${prompt}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? rawText.slice(jsonStart, jsonEnd + 1) : rawText;
    aiResponse = JSON.parse(jsonText);

    /* Asegurar estructura mínima */
    if (!aiResponse.title || !aiResponse.checklist || !Array.isArray(aiResponse.checklist)) {
      throw new Error("Respuesta de IA con estructura incompleta");
    }
  } catch (error) {
    console.error("[Doctor assistant AI error]", error);
    aiResponse = fallbackResponse(prompt, context);
  }

  await auditLog({
    actorUserId: user.id,
    action: "USE_DOCTOR_ASSISTANT",
    entityType: "DoctorAssistant",
    metadata: { assistantMode: "claude-haiku-4-5", prompt: prompt.slice(0, 80) }
  });

  return ok(aiResponse);
}
