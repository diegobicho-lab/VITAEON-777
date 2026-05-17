import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/prisma";
import { emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { passwordRecoveryResetSchema } from "@/lib/validation/schemas";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("auth:password-reset", { limit: 6, windowMs: 10 * 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos. Solicita un nuevo enlace más tarde.", 429);

  const body = await request.json().catch(() => null);
  const parsed = passwordRecoveryResetSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Solicitud inválida.", 422, parsed.error.flatten());

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return fail("INVALID_OR_EXPIRED_TOKEN", "El enlace de recuperación expiró o ya fue utilizado.", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
      data: { usedAt: new Date() }
    })
  ]);

  await auditLog({
    actorUserId: resetToken.userId,
    action: "RESET_PASSWORD",
    entityType: "User",
    entityId: resetToken.userId
  });

  await sendTransactionalEmail({
    to: resetToken.user.email,
    subject: "Tu contraseña de VITAEON fue actualizada",
    text: "Tu contraseña fue actualizada correctamente. Si no reconoces este cambio, contacta soporte de inmediato.",
    html: emailShell(
      "Contraseña actualizada",
      "<p>Tu contraseña fue actualizada correctamente.</p><p>Si no reconoces este cambio, contacta soporte de VITAEON de inmediato.</p>"
    )
  });

  return ok({ message: "Contraseña actualizada correctamente." });
}
