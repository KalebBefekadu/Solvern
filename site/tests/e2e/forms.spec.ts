import fs from "node:fs/promises";
import path from "node:path";
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

  test("prefills from support email links", async ({ page }) => {
    await page.goto("/customer-service?job=SV-4321&first=Dana&last=Smith&email=dana%40example.com&zip=30305");
    const form = page.locator("form#callback");
    await expect(form.getByLabel("Yes")).toBeChecked();
    await expect(form.locator('[name="jobNumber"]')).toHaveValue("SV-4321");
    await expect(form.locator('[name="firstName"]')).toHaveValue("Dana");
    await expect(form.locator('[name="email"]')).toHaveValue("dana@example.com");
  });
});

test.describe("Concept Preview", () => {
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
    // Desktop shows the note box on the photo; phones show the notes list under it.
    const note = section.getByLabel("Note 1", { exact: true }).locator("visible=true").first();
    await note.fill("Built-in shelves on this wall");

    await section.locator('textarea[name="message"]').fill("Built-in shelving for the living room");
    await section.locator('[name="name"]').fill("Dana Smith");
    const email = unique();
    await fillContact(page, "#preview form", email);
    await section.getByRole("button", { name: "Get my Concept Preview" }).click();

    await expect(section.getByRole("status")).toContainText("Received.", { timeout: 15_000 });
    const lead = await expect.poll(() => findLead((l) => l.email === email)).not.toBeNull().then(() => findLead((l) => l.email === email));
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
    await section.locator('textarea[name="message"]').fill("Repoint the front steps");
    await section.locator('[name="name"]').fill("Dana Smith");
    const email = unique();
    await fillContact(page, "#preview form", email);
    await section.getByRole("button", { name: "Get my Concept Preview" }).click();
    await expect(section.getByRole("status")).toContainText("Received.");
    await expect.poll(async () => ((await findLead((l) => l.email === email))?.photos as { original_path: string }[] | undefined)?.[0]?.original_path).toMatch(/original-1\.jpg$/);
  });
});
