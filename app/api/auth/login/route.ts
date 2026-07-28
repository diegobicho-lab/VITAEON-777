import bcrypt from "bcryptjs";
import { ok, fail } from "@/lib/api-response";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { auditLog } from "@/lib/audit/audit";
import { loginSchema } from "@/lib/validation/schemas";
import type { CurrentUser } from "@/types/domain";

export async function POST(request: Request) {
  const limit = await rateLimitByIp("auth:login", { limit: 5, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos de acceso. Intenta de nuevo en un momento.", 429);

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Credenciales inválidas.", 422, parsed.error.flatten());

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.isActive) return fail("INVALID_CREDENTIALS", "Correo o contraseña incorrectos.", 401);

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    await auditLog({ actorUserId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id });
    return fail("INVALID_CREDENTIALS", "Correo o contraseña incorrectos.", 401);
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
  await auditLog({ actorUserId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id });

  return ok(currentUser);
}
