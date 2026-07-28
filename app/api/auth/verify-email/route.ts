import crypto from "node:crypto";
import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/prisma";
import { emailVerificationSchema } from "@/lib/validation/schemas";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = emailVerificationSchema.safeParse({ token: url.searchParams.get("token") ?? "" });
  if (!parsed.success) return fail("INVALID_VERIFICATION_TOKEN", "El enlace de verificación no es válido.", 400);

  const tokenHash = hashToken(parsed.data.token);
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
    return fail("INVALID_OR_EXPIRED_TOKEN", "El enlace de verificación expiró o ya fue utilizado.", 400);
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

  return ok({ message: "Correo verificado correctamente. Ya puedes continuar en VITAEON." });
}
