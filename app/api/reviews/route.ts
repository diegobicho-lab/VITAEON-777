import { Prisma, ReviewStatus } from "@prisma/client";
import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { reviewCreateSchema, reviewModerationSchema } from "@/lib/validation/schemas";

const blockedWords = [
  // insultos directos
  "idiota", "imbécil", "imbecil", "estúpido", "estupido", "maldito", "maldita",
  "asco", "asqueroso", "asquerosa", "basura", "mierda", "puto", "puta", "pendejo",
  "pendeja", "culero", "culera", "mamón", "mamon", "ojete", "cabrón", "cabron",
  // fraude / spam
  "fraude", "spam", "estafa", "fake", "falso", "falsa", "mentira", "mentiroso",
  "mentirosa", "tramposo", "tramposa", "ladrón", "ladron", "robo", "engaño", "engano",
  // amenazas
  "matar", "muerte", "amenaza", "golpe", "golpear",
  // contenido inapropiado
  "porno", "pornografía", "pornografia", "desnudo", "desnuda", "sexo"
];

function requiresModeration(comment: string) {
  const normalized = comment.toLowerCase();
  return blockedWords.some((word) => normalized.includes(word));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const mine = searchParams.get("mine") === "true";

  const reviews = await prisma.doctorReview.findMany({
    where:
      user?.role === "ADMIN" || user?.role === "STAFF"
        ? doctorId
          ? { doctorId }
          : {}
        : user?.role === "DOCTOR" && mine
          ? { doctor: { userId: user.id } }
          : { doctorId: doctorId ?? "__none__", status: ReviewStatus.PUBLISHED },
    include: {
      patient: { include: { user: { select: { name: true } } } },
      doctor: { select: { fullName: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return ok({
    average: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0,
    total: reviews.length,
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      doctorReply: review.doctorReply,
      status: review.status,
      patientName: review.patient.user.name,
      doctorName: review.doctor.fullName,
      createdAt: review.createdAt
    }))
  });
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("reviews:create", { limit: 8, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas opiniones en poco tiempo. Intenta más tarde.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "PATIENT") return fail("FORBIDDEN", "Solo pacientes pueden dejar opiniones.", 403);

  const body = await request.json().catch(() => null);
  const parsed = reviewCreateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Opinión inválida.", 422, parsed.error.flatten());

  const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
  if (!patient) return fail("PATIENT_PROFILE_REQUIRED", "No se encontró perfil de paciente.", 409);

  const appointment = parsed.data.appointmentId
    ? await prisma.appointment.findFirst({
        where: {
          id: parsed.data.appointmentId,
          patientId: patient.id,
          doctorId: parsed.data.doctorId,
          status: "COMPLETED"
        }
      })
    : await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          doctorId: parsed.data.doctorId,
          status: "COMPLETED"
        },
        orderBy: { createdAt: "desc" }
      });

  if (!appointment) {
    return fail("APPOINTMENT_REQUIRED", "Solo pacientes con una cita completada pueden publicar una opinión.", 403);
  }

  const status = requiresModeration(parsed.data.comment) ? ReviewStatus.PENDING_REVIEW : ReviewStatus.PUBLISHED;
  let review;
  try {
    review = await prisma.doctorReview.create({
      data: {
        doctorId: parsed.data.doctorId,
        patientId: patient.id,
        appointmentId: appointment.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        status
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("REVIEW_ALREADY_EXISTS", "Ya publicaste una opinión para esta cita.", 409);
    }
    throw error;
  }

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_DOCTOR_REVIEW",
    entityType: "DoctorReview",
    entityId: review.id,
    metadata: { doctorId: parsed.data.doctorId, status }
  });

  return ok(review, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión.", 401);

  const body = await request.json().catch(() => null);
  const parsed = reviewModerationSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de opinión inválidos.", 422, parsed.error.flatten());

  const review = await prisma.doctorReview.findUnique({ where: { id: parsed.data.reviewId }, include: { doctor: true } });
  if (!review) return fail("REVIEW_NOT_FOUND", "No encontramos la opinión.", 404);

  const canModerate = user.role === "ADMIN" || user.role === "STAFF";
  const canReply = user.role === "DOCTOR" && review.doctor.userId === user.id;
  if (!canModerate && !canReply) return fail("FORBIDDEN", "No tienes permiso para modificar esta opinión.", 403);

  const updated = await prisma.doctorReview.update({
    where: { id: review.id },
    data: {
      status: canModerate ? parsed.data.status : undefined,
      doctorReply: canReply ? parsed.data.doctorReply : undefined
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: canModerate ? "MODERATE_DOCTOR_REVIEW" : "REPLY_DOCTOR_REVIEW",
    entityType: "DoctorReview",
    entityId: review.id
  });

  return ok(updated);
}
