import { afterEach, describe, expect, it } from "vitest";
import { previewPrompt } from "@/lib/server/preview-generation";
import { GET } from "@/app/api/preview-generation/worker/route";

const original = {
  PREVIEW_WORKER_SECRET: process.env.PREVIEW_WORKER_SECRET,
  PREVIEW_GENERATION_ENABLED: process.env.PREVIEW_GENERATION_ENABLED,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("preview generation", () => {
  it("orders numbered customer requests without putting marks in the result", () => {
    const prompt = previewPrompt(
      [
        { n: 2, pen: "blue", text: "Add shelves" },
        { n: 1, pen: "red", text: "Paint the trim" },
      ],
      "Update the kitchen",
    );
    expect(prompt.indexOf("1. red mark")).toBeLessThan(prompt.indexOf("2. blue mark"));
    expect(prompt).toContain("Remove its colored marks");
    expect(prompt).toContain("leave that area unchanged for human review");
    expect(prompt).toContain("Overall project goal: Update the kitchen");
  });

  it("requires the worker secret and keeps disabled generation inert", async () => {
    process.env.PREVIEW_WORKER_SECRET = "test-worker-secret";
    process.env.PREVIEW_GENERATION_ENABLED = "false";
    const url = "http://localhost/api/preview-generation/worker";
    expect((await GET(new Request(url))).status).toBe(401);
    const authorized = await GET(new Request(url, { headers: { authorization: "Bearer test-worker-secret" } }));
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toEqual({ status: "disabled" });
  });
});
