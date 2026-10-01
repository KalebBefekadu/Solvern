import { NextResponse } from "next/server";
import { uploadPath } from "@/lib/leads/schema";
import { MAX_PHOTO_BYTES } from "@/lib/leads/constants";
import { devFallbackAllowed, writeLocalUpload } from "@/lib/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Development-only stand-in for Supabase signed uploads. Writes to ./.data/uploads. */
export async function PUT(req: Request) {
  if (!devFallbackAllowed()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = new URL(req.url).searchParams.get("path") || "";
  if (!uploadPath.safeParse(p).success) return NextResponse.json({ error: "Bad path" }, { status: 400 });
  if (Number(req.headers.get("content-length") || 0) > MAX_PHOTO_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_PHOTO_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  await writeLocalUpload(p, body);
  return NextResponse.json({ ok: true });
}
