import { fetchWithTimeout } from "./env";

/**
 * Cloudflare Turnstile verification.
 * - No secret and no site key: Turnstile is off (development, or a deploy that chose not to use it).
 * - Site key without a secret in production: misconfigured, so every request is refused rather than let through.
 */
export async function verifyTurnstile(token: string, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production" || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetchWithTimeout("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body }, 5000);
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("[turnstile] verification failed", e);
    return false;
  }
}
