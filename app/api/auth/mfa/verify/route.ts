import { ok, fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { validateTotp, verifyMfaChallengeToken } from "@/lib/auth/mfa";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { mfaVerifySchema } from "@/lib/validation/schemas";
import type { CurrentUser } from "@/types/domain";

export async function POST(request: Request) {
  const limit = await rateLimitByIp("auth:mfa:verify", { limit: 6, windowMs: 5 * 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos de MFA. Intenta más tarde.", 429);

  if (process.env.ADMIN_MFA_REQUIRED !== "true") return fail("MFA_NOT_REQUIRED", "MFA no está requerido.", 400);
  const secret = process.env.ADMIN_MFA_TOTP_SECRET;
  if (!secret) return fail("MFA_NOT_CONFIGURED", "MFA de administración no está configurado.", 503);

  const body = await request.json().catch(() => null);
  const parsed = mfaVerifySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Código MFA inválido.", 422, parsed.error.flatten());

  let challenge;
  try {
    challenge = await verifyMfaChallengeToken(parsed.data.challengeToken);
  } catch {
    return fail("INVALID_MFA_CHALLENGE", "La sesión MFA expiró. Inicia sesión nuevamente.", 401);
  }

  if (challenge.role !== "ADMIN") return fail("FORBIDDEN", "MFA solo aplica a administración.", 403);
  if (!validateTotp(parsed.data.code, secret)) {
    return fail("INVALID_MFA_CODE", "Código MFA incorrecto.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.id ?? challenge.sub },
    select: { id: true, email: true, name: true, role: true, isActive: true, sessionVersion: true }
  });
  if (!user || !user.isActive || user.role !== "ADMIN") return fail("UNAUTHORIZED", "No hay usuario admin válido.", 401);
  if ((challenge.sessionVersion ?? 0) !== user.sessionVersion) {
    return fail("INVALID_MFA_CHALLENGE", "La sesión MFA expiró. Inicia sesión nuevamente.", 401);
  }

  const currentUser: CurrentUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as CurrentUser["role"],
    sessionVersion: user.sessionVersion
  };
  const token = await createSessionToken(currentUser);
  await setSessionCookie(token);
  await auditLog({ actorUserId: user.id, action: "LOGIN_MFA_SUCCESS", entityType: "User", entityId: user.id });

  return ok(currentUser);
}
