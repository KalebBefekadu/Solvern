"use client";

import { flattenToPng, serializeMarkup, serializeNotes, type MarkupPhoto } from "@/lib/markup";
import { readUtm } from "@/lib/analytics";
import { PHOTO_TYPES, type FieldErrors } from "./constants";

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
  token?: string;
  tusEndpoint?: string;
  bucket?: string;
}

async function resumablePut(t: Target, blob: Blob, onProgress?: (msg: string) => void) {
  const { Upload } = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(blob, {
      endpoint: t.tusEndpoint!,
      headers: { "x-signature": t.token!, "x-upsert": "false" },
      metadata: { bucketName: t.bucket!, objectName: t.path, contentType: blob.type || "application/octet-stream", cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      fingerprint: async () => `${t.path}:${blob.size}:${blob.type}`,
      onProgress: (uploaded, total) => onProgress?.(`Uploading your photos ${Math.round((uploaded / total) * 100)}%`),
      onError: () => reject(new SubmitError("A photo did not upload. Check your connection and try again.")),
      onSuccess: () => resolve(),
    });
    void upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
}

async function putFile(t: Target, blob: Blob, onProgress?: (msg: string) => void) {
  if (t.mode === "supabase" && blob.size > 6 * 1024 * 1024 && t.token && t.tusEndpoint && t.bucket) {
    await resumablePut(t, blob, onProgress);
    return;
  }
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

const okType = (t: string) => (PHOTO_TYPES as readonly string[]).includes(t);

/** Uploads only assets that changed, then returns complete records for the lead. */
export async function uploadPhotos(photos: MarkupPhoto[], onProgress?: (msg: string) => void, previous: Record<string, UploadedPhotoRecord> = {}, draftId?: string) {
  if (!photos.length) return [];
  onProgress?.("Preparing your photos");
  const prepared = await Promise.all(
    photos.map(async (p) => {
      const old = previous[p.id];
      const strokes = serializeMarkup(p);
      const sameDrawing = old && JSON.stringify(old.strokes) === JSON.stringify(strokes);
      return {
        photo: p,
        old,
        strokes,
        original: old ? null : p.file,
        originalType: okType(p.file.type) ? p.file.type : "image/jpeg",
        annotated: p.strokes.length && !sameDrawing ? await flattenToPng(p) : null,
        annotatedPath: p.strokes.length && sameDrawing ? old.annotatedPath : null,
      };
    }),
  );
  const files = prepared.flatMap((p) => [
    ...(p.original ? [{ kind: "original" as const, contentType: p.originalType, size: p.original.size }] : []),
    ...(p.annotated ? [{ kind: "annotated" as const, contentType: "image/png", size: p.annotated.size }] : []),
  ]);
  let targets: Target[] = [];
  if (files.length) {
    const res = await fetch("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files, draftId }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new SubmitError(data.error || "Photo upload is unavailable right now.");
    targets = data.targets;
  }

  onProgress?.("Uploading your photos");
  let i = 0;
  const records: UploadedPhotoRecord[] = [];
  for (const p of prepared) {
    const orig = p.original ? targets[i++] : null;
    if (orig && p.original) await putFile(orig, p.original, onProgress);
    let annotatedPath = p.annotatedPath;
    if (p.annotated) {
      const ann = targets[i++];
      await putFile(ann, p.annotated, onProgress);
      annotatedPath = ann.path;
    }
    records.push({ originalPath: orig?.path ?? p.old!.originalPath, annotatedPath, strokes: p.strokes, notes: serializeNotes(p.photo) });
  }
  return records;
}

export interface UploadedPhotoRecord {
  originalPath: string;
  annotatedPath: string | null;
  strokes: ReturnType<typeof serializeMarkup>;
  notes: ReturnType<typeof serializeNotes>;
}

export async function submitLead(payload: Record<string, unknown>) {
  const res = await fetch("/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, sourceUrl: window.location.pathname, utm: readUtm() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SubmitError(data.error || "Something went wrong. Please try again or call us.", data.fields || {});
  return data as { ok: true; id?: string };
}
