import "server-only";
import { headers } from "next/headers";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export async function getClientIp() {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "local"
  );
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
