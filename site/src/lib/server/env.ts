/** Which production services are configured. Reads process.env at call time so tests can change it. */
export function services() {
  const supabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const localStore = process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_LEAD_STORE === "true";
  return {
    storage: supabase ? ("supabase" as const) : localStore ? ("local" as const) : ("missing" as const),
    email: !!process.env.RESEND_API_KEY && !!process.env.LEAD_NOTIFY_FROM && !!process.env.LEAD_NOTIFY_TO,
    turnstile: !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  };
}

/** Fetch with a deadline, so a slow third party never hangs a lead submission. */
export function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}
