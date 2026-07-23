import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { clearSecretaryCookie, createSecretarySessionToken, setSecretaryCookie } from "@/lib/auth/secretary";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";

const pinSchema = z.object({
  pin: z.string().min(4).max(6)
});

/* ── POST — verificar PIN y crear sesión de secretaría ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit: max 6 intentos / 5 min por IP (protege contra fuerza bruta)
  const limit = await rateLimitByIp("secretaria:auth", { limit: 6, windowMs: 5 * 60_000 });
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Demasiados intentos. Espera 5 minutos e intenta de nuevo.", 429);
  }

  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { token },
    select: { pinHash: true, isActive: true, doctorId: true }
  });

  if (!link || !link.isActive) {
    return fail("INVALID_LINK", "Enlace de secretaría no válido o desactivado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "PIN inválido.", 422);
  }

  const pinMatch = await bcrypt.compare(parsed.data.pin, link.pinHash);
  if (!pinMatch) {
    return fail("INVALID_PIN", "PIN incorrecto. Verifica con el médico.", 401);
  }

  const sessionToken = await createSecretarySessionToken(link.doctorId, token);
  await setSecretaryCookie(sessionToken);

  return ok({ authenticated: true });
}

/* ── DELETE — cerrar sesión de secretaría ─── */
export async function DELETE() {
  await clearSecretaryCookie();
  return ok({ loggedOut: true });
}
