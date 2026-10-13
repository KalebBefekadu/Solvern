import { NextResponse } from "next/server";
import { processNextPreviewJob } from "@/lib/server/preview-generation";
import { log } from "@/lib/server/log";
import { authorizedWorker } from "@/lib/server/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request) {
  if (!authorizedWorker(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (process.env.PREVIEW_GENERATION_ENABLED !== "true") return NextResponse.json({ status: "disabled" }, { headers: { "Cache-Control": "no-store" } });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Generation is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const status = await processNextPreviewJob();
    return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log.error("preview.worker_failed", {}, e);
    return NextResponse.json({ error: "Worker failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = run;
export const POST = run;
