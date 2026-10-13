/**
 * Development uses an in-memory fixed window. Production uses a PostgreSQL counter
 * shared by every server instance; only an HMAC of the client key reaches storage.
 */
import { createHmac } from "node:crypto";
import { BackendUnavailable, supabase } from "./backend";
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

export async function rateLimitDistributed(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfter: number }> {
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_LEAD_STORE === "true") return rateLimit(key, limit, windowMs);
  const secret = process.env.RATE_LIMIT_SECRET;
  const sb = supabase();
  if (!secret || secret.length < 32 || !sb) throw new BackendUnavailable("Distributed rate limiting is not configured");
  const keyHash = createHmac("sha256", secret).update(key).digest("hex");
  const { data, error } = await sb.rpc("consume_rate_limit", { p_key_hash: keyHash, p_limit: limit, p_window_seconds: Math.ceil(windowMs / 1000) });
  if (error || !Array.isArray(data) || data.length !== 1) throw new BackendUnavailable("Distributed rate limiting is unavailable");
  return { ok: data[0].allowed === true, retryAfter: Math.max(0, Number(data[0].retry_after) || 0) };
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
