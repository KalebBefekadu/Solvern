import { Buffer } from "node:buffer";
import { log } from "./log";
import { signedViewUrl, supabase } from "./backend";
import { notifyPreviewAttention, notifyPreviewReady } from "./notify";

const BUCKET = process.env.SUPABASE_BUCKET || "lead-uploads";
const MODEL = "gpt-image-2.5-sunburst";

type Job = { job_id: string; lease_id: string; photo_id: string; parent_lead_id: string; attempt_number: number };
type Photo = { original_path: string; annotated_path: string | null; notes: unknown };

export class PreviewProviderError extends Error {
  constructor(
    public kind: "retryable" | "failed" | "uncertain",
    public code: string,
  ) {
    super(code);
  }
}

export function previewPrompt(notes: unknown, projectGoal = ""): string {
  const rows = Array.isArray(notes) ? notes : [];
  const instructions = rows
    .filter((row): row is { n: number; pen: string; text: string } => typeof row?.n === "number" && typeof row?.pen === "string" && typeof row?.text === "string")
    .sort((a, b) => a.n - b.n)
    .map((row) => `${row.n}. ${row.pen} mark: ${row.text.trim()}`)
    .filter((row) => row.length <= 550);
  return [
    "Edit the supplied photograph into a realistic home improvement concept preview.",
    "Preserve camera angle, room geometry, dimensions, lighting direction, and all areas outside the requested changes.",
    "The second reference, when present, is a markup guide only. Remove its colored marks and labels from the result.",
    "Apply only the customer's numbered requests. Do not invent structural changes or additional rooms.",
    "If a request is ambiguous, leave that area unchanged for human review.",
    `Overall project goal: ${projectGoal.trim().slice(0, 2000) || "Not specified"}`,
    "Customer requests:",
    ...(instructions.length ? instructions : ["No marked changes were specified. Use the overall project goal, and preserve unrelated areas."]),
  ].join("\n");
}

async function editImage(photo: Photo, projectGoal: string): Promise<Buffer> {
  const sb = supabase();
  const key = process.env.OPENAI_API_KEY;
  if (!sb || !key) throw new PreviewProviderError("failed", "configuration_missing");
  const paths = [photo.original_path, photo.annotated_path].filter((path): path is string => !!path);
  const form = new FormData();
  form.set("model", MODEL);
  form.set("prompt", previewPrompt(photo.notes, projectGoal));
  form.set("quality", "medium");
  form.set("size", "auto");
  form.set("output_format", "webp");
  for (const [index, path] of paths.entries()) {
    const mime = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : null;
    if (!mime) throw new PreviewProviderError("failed", "unsupported_input_type");
    const { data, error } = await sb.storage.from(BUCKET).download(path);
    if (error || !data) throw new PreviewProviderError("retryable", "input_download_failed");
    form.append("image[]", new Blob([await data.arrayBuffer()], { type: mime }), `reference-${index}.${mime.slice(6)}`);
  }
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(240_000),
    });
  } catch {
    // A timed-out request may still have generated an image and incurred cost.
    throw new PreviewProviderError("uncertain", "provider_outcome_unknown");
  }
  if (response.status === 429 || response.status >= 500) throw new PreviewProviderError("retryable", `provider_${response.status}`);
  if (!response.ok) throw new PreviewProviderError("failed", `provider_${response.status}`);
  let payload: { data?: { b64_json?: string }[] };
  try {
    payload = await response.json();
  } catch {
    throw new PreviewProviderError("uncertain", "provider_response_invalid");
  }
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) throw new PreviewProviderError("uncertain", "provider_result_missing");
  const result = Buffer.from(encoded, "base64");
  if (result.length < 12 || result.length > 25 * 1024 * 1024 || result.toString("ascii", 0, 4) !== "RIFF" || result.toString("ascii", 8, 12) !== "WEBP") {
    throw new PreviewProviderError("failed", "provider_result_invalid");
  }
  return result;
}

async function finish(job: Job, status: "ready" | "failed" | "uncertain" | "queued", outputPath: string | null, errorCode: string | null): Promise<boolean> {
  const sb = supabase();
  if (!sb) throw new Error("Preview database unavailable");
  const { data, error } = await sb.rpc("finish_preview_generation_job", {
    p_job_id: job.job_id,
    p_lease_id: job.lease_id,
    p_status: status,
    p_output_path: outputPath,
    p_error_code: errorCode,
  });
  if (error) throw new Error(`Could not finish preview job: ${error.message}`);
  return data === true;
}

/** Claims at most one immutable submitted photo. Calls never run during drawing. */
export async function processNextPreviewJob(): Promise<"idle" | "ready" | "queued" | "failed" | "uncertain"> {
  const sb = supabase();
  if (!sb) throw new Error("Preview database unavailable");
  const { data, error } = await sb.rpc("claim_preview_generation_job");
  if (error) throw new Error(`Could not claim preview job: ${error.message}`);
  const job = (data as Job[] | null)?.[0];
  if (!job) return "idle";

  let result: Buffer;
  try {
    const { data: photo, error: photoError } = await sb
      .from("lead_photos")
      .select("original_path,annotated_path,notes")
      .eq("id", job.photo_id)
      .eq("lead_id", job.parent_lead_id)
      .single();
    if (photoError || !photo) throw new PreviewProviderError("failed", "photo_missing");
    const { data: lead, error: leadError } = await sb.from("leads").select("message,trade_slug").eq("id", job.parent_lead_id).single();
    if (leadError || !lead) throw new PreviewProviderError("failed", "lead_missing");
    result = await editImage(photo as Photo, `${lead.trade_slug ?? "Home improvement"}: ${lead.message}`);
  } catch (e) {
    const failure = e instanceof PreviewProviderError ? e : new PreviewProviderError("uncertain", "worker_error");
    const status = failure.kind === "retryable" ? (job.attempt_number >= 3 ? "failed" : "queued") : failure.kind;
    await finish(job, status, null, failure.code);
    log.warn("preview.generation_failed", { jobId: job.job_id, status, code: failure.code });
    if (status === "failed" || status === "uncertain") {
      await notifyPreviewAttention(job.parent_lead_id, job.photo_id, status, failure.code).catch((error) =>
        log.error("preview.review_notification_failed", { jobId: job.job_id }, error),
      );
    }
    return status;
  }

  const outputPath = `generated/${job.parent_lead_id}/${job.photo_id}/${job.job_id}.webp`;
  const { error: uploadError } = await sb.storage.from(BUCKET).upload(outputPath, result, { contentType: "image/webp", upsert: false });
  if (uploadError) {
    await finish(job, "uncertain", null, "output_upload_failed");
    log.error("preview.output_upload_failed", { jobId: job.job_id }, uploadError);
    await notifyPreviewAttention(job.parent_lead_id, job.photo_id, "uncertain", "output_upload_failed").catch((error) =>
      log.error("preview.review_notification_failed", { jobId: job.job_id }, error),
    );
    return "uncertain";
  }
  const committed = await finish(job, "ready", outputPath, null);
  if (!committed) {
    log.error("preview.lease_lost", { jobId: job.job_id, outputPath });
    await notifyPreviewAttention(job.parent_lead_id, job.photo_id, "uncertain", "lease_lost").catch((error) =>
      log.error("preview.review_notification_failed", { jobId: job.job_id }, error),
    );
    return "uncertain";
  }
  const url = await signedViewUrl(outputPath);
  await notifyPreviewReady(job.parent_lead_id, job.photo_id, url).catch((e) => log.error("preview.review_notification_failed", { jobId: job.job_id }, e));
  return "ready";
}
