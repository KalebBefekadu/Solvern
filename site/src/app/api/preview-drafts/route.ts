import { NextResponse } from "next/server";
import { createDraft, DRAFT_COOKIE, readDraft } from "@/lib/server/preview-drafts";
import { assertSameOrigin, clientIp, errorResponse, HttpError, readJson } from "@/lib/server/http";
import { BackendUnavailable } from "@/lib/server/backend";
import { rateLimitDistributed } from "@/lib/server/rate-limit";
import { z } from "zod";
import { verifyTurnstile } from "@/lib/server/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const draft = await readDraft(req);
    // A first-time visitor has no draft. An empty response is an expected state,
    // so the browser should not log a failed network request.
    if (!draft) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(
      { id: draft.id, sourcePath: draft.sourcePath, revision: draft.revision, photos: draft.photos, finalized: !!draft.finalizedLeadId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e instanceof HttpError ? e : new HttpError(e instanceof BackendUnavailable ? 503 : 500, "Saved photos are unavailable right now."));
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const limit = await rateLimitDistributed(`preview-drafts:${clientIp(req) ?? "unknown"}`, 12, 10 * 60 * 1000);
    if (!limit.ok) throw new HttpError(429, "Please wait a few minutes before starting another request.");
    const parsed = z.object({ sourcePath: z.string().regex(/^\/[a-z-]{0,50}$/), turnstileToken: z.string().max(4096).optional().default("") }).safeParse(await readJson(req, 8192));
    if (!parsed.success) throw new HttpError(400, "Bad photo request");
    const existing = await readDraft(req);
    if (existing && !existing.finalizedLeadId && existing.sourcePath === parsed.data.sourcePath)
      return NextResponse.json({ id: existing.id, revision: existing.revision, photos: existing.photos }, { headers: { "Cache-Control": "no-store" } });
    if (!(await verifyTurnstile(parsed.data.turnstileToken, clientIp(req)))) {
      throw new HttpError(400, "We could not confirm you are a person. Please try again before saving your photo.");
    }
    const { draft, cookie } = await createDraft(parsed.data.sourcePath);
    const response = NextResponse.json({ id: draft.id, revision: 0, photos: [] }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(DRAFT_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api", maxAge: 7 * 24 * 60 * 60 });
    return response;
  } catch (e) {
    return errorResponse(e instanceof HttpError ? e : new HttpError(e instanceof BackendUnavailable ? 503 : 500, "Photo saving is unavailable right now."));
  }
}
