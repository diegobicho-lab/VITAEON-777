import crypto from "node:crypto";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { rateLimitByIp } from "@/lib/security/rate-limit";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Reenvía el enlace de verificación al usuario autenticado.
 *
 * Sin esto, un paciente cuyo primer correo se perdió o expiró quedaba bloqueado
 * para reservar sin ninguna salida dentro del producto.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para reenviar la verificación.", 401);

  const limit = await rateLimitByIp("auth:resend-verification", { limit: 3, windowMs: 10 * 60_000 });
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Ya enviamos varios correos. Espera unos minutos antes de pedir otro.", 429);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true }
  });
  if (!dbUser) return fail("USER_NOT_FOUND", "No encontramos tu cuenta.", 404);

  if (dbUser.emailVerifiedAt) {
    return ok({ alreadyVerified: true, message: "Tu correo ya está verificado." });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);

  await prisma.$transaction([
    // Invalida enlaces anteriores para que solo el más reciente funcione.
    prisma.emailVerificationToken.updateMany({
      where: { userId: dbUser.id, usedAt: null },
      data: { usedAt: new Date() }
    }),
    prisma.emailVerificationToken.create({
      data: { userId: dbUser.id, tokenHash: hashToken(token), expiresAt }
    })
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");
  const verificationUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const delivery = await sendTransactionalEmail({
    to: dbUser.email,
    subject: "Verifica tu correo en VITAEON",
    text: `Verifica tu correo para reservar citas: ${verificationUrl}`,
    html: emailShell("Verifica tu correo", [
      `<p>Hola ${dbUser.name.split(" ")[0]}, confirma tu correo para poder reservar citas y pagar en línea.</p>`,
      emailButton("Verificar mi correo", verificationUrl),
      `<p style="margin-top:12px;font-size:13px;color:#7f9aaa;">El enlace vence en 24 horas.</p>`
    ].join(""))
  }).catch((error) => {
    console.error("[resend-verification] delivery failed:", error);
    return { sent: false as const };
  });

  await auditLog({
    actorUserId: dbUser.id,
    action: "RESEND_EMAIL_VERIFICATION",
    entityType: "User",
    entityId: dbUser.id
  });

  if (!delivery.sent) {
    return fail(
      "VERIFICATION_EMAIL_FAILED",
      "No pudimos enviar el correo en este momento. Intenta de nuevo en unos minutos.",
      502
    );
  }

  return ok({ sent: true, message: "Te enviamos un nuevo enlace de verificación." });
}
