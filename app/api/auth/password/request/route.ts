import crypto from "node:crypto";
import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/prisma";
import { emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { passwordRecoveryRequestSchema } from "@/lib/validation/schemas";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("auth:password-request", { limit: 4, windowMs: 10 * 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos de recuperación. Intenta más tarde.", 429);

  const body = await request.json().catch(() => null);
  const parsed = passwordRecoveryRequestSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Correo inválido.", 422, parsed.error.flatten());

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt
      }
    });

    const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
    await sendTransactionalEmail({
      to: user.email,
      subject: "Recupera tu acceso a VITAEON",
      text: `Solicitaste recuperar tu contraseña. Abre este enlace durante los próximos 30 minutos: ${resetUrl}`,
      html: emailShell(
        "Recupera tu acceso",
        `<p>Recibimos una solicitud para cambiar tu contraseña de VITAEON.</p><p>Este enlace expira en 30 minutos:</p><p><a href="${resetUrl}" style="color:#315f7c;font-weight:700">Cambiar contraseña</a></p><p>Si no fuiste tú, puedes ignorar este correo.</p>`
      )
    });

    await auditLog({
      actorUserId: user.id,
      action: "REQUEST_PASSWORD_RESET",
      entityType: "User",
      entityId: user.id
    });
  }

  return ok({
    message: "Si el correo existe en VITAEON, enviaremos instrucciones para recuperar el acceso."
  });
}
