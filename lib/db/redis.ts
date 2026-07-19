import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis singleton.
 * All server-side code that needs Redis (rate-limiting, webhook idempotency, etc.)
 * should import from here so we keep one connection pool.
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});
