import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

type Bucket = {
  count: number;
  resetAt: number;
};

// NOTE: este Map es in-memory y se reinicia en cada cold start de Vercel.
// Para producción a escala, reemplazar con Upstash Redis (@upstash/ratelimit).
// En beta (<500 usuarios) provee protección suficiente contra bursts dentro de la misma instancia.
const buckets = new Map<string, Bucket>();

export async function getClientIp() {
  const headerList = await headers();
  const ip =
    headerList.get("cf-connecting-ip") ||
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip");

  if (ip) return ip;

  // Fallback: hash del user-agent para evitar que distintos navegadores compartan bucket
  const ua = headerList.get("user-agent") ?? "unknown";
  return `ua-${createHash("sha1").update(ua).digest("hex").slice(0, 16)}`;
}

export async function rateLimit(key: string, options: { limit: number; windowMs: number }) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  if (current.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, remaining: options.limit - current.count, resetAt: current.resetAt };
}

export async function rateLimitByIp(scope: string, options: { limit: number; windowMs: number }) {
  const ip = await getClientIp();
  return rateLimit(`${scope}:${ip}`, options);
}
