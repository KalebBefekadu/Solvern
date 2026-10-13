import { log } from "./log";
import { fetchWithTimeout } from "./env";

/**
 * Cloudflare Turnstile verification.
 * - No secret: verification is off in development and explicitly local end-to-end tests.
 * - A production deployment without a secret refuses requests.
 */
export async function verifyTurnstile(token: string, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_LEAD_STORE === "true";
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetchWithTimeout("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body }, 5000);
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    log.warn("turnstile.unreachable", {}, e);
    return false;
  }
}
