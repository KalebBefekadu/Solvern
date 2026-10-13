import { createHmac } from "node:crypto";
import type { LeadRow } from "./backend";
import { fetchWithTimeout } from "./env";

export interface LeadCreatedEvent {
  schemaVersion: 1;
  eventType: "lead.created";
  eventId: string;
  occurredAt: string;
  lead: {
    id: string;
    type: LeadRow["type"];
    tradeSlug: string | null;
    tradeName: string | null;
    name: string;
    phone: string;
    email: string;
    zip: string;
    message: string;
    preferredContact: string | null;
    existingJob: boolean;
    jobNumber: string | null;
    topic: string | null;
    sourceUrl: string;
    attribution: Record<string, string>;
    photoCount: number;
    status: "new";
  };
}

export function leadPlatformConfigured() {
  return !!process.env.LEAD_PLATFORM_WEBHOOK_URL?.trim() && !!process.env.LEAD_PLATFORM_WEBHOOK_SECRET?.trim();
}

export function leadCreatedEvent(leadId: string, lead: LeadRow, tradeName: string | null, photoCount: number, occurredAt = new Date().toISOString()): LeadCreatedEvent {
  return {
    schemaVersion: 1,
    eventType: "lead.created",
    eventId: `lead.created:${leadId}`,
    occurredAt,
    lead: {
      id: leadId,
      type: lead.type,
      tradeSlug: lead.trade_slug,
      tradeName,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      zip: lead.zip,
      message: lead.message,
      preferredContact: lead.preferred_contact,
      existingJob: lead.existing_job,
      jobNumber: lead.job_number,
      topic: lead.topic,
      sourceUrl: lead.source_url,
      attribution: lead.utm,
      photoCount,
      status: lead.status,
    },
  };
}

/**
 * Sends a versioned, signed event to the future lead-management platform.
 * This is deliberately best-effort: the lead is already durable before this runs,
 * and an integration outage must never turn into a failed customer submission.
 */
export async function notifyLeadPlatform(event: LeadCreatedEvent) {
  const url = process.env.LEAD_PLATFORM_WEBHOOK_URL?.trim();
  const secret = process.env.LEAD_PLATFORM_WEBHOOK_SECRET?.trim();
  if (!url || !secret) return { configured: false, delivered: false } as const;

  const body = JSON.stringify(event);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Solvern-Event": event.eventType,
        "X-Solvern-Event-Id": event.eventId,
        "X-Solvern-Signature": `sha256=${signature}`,
      },
      body,
    },
    5000,
  );

  if (!response.ok) throw new Error(`Lead platform returned ${response.status}`);
  return { configured: true, delivered: true } as const;
}
