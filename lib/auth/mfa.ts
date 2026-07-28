import "server-only";
import crypto from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { CurrentUser } from "@/types/domain";

const MFA_AUDIENCE = "vitaeon-admin-mfa";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return new TextEncoder().encode(secret);
}

function base32ToBuffer(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value === -1) throw new Error("Invalid base32 secret");
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac("sha1", secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

export function validateTotp(code: string, secret: string, now = Date.now()) {
  const secretBuffer = base32ToBuffer(secret);
  const currentCounter = Math.floor(now / 1000 / 30);

  return [-1, 0, 1].some((drift) => {
    const expected = hotp(secretBuffer, currentCounter + drift);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code));
  });
}

export async function createMfaChallengeToken(user: CurrentUser) {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion ?? 0,
    aud: MFA_AUDIENCE
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecret());
}

export async function verifyMfaChallengeToken(token: string) {
  const verified = await jwtVerify(token, getSecret(), { audience: MFA_AUDIENCE });
  return verified.payload as unknown as CurrentUser & { sub: string };
}
