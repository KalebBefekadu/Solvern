import { NextResponse } from "next/server";
import { z } from "zod";
import { photoSchema } from "@/lib/leads/schema";
import { BackendUnavailable } from "@/lib/server/backend";
import { assertSameOrigin, errorResponse, HttpError, readJson } from "@/lib/server/http";
import { deleteDraftPhoto, readDraft, saveDraftPhoto } from "@/lib/server/preview-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(0).max(4),
  expectedRevision: z.number().int().nonnegative(),
  mutationId: z.string().uuid(),
  record: photoSchema,
});

export async function PUT(req: Request) {
  try {
    assertSameOrigin(req);
    const draft = await readDraft(req);
    if (!draft) throw new HttpError(401, "Your photo session expired. Please reload and try again.");
    const parsed = saveSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(422, "This photo could not be saved. Please check its notes.");
    const { id, position, expectedRevision, record, mutationId } = parsed.data;
    const next = await saveDraftPhoto(draft, id, position, expectedRevision, record, mutationId);
    const saved = next.photos.find((photo) => photo.id === id);
    return NextResponse.json({ id, revision: next.revision, savedAt: saved?.savedAt, record: saved?.record }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e instanceof HttpError ? e : new HttpError(e instanceof BackendUnavailable ? 503 : 500, "This photo could not be saved. Please try again."));
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const draft = await readDraft(req);
    if (!draft) throw new HttpError(401, "Your photo session expired. Please reload and try again.");
    const parsed = z.object({ id: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), mutationId: z.string().uuid() }).safeParse(await readJson(req, 256));
    if (!parsed.success) throw new HttpError(400, "Bad photo request");
    const next = await deleteDraftPhoto(draft, parsed.data.id, parsed.data.expectedRevision, parsed.data.mutationId);
    return NextResponse.json({ id: parsed.data.id, revision: next.revision }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e instanceof HttpError ? e : new HttpError(e instanceof BackendUnavailable ? 503 : 500, "This photo could not be removed. Please try again."));
  }
}
