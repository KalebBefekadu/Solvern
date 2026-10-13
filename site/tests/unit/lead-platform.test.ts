import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leadCreatedEvent, notifyLeadPlatform } from "@/lib/server/lead-platform";
import type { LeadRow } from "@/lib/server/backend";

const lead: LeadRow = {
  type: "concept_preview",
  trade_slug: "painting",
  name: "Dana Smith",
  phone: "404-555-0100",
  email: "dana@example.com",
  zip: "30305",
  message: "Paint the living room.",
  preferred_contact: "text",
  existing_job: false,
  job_number: null,
  topic: null,
  source_url: "/painting?utm_source=search",
  utm: { utm_source: "search" },
  status: "new",
  request_id: null,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("lead platform connector", () => {
  it("does nothing when the connector is not configured", async () => {
    expect(await notifyLeadPlatform(leadCreatedEvent("lead-1", lead, "Painting", 2))).toEqual({ configured: false, delivered: false });
  });

  it("posts a versioned event with a valid HMAC signature", async () => {
    vi.stubEnv("LEAD_PLATFORM_WEBHOOK_URL", "https://leads.example.test/events");
    vi.stubEnv("LEAD_PLATFORM_WEBHOOK_SECRET", "test-secret");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const event = leadCreatedEvent("lead-1", lead, "Painting", 2);
    await expect(notifyLeadPlatform(event)).resolves.toEqual({ configured: true, delivered: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://leads.example.test/events");
    const body = init.body as string;
    const signature = createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(init.headers).toMatchObject({
      "X-Solvern-Event": "lead.created",
      "X-Solvern-Event-Id": "lead.created:lead-1",
      "X-Solvern-Signature": `sha256=${signature}`,
    });
    expect(JSON.parse(body)).toMatchObject({ schemaVersion: 1, lead: { id: "lead-1", photoCount: 2 } });
  });

  it("surfaces a rejected delivery to the caller", async () => {
    vi.stubEnv("LEAD_PLATFORM_WEBHOOK_URL", "https://leads.example.test/events");
    vi.stubEnv("LEAD_PLATFORM_WEBHOOK_SECRET", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(notifyLeadPlatform(leadCreatedEvent("lead-1", lead, "Painting", 0))).rejects.toThrow("503");
  });
});
