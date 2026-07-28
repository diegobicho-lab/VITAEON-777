import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/db/redis";

// Cache de instancias de Ratelimit para no recrear en cada request
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  if (!redis) throw new Error("Redis is not configured");

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
  try {
    const limiter = getLimiter(options.limit, options.windowMs);
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset
    };
  } catch (error) {
    console.warn("[rate-limit] Redis unavailable; allowing request without rate limit.", error);
    return {
      allowed: true,
      remaining: options.limit,
      resetAt: Date.now() + options.windowMs
    };
  }
}

export async function rateLimitByIp(scope: string, options: { limit: number; windowMs: number }) {
  const ip = await getClientIp();
  return rateLimit(`${scope}:${ip}`, options);
}
