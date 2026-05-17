import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { doctorAssistantSchema } from "@/lib/validation/schemas";

function buildAssistantResponse(prompt: string, context?: string) {
  const text = `${prompt} ${context ?? ""}`.toLowerCase();
  const wantsReminders = ["recordatorio", "notificar", "avisar", "whatsapp", "sms", "correo"].some((word) =>
    text.includes(word)
  );
  const wantsOpenings = ["hueco", "libre", "disponible", "agenda", "organizar"].some((word) => text.includes(word));

  return {
    title: "Secretaria médica virtual",
    specialty: "Agenda médica",
    priority: wantsOpenings
      ? "Revisar huecos disponibles y confirmar pacientes pendientes antes de abrir nuevos horarios."
      : "Priorizar la próxima cita, pendientes de confirmación y recordatorios internos del día.",
    checklist: [
      "Revisar la cita más próxima y preparar expediente.",
      wantsReminders
        ? "Preparar recordatorios internos para pacientes pendientes."
        : "Identificar pacientes que requieren confirmación.",
      "Ordenar horarios libres por cercanía y duración.",
      "Registrar cambios de agenda antes de notificar al paciente.",
      "Mantener todo envío externo como pendiente hasta configurar email, WhatsApp, SMS o push."
    ],
    note: "Secretaria interna de agenda para plan Amatista. No envía mensajes externos sin una integración configurada."
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden ver su asistente de agenda.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true, medal: true } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal !== "amatista") {
    return fail("PLAN_UPGRADE_REQUIRED", "La secretaria médica virtual está disponible en el plan Amatista.", 402);
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 1000 * 60 * 60 * 24);
  const week = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
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

  const pendingConfirmations = upcomingSlots.filter((slot) => slot.appointment?.status === "PENDING_DOCTOR_ACCEPTANCE" || slot.appointment?.status === "PENDING").length;
  const freeSlots = upcomingSlots.filter((slot) => slot.isActive && !slot.appointment).slice(0, 5);

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
      booked: todaySlots.filter((slot) => slot.appointment).length,
      available: todaySlots.filter((slot) => slot.isActive && !slot.appointment).length
    },
    pendingConfirmations,
    remindersToPrepare: upcomingSlots.filter((slot) => slot.appointment && slot.startsAt > now).slice(0, 5).length,
    suggestedFreeSlots: freeSlots.map((slot) => ({ id: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt })),
    notifications,
    deliveryChannels: ["internal"],
    externalDeliveryPending: ["email", "whatsapp", "sms", "push"]
  });
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("doctor-assistant", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas consultas al asistente. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || (user.role !== "DOCTOR" && user.role !== "ADMIN" && user.role !== "STAFF")) {
    return fail("FORBIDDEN", "No tienes acceso al asistente médico.", 403);
  }

  if (user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { medal: true } });
    if (!doctor || doctor.medal !== "amatista") {
      return fail(
        "PLAN_UPGRADE_REQUIRED",
        "El asistente de IA de agenda está disponible para médicos con plan Amatista.",
        402
      );
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = doctorAssistantSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Solicitud inválida.", 422, parsed.error.flatten());

  const response = buildAssistantResponse(parsed.data.prompt, parsed.data.context);
  await auditLog({
    actorUserId: user.id,
    action: "USE_DOCTOR_ASSISTANT",
    entityType: "DoctorAssistant",
    metadata: { assistantMode: response.specialty }
  });

  return ok(response);
}
