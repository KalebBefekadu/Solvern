import { supabase, signedViewUrl, type LeadRow } from "./backend";
import { previewTarget } from "@/lib/content";
import { leadCreatedEvent, notifyLeadPlatform, type LeadCreatedEvent } from "./lead-platform";
import { confirmationEmail, sendMail, teamEmail, type Mail, type TeamNotice } from "./notify";
import { log } from "./log";

type JobKind = "team_email" | "customer_email" | "lead_webhook";
type Snapshot = { kind: "email"; mail: Mail } | { kind: "webhook"; event: LeadCreatedEvent };
interface Job {
  job_id: string;
  parent_lead_id: string;
  kind: JobKind;
  lease_id: string;
  frozen_payload: Snapshot | Record<string, never>;
  attempt_number: number;
}

function label(type: LeadRow["type"]) {
  return type === "concept_preview" ? "Concept Preview" : type === "visit" ? "Visit" : "Callback";
}

async function buildSnapshot(kind: JobKind, leadId: string): Promise<Snapshot> {
  const sb = supabase();
  if (!sb) throw new Error("Lead database unavailable");
  const { data: lead, error: leadError } = await sb.from("leads").select("*").eq("id", leadId).single();
  if (leadError || !lead) throw new Error(`Lead lookup failed: ${leadError?.message}`);
  const row = lead as LeadRow & { id: string; created_at: string };

  if (kind === "customer_email") {
    return { kind: "email", mail: { to: [row.email], ...confirmationEmail(row.type, row.name.split(/\s+/)[0]) } };
  }

  const { data: photos, error: photoError } = await sb.from("lead_photos").select("original_path,annotated_path,notes").eq("lead_id", leadId).order("created_at");
  if (photoError) throw new Error(`Lead photo lookup failed: ${photoError.message}`);
  const tradeName = row.trade_slug ? (previewTarget(row.trade_slug)?.name ?? row.trade_slug) : null;
  if (kind === "lead_webhook") {
    return { kind: "webhook", event: leadCreatedEvent(leadId, { ...row, status: "new" }, tradeName, photos?.length ?? 0, row.created_at) };
  }

  const fields: [string, string][] = [
    ["Request", label(row.type)],
    ...(tradeName ? ([["Trade", tradeName]] as [string, string][]) : []),
    ["Name", row.name],
    ["Phone", row.phone],
    ["Email", row.email],
    ["Zip", row.zip],
    ...(row.topic ? ([["Topic", row.topic]] as [string, string][]) : []),
    ...(row.job_number ? ([["Job number", row.job_number]] as [string, string][]) : []),
    ["Message", row.message],
    ["Source", row.source_url],
    ...Object.entries(row.utm ?? {}).map(([key, value]): [string, string] => [key, value]),
  ];
  const photoLinks: TeamNotice["photos"] = [];
  for (const photo of photos ?? []) {
    const original = await signedViewUrl(photo.original_path);
    const annotated = photo.annotated_path ? await signedViewUrl(photo.annotated_path) : null;
    if (!original || (photo.annotated_path && !annotated)) throw new Error("Private photo link unavailable");
    const notes = Array.isArray(photo.notes) ? (photo.notes as { n: number; text: string }[]).map((note) => `Note ${note.n}: ${note.text || "(no text)"}`) : [];
    photoLinks.push({ original, annotated, notes });
  }
  return { kind: "email", mail: teamEmail({ leadId, type: row.type, trade: tradeName, fields, photos: photoLinks, replyTo: row.email }) };
}

/** One bounded delivery per invocation. Cron can call again to drain the queue. */
export async function processNextLeadDelivery(): Promise<"idle" | "delivered" | "retry" | "failed"> {
  const sb = supabase();
  if (!sb) throw new Error("Lead database unavailable");
  const { data, error } = await sb.rpc("claim_lead_delivery").maybeSingle();
  if (error) throw new Error(`Lead delivery claim failed: ${error.message}`);
  if (!data) return "idle";
  const job = data as Job;
  try {
    let snapshot = job.frozen_payload as Snapshot;
    if (!snapshot?.kind) {
      snapshot = await buildSnapshot(job.kind, job.parent_lead_id);
      const { data: updated, error: freezeError } = await sb
        .from("lead_sync_outbox")
        .update({ payload: snapshot })
        .eq("id", job.job_id)
        .eq("lease_token", job.lease_id)
        .eq("state", "processing")
        .select("id")
        .maybeSingle();
      if (freezeError || !updated) throw new Error(`Delivery snapshot failed: ${freezeError?.message ?? "lease lost"}`);
    }
    if (snapshot.kind === "email") await sendMail(snapshot.mail, `lead-delivery/${job.job_id}`);
    else {
      const result = await notifyLeadPlatform(snapshot.event);
      if (!result.configured) throw new Error("Lead webhook is not configured");
    }
    const { data: finished, error: finishError } = await sb.rpc("finish_lead_delivery", { p_job_id: job.job_id, p_lease_id: job.lease_id, p_success: true, p_error: null });
    if (finishError || !finished) throw new Error(`Delivery completion failed: ${finishError?.message ?? "lease lost"}`);
    return "delivered";
  } catch (e) {
    log.error("lead.delivery_failed", { jobId: job.job_id, kind: job.kind, attempt: job.attempt_number }, e);
    const { data: finished, error: finishError } = await sb.rpc("finish_lead_delivery", {
      p_job_id: job.job_id,
      p_lease_id: job.lease_id,
      p_success: false,
      p_error: e instanceof Error ? e.message : "Delivery failed",
    });
    if (finishError || !finished) throw new Error(`Delivery failure could not be recorded: ${finishError?.message ?? "lease lost"}`);
    return job.attempt_number >= 5 ? "failed" : "retry";
  }
}
