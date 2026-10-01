import { NextResponse } from "next/server";
import { uploadPath } from "@/lib/leads/schema";
import { devFallbackAllowed, writeLocalUpload } from "@/lib/server/backend";

export const runtime = "nodejs";

/** Development-only stand-in for Supabase signed uploads. Writes to ./.data/uploads. */
export async function PUT(req: Request) {
  if (!devFallbackAllowed()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = new URL(req.url).searchParams.get("path") || "";
  if (!uploadPath.safeParse(p).success) return NextResponse.json({ error: "Bad path" }, { status: 400 });
  const body = await req.arrayBuffer();
  if (body.byteLength > 15 * 1024 * 1024) return NextResponse.json({ error: "Too large" }, { status: 413 });
  await writeLocalUpload(p, body);
  return NextResponse.json({ ok: true });
}
