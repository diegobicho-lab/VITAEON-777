import crypto from "node:crypto";
import { auditLog } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/prisma";
import { emailVerificationSchema } from "@/lib/validation/schemas";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");
}

/** El usuario llega desde su cliente de correo: siempre debe ver una página, no JSON. */
function redirectToStatus(status: "ok" | "invalid" | "expired") {
  return Response.redirect(`${appUrl()}/verificar-correo?estado=${status}`, 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = emailVerificationSchema.safeParse({ token: url.searchParams.get("token") ?? "" });
  if (!parsed.success) return redirectToStatus("invalid");

  const tokenHash = hashToken(parsed.data.token);
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
    return redirectToStatus("expired");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: verificationToken.user.emailVerifiedAt ?? new Date() }
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() }
    }),
    prisma.emailVerificationToken.updateMany({
      where: { userId: verificationToken.userId, usedAt: null, id: { not: verificationToken.id } },
      data: { usedAt: new Date() }
    })
  ]);

  await auditLog({
    actorUserId: verificationToken.userId,
    action: "VERIFY_EMAIL",
    entityType: "User",
    entityId: verificationToken.userId
  });

  // No se invalida la sesión: getCurrentUser() lee emailVerifiedAt de la base en
  // cada request, así que la verificación surte efecto de inmediato sin obligar
  // al paciente a volver a iniciar sesión.
  return redirectToStatus("ok");
}
