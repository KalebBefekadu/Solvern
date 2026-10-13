import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { photoSchema } from "@/lib/leads/schema";
import { MAX_PHOTOS } from "@/lib/leads/constants";
import { BackendUnavailable, devFallbackAllowed, readUploadedObject, supabase, uploadExists, writeValidatedObject } from "./backend";
import { HttpError } from "./http";
import { normalizeImage, type ImageKind } from "./normalize-image";

export const DRAFT_COOKIE = "solvern_preview_draft";
const DAYS = 7;
const LOCAL_DIR = path.join(process.cwd(), ".data", "preview-drafts");

type PhotoRecord = z.infer<typeof photoSchema>;
export interface SavedPhoto {
  id: string;
  position: number;
  record: PhotoRecord;
  savedAt: string;
}
export interface PreviewDraft {
  id: string;
  accessHash: string;
  sourcePath: string;
  revision: number;
  expiresAt: string;
  photos: SavedPhoto[];
  finalizedLeadId: string | null;
  lastMutation?: { id: string; digest: string } | null;
}

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

function cookieValue(req: Request): string | null {
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DRAFT_COOKIE}=`));
  return cookie ? cookie.slice(DRAFT_COOKIE.length + 1) : null;
}

async function readLocal(id: string): Promise<PreviewDraft | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, `${id}.json`), "utf8")) as PreviewDraft;
  } catch {
    return null;
  }
}

async function readById(id: string): Promise<PreviewDraft | null> {
  const sb = supabase();
  if (!sb) {
    if (!devFallbackAllowed()) throw new BackendUnavailable("Draft storage is not configured");
    return readLocal(id);
  }
  const { data, error } = await sb.from("preview_drafts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Draft lookup failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    accessHash: data.access_hash,
    sourcePath: data.source_path,
    revision: data.revision,
    expiresAt: data.expires_at,
    photos: data.photos,
    finalizedLeadId: data.finalized_lead_id,
    lastMutation: data.last_mutation,
  };
}

export async function readDraft(req: Request): Promise<PreviewDraft | null> {
  const value = cookieValue(req);
  if (!value) return null;
  const match = /^([0-9a-f-]{36})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return null;
  const draft = await readById(match[1]);
  if (!draft || draft.accessHash !== digest(match[2]) || Date.parse(draft.expiresAt) <= Date.now()) return null;
  return draft;
}

export async function createDraft(sourcePath: string): Promise<{ draft: PreviewDraft; cookie: string }> {
  const id = randomUUID();
  const secret = randomBytes(32).toString("hex");
  const draft: PreviewDraft = {
    id,
    accessHash: digest(secret),
    sourcePath,
    revision: 0,
    expiresAt: new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000).toISOString(),
    photos: [],
    finalizedLeadId: null,
    lastMutation: null,
  };
  const sb = supabase();
  if (sb) {
    const { error } = await sb.from("preview_drafts").insert({ id, access_hash: draft.accessHash, source_path: sourcePath, expires_at: draft.expiresAt });
    if (error) throw new Error(`Draft creation failed: ${error.message}`);
  } else {
    if (!devFallbackAllowed()) throw new BackendUnavailable("Draft storage is not configured");
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, `${id}.json`), JSON.stringify(draft), { flag: "wx" });
  }
  return { draft, cookie: `${id}.${secret}` };
}

const localLocks = new Map<string, Promise<void>>();

async function withLocalLock<T>(id: string, run: () => Promise<T>): Promise<T> {
  const previous = localLocks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = previous.then(() => gate);
  localLocks.set(id, current);
  await previous;
  try {
    return await run();
  } finally {
    release();
    if (localLocks.get(id) === current) localLocks.delete(id);
  }
}

function mutationDigest(operation: string, id: string, position?: number, record?: PhotoRecord): string {
  return createHash("sha256").update(JSON.stringify({ operation, id, position, record })).digest("hex");
}

async function validatedPath(rawPath: string, kind: ImageKind, mutationId: string, existingPath?: string | null): Promise<string> {
  if (existingPath === rawPath && rawPath.split("/").pop()?.startsWith(`clean-${kind}-`)) return rawPath;
  const filename = rawPath.split("/").pop() ?? "";
  if (!filename.startsWith(`${kind}-`) && !filename.startsWith(`clean-${kind}-`)) throw new HttpError(422, "This photo upload is invalid. Please upload it again.");
  const outputPath = `${rawPath.slice(0, rawPath.lastIndexOf("/"))}/clean-${kind}-${mutationId}.${kind === "annotated" ? "png" : "jpg"}`;
  if (await uploadExists(outputPath)) return outputPath;
  const image = await normalizeImage(await readUploadedObject(rawPath), filename, kind);
  await writeValidatedObject(outputPath, image.bytes, image.contentType);
  return outputPath;
}

async function repeatedMutation(draft: PreviewDraft, mutationId: string, fingerprint: string): Promise<PreviewDraft | null> {
  const current = await readById(draft.id);
  if (current?.lastMutation?.id !== mutationId) return null;
  if (current.lastMutation.digest !== fingerprint) throw new HttpError(409, "This save request was reused for different changes.");
  return current;
}

async function persistPhotos(draft: PreviewDraft, expectedRevision: number, photos: SavedPhoto[], mutationId: string, fingerprint: string): Promise<PreviewDraft> {
  const next = { ...draft, revision: expectedRevision + 1, photos, lastMutation: { id: mutationId, digest: fingerprint } };
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("preview_drafts")
      .update({ photos, revision: next.revision, last_mutation: next.lastMutation, updated_at: new Date().toISOString() })
      .eq("id", draft.id)
      .eq("revision", expectedRevision)
      .is("finalized_lead_id", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`Draft photo update failed: ${error.message}`);
    if (!data) return (await repeatedMutation(draft, mutationId, fingerprint)) ?? Promise.reject(new HttpError(409, "This photo changed in another tab. Reload and try again."));
  } else {
    return withLocalLock(draft.id, async () => {
      const current = await readLocal(draft.id);
      if (!current || current.revision !== expectedRevision || current.finalizedLeadId) {
        const repeat = await repeatedMutation(draft, mutationId, fingerprint);
        if (repeat) return repeat;
        throw new HttpError(409, "This photo changed in another tab. Reload and try again.");
      }
      await fs.writeFile(path.join(LOCAL_DIR, `${draft.id}.json`), JSON.stringify(next));
      return next;
    });
  }
  return next;
}

export async function saveDraftPhoto(draft: PreviewDraft, id: string, position: number, expectedRevision: number, record: PhotoRecord, mutationId: string): Promise<PreviewDraft> {
  const fingerprint = mutationDigest("save", id, position, record);
  const repeated = await repeatedMutation(draft, mutationId, fingerprint);
  if (repeated) return repeated;
  if (draft.finalizedLeadId) throw new HttpError(409, "This request has already been sent.");
  if (draft.revision !== expectedRevision) throw new HttpError(409, "This photo changed in another tab. Reload and try again.");
  if (record.notes.some((note) => !note.text.trim())) throw new HttpError(422, "Describe every mark before saving this photo.");
  const paths = [record.originalPath, record.annotatedPath].filter((value): value is string => !!value);
  if (paths.some((value) => !value.startsWith(`previews/${draft.id}/`))) throw new HttpError(403, "This photo does not belong to your request.");
  if (!(await Promise.all(paths.map(uploadExists))).every(Boolean)) throw new HttpError(400, "A photo did not finish uploading. Please try again.");
  const existing = draft.photos.find((photo) => photo.id === id);
  if (!existing && draft.photos.length >= MAX_PHOTOS) throw new HttpError(422, "You can add up to five photos.");
  if (draft.photos.some((photo) => photo.id !== id && (paths.includes(photo.record.originalPath) || (photo.record.annotatedPath && paths.includes(photo.record.annotatedPath))))) {
    throw new HttpError(400, "This photo was already saved to the request.");
  }
  const validatedRecord = supabase()
    ? {
        ...record,
        originalPath: await validatedPath(record.originalPath, "original", mutationId, existing?.record.originalPath),
        annotatedPath: record.annotatedPath ? await validatedPath(record.annotatedPath, "annotated", mutationId, existing?.record.annotatedPath) : null,
      }
    : record;
  const savedAt = new Date().toISOString();
  const photos = [...draft.photos.filter((photo) => photo.id !== id), { id, position, record: validatedRecord, savedAt }].sort((a, b) => a.position - b.position);
  return persistPhotos(draft, expectedRevision, photos, mutationId, fingerprint);
}

export async function deleteDraftPhoto(draft: PreviewDraft, id: string, expectedRevision: number, mutationId: string): Promise<PreviewDraft> {
  const fingerprint = mutationDigest("delete", id);
  const repeated = await repeatedMutation(draft, mutationId, fingerprint);
  if (repeated) return repeated;
  if (draft.finalizedLeadId) throw new HttpError(409, "This request has already been sent.");
  if (draft.revision !== expectedRevision) throw new HttpError(409, "This photo changed in another tab. Reload and try again.");
  if (!draft.photos.some((photo) => photo.id === id)) return draft;
  const photos = draft.photos.filter((photo) => photo.id !== id);
  return persistPhotos(draft, expectedRevision, photos, mutationId, fingerprint);
}

export async function markDraftFinalized(draft: PreviewDraft, leadId: string) {
  const sb = supabase();
  if (sb) {
    const { error } = await sb.from("preview_drafts").update({ finalized_lead_id: leadId }).eq("id", draft.id).is("finalized_lead_id", null);
    if (error) throw new Error(`Draft finalization failed: ${error.message}`);
  } else {
    await fs.writeFile(path.join(LOCAL_DIR, `${draft.id}.json`), JSON.stringify({ ...draft, finalizedLeadId: leadId }));
  }
}
