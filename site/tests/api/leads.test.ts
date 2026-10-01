/**
 * Lead API end to end against the local store (no Supabase, Resend or Turnstile configured).
 * Runs in a temporary working directory so ./.data never touches the repo.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;
let leads: typeof import("@/app/api/leads/route");
let uploads: typeof import("@/app/api/uploads/route");
let local: typeof import("@/app/api/uploads/local/route");
let resetRateLimits: () => void;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "solvern-api-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"]) delete process.env[k];
  leads = await import("@/app/api/leads/route");
  uploads = await import("@/app/api/uploads/route");
  local = await import("@/app/api/uploads/local/route");
  ({ resetRateLimits } = await import("@/lib/server/rate-limit"));
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

beforeEach(() => resetRateLimits());

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const contact = { zip: "30305", phone: "(404) 555-0100", email: "dana@example.com" };
const callback = {
  type: "callback",
  existingJob: "yes",
  jobNumber: "SV-1234",
  topic: "Arrival time update",
  message: "When will the crew arrive?",
  firstName: "Dana",
  lastName: "Smith",
  preferredContact: "text",
  ...contact,
};

async function storedLeads() {
  const d = path.join(dir, ".data", "leads");
  const files = await fs.readdir(d).catch(() => []);
  return Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(d, f), "utf8"))));
}

describe("POST /api/leads", () => {
  it("stores a callback request", async () => {
    const res = await leads.POST(post("/api/leads", callback));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const row = (await storedLeads()).find((l) => l.id === id);
    expect(row).toMatchObject({ type: "callback", name: "Dana Smith", existing_job: true, job_number: "SV-1234", preferred_contact: "text", status: "new" });
  });

  it("returns field errors for invalid input", async () => {
    const res = await leads.POST(post("/api/leads", { ...callback, email: "nope" }));
    expect(res.status).toBe(422);
    expect((await res.json()).fields).toEqual({ email: "Enter a valid email address." });
  });

  it("pretends success for the honeypot and stores nothing", async () => {
    const before = (await storedLeads()).length;
    const res = await leads.POST(post("/api/leads", { ...callback, company: "Bots Inc" }));
    expect(res.status).toBe(200);
    expect((await storedLeads()).length).toBe(before);
  });

  it("refuses cross-site posts", async () => {
    const res = await leads.POST(post("/api/leads", callback, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("refuses oversized bodies", async () => {
    const res = await leads.POST(post("/api/leads", { ...callback, message: "x".repeat(1024 * 1024 + 1) }));
    expect(res.status).toBe(413);
  });

  it("refuses malformed JSON", async () => {
    const res = await leads.POST(post("/api/leads", "{"));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown trade", async () => {
    const res = await leads.POST(post("/api/leads", { type: "concept_preview", tradeSlug: "not-a-trade", message: "Hello", name: "Dana", ...contact }));
    expect(res.status).toBe(422);
    expect((await res.json()).fields).toEqual({ tradeSlug: "Choose a trade." });
  });

  it("rejects photos that were never uploaded", async () => {
    const res = await leads.POST(
      post("/api/leads", {
        type: "concept_preview",
        tradeSlug: "carpentry",
        message: "Built-ins",
        name: "Dana",
        ...contact,
        photos: [
          {
            originalPath: "leads/2026-10-01/123e4567-e89b-12d3-a456-426614174000/original-1.jpg",
            annotatedPath: null,
            strokes: { width: 10, height: 10, strokes: [] },
            notes: [],
          },
        ],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rate limits bursts from one address", async () => {
    const h = { "x-forwarded-for": "9.9.9.9" };
    const statuses = [];
    for (let i = 0; i < 9; i++) statuses.push((await leads.POST(post("/api/leads", { ...callback, email: "bad" }, h))).status);
    expect(statuses.slice(0, 8).every((s) => s === 422)).toBe(true);
    expect(statuses[8]).toBe(429);
  });
});

describe("photo upload flow", () => {
  it("issues targets, accepts the files, and stores a Concept Preview lead with markup", async () => {
    const res = await uploads.POST(
      post("/api/uploads", {
        files: [
          { kind: "original", contentType: "image/jpeg", size: 4 },
          { kind: "annotated", contentType: "image/png", size: 4 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const { targets } = await res.json();
    expect(targets).toHaveLength(2);

    for (const t of targets) {
      expect(t.mode).toBe("local");
      const put = await local.PUT(new Request(`http://localhost${t.url}`, { method: "PUT", body: new Uint8Array([1, 2, 3, 4]) }));
      expect(put.status).toBe(200);
    }

    const lead = await leads.POST(
      post("/api/leads", {
        type: "concept_preview",
        tradeSlug: "project-kitchen",
        message: "Open the kitchen to the dining room",
        name: "Dana Smith",
        ...contact,
        photos: [
          {
            originalPath: targets[0].path,
            annotatedPath: targets[1].path,
            strokes: { width: 100, height: 80, strokes: [{ pen: "blue", color: "#2F63D6", note: 1, points: [[1, 2, 0.5]] }] },
            notes: [{ n: 1, pen: "blue", color: "#2F63D6", text: "Remove this wall", anchor: { x: 1, y: 2 } }],
          },
        ],
      }),
    );
    expect(lead.status).toBe(200);
    const { id } = await lead.json();
    const row = (await storedLeads()).find((l) => l.id === id);
    expect(row.trade_slug).toBe("project-kitchen");
    expect(row.photos[0]).toMatchObject({ original_path: targets[0].path, annotated_path: targets[1].path });
    expect(row.photos[0].notes[0].text).toBe("Remove this wall");
  });

  it("refuses unsupported file types", async () => {
    const res = await uploads.POST(post("/api/uploads", { files: [{ kind: "original", contentType: "image/gif", size: 4 }] }));
    expect(res.status).toBe(400);
  });

  it("refuses local upload paths outside the issued pattern", async () => {
    const res = await local.PUT(new Request("http://localhost/api/uploads/local?path=../../etc/passwd", { method: "PUT", body: "x" }));
    expect(res.status).toBe(400);
  });
});
