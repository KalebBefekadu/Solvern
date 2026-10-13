import { NextResponse } from "next/server";
import { cleanExpiredPreviewDrafts, cleanRateLimitBuckets } from "@/lib/server/preview-maintenance";
import { authorizedWorker } from "@/lib/server/worker-auth";
import { log } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request) {
  if (!authorizedWorker(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Storage is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const cleaned = await cleanExpiredPreviewDrafts();
    const rateLimitBucketsRemoved = await cleanRateLimitBuckets();
    return NextResponse.json({ cleaned, rateLimitBucketsRemoved }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log.error("preview.maintenance_failed", {}, e);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = run;
export const POST = run;
