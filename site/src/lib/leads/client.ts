"use client";

import { flattenToPng, serializeMarkup, serializeNotes, type MarkupPhoto } from "@/lib/markup";
import { readUtm } from "@/lib/analytics";
import type { FieldErrors } from "./constants";

export class SubmitError extends Error {
  constructor(
    message: string,
    public fields: FieldErrors = {},
  ) {
    super(message);
  }
}

interface Target {
  path: string;
  url: string;
  method: "PUT";
  mode: "supabase" | "local";
}

async function putFile(t: Target, blob: Blob) {
  let res: Response;
  if (t.mode === "supabase") {
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", blob);
    res = await fetch(t.url, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
  } else {
    res = await fetch(t.url, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } });
  }
  if (!res.ok) throw new SubmitError("A photo did not upload. Check your connection and try again.");
}

const okType = (t: string) => ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(t);

/** Flattens each marked-up photo, uploads originals and annotated PNGs, and returns the photo records for the lead. */
export async function uploadPhotos(photos: MarkupPhoto[], onProgress?: (msg: string) => void) {
  if (!photos.length) return [];
  onProgress?.("Preparing your photos");
  const prepared = await Promise.all(
    photos.map(async (p) => ({
      photo: p,
      original: p.file,
      originalType: okType(p.file.type) ? p.file.type : "image/jpeg",
      annotated: p.strokes.length ? await flattenToPng(p) : null,
    })),
  );
  const files = prepared.flatMap((p) => [
    { kind: "original" as const, contentType: p.originalType, size: p.original.size },
    ...(p.annotated ? [{ kind: "annotated" as const, contentType: "image/png", size: p.annotated.size }] : []),
  ]);
  const res = await fetch("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SubmitError(data.error || "Photo upload is unavailable right now.");
  const targets: Target[] = data.targets;

  onProgress?.("Uploading your photos");
  let i = 0;
  const records = [];
  for (const p of prepared) {
    const orig = targets[i++];
    await putFile(orig, p.original);
    let annotatedPath: string | null = null;
    if (p.annotated) {
      const ann = targets[i++];
      await putFile(ann, p.annotated);
      annotatedPath = ann.path;
    }
    records.push({ originalPath: orig.path, annotatedPath, strokes: serializeMarkup(p.photo), notes: serializeNotes(p.photo) });
  }
  return records;
}

export async function submitLead(payload: Record<string, unknown>) {
  const res = await fetch("/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, sourceUrl: window.location.href.slice(0, 500), utm: readUtm() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SubmitError(data.error || "Something went wrong. Please try again or call us.", data.fields || {});
  return data as { ok: true; id?: string };
}
