import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Redis persistente — funciona en producción serverless (Vercel).
// Los buckets sobreviven cold starts y múltiples workers.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

// Cache de instancias de Ratelimit para no recrear en cada request
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const key = `${limit}:${windowMs}`;
  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
        prefix: "vitaeon:rl"
      })
    );
  }
  return limiters.get(key)!;
}

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
  const limiter = getLimiter(options.limit, options.windowMs);
  const result = await limiter.limit(key);
  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: result.reset
  };
}

export async function rateLimitByIp(scope: string, options: { limit: number; windowMs: number }) {
  const ip = await getClientIp();
  return rateLimit(`${scope}:${ip}`, options);
}
