import { NextResponse } from "next/server";
import { uploadRequestSchema } from "@/lib/leads/schema";
import { BackendUnavailable, createUploadTargets } from "@/lib/server/backend";

export const runtime = "nodejs";

/** Returns one signed upload target per file. Browsers upload straight to storage, so photos never pass through the function body limit. */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const parsed = uploadRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Those files can't be uploaded. Use JPG or PNG photos up to 15 MB." }, { status: 400 });
  try {
    const result = await createUploadTargets(parsed.data.files);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[uploads]", e);
    const status = e instanceof BackendUnavailable ? 503 : 500;
    return NextResponse.json({ error: "Photo upload is unavailable right now. Please call us instead." }, { status });
  }
}
