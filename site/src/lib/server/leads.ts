/**
 * Lead intake: turns a validated form payload into stored rows and notifications.
 * HTTP concerns (body limits, origin, rate limits) live in the route; this module is plain logic.
 */
import type { CallbackLead, PreviewLead } from "@/lib/leads/schema";
import { previewTarget } from "@/lib/content";
import { DuplicateRequest, findLeadByRequestId, insertLead, signedViewUrl, uploadExists, type LeadRow, type PhotoRow } from "./backend";
import { confirmCustomer, notifyTeam } from "./notify";
import { HttpError } from "./http";

const PREF_LABEL = { phone: "Phone call", text: "Text", email: "Email" } as const;
const EXISTING_LABEL = { yes: "Yes", no: "No", not_sure: "Not sure" } as const;

interface Prepared {
  lead: LeadRow;
  photos: PhotoRow[];
  tradeName: string | null;
  firstName: string;
  fields: [string, string][];
}

function utmLine(utm: Record<string, string>): [string, string][] {
  const entries = Object.entries(utm);
  return entries.length ? [["UTM", entries.map(([k, v]) => `${k}=${v}`).join(", ")]] : [];
}

export function prepareCallback(d: CallbackLead): Prepared {
  const name = `${d.firstName} ${d.lastName}`;
  const jobNumber = d.existingJob === "yes" && d.jobNumber ? d.jobNumber : null;
  return {
    tradeName: null,
    firstName: d.firstName,
    photos: [],
    lead: {
      type: "callback",
      trade_slug: null,
      name,
      phone: d.phone,
      email: d.email,
      zip: d.zip,
      message: d.message,
      preferred_contact: d.preferredContact,
      existing_job: d.existingJob === "yes",
      job_number: jobNumber,
      topic: d.topic,
      source_url: d.sourceUrl,
      utm: d.utm,
      status: "new",
      request_id: d.requestId ?? null,
    },
    fields: [
      ["Existing job", jobNumber ? `Yes, ${jobNumber}` : EXISTING_LABEL[d.existingJob]],
      ["Topic", d.topic],
      ["Name", name],
      ["Phone", d.phone],
      ["Email", d.email],
      ["Zip", d.zip],
      ["Preferred contact", PREF_LABEL[d.preferredContact]],
      ["Message", d.message],
      ["Source", d.sourceUrl],
      ...utmLine(d.utm),
    ],
  };
}

export async function preparePreview(d: PreviewLead): Promise<Prepared> {
  const target = previewTarget(d.tradeSlug);
  if (!target) throw new HttpError(422, "Choose a trade.", { tradeSlug: "Choose a trade." });

  // Every referenced upload must exist before the lead points at it.
  const paths = d.photos.flatMap((p) => [p.originalPath, p.annotatedPath].filter((x): x is string => !!x));
  if (new Set(paths).size !== paths.length) throw new HttpError(400, "A photo was sent twice. Please try again.");
  const exists = await Promise.all(paths.map(uploadExists));
  if (exists.includes(false)) throw new HttpError(400, "A photo did not finish uploading. Please try again.");

  return {
    tradeName: target.name,
    firstName: d.name.split(/\s+/)[0],
    photos: d.photos.map((p) => ({ original_path: p.originalPath, annotated_path: p.annotatedPath, strokes: p.strokes, notes: p.notes })),
    lead: {
      type: d.type,
      trade_slug: target.slug,
      name: d.name,
      phone: d.phone,
      email: d.email,
      zip: d.zip,
      message: d.message,
      preferred_contact: d.preferredContact ?? null,
      existing_job: false,
      job_number: null,
      topic: null,
      source_url: d.sourceUrl,
      utm: d.utm,
      status: "new",
      request_id: d.requestId ?? null,
    },
    fields: [
      ["Trade", target.name],
      [d.type === "visit" ? "What's happening" : "What they want", d.message],
      ["Name", d.name],
      ["Phone", d.phone],
      ["Email", d.email],
      ["Zip", d.zip],
      ["Photos", String(d.photos.length)],
      ["Source", d.sourceUrl],
      ...utmLine(d.utm),
    ],
  };
}

/**
 * Stores the lead, then sends both emails. A failed email never fails the customer's request.
 * A retry of a form attempt that was already stored returns the same id and sends nothing again.
 */
export async function createLead(data: CallbackLead | PreviewLead): Promise<string> {
  if (data.requestId) {
    const existing = await findLeadByRequestId(data.requestId);
    if (existing) return existing;
  }
  const p = data.type === "callback" ? prepareCallback(data) : await preparePreview(data);
  let leadId: string;
  try {
    leadId = await insertLead(p.lead, p.photos);
  } catch (e) {
    if (e instanceof DuplicateRequest && data.requestId) {
      const existing = await findLeadByRequestId(data.requestId);
      if (existing) return existing;
    }
    throw e;
  }

  const photoLinks = await Promise.all(
    p.photos.map(async (ph) => ({
      original: (await signedViewUrl(ph.original_path)) ?? ph.original_path,
      annotated: ph.annotated_path ? ((await signedViewUrl(ph.annotated_path)) ?? ph.annotated_path) : null,
      notes: (ph.notes as { n: number; text: string }[]).map((n) => `Note ${n.n}: ${n.text || "(no text)"}`),
    })),
  ).catch((e) => {
    console.error("[leads] signed links failed", e);
    return p.photos.map((ph) => ({ original: ph.original_path, annotated: ph.annotated_path, notes: [] as string[] }));
  });

  const results = await Promise.allSettled([
    notifyTeam({ leadId, type: p.lead.type, trade: p.tradeName, fields: p.fields, photos: photoLinks, replyTo: p.lead.email }),
    confirmCustomer(p.lead.type, p.lead.email, p.firstName),
  ]);
  for (const r of results) if (r.status === "rejected") console.error("[leads] notification failed", leadId, r.reason);
  return leadId;
}
