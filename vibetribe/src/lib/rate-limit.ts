/**
 * Small in-memory sliding-window limiter.
 * LIMITATION: state is per server instance (serverless instances don't share it).
 * It stops accidental spam and cost blow-ups in an MVP; swap for Redis/Upstash for strict limits.
 */
type Bucket = number[];
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false as const, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  return { ok: true as const, retryAfterSec: 0 };
}
