import { describe, expect, it } from "vitest";
import { callbackLeadSchema, flattenErrors, previewLeadSchema, uploadPath, uploadRequestSchema } from "@/lib/leads/schema";

const contact = { zip: "30305", phone: "(404) 555-0100", email: "dana@example.com" };
const callback = {
  type: "callback",
  existingJob: "yes",
  jobNumber: "SV-1234",
  topic: "Arrival time update",
  message: "When will the crew arrive?",
  firstName: "Dana",
  lastName: "Smith",
  preferredContact: "phone",
  ...contact,
};

describe("callback lead", () => {
  it("accepts a complete request and applies defaults", () => {
    const r = callbackLeadSchema.parse(callback);
    expect(r.utm).toEqual({});
    expect(r.company).toBe("");
    expect(r.sourceUrl).toBe("");
  });

  it("only allows topics that match the existing-job branch", () => {
    const r = callbackLeadSchema.safeParse({ ...callback, existingJob: "no" });
    expect(r.success).toBe(false);
    expect(flattenErrors(r.error!)).toEqual({ topic: "Choose a topic." });
    expect(callbackLeadSchema.safeParse({ ...callback, existingJob: "no", topic: "Help or advice" }).success).toBe(true);
  });

  it("rejects bad contact details with field messages", () => {
    const r = callbackLeadSchema.safeParse({ ...callback, zip: "3030", phone: "555-0100", email: "nope" });
    expect(flattenErrors(r.error!)).toMatchObject({
      zip: "Enter a 5-digit zip code.",
      phone: "Enter a phone number with area code.",
      email: "Enter a valid email address.",
    });
  });

  it("trims input before validating", () => {
    const r = callbackLeadSchema.parse({ ...callback, firstName: "  Dana  ", zip: " 30305 " });
    expect(r.firstName).toBe("Dana");
    expect(r.zip).toBe("30305");
  });
});

describe("preview lead", () => {
  const base = { type: "concept_preview", tradeSlug: "carpentry", message: "New built-ins", name: "Dana Smith", ...contact };

  it("accepts a request without photos", () => {
    expect(previewLeadSchema.parse(base).photos).toEqual([]);
  });

  it("rejects more than five photos", () => {
    const photo = {
      originalPath: "leads/2026-10-01/123e4567-e89b-12d3-a456-426614174000/original-1.jpg",
      annotatedPath: null,
      strokes: { width: 10, height: 10, strokes: [] },
      notes: [],
    };
    expect(previewLeadSchema.safeParse({ ...base, photos: Array(6).fill(photo) }).success).toBe(false);
  });

  it("rejects strokes without points", () => {
    const photo = {
      originalPath: "leads/2026-10-01/123e4567-e89b-12d3-a456-426614174000/original-1.jpg",
      annotatedPath: null,
      strokes: { width: 10, height: 10, strokes: [{ pen: "blue", color: "#2F63D6", note: 1, points: [] }] },
      notes: [],
    };
    expect(previewLeadSchema.safeParse({ ...base, photos: [photo] }).success).toBe(false);
  });
});

describe("upload paths", () => {
  it("accepts only paths issued by /api/uploads", () => {
    expect(uploadPath.safeParse("leads/2026-10-01/123e4567-e89b-12d3-a456-426614174000/annotated-2.png").success).toBe(true);
    for (const bad of [
      "../etc/passwd",
      "leads/2026-10-01/../../secret.png",
      "leads/2026-10-01/123e4567-e89b-12d3-a456-426614174000/x.exe",
      "/leads/2026-10-01/123e4567-e89b-12d3-a456-426614174000/original-1.jpg",
    ]) {
      expect(uploadPath.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("limits upload requests by type, size and count", () => {
    const file = { kind: "original", contentType: "image/jpeg", size: 1000 };
    expect(uploadRequestSchema.safeParse({ files: [file] }).success).toBe(true);
    expect(uploadRequestSchema.safeParse({ files: [{ ...file, contentType: "image/gif" }] }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ files: [{ ...file, size: 16 * 1024 * 1024 }] }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ files: Array(11).fill(file) }).success).toBe(false);
  });
});
