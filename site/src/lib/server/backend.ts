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
}

export async function createUploadTargets(files: { kind: string; contentType: string }[]): Promise<{ batch: string; targets: UploadTarget[] }> {
  const batch = randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const sb = supabase();
  if (!sb && !devFallbackAllowed()) throw new BackendUnavailable("Storage is not configured");
  const targets = await Promise.all(
    files.map(async (f, i): Promise<UploadTarget> => {
      const p = `leads/${day}/${batch}/${f.kind}-${i + 1}.${EXT[f.contentType]}`;
      if (!sb) return { path: p, url: `/api/uploads/local?path=${encodeURIComponent(p)}`, method: "PUT", mode: "local" };
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(p);
      if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
      return { path: p, url: data.signedUrl, method: "PUT", mode: "supabase" };
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

export class DuplicateRequest extends Error {}

export async function insertLead(lead: LeadRow, photos: PhotoRow[]): Promise<string> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.from("leads").insert(lead).select("id").single();
    // Unique request_id: a concurrent retry of the same form attempt got there first.
    if (error?.code === "23505" && lead.request_id) throw new DuplicateRequest(lead.request_id);
    if (error || !data) throw new Error(`Lead insert failed: ${error?.message}`);
    if (photos.length) {
      const { error: pErr } = await sb.from("lead_photos").insert(photos.map((p) => ({ ...p, lead_id: data.id })));
      if (pErr) {
        // No half-saved leads: remove the parent row so the customer's retry starts clean.
        await sb.from("leads").delete().eq("id", data.id);
        throw new Error(`Lead photo insert failed: ${pErr.message}`);
      }
    }
    return data.id as string;
  }
  if (!devFallbackAllowed()) throw new BackendUnavailable("Database is not configured");
  const id = randomUUID();
  await fs.mkdir(path.join(DATA_DIR, "leads"), { recursive: true });
  await fs.writeFile(
    path.join(DATA_DIR, "leads", `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}.json`),
    JSON.stringify({ id, created_at: new Date().toISOString(), ...lead, photos }, null, 2),
  );
  if (lead.request_id) {
    await fs.mkdir(path.join(DATA_DIR, "requests"), { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, "requests", lead.request_id), id);
  }
  return id;
}
