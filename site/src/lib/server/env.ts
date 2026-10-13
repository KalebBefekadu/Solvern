/** Which production services are configured. Reads process.env at call time so tests can change it. */
export function services() {
  const supabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const localStore = process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_LEAD_STORE === "true";
  const email = !!process.env.RESEND_API_KEY && !!process.env.LEAD_NOTIFY_FROM && !!process.env.LEAD_NOTIFY_TO;
  return {
    storage: supabase ? ("supabase" as const) : localStore ? ("local" as const) : ("missing" as const),
    previewGeneration:
      process.env.PREVIEW_GENERATION_ENABLED !== "true"
        ? ("off" as const)
        : supabase && !!process.env.OPENAI_API_KEY && !!(process.env.PREVIEW_WORKER_SECRET || process.env.CRON_SECRET) && !!process.env.LEAD_NOTIFY_TO
          ? ("configured" as const)
          : ("missing" as const),
    email,
    turnstile: !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    leadPlatform: !!process.env.LEAD_PLATFORM_WEBHOOK_URL && !!process.env.LEAD_PLATFORM_WEBHOOK_SECRET,
    leadDelivery: supabase && email && !!(process.env.OUTBOX_WORKER_SECRET || process.env.CRON_SECRET),
    rateLimit: supabase && (process.env.RATE_LIMIT_SECRET?.length ?? 0) >= 32,
  };
}

/** Fetch with a deadline, so a slow third party never hangs a lead submission. */
export function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}
