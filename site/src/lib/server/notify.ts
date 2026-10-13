/**
 * Email notifications through Resend's HTTP API (no SDK needed).
 * Without RESEND_API_KEY the messages are logged instead, so local testing works.
 */
import { hasPlaceholder, site, siteReady } from "@/content/site";
import { fetchWithTimeout } from "./env";
import { log } from "./log";

export interface Mail {
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export async function sendMail(mail: Mail, idempotencyKey?: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_NOTIFY_FROM;
  if (!key || !from || !mail.to.length) {
    if (idempotencyKey) throw new Error("Lead email is not configured");
    // Development: show the email so the flow can be checked. Production: never log customer details.
    if (process.env.NODE_ENV !== "production")
      console.info("[notify] email not sent (Resend not configured)\n", JSON.stringify({ to: mail.to, subject: mail.subject, text: mail.text }, null, 2));
    else log.warn("notify.not_configured", { subject: mail.subject });
    return;
  }
  const res = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, reply_to: mail.replyTo }),
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}`);
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface TeamNotice {
  leadId: string;
  type: string;
  trade: string | null;
  fields: [string, string][];
  photos: { original: string | null; annotated: string | null; notes: string[] }[];
  replyTo?: string;
}

const TYPE_LABEL: Record<string, string> = {
  concept_preview: "Concept Preview request",
  visit: "Visit request",
  callback: "Callback request",
};

export function teamEmail(n: TeamNotice): Mail {
  const to = (process.env.LEAD_NOTIFY_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const subject = `${TYPE_LABEL[n.type] ?? "New lead"}${n.trade ? `: ${n.trade}` : ""}`;
  const lines = n.fields.map(([k, v]) => `${k}: ${v}`);
  const photoText = n.photos.map((p, i) =>
    [`Photo ${i + 1}`, p.annotated ? `  Marked up: ${p.annotated}` : "", p.original ? `  Original: ${p.original}` : "", ...p.notes.map((t) => `  ${t}`)].filter(Boolean).join("\n"),
  );
  const text = [subject, "", ...lines, "", ...photoText, "", `Lead id: ${n.leadId}`].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#1B2330;font-size:15px;line-height:22px">
<h2 style="margin:0 0 12px">${esc(subject)}</h2>
<table cellpadding="4" style="border-collapse:collapse">${n.fields.map(([k, v]) => `<tr><td style="font-weight:bold;vertical-align:top">${esc(k)}</td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>
${n.photos
  .map(
    (p, i) => `<h3 style="margin:20px 0 6px">Photo ${i + 1}</h3>
${p.annotated ? `<p><a href="${esc(p.annotated)}">Marked-up photo</a></p>` : ""}${p.original ? `<p><a href="${esc(p.original)}">Original photo</a></p>` : ""}
${p.notes.length ? `<ol>${p.notes.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}`,
  )
  .join("")}
<p style="margin-top:20px">Lead id: ${esc(n.leadId)}</p></div>`;
  return { to, subject, text, html, replyTo: n.replyTo };
}

export async function notifyTeam(n: TeamNotice) {
  await sendMail(teamEmail(n));
}

/**
 * Customer confirmation. Wording follows the brand voice and the 48-hour promise.
 * A sentence that still carries an owner placeholder ([HOURS], [YOUR NUMBER]) is left out,
 * so a customer never receives bracketed text.
 */
export function confirmationEmail(type: string, firstName: string) {
  const sentences =
    type === "concept_preview"
      ? ["Received. Your Concept Preview and estimate will arrive within 48 hours."]
      : type === "visit"
        ? ["Received. We will call you back to confirm a time for your visit."]
        : [
            "Received. The right person on our team will contact you.",
            siteReady.callbackTiming
              ? `We aim to reply within ${site.callback.responseTime} during ${site.callback.hours}.`
              : "We aim to reply as soon as possible during business hours.",
          ];
  const body = sentences.filter((x) => !hasPlaceholder(x)).join(" ");
  const callLine = hasPlaceholder(site.phone.display) ? null : `If anything changes, call us at ${site.phone.display}.`;
  const text = [`Hi ${firstName},`, body, callLine, `Solvern Home\n${site.tagline}`].filter(Boolean).join("\n\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#1B2330;font-size:16px;line-height:24px"><p>Hi ${esc(firstName)},</p><p>${esc(body)}</p>${callLine ? `<p>${esc(callLine)}</p>` : ""}<p><strong>Solvern Home</strong><br>${esc(site.tagline)}</p></div>`;
  const subject = type === "concept_preview" ? "Your Concept Preview request is in" : type === "visit" ? "Your visit request is in" : "Your callback request is in";
  return { subject, text, html };
}

export async function confirmCustomer(type: string, toEmail: string, firstName: string) {
  await sendMail({ to: [toEmail], ...confirmationEmail(type, firstName) });
}

/** Generated files remain private and are sent only to staff for review. */
export async function notifyPreviewReady(leadId: string, photoId: string, signedUrl: string | null) {
  const to = (process.env.LEAD_NOTIFY_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length) {
    log.warn("preview.review_inbox_missing", { leadId, photoId });
    return;
  }
  const subject = "Concept Preview ready for review";
  const text = [
    "Review the generated photo before sending anything to the customer.",
    `Lead id: ${leadId}`,
    `Photo id: ${photoId}`,
    signedUrl ? `Private review link (expires in 7 days): ${signedUrl}` : "Open the private storage record to review the image.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#1B2330"><p>Review the generated photo before sending anything to the customer.</p><p>Lead id: ${esc(leadId)}<br>Photo id: ${esc(photoId)}</p>${signedUrl ? `<p><a href="${esc(signedUrl)}">Private review link (expires in 7 days)</a></p>` : ""}</div>`;
  await sendMail({ to, subject, text, html });
}

export async function notifyPreviewAttention(leadId: string, photoId: string, status: "failed" | "uncertain", code: string) {
  const to = (process.env.LEAD_NOTIFY_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length) {
    log.warn("preview.review_inbox_missing", { leadId, photoId, status });
    return;
  }
  const subject = "Concept Preview needs manual attention";
  const text = [
    `Generation status: ${status}`,
    `Reason: ${code}`,
    `Lead id: ${leadId}`,
    `Photo id: ${photoId}`,
    "Please use the manual Concept Preview workflow to meet the customer promise.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#1B2330"><p>Generation status: ${esc(status)}<br>Reason: ${esc(code)}</p><p>Lead id: ${esc(leadId)}<br>Photo id: ${esc(photoId)}</p><p>Please use the manual Concept Preview workflow to meet the customer promise.</p></div>`;
  await sendMail({ to, subject, text, html });
}
