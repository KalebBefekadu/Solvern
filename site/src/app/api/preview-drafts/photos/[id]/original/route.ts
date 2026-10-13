import { NextResponse } from "next/server";
import { readLocalUpload, signedViewUrl, supabase } from "@/lib/server/backend";
import { readDraft } from "@/lib/server/preview-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const draft = await readDraft(req);
  const { id } = await params;
  const photo = draft?.photos.find((item) => item.id === id);
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (supabase()) {
    const url = await signedViewUrl(photo.record.originalPath, 60);
    if (!url) return NextResponse.json({ error: "Photo unavailable" }, { status: 503 });
    return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
  }
  const bytes = await readLocalUpload(photo.record.originalPath);
  const ext = photo.record.originalPath.split(".").at(-1)?.toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "heic" ? "image/heic" : ext === "heif" ? "image/heif" : "image/jpeg";
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mime, "Cache-Control": "no-store" } });
}
