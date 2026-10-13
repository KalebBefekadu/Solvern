import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { solidBmp, solidPng } from "./helpers";

const LEADS_DIR = path.join(process.cwd(), ".data", "leads");

async function findLead(match: (l: Record<string, unknown>) => boolean) {
  const files = await fs.readdir(LEADS_DIR).catch(() => [] as string[]);
  for (const f of files) {
    const lead = JSON.parse(await fs.readFile(path.join(LEADS_DIR, f), "utf8"));
    if (match(lead)) return lead;
  }
  return null;
}

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.beforeEach(async ({ page }, testInfo) => {
  // Each parallel browser scenario is a separate visitor for the in-memory rate limiter.
  const hash = createHash("sha256").update(testInfo.testId).digest();
  await page.setExtraHTTPHeaders({ "x-real-ip": `198.18.${hash[0]}.${hash[1]}` });
});

async function fillContact(page: Page, scope: string, email: string) {
  const form = page.locator(scope);
  await form.locator('[name="zip"]').fill("30305");
  await form.locator('[name="phone"]').fill("(404) 555-0100");
  await form.locator('[name="email"]').fill(email);
}

test.describe("callback form", () => {
  test("validates, branches by existing job and submits", async ({ page }) => {
    await page.goto("/customer-service");
    const form = page.locator("form#callback");

    await form.getByRole("button", { name: "Request a callback" }).click();
    await expect(form.getByText("Choose an answer.")).toBeVisible();
    await expect(form.getByText("Enter your first name.")).toBeVisible();

    await form.getByLabel("Yes").check();
    await expect(form.locator('[name="jobNumber"]')).toBeVisible();
    await expect(form.locator('select[name="topic"] option')).toContainText(["Arrival time update"]);

    await form.getByLabel("No", { exact: true }).check();
    await expect(form.locator('[name="jobNumber"]')).toHaveCount(0);
    await form.locator('select[name="topic"]').selectOption("New project or estimate");
    await expect(form.getByRole("link", { name: "Get my Concept Preview" })).toBeVisible();

    await form.locator('select[name="topic"]').selectOption("Help or advice");
    await form.locator('textarea[name="message"]').fill("Do you repair old plaster walls?");
    await form.locator('[name="firstName"]').fill("Dana");
    await form.locator('[name="lastName"]').fill("Smith");
    const email = unique();
    await fillContact(page, "form#callback", email);
    await form.getByLabel("Text").check();
    await form.getByRole("button", { name: "Request a callback" }).click();

    await expect(page.getByRole("status")).toContainText("Received.");
    await expect.poll(() => findLead((l) => l.email === email)).toMatchObject({ type: "callback", topic: "Help or advice", preferred_contact: "text", existing_job: false });
  });

  test("does not read personal details from URL parameters", async ({ page }) => {
    await page.goto("/customer-service?job=SV-4321&first=Dana&last=Smith&email=dana%40example.com&zip=30305");
    const form = page.locator("form#callback");
    await expect(form.getByLabel("Yes")).not.toBeChecked();
    await expect(form.locator('[name="firstName"]')).toHaveValue("");
    await expect(form.locator('[name="email"]')).toHaveValue("");
  });
});

test.describe("Concept Preview", () => {
  test("places each new note below the image and links its marker to the text field", async ({ page }) => {
    await page.goto("/carpentry");
    const section = page.locator("#preview");
    await section.locator('input[type="file"]').setInputFiles({ name: "room.png", mimeType: "image/png", buffer: solidPng(800, 600) });
    await section.getByRole("button", { name: "Red pen" }).click();
    const canvas = section.locator("svg.strokes");
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.45);
    await page.mouse.up();

    const note = section.getByLabel("Note 1", { exact: true });
    await expect(note).toBeVisible();
    const placement = await section.evaluate((element) => ({
      imageBottom: element.querySelector(".markup__canvas")!.getBoundingClientRect().bottom,
      noteTop: element.querySelector(".notes-list textarea")!.getBoundingClientRect().top,
    }));
    expect(placement.noteTop).toBeGreaterThanOrEqual(placement.imageBottom);
    await section.getByRole("button", { name: "Edit note 1" }).click();
    await expect(note).toBeFocused();
    await note.fill("Paint the trim red");
    await section.getByRole("button", { name: "Undo" }).click();
    await expect(note).toHaveCount(0);
    await section.getByRole("button", { name: "Redo" }).click();
    await expect(section.getByLabel("Note 1", { exact: true })).toHaveValue("Paint the trim red");
  });

  test("restores an unfinished note and does not reupload for a text edit", async ({ page }) => {
    let uploadRequests = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/uploads") uploadRequests++;
    });
    await page.goto("/carpentry");
    const section = page.locator("#preview");
    await section.locator('input[type="file"]').setInputFiles({ name: "room.png", mimeType: "image/png", buffer: solidPng(800, 600) });
    const canvas = section.locator("svg.strokes");
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 180, box.y + 150);
    await page.mouse.up();
    await section.getByLabel("Note 1", { exact: true }).fill("Paint this wall blue");
    await expect(section.locator(".markup__progress")).toContainText("Not saved yet");
    await page.waitForTimeout(450);
    await page.reload();
    await expect(section.getByLabel("Note 1", { exact: true })).toHaveValue("Paint this wall blue");
    await section.getByRole("button", { name: "Save photo", exact: true }).click();
    await expect(section.locator(".markup__progress")).toContainText("Saved");
    expect(uploadRequests).toBe(1);
    await section.getByLabel("Note 1", { exact: true }).fill("Paint this wall green");
    await section.getByRole("button", { name: "Save photo", exact: true }).click();
    await expect(section.locator(".markup__progress")).toContainText("Saved");
    expect(uploadRequests).toBe(1);
  });

  test("removing a saved photo leaves it out of the final request", async ({ page }) => {
    await page.goto("/carpentry");
    const section = page.locator("#preview");
    await section.locator('input[type="file"]').setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: solidPng(800, 600) },
      { name: "two.png", mimeType: "image/png", buffer: solidPng(640, 480) },
    ]);
    await section.getByRole("button", { name: "Save reference photo and continue" }).click();
    await expect(section.locator(".markup__progress")).toContainText("Photo 2 of 2");
    await section.getByRole("button", { name: "Save reference photo", exact: true }).click();
    await expect(section.getByText("2 of 2 photos saved.")).toBeVisible();
    await section.getByRole("button", { name: "Remove photo 1" }).click();
    await expect(section.getByText("1 of 1 photos saved.")).toBeVisible();
    await section.locator('textarea[name="message"]').fill("Built-in shelving for the living room");
    await section.locator('[name="name"]').fill("Dana Smith");
    const email = unique();
    await fillContact(page, "#preview form", email);
    await section.getByRole("button", { name: "Get my Concept Preview" }).click();
    await expect(section.getByRole("status")).toContainText("Received.");
    const lead = await expect
      .poll(() => findLead((item) => item.email === email))
      .not.toBeNull()
      .then(() => findLead((item) => item.email === email));
    expect((lead?.photos as unknown[]).length).toBe(1);
  });

  test("saves two photos in order and restores them after reload", async ({ page }) => {
    await page.goto("/carpentry");
    const section = page.locator("#preview");
    await section.locator('input[type="file"]').setInputFiles([
      { name: "room-one.png", mimeType: "image/png", buffer: solidPng(800, 600) },
      { name: "room-two.png", mimeType: "image/png", buffer: solidPng(640, 480) },
    ]);
    await expect(section.locator(".markup__progress")).toContainText("Photo 1 of 2");
    await section.getByRole("button", { name: "Red pen" }).click();
    const canvas = section.locator("svg.strokes");
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.up();
    await expect(section.getByLabel("Note 1", { exact: true })).toBeVisible();
    await section.getByLabel("Note 1", { exact: true }).fill("Paint this wall red");
    await section.getByRole("button", { name: "Save photo and continue" }).click();
    await expect(section.locator(".markup__progress")).toContainText("Photo 2 of 2");
    await section.getByRole("button", { name: "Save reference photo", exact: true }).click();
    await expect(section.getByText("2 of 2 photos saved.")).toBeVisible();

    await page.reload();
    await expect(section.getByText("2 of 2 photos saved.")).toBeVisible();
    await expect(section.getByLabel("Note 1", { exact: true })).toHaveValue("Paint this wall red");
    await section.locator('textarea[name="message"]').fill("Paint the living room walls");
    await section.locator('[name="name"]').fill("Dana Smith");
    const email = unique();
    await fillContact(page, "#preview form", email);
    await section.getByRole("button", { name: "Get my Concept Preview" }).click();
    await expect(section.getByRole("status")).toContainText("Received.");
    const lead = await expect
      .poll(() => findLead((item) => item.email === email))
      .not.toBeNull()
      .then(() => findLead((item) => item.email === email));
    expect((lead?.photos as unknown[]).length).toBe(2);
  });

  test("finishes a five-photo request one image at a time", async ({ page }) => {
    await page.goto("/carpentry");
    const section = page.locator("#preview");
    await section
      .locator('input[type="file"]')
      .setInputFiles(Array.from({ length: 5 }, (_, i) => ({ name: `room-${i + 1}.png`, mimeType: "image/png", buffer: solidPng(320 + i * 10, 240) })));
    for (let i = 1; i <= 5; i++) {
      await expect(section.locator(".markup__progress")).toContainText(`Photo ${i} of 5`);
      await section.getByRole("button", { name: i < 5 ? "Save reference photo and continue" : "Save reference photo", exact: true }).click();
    }
    await expect(section.getByText("5 of 5 photos saved.")).toBeVisible();
    await section.getByRole("button", { name: "Remove photo 3" }).click();
    await expect(section.getByText("4 of 4 photos saved.")).toBeVisible();
    await page.reload();
    await expect(section.getByText("4 of 4 photos saved.")).toBeVisible();
    await section.locator('input[type="file"]').setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: solidPng(360, 240) });
    await expect(section.locator(".markup__progress")).toContainText("Photo 5 of 5");
    await section.getByRole("button", { name: "Save reference photo", exact: true }).click();
    await expect(section.getByText("5 of 5 photos saved.")).toBeVisible();
    await section.locator('textarea[name="message"]').fill("Built-in shelving across five rooms");
    await section.locator('[name="name"]').fill("Dana Smith");
    const email = unique();
    await fillContact(page, "#preview form", email);
    await section.getByRole("button", { name: "Get my Concept Preview" }).click();
    await expect(section.getByRole("status")).toContainText("Received.");
    const lead = await expect
      .poll(() => findLead((item) => item.email === email))
      .not.toBeNull()
      .then(() => findLead((item) => item.email === email));
    expect(lead?.photos).toHaveLength(5);
  });

  test("uploads a photo, draws a note and submits with markup", async ({ page }) => {
    await page.goto("/carpentry");
    const section = page.locator("#preview");
    await section.locator('input[type="file"]').setInputFiles({ name: "room.png", mimeType: "image/png", buffer: solidPng(800, 600) });

    const canvas = section.locator("svg.strokes");
    await expect(canvas).toBeVisible();
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.03), box.y + box.height * (0.3 + i * 0.02));
    await page.mouse.up();

    await expect(section.locator("svg.strokes path")).toHaveCount(1);
    await expect(section.locator(".markup__canvas textarea")).toHaveCount(0);
    const note = section.getByLabel("Note 1", { exact: true });
    await note.fill("Built-in shelves on this wall");
    await section.getByRole("button", { name: "Save photo", exact: true }).click();
    await expect(section.locator(".markup__progress")).toContainText("Saved");

    await section.locator('textarea[name="message"]').fill("Built-in shelving for the living room");
    await section.locator('[name="name"]').fill("Dana Smith");
    const email = unique();
    await fillContact(page, "#preview form", email);
    await section.getByRole("button", { name: "Get my Concept Preview" }).click();

    await expect(section.getByRole("status")).toContainText("Received.", { timeout: 15_000 });
    const lead = await expect
      .poll(() => findLead((l) => l.email === email))
      .not.toBeNull()
      .then(() => findLead((l) => l.email === email));
    expect(lead).toMatchObject({ type: "concept_preview", trade_slug: "carpentry" });
    const photo = (lead!.photos as { annotated_path: string; original_path: string; notes: { text: string }[]; strokes: { strokes: unknown[] } }[])[0];
    expect(photo.notes[0].text).toBe("Built-in shelves on this wall");
    expect(photo.strokes.strokes).toHaveLength(1);
    for (const p of [photo.original_path, photo.annotated_path]) await expect(fs.stat(path.join(process.cwd(), ".data", "uploads", p))).resolves.toBeTruthy();
  });

  test("diagnosis trades ask for a visit and work without a photo", async ({ page }) => {
    await page.goto("/hvac");
    const section = page.locator("#visit");
    await section.locator('textarea[name="message"]').fill("The upstairs unit blows warm air");
    await section.locator('[name="name"]').fill("Dana Smith");
    const email = unique();
    await fillContact(page, "#visit form", email);
    await section.getByRole("button", { name: "Request a visit" }).click();
    await expect(section.getByRole("status")).toContainText("Received.");
    await expect.poll(() => findLead((l) => l.email === email)).toMatchObject({ type: "visit", trade_slug: "hvac" });
  });

  test("standalone page preselects from the query string and requires a choice", async ({ page }) => {
    await page.goto("/concept-preview?project=kitchen");
    await expect(page.getByLabel("Trade or project")).toHaveValue("project-kitchen");
    await page.goto("/concept-preview");
    await page.getByRole("button", { name: "Get my Concept Preview" }).click();
    await expect(page.getByText("Choose a trade.")).toBeVisible();
  });

  test("converts photo formats storage refuses into JPEG", async ({ page }) => {
    await page.goto("/masonry");
    const section = page.locator("#preview");
    await section.locator('input[type="file"]').setInputFiles({ name: "wall.bmp", mimeType: "image/bmp", buffer: solidBmp(320, 240) });
    await expect(section.locator("svg.strokes")).toBeVisible();
    await section.getByRole("button", { name: "Save reference photo" }).click();
    await expect(section.locator(".markup__progress")).toContainText("Saved");
    await section.locator('textarea[name="message"]').fill("Repoint the front steps");
    await section.locator('[name="name"]').fill("Dana Smith");
    const email = unique();
    await fillContact(page, "#preview form", email);
    await section.getByRole("button", { name: "Get my Concept Preview" }).click();
    await expect(section.getByRole("status")).toContainText("Received.");
    await expect.poll(async () => ((await findLead((l) => l.email === email))?.photos as { original_path: string }[] | undefined)?.[0]?.original_path).toMatch(/original-1\.jpg$/);
  });
});
