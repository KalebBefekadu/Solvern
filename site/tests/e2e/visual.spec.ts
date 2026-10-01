import { expect, test } from "@playwright/test";

/**
 * Screenshot comparison: catches design changes nobody meant to make.
 * Baselines live in tests/e2e/__screenshots__ and are rendered by Linux Chromium (the CI runner),
 * so the suite only runs on Linux. After an approved design change, refresh them with
 * `npm run test:visual:update` and review the new images in the diff before committing.
 */
test.skip(process.platform !== "linux", "Baselines are rendered on Linux; run in CI or a Linux container.");

const PAGES: Record<string, string> = {
  hub: "/",
  carpentry: "/carpentry",
  hvac: "/hvac",
  masonry: "/masonry",
  "draft-trade": "/roofing",
  "concept-preview": "/concept-preview",
  "customer-service": "/customer-service",
  reviews: "/reviews",
  financing: "/financing",
  about: "/about",
  privacy: "/privacy",
  "not-found": "/not-a-real-page",
};

for (const [name, path] of Object.entries(PAGES)) {
  test(`${name} looks as approved`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}

test("mobile menu looks as approved", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The menu button only shows on small screens.");
  await page.goto("/carpentry", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /menu/i }).click();
  await expect(page).toHaveScreenshot("mobile-menu.png");
});
