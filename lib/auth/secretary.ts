import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

const SECRETARY_COOKIE = "vitaeon_secretary_session";

export interface SecretarySession {
  doctorId: string;
  linkToken: string;
  type: "secretary";
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return new TextEncoder().encode(secret);
}

export async function createSecretarySessionToken(doctorId: string, linkToken: string): Promise<string> {
  return new SignJWT({ doctorId, linkToken, type: "secretary" } as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function setSecretaryCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SECRETARY_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 // 24 horas
  });
}

export async function clearSecretaryCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SECRETARY_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

/**
 * Verifica la cookie de sesión de secretaría.
 * Devuelve la sesión si es válida y el token coincide con el linkToken esperado.
 * Si linkToken es null, solo verifica que la sesión sea válida.
 */
export async function getSecretarySession(expectedLinkToken?: string): Promise<SecretarySession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SECRETARY_COOKIE)?.value;
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, getSecret());
    const session = verified.payload as unknown as SecretarySession;
    if (session.type !== "secretary") return null;
    if (expectedLinkToken && session.linkToken !== expectedLinkToken) return null;
    return session;
  } catch {
    return null;
  }
}
