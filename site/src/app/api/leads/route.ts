import { log } from "@/lib/server/log";
import { NextResponse } from "next/server";
import { callbackLeadSchema, flattenErrors, previewLeadSchema } from "@/lib/leads/schema";
import { BackendUnavailable } from "@/lib/server/backend";
import { assertSameOrigin, clientIp, errorResponse, HttpError, readJson } from "@/lib/server/http";
import { createLead } from "@/lib/server/leads";
import { rateLimitDistributed } from "@/lib/server/rate-limit";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { markDraftFinalized, readDraft } from "@/lib/server/preview-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per address: enough for a family sharing a connection, low enough to blunt a script. */
const LIMIT = { count: 8, windowMs: 10 * 60 * 1000 };

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = clientIp(req);
    const rl = await rateLimitDistributed(`leads:${ip ?? "unknown"}`, LIMIT.count, LIMIT.windowMs);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests from this connection. Please wait a few minutes or call us." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter), "Cache-Control": "no-store" } },
      );
    }

    const json = (await readJson(req)) as Record<string, unknown> | null;
    const schema = json?.type === "callback" ? callbackLeadSchema : previewLeadSchema;
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new HttpError(422, "Please check the highlighted fields.", flattenErrors(parsed.error));
    const data = parsed.data;

    // Honeypot: pretend success so bots learn nothing.
    if (data.company) return NextResponse.json({ ok: true });

    if (!(await verifyTurnstile(data.turnstileToken, ip))) {
      throw new HttpError(400, "We could not confirm you are a person. Please try again, or call us.");
    }

    const draft = data.type !== "callback" && data.draftId ? await readDraft(req) : null;
    if (data.type !== "callback" && data.draftId && (!draft || draft.id !== data.draftId)) throw new HttpError(401, "Your photo session expired. Please reload and try again.");
    if (draft?.finalizedLeadId) return NextResponse.json({ ok: true, id: draft.finalizedLeadId }, { headers: { "Cache-Control": "no-store" } });
    let payload = data;
    if (data.type !== "callback" && draft) {
      const ids = data.photoIds ?? draft.photos.map((photo) => photo.id);
      if (new Set(ids).size !== ids.length || ids.some((id) => !draft.photos.some((photo) => photo.id === id))) {
        throw new HttpError(422, "Save every selected photo before sending your request.");
      }
      payload = { ...data, photos: ids.map((id) => draft.photos.find((photo) => photo.id === id)!.record) };
    }
    const id = await createLead(payload, draft?.id);
    if (draft) await markDraftFinalized(draft, id);
    log.info("lead.stored", { id, type: data.type });
    return NextResponse.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e);
    log.error("lead.failed", {}, e);
    return errorResponse(new HttpError(e instanceof BackendUnavailable ? 503 : 500, "Something went wrong on our side. Please call us and we will take it from here."));
  }
}
