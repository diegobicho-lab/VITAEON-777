import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { openSensitiveText, sealSensitiveText } from "@/lib/security/crypto";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { medicalConversationCreateSchema } from "@/lib/validation/schemas";

function canAccessDoctorTools(role: string) {
  return role === "DOCTOR" || role === "ADMIN" || role === "STAFF";
}

function hasAmatistaAccess(doctor: { medal: string; subscriptionStatus: string }) {
  return doctor.medal === "amatista" && doctor.subscriptionStatus === "ACTIVE";
}

async function getDoctorForUser(userId: string) {
  return prisma.doctor.findUnique({ where: { userId } });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canAccessDoctorTools(user.role)) return fail("FORBIDDEN", "No tienes acceso al chat médico.", 403);

  const doctor = user.role === "DOCTOR" ? await getDoctorForUser(user.id) : null;
  if (user.role === "DOCTOR" && !doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);

  const conversations = await prisma.medicalConversation.findMany({
    where:
      user.role === "DOCTOR"
        ? { OR: [{ createdByDoctorId: doctor?.id }, { recipientDoctorId: doctor?.id }] }
        : {},
    include: {
      createdByDoctor: { select: { id: true, fullName: true, specialty: true } },
      recipientDoctor: { select: { id: true, fullName: true, specialty: true } },
      messages: {
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
        take: 12
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return ok(
    conversations.map((conversation) => ({
      ...conversation,
      patientAlias: openSensitiveText(conversation.patientAlias),
      clinicalSummary: openSensitiveText(conversation.clinicalSummary),
      messages: conversation.messages.map((message) => ({
        ...message,
        body: openSensitiveText(message.body)
      }))
    }))
  );
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("doctor-conversations:create", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas conversaciones creadas. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden crear conversaciones clínicas.", 403);

  const doctor = await getDoctorForUser(user.id);
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (!hasAmatistaAccess(doctor)) {
    return fail(
      "AMATISTA_PLAN_REQUIRED",
      "La colaboración médica es una función premium incluida únicamente en el Plan Amatista.",
      403
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = medicalConversationCreateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de conversación inválidos.", 422, parsed.error.flatten());

  if (parsed.data.recipientDoctorId && parsed.data.recipientDoctorId === doctor.id) {
    return fail("INVALID_RECIPIENT", "El destinatario debe ser otro médico.", 422);
  }

  if (parsed.data.recipientDoctorId) {
    const recipient = await prisma.doctor.findUnique({ where: { id: parsed.data.recipientDoctorId } });
    if (!recipient) return fail("RECIPIENT_NOT_FOUND", "No encontramos al médico destinatario.", 404);
  }

  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.medicalConversation.create({
      data: {
        title: parsed.data.title,
        createdByDoctorId: doctor.id,
        recipientDoctorId: parsed.data.recipientDoctorId,
        patientAlias: sealSensitiveText(parsed.data.patientAlias),
        clinicalSummary: sealSensitiveText(parsed.data.clinicalSummary)
      }
    });

    if (parsed.data.initialMessage) {
      await tx.medicalChatMessage.create({
        data: {
          conversationId: created.id,
          senderUserId: user.id,
          // initialMessage is validated min(1) by schema and guarded by the if above — non-null is guaranteed.
        body: sealSensitiveText(parsed.data.initialMessage)!
        }
      });
    }

    return tx.medicalConversation.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        createdByDoctor: { select: { id: true, fullName: true } },
        recipientDoctor: { select: { id: true, fullName: true } },
        messages: { include: { sender: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } }
      }
    });
  });

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_MEDICAL_CONVERSATION",
    entityType: "MedicalConversation",
    entityId: conversation.id,
    metadata: { recipientDoctorId: parsed.data.recipientDoctorId ?? null }
  });

  return ok(
    {
      ...conversation,
      patientAlias: openSensitiveText(conversation.patientAlias),
      clinicalSummary: openSensitiveText(conversation.clinicalSummary),
      messages: conversation.messages.map((message) => ({ ...message, body: openSensitiveText(message.body) }))
    },
    { status: 201 }
  );
}
