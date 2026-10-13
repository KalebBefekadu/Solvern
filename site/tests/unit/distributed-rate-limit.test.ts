import { afterEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/server/backend";
import { rateLimitDistributed, resetRateLimits } from "@/lib/server/rate-limit";

vi.mock("@/lib/server/backend", () => ({
  BackendUnavailable: class BackendUnavailable extends Error {},
  supabase: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(supabase).mockReset();
  resetRateLimits();
});

describe("distributed rate limiting", () => {
  it("uses one database counter and stores only a keyed digest", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_SECRET", "s".repeat(32));
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: false, retry_after: 17 }], error: null });
    vi.mocked(supabase).mockReturnValue({ rpc } as never);

    expect(await rateLimitDistributed("leads:203.0.113.7", 8, 600_000)).toEqual({ ok: false, retryAfter: 17 });
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_limit: 8,
      p_window_seconds: 600,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.7");
  });

  it("fails closed in production when the database response is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_SECRET", "s".repeat(32));
    vi.mocked(supabase).mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } }) } as never);
    await expect(rateLimitDistributed("uploads:203.0.113.7", 20, 600_000)).rejects.toThrow("unavailable");
  });

  it("uses the local counter for development and end-to-end fixtures", async () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(await rateLimitDistributed("leads:local", 1, 600_000)).toEqual({ ok: true, retryAfter: 0 });
    expect((await rateLimitDistributed("leads:local", 1, 600_000)).ok).toBe(false);
  });
});
