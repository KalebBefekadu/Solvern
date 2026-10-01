/**
 * Fixed-window rate limiter kept in memory.
 * On serverless hosts each instance keeps its own window, so this is a best-effort brake on bursts
 * from one address. Turnstile remains the real spam control.
 */
interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  const w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) prune(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  w.count += 1;
  if (w.count > limit) return { ok: false, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

function prune(now: number) {
  for (const [k, w] of buckets) if (w.resetAt <= now) buckets.delete(k);
  // Still full: drop the oldest entries rather than grow without bound.
  if (buckets.size >= MAX_KEYS) {
    const extra = buckets.size - MAX_KEYS + 1;
    let i = 0;
    for (const k of buckets.keys()) {
      if (i++ >= extra) break;
      buckets.delete(k);
    }
  }
}

/** Test hook. */
export function resetRateLimits() {
  buckets.clear();
}
