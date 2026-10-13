import { NextResponse } from "next/server";
import { services } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deploy configuration check. Booleans only, never secret values.
 * A successful production response requires every launch-critical integration.
 */
export function GET() {
  const s = services();
  const ok =
    process.env.NODE_ENV === "production"
      ? s.storage === "supabase" && s.email && s.turnstile && s.leadPlatform && s.leadDelivery && s.rateLimit && process.env.ALLOW_LOCAL_LEAD_STORE !== "true"
      : s.storage !== "missing";
  return NextResponse.json({ ok, ...s }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
