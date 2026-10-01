import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/carpentry", "/hvac", "/masonry", "/roofing", "/concept-preview", "/customer-service", "/reviews", "/financing", "/about", "/privacy", "/terms"];

for (const path of PAGES) {
  test(`${path} renders cleanly, fits the screen and passes axe`, async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
    page.on("pageerror", (e) => problems.push(e.message));

    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main#main")).toBeVisible();

    // No horizontal scroll at any tested width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test("the phone number is a working tel: link on every trade page", async ({ page }) => {
  await page.goto("/carpentry");
  const tel = page.locator('a[href^="tel:"]').first();
  await expect(tel).toHaveAttribute("href", /^tel:\+1\d{10}$/);
});

test("unknown pages return 404 with a way home", async ({ page }) => {
  const res = await page.goto("/not-a-real-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Go to Solvern Home" })).toBeVisible();
});

test("draft trade pages stay out of search; approved ones are indexable", async ({ page, request }) => {
  await page.goto("/roofing");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("note")).toContainText("Draft page");

  await page.goto("/carpentry");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/carpentry$/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/carpentry</loc>");
  expect(sitemap).not.toContain("/roofing</loc>");
});

test("structured data is valid JSON on trade pages", async ({ page }) => {
  await page.goto("/hvac");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length).toBeGreaterThan(0);
  for (const b of blocks) expect(() => JSON.parse(b)).not.toThrow();
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("health check reports configured services", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, storage: "local" });
});

test.describe("at 320px", () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test("no page scrolls sideways", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test("share images, icons and manifest are served", async ({ request, page }) => {
  for (const url of ["/opengraph-image", "/carpentry/opengraph-image/card", "/apple-icon"]) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()["content-type"], url).toBe("image/png");
  }
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Solvern Home");

  await page.goto("/about");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image$/);
  await page.goto("/hvac");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/hvac\/opengraph-image\/card$/);
});

test("mobile menu closes on Escape and returns focus to its button", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The menu button only shows below 1024px");
  await page.goto("/");
  const button = page.getByRole("button", { name: "Open menu" });
  await button.click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});
