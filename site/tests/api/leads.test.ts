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
let drafts: typeof import("@/app/api/preview-drafts/route");
let draftPhotos: typeof import("@/app/api/preview-drafts/photos/route");
let resetRateLimits: () => void;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "solvern-api-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"]) delete process.env[k];
  leads = await import("@/app/api/leads/route");
  uploads = await import("@/app/api/uploads/route");
  local = await import("@/app/api/uploads/local/route");
  drafts = await import("@/app/api/preview-drafts/route");
  draftPhotos = await import("@/app/api/preview-drafts/photos/route");
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

const put = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: "PUT",
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", ...headers },
    body: JSON.stringify(body),
  });

const del = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", ...headers },
    body: JSON.stringify(body),
  });

async function startDraft() {
  const response = await drafts.POST(post("/api/preview-drafts", { sourcePath: "/carpentry" }));
  expect(response.status).toBe(200);
  return { ...(await response.json()), cookie: response.headers.get("set-cookie")!.split(";")[0] } as { id: string; revision: number; cookie: string };
}

async function uploadedDraftPhoto(draft: { id: string; cookie: string }) {
  const targetResponse = await uploads.POST(
    post("/api/uploads", { draftId: draft.id, files: [{ kind: "original", contentType: "image/png", size: 4 }] }, { cookie: draft.cookie }),
  );
  expect(targetResponse.status).toBe(200);
  const { targets } = await targetResponse.json();
  const target = targets[0];
  expect((await local.PUT(new Request(`http://localhost${target.url}`, { method: "PUT", body: new Uint8Array([1, 2, 3, 4]) }))).status).toBe(200);
  return {
    originalPath: target.path as string,
    annotatedPath: null,
    strokes: { width: 100, height: 80, strokes: [{ pen: "red", color: "#D92D32", note: 1, points: [[12, 18, 0.5]] }] },
    notes: [{ n: 1, pen: "red", color: "#D92D32", text: "Paint the trim red", anchor: { x: 12, y: 18 } }],
  };
}

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
  it("requires a verified draft before issuing production upload targets", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_LOCAL_LEAD_STORE", "");
    const limiter = await import("@/lib/server/rate-limit");
    const sharedLimit = vi.spyOn(limiter, "rateLimitDistributed").mockResolvedValue({ ok: true, retryAfter: 0 });
    try {
      const file = { kind: "original", contentType: "image/jpeg", size: 4 };
      expect((await uploads.POST(post("/api/uploads", { files: [file] }))).status).toBe(401);
      expect((await drafts.POST(post("/api/preview-drafts", { sourcePath: "/carpentry" }))).status).toBe(400);
    } finally {
      sharedLimit.mockRestore();
      vi.unstubAllEnvs();
    }
  });

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

describe("retries", () => {
  it("stores a form attempt once, however many times it is sent", async () => {
    const requestId = "0d6f4c2e-8a51-4c3b-9f0e-6b1d2a7c9e11";
    const body = { ...callback, email: "retry@example.com", requestId };
    const first = await (await leads.POST(post("/api/leads", body))).json();
    const second = await (await leads.POST(post("/api/leads", body))).json();
    expect(second.id).toBe(first.id);
    expect((await storedLeads()).filter((l) => l.email === "retry@example.com")).toHaveLength(1);
  });

  it("rejects a request id that is not a UUID", async () => {
    const res = await leads.POST(post("/api/leads", { ...callback, requestId: "not-a-uuid" }));
    expect(res.status).toBe(422);
  });
});

describe("saved photo drafts", () => {
  it("requires the draft cookie and rejects paths issued to another draft", async () => {
    const owner = await startDraft();
    const other = await startDraft();
    const record = await uploadedDraftPhoto(owner);
    const id = "6087e96b-5dd5-4b3f-84db-f43c7d9f56a1";
    const body = { id, position: 0, expectedRevision: 0, mutationId: crypto.randomUUID(), record };
    expect((await draftPhotos.PUT(put("/api/preview-drafts/photos", body))).status).toBe(401);
    expect((await draftPhotos.PUT(put("/api/preview-drafts/photos", body, { cookie: other.cookie }))).status).toBe(403);
    expect((await draftPhotos.PUT(put("/api/preview-drafts/photos", body, { cookie: owner.cookie }))).status).toBe(200);
    const saved = await drafts.GET(new Request("http://localhost/api/preview-drafts", { headers: { cookie: owner.cookie } }));
    expect((await saved.json()).photos).toMatchObject([{ id, record: { notes: [{ text: "Paint the trim red" }] } }]);
    const removal = { id, expectedRevision: 1, mutationId: crypto.randomUUID() };
    expect((await draftPhotos.DELETE(del("/api/preview-drafts/photos", removal))).status).toBe(401);
    expect((await draftPhotos.DELETE(del("/api/preview-drafts/photos", { ...removal, expectedRevision: 0 }, { cookie: owner.cookie }))).status).toBe(409);
    expect((await draftPhotos.DELETE(del("/api/preview-drafts/photos", removal, { cookie: owner.cookie }))).status).toBe(200);
    expect((await draftPhotos.DELETE(del("/api/preview-drafts/photos", removal, { cookie: owner.cookie }))).status).toBe(200);
    const after = await drafts.GET(new Request("http://localhost/api/preview-drafts", { headers: { cookie: owner.cookie } }));
    expect((await after.json()).photos).toEqual([]);
  });

  it("rejects empty notes and stale revisions, then submits the saved photo once under concurrent retries", async () => {
    const draft = await startDraft();
    const record = await uploadedDraftPhoto(draft);
    const id = "3763e4e4-fc3e-496a-bd7a-1dd8a2183f30";
    const body = { id, position: 0, expectedRevision: 0, mutationId: crypto.randomUUID(), record };
    expect(
      (await draftPhotos.PUT(put("/api/preview-drafts/photos", { ...body, record: { ...record, notes: [{ ...record.notes[0], text: " " }] } }, { cookie: draft.cookie }))).status,
    ).toBe(422);
    expect((await draftPhotos.PUT(put("/api/preview-drafts/photos", body, { cookie: draft.cookie }))).status).toBe(200);
    expect((await draftPhotos.PUT(put("/api/preview-drafts/photos", body, { cookie: draft.cookie }))).status).toBe(200);
    expect((await draftPhotos.PUT(put("/api/preview-drafts/photos", { ...body, mutationId: crypto.randomUUID() }, { cookie: draft.cookie }))).status).toBe(409);
    expect((await draftPhotos.PUT(put("/api/preview-drafts/photos", { ...body, position: 1 }, { cookie: draft.cookie }))).status).toBe(409);

    const base = {
      type: "concept_preview",
      tradeSlug: "carpentry",
      message: "Red trim in the living room",
      name: "Dana Smith",
      ...contact,
      draftId: draft.id,
      photoIds: [id],
      photos: [],
    };
    const [first, second] = await Promise.all([
      leads.POST(post("/api/leads", { ...base, requestId: "77f2a5cb-96f4-483a-8e16-3e7c3c302c7b" }, { cookie: draft.cookie })),
      leads.POST(post("/api/leads", { ...base, requestId: "5a8cfba9-e704-4472-8134-263d53ae3c0e" }, { cookie: draft.cookie })),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    const firstId = (await first.json()).id;
    expect((await second.json()).id).toBe(firstId);
    const stored = (await storedLeads()).filter((lead) => lead.preview_draft_id === draft.id);
    expect(stored).toHaveLength(1);
    expect(stored[0].photos).toMatchObject([{ original_path: record.originalPath, notes: [{ text: "Paint the trim red" }] }]);
  });
});
