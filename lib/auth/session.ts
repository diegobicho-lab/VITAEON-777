import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/db/prisma";
import type { CurrentUser } from "@/types/domain";

const SESSION_COOKIE = "vitaeon_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: CurrentUser) {
  return new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, getSecret());
    const sessionUser = verified.payload as unknown as CurrentUser;
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });
    if (!user?.isActive) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as CurrentUser["role"]
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  // sameSite: "lax" — NO cambiar a "strict".
  // Stripe redirige al usuario de vuelta al sitio tras el pago (cross-site navigation).
  // Con "strict" el navegador no envía la cookie en ese redirect, dejando al usuario
  // sin sesión justo al completar una suscripción. "lax" es el mínimo seguro viable
  // mientras se use Stripe Checkout con redirect. Si en el futuro se migra a
  // Stripe Elements (pago embebido sin redirect), se puede subir a "strict".
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
