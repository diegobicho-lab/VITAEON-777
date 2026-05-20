import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { openSensitiveText, sealSensitiveText } from "@/lib/security/crypto";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { medicalChatMessageSchema } from "@/lib/validation/schemas";

async function canAccessConversation(userId: string, role: string, conversationId: string) {
  if (role === "ADMIN" || role === "STAFF") return true;
  if (role !== "DOCTOR") return false;
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) return false;
  const conversation = await prisma.medicalConversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ createdByDoctorId: doctor.id }, { recipientDoctorId: doctor.id }]
    }
  });
  return Boolean(conversation);
}

async function hasAmatistaAccess(userId: string, role: string) {
  if (role === "ADMIN" || role === "STAFF") return true;
  if (role !== "DOCTOR") return false;
  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { medal: true } });
  return doctor?.medal === "amatista";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver mensajes médicos.", 401);

  const { id } = await params;
  if (!(await hasAmatistaAccess(user.id, user.role))) {
    return fail(
      "AMATISTA_PLAN_REQUIRED",
      "La colaboración médica es una función premium incluida únicamente en el Plan Amatista.",
      403
    );
  }

  if (!(await canAccessConversation(user.id, user.role, id))) {
    return fail("FORBIDDEN", "No tienes acceso a esta conversación médica.", 403);
  }

  const messages = await prisma.medicalChatMessage.findMany({
    where: { conversationId: id },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" }
  });

  return ok(messages.map((message) => ({ ...message, body: openSensitiveText(message.body) })));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await rateLimitByIp("doctor-conversations:message", { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados mensajes. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para enviar mensajes médicos.", 401);

  const { id } = await params;
  if (!(await hasAmatistaAccess(user.id, user.role))) {
    return fail(
      "AMATISTA_PLAN_REQUIRED",
      "La colaboración médica es una función premium incluida únicamente en el Plan Amatista.",
      403
    );
  }

  if (!(await canAccessConversation(user.id, user.role, id))) {
    return fail("FORBIDDEN", "No tienes acceso a esta conversación médica.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = medicalChatMessageSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Mensaje inválido.", 422, parsed.error.flatten());

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.medicalChatMessage.create({
      data: {
        conversationId: id,
        senderUserId: user.id,
        body: sealSensitiveText(parsed.data.body) ?? ""
      },
      include: { sender: { select: { id: true, name: true, role: true } } }
    });
    await tx.medicalConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return created;
  });

  await auditLog({
    actorUserId: user.id,
    action: "SEND_MEDICAL_CHAT_MESSAGE",
    entityType: "MedicalConversation",
    entityId: id
  });

  return ok({ ...message, body: openSensitiveText(message.body) }, { status: 201 });
}
