/**
 * Server-only storage for leads and uploads.
 * - Production: Supabase (table `leads`, `lead_photos`, private bucket `lead-uploads`). See supabase/migrations.
 * - Development without Supabase env: JSON and files under ./.data so the whole flow can be tested locally.
 * Never import this file from a client component.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const BUCKET = process.env.SUPABASE_BUCKET || "lead-uploads";

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Local ./.data storage: always in development, in production only when explicitly allowed (end to end tests). */
export const devFallbackAllowed = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_LEAD_STORE === "true";

export class BackendUnavailable extends Error {}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export interface UploadTarget {
  path: string;
  url: string;
  method: "PUT";
  /** "supabase": send multipart (cacheControl + file). "local": send the raw file body. */
  mode: "supabase" | "local";
  token?: string;
  tusEndpoint?: string;
  bucket?: string;
}

function tusEndpoint(): string {
  const url = new URL(process.env.SUPABASE_URL!);
  if (url.hostname.endsWith(".supabase.co") && !url.hostname.endsWith(".storage.supabase.co")) {
    url.hostname = url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  return `${url.origin}/storage/v1/upload/resumable`;
}

export async function createUploadTargets(files: { kind: string; contentType: string; size: number }[], draftId?: string): Promise<{ batch: string; targets: UploadTarget[] }> {
  const batch = randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const sb = supabase();
  if (!sb && !devFallbackAllowed()) throw new BackendUnavailable("Storage is not configured");
  const targets = await Promise.all(
    files.map(async (f, i): Promise<UploadTarget> => {
      const p = draftId ? `previews/${draftId}/${batch}/${f.kind}-${i + 1}.${EXT[f.contentType]}` : `leads/${day}/${batch}/${f.kind}-${i + 1}.${EXT[f.contentType]}`;
      if (!sb) return { path: p, url: `/api/uploads/local?path=${encodeURIComponent(p)}`, method: "PUT", mode: "local" };
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(p);
      if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
      return { path: p, url: data.signedUrl, method: "PUT", mode: "supabase", token: data.token, tusEndpoint: tusEndpoint(), bucket: BUCKET };
    }),
  );
  return { batch, targets };
}

export async function writeLocalUpload(p: string, body: ArrayBuffer) {
  const root = path.join(DATA_DIR, "uploads");
  const full = path.join(root, p);
  if (!full.startsWith(root + path.sep)) throw new Error("Bad path");
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, Buffer.from(body));
}

/** Confirms an uploaded object exists before the lead references it. */
export async function uploadExists(p: string): Promise<boolean> {
  const sb = supabase();
  if (sb) {
    const dir = p.slice(0, p.lastIndexOf("/"));
    const name = p.slice(p.lastIndexOf("/") + 1);
    const { data } = await sb.storage.from(BUCKET).list(dir, { search: name, limit: 1 });
    return !!data?.some((o) => o.name === name);
  }
  try {
    await fs.access(path.join(DATA_DIR, "uploads", p));
    return true;
  } catch {
    return false;
  }
}

/** Reads a private upload only for a caller whose route has already checked draft ownership. */
export async function readLocalUpload(p: string): Promise<Buffer> {
  if (!devFallbackAllowed()) throw new BackendUnavailable("Local storage is not configured");
  const root = path.join(DATA_DIR, "uploads");
  const full = path.join(root, p);
  if (!full.startsWith(root + path.sep)) throw new Error("Bad path");
  return fs.readFile(full);
}

/** Read an uploaded object for validation before it can be referenced by a draft. */
export async function readUploadedObject(p: string): Promise<Buffer> {
  const sb = supabase();
  if (!sb) return readLocalUpload(p);
  const { data, error } = await sb.storage.from(BUCKET).download(p);
  if (error || !data) throw new Error(`Could not read uploaded photo: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Only the server writes normalized objects; upload targets never point to this path. */
export async function writeValidatedObject(p: string, bytes: Buffer, contentType: string): Promise<void> {
  const sb = supabase();
  if (!sb) {
    await writeLocalUpload(p, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    return;
  }
  const { error } = await sb.storage.from(BUCKET).upload(p, bytes, { contentType, upsert: false, cacheControl: "3600" });
  if (error) throw new Error(`Could not save validated photo: ${error.message}`);
}

/** Short-lived links for the team notification email (private bucket). */
export async function signedViewUrl(p: string, seconds = 60 * 60 * 24 * 7): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(p, seconds);
  return data?.signedUrl ?? null;
}

export interface LeadRow {
  type: "concept_preview" | "visit" | "callback";
  trade_slug: string | null;
  name: string;
  phone: string;
  email: string;
  zip: string;
  message: string;
  preferred_contact: string | null;
  existing_job: boolean;
  job_number: string | null;
  topic: string | null;
  source_url: string;
  utm: Record<string, string>;
  status: "new";
  request_id: string | null;
  preview_draft_id?: string | null;
}

export interface PhotoRow {
  original_path: string;
  annotated_path: string | null;
  strokes: unknown;
  notes: unknown;
}

/** The lead already stored for this form attempt, if any. */
export async function findLeadByRequestId(requestId: string): Promise<string | null> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.from("leads").select("id").eq("request_id", requestId).maybeSingle();
    if (error) throw new Error(`Lead lookup failed: ${error.message}`);
    return (data?.id as string | undefined) ?? null;
  }
  if (!devFallbackAllowed()) throw new BackendUnavailable("Database is not configured");
  try {
    return (await fs.readFile(path.join(DATA_DIR, "requests", requestId), "utf8")).trim() || null;
  } catch {
    return null;
  }
}

const localDraftLocks = new Map<string, Promise<void>>();

async function withLocalDraftLock<T>(id: string, run: () => Promise<T>): Promise<T> {
  const previous = localDraftLocks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = previous.then(() => gate);
  localDraftLocks.set(id, current);
  await previous;
  try {
    return await run();
  } finally {
    release();
    if (localDraftLocks.get(id) === current) localDraftLocks.delete(id);
  }
}

export async function insertLead(lead: LeadRow, photos: PhotoRow[]): Promise<{ id: string; inserted: boolean }> {
  const sb = supabase();
  if (sb) {
    const queueGeneration =
      process.env.PREVIEW_GENERATION_ENABLED === "true" &&
      !!process.env.OPENAI_API_KEY &&
      !!(process.env.PREVIEW_WORKER_SECRET || process.env.CRON_SECRET) &&
      !!process.env.LEAD_NOTIFY_TO &&
      !!lead.preview_draft_id &&
      lead.type === "concept_preview";
    const { data, error } = await sb.rpc("insert_lead_atomic", { p_lead: { ...lead, queue_generation: queueGeneration }, p_photos: photos }).single();
    if (error || !data) throw new Error(`Atomic lead insert failed: ${error?.message}`);
    const result = data as { lead_id: string; inserted: boolean };
    return { id: result.lead_id, inserted: result.inserted };
  }
  if (!devFallbackAllowed()) throw new BackendUnavailable("Database is not configured");
  const write = async () => {
    const leadsDir = path.join(DATA_DIR, "leads");
    await fs.mkdir(leadsDir, { recursive: true });
    if (lead.preview_draft_id) {
      for (const file of await fs.readdir(leadsDir)) {
        const existing = JSON.parse(await fs.readFile(path.join(leadsDir, file), "utf8")) as { id: string; preview_draft_id?: string };
        if (existing.preview_draft_id === lead.preview_draft_id) return { id: existing.id, inserted: false };
      }
    }
    const id = randomUUID();
    await fs.writeFile(
      path.join(leadsDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}.json`),
      JSON.stringify({ id, created_at: new Date().toISOString(), ...lead, photos }, null, 2),
    );
    if (lead.request_id) {
      await fs.mkdir(path.join(DATA_DIR, "requests"), { recursive: true });
      await fs.writeFile(path.join(DATA_DIR, "requests", lead.request_id), id);
    }
    return { id, inserted: true };
  };
  return lead.preview_draft_id ? withLocalDraftLock(lead.preview_draft_id, write) : write();
}
