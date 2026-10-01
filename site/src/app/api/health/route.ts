import { NextResponse } from "next/server";
import { services } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deploy check: which services this deployment can reach. Booleans only, never values.
 * `ok` is false when leads would be refused because no storage is configured.
 */
export function GET() {
  const s = services();
  const ok = s.storage !== "missing";
  return NextResponse.json({ ok, ...s }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
