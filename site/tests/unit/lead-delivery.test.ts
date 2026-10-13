import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supabase: vi.fn(),
  sendMail: vi.fn(),
  teamEmail: vi.fn(),
  notifyLeadPlatform: vi.fn(),
}));

vi.mock("@/lib/server/backend", () => ({ supabase: mocks.supabase, signedViewUrl: vi.fn() }));
vi.mock("@/lib/server/notify", () => ({ sendMail: mocks.sendMail, confirmationEmail: vi.fn(), teamEmail: mocks.teamEmail }));
vi.mock("@/lib/server/lead-platform", () => ({ notifyLeadPlatform: mocks.notifyLeadPlatform, leadCreatedEvent: vi.fn() }));
vi.mock("@/lib/server/log", () => ({ log: { error: vi.fn() } }));

import { processNextLeadDelivery } from "@/lib/server/lead-delivery";

const job = {
  job_id: "33333333-3333-4333-8333-333333333333",
  parent_lead_id: "44444444-4444-4444-8444-444444444444",
  kind: "customer_email",
  lease_id: "55555555-5555-4555-8555-555555555555",
  frozen_payload: { kind: "email", mail: { to: ["dana@example.com"], subject: "Received", text: "Thanks", html: "<p>Thanks</p>" } },
  attempt_number: 2,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("durable lead delivery", () => {
  it("freezes a new message before sending it", async () => {
    const events: string[] = [];
    const pending = { ...job, kind: "team_email", frozen_payload: {} };
    const mail = { to: ["team@example.com"], subject: "New lead", text: "New lead", html: "<p>New lead</p>" };
    const rpc = vi
      .fn()
      .mockReturnValueOnce({ maybeSingle: vi.fn().mockResolvedValue({ data: pending, error: null }) })
      .mockResolvedValueOnce({ data: true, error: null });
    const from = vi.fn((table: string) => {
      if (table === "leads")
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: job.parent_lead_id,
                  type: "callback",
                  trade_slug: null,
                  name: "Dana Smith",
                  phone: "4045550100",
                  email: "dana@example.com",
                  zip: "30305",
                  message: "Please call",
                  topic: "Help or advice",
                  job_number: null,
                  source_url: "/customer-service",
                  utm: {},
                  created_at: "2026-10-12T12:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        };
      if (table === "lead_photos") return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      if (table === "lead_sync_outbox")
        return {
          update: (payload: unknown) => {
            events.push("freeze");
            expect(payload).toEqual({ payload: { kind: "email", mail } });
            return { eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: job.job_id }, error: null }) }) }) }) }) };
          },
        };
      throw new Error(`Unexpected table ${table}`);
    });
    mocks.supabase.mockReturnValue({ rpc, from });
    mocks.teamEmail.mockReturnValue(mail);
    mocks.sendMail.mockImplementation(async () => {
      events.push("send");
    });

    expect(await processNextLeadDelivery()).toBe("delivered");
    expect(events).toEqual(["freeze", "send"]);
  });

  it("reuses the frozen email and idempotency key on a retry", async () => {
    const rpc = vi
      .fn()
      .mockReturnValueOnce({ maybeSingle: vi.fn().mockResolvedValue({ data: job, error: null }) })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.supabase.mockReturnValue({
      rpc,
      from: vi.fn(() => {
        throw new Error("A frozen retry should not rebuild its payload");
      }),
    });
    mocks.sendMail.mockResolvedValue(undefined);

    expect(await processNextLeadDelivery()).toBe("delivered");
    expect(mocks.sendMail).toHaveBeenCalledWith(job.frozen_payload.mail, `lead-delivery/${job.job_id}`);
    expect(rpc).toHaveBeenLastCalledWith("finish_lead_delivery", {
      p_job_id: job.job_id,
      p_lease_id: job.lease_id,
      p_success: true,
      p_error: null,
    });
  });

  it("records provider failure for a bounded retry", async () => {
    const rpc = vi
      .fn()
      .mockReturnValueOnce({ maybeSingle: vi.fn().mockResolvedValue({ data: job, error: null }) })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.supabase.mockReturnValue({ rpc });
    mocks.sendMail.mockRejectedValue(new Error("Provider unavailable"));

    expect(await processNextLeadDelivery()).toBe("retry");
    expect(rpc).toHaveBeenLastCalledWith("finish_lead_delivery", {
      p_job_id: job.job_id,
      p_lease_id: job.lease_id,
      p_success: false,
      p_error: "Provider unavailable",
    });
  });
});
