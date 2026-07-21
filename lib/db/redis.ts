import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis singleton.
 * All server-side code that needs Redis (rate-limiting, webhook idempotency, etc.)
 * should import from here so we keep one connection pool.
 */
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required — add them to .env.local or Vercel env vars");
}

export const redis = new Redis({ url: redisUrl, token: redisToken });
