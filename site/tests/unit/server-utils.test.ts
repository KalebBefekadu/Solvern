import { describe, expect, it, vi } from "vitest";
import { assertSameOrigin, clientIp, HttpError, readJson } from "@/lib/server/http";
import { rateLimit, resetRateLimits } from "@/lib/server/rate-limit";
import { esc } from "@/lib/server/notify";

const req = (headers: Record<string, string>, body = "{}") => new Request("http://localhost/api/leads", { method: "POST", headers, body });

describe("assertSameOrigin", () => {
  it("allows same-origin and origin-less requests", () => {
    expect(() => assertSameOrigin(req({ host: "solvern.com", origin: "https://solvern.com" }))).not.toThrow();
    expect(() => assertSameOrigin(req({ host: "solvern.com" }))).not.toThrow();
  });

  it("refuses cross-site posts", () => {
    expect(() => assertSameOrigin(req({ host: "solvern.com", origin: "https://evil.example" }))).toThrow(HttpError);
    expect(() => assertSameOrigin(req({ host: "solvern.com", origin: "null" }))).toThrow(HttpError);
  });
});

describe("readJson", () => {
  it("parses JSON", async () => {
    expect(await readJson(req({}, '{"a":1}'))).toEqual({ a: 1 });
  });

  it("refuses bodies over the limit with 413", async () => {
    await expect(readJson(req({}, JSON.stringify({ a: "x".repeat(200) })), 100)).rejects.toMatchObject({ status: 413 });
  });

  it("refuses malformed JSON with 400", async () => {
    await expect(readJson(req({}, "{"))).rejects.toMatchObject({ status: 400 });
  });
});

describe("clientIp", () => {
  it("prefers the edge-provided address", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(req({ "cf-connecting-ip": "3.3.3.3", "x-forwarded-for": "1.1.1.1" }))).toBe("3.3.3.3");
    expect(clientIp(req({}))).toBeNull();
  });
});

describe("rateLimit", () => {
  it("allows up to the limit per window, then resets", () => {
    resetRateLimits();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, t).ok).toBe(true);
    const blocked = rateLimit("k", 3, 1000, t + 10);
    expect(blocked).toEqual({ ok: false, retryAfter: 1 });
    expect(rateLimit("other", 3, 1000, t).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t + 1000).ok).toBe(true);
  });
});

describe("email escaping", () => {
  it("escapes HTML in customer-supplied text", () => {
    expect(esc(`<script>"x" & 'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;");
  });
});

describe("customer confirmation email", () => {
  it("never sends bracketed placeholders", async () => {
    const { confirmationEmail } = await import("@/lib/server/notify");
    for (const type of ["concept_preview", "visit", "callback"]) {
      const m = confirmationEmail(type, "Dana");
      expect(m.text, type).not.toMatch(/\[[^\]]+\]/);
      expect(m.html, type).not.toMatch(/\[[^\]]+\]/);
      expect(m.text).toMatch(/^Hi Dana,/);
    }
  });

  it("escapes the customer's name in HTML", async () => {
    const { confirmationEmail } = await import("@/lib/server/notify");
    expect(confirmationEmail("visit", "<b>Dana</b>").html).toContain("&lt;b&gt;Dana&lt;/b&gt;");
  });
});

describe("robots", () => {
  it("blocks every crawler on preview deployments", async () => {
    const { default: robots } = await import("@/app/robots");
    process.env.VERCEL_ENV = "preview";
    expect(robots().rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    process.env.VERCEL_ENV = "production";
    expect(robots().sitemap).toMatch(/sitemap\.xml$/);
    delete process.env.VERCEL_ENV;
  });
});

describe("log", () => {
  it("writes one JSON line with the event, level and error summary", async () => {
    const { log } = await import("@/lib/server/log");
    const lines: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((l: string) => void lines.push(l));
    log.error("lead.failed", { id: "x" }, new Error("boom"));
    spy.mockRestore();
    expect(JSON.parse(lines[0])).toMatchObject({ level: "error", event: "lead.failed", id: "x", error: "Error", message: "boom" });
  });
});
