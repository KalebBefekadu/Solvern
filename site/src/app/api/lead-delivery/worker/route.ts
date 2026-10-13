import { NextResponse } from "next/server";
import { authorizedWorker } from "@/lib/server/worker-auth";
import { processNextLeadDelivery } from "@/lib/server/lead-delivery";
import { log } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  if (!authorizedWorker(req, process.env.OUTBOX_WORKER_SECRET || process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Lead database is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const results = { delivered: 0, retry: 0, failed: 0 };
    for (let index = 0; index < 10; index += 1) {
      const status = await processNextLeadDelivery();
      if (status === "idle") break;
      results[status] += 1;
    }
    return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log.error("lead.delivery_worker_failed", {}, e);
    return NextResponse.json({ error: "Delivery worker failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = run;
export const POST = run;
