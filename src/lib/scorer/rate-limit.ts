/**
 * Simple in-memory rate limiter for the scorer endpoints.
 *
 * Each serverless instance keeps its own counters, so under heavy
 * spread-out traffic the limit is per-instance, not global. For the
 * scorer use case (a handful of saves per match) that's fine: a single
 * abuser sending bursts from one IP gets blocked at the instance they
 * landed on; legitimate use never bumps the ceiling.
 *
 * For stronger guarantees we'd move to Vercel KV / Upstash Redis. Marked
 * as a v2 follow-up in `Por hacer/anotadores.md`.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX = 30;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Composite key = action + ip + token. Each combination has its own
 * rolling 1-minute window.
 */
export function checkRateLimit(
  key: string,
  max: number = DEFAULT_MAX
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Reads the caller's IP from common headers Vercel sets. Falls back to
 * "unknown" so the limiter still applies under one shared bucket.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
