import { log } from "@/lib/server/log";
import { NextResponse } from "next/server";
import { uploadRequestSchema } from "@/lib/leads/schema";
import { BackendUnavailable, createUploadTargets } from "@/lib/server/backend";
import { assertSameOrigin, clientIp, errorResponse, HttpError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { count: 20, windowMs: 10 * 60 * 1000 };

/** Returns one signed upload target per file. Browsers upload straight to storage, so photos never pass through the function body limit. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const rl = rateLimit(`uploads:${clientIp(req) ?? "unknown"}`, LIMIT.count, LIMIT.windowMs);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many uploads from this connection. Please wait a few minutes or call us." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter), "Cache-Control": "no-store" } },
      );
    }
    const parsed = uploadRequestSchema.safeParse(await readJson(req, 16 * 1024));
    if (!parsed.success) throw new HttpError(400, "Those files can't be uploaded. Use JPG or PNG photos up to 15 MB.");
    const result = await createUploadTargets(parsed.data.files);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e);
    log.error("uploads.failed", {}, e);
    return errorResponse(new HttpError(e instanceof BackendUnavailable ? 503 : 500, "Photo upload is unavailable right now. Please call us instead."));
  }
}
