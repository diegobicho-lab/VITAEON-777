import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";

const createLinkSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "El PIN debe tener entre 4 y 6 dígitos.")
});

/* ── GET — obtener enlace actual ─── */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return fail("FORBIDDEN", "Solo médicos pueden gestionar el enlace de secretaría.", 403);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, medal: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  if (doctor.medal === "oro") {
    return fail("PLAN_REQUIRED", "El enlace de secretaría está disponible en los planes Diamante y Amatista.", 403);
  }

  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { doctorId: doctor.id },
    select: { token: true, isActive: true, createdAt: true, updatedAt: true }
  });

  return ok(link ?? null);
}

/* ── POST — crear o regenerar enlace ─── */
export async function POST(request: Request) {
  const limit = await rateLimitByIp("doctor:secretary-link:create", { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos. Espera un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return fail("FORBIDDEN", "Solo médicos pueden gestionar el enlace de secretaría.", 403);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, medal: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  if (doctor.medal === "oro") {
    return fail("PLAN_REQUIRED", "El enlace de secretaría está disponible en los planes Diamante y Amatista.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "PIN inválido.", 422, parsed.error.flatten());
  }

  const newToken = randomBytes(24).toString("hex"); // 48 chars hex = 192 bits de entropía
  const pinHash = await bcrypt.hash(parsed.data.pin, 10);

  const link = await prisma.doctorSecretaryLink.upsert({
    where: { doctorId: doctor.id },
    create: {
      doctorId: doctor.id,
      token: newToken,
      pinHash,
      isActive: true
    },
    update: {
      token: newToken,
      pinHash,
      isActive: true,
      updatedAt: new Date()
    },
    select: { token: true, isActive: true, createdAt: true, updatedAt: true }
  });

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_SECRETARY_LINK",
    entityType: "DoctorSecretaryLink",
    entityId: doctor.id
  });

  return ok(link, { status: 201 });
}

/* ── DELETE — desactivar enlace ─── */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return fail("FORBIDDEN", "Solo médicos pueden gestionar el enlace de secretaría.", 403);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  await prisma.doctorSecretaryLink.updateMany({
    where: { doctorId: doctor.id },
    data: { isActive: false }
  });

  await auditLog({
    actorUserId: user.id,
    action: "DEACTIVATE_SECRETARY_LINK",
    entityType: "DoctorSecretaryLink",
    entityId: doctor.id
  });

  return ok({ deactivated: true });
}
