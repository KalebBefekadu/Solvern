import { expect, test } from "@playwright/test";
import trades from "../../src/content/trades.json" with { type: "json" };

/**
 * WCAG 2.4.7 and 1.4.11: every focus ring must reach 3:1 against the surface it sits on.
 * axe does not check this, and the ring color changes per surface (globals.css, end of file).
 */
const PAGES = ["/", "/customer-service", "/concept-preview", "/financing", ...trades.trades.map((t) => `/${t.slug}`)];

test("focus rings reach 3:1 on every page", async ({ page }) => {
  test.setTimeout(120_000);
  const failures: string[] = [];
  for (const path of PAGES) {
    await page.goto(path);
    const bad = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (a: number[], b: number[]) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
        return (x + 0.05) / (y + 0.05);
      };
      const surface = (el: Element) => {
        for (let e = el.parentElement; e; e = e.parentElement) {
          const c = parse(getComputedStyle(e).backgroundColor);
          if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) return c.slice(0, 3);
        }
        return [255, 255, 255];
      };
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("a[href], button, select, textarea, summary, input:not([type=hidden])")) {
        if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
        el.focus({ preventScroll: true });
        if (document.activeElement !== el) continue;
        const cs = getComputedStyle(el);
        if (cs.outlineStyle === "none") continue;
        const r = ratio(parse(cs.outlineColor).slice(0, 3), surface(el));
        if (r < 3) out.push(`${r.toFixed(2)}:1 ${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40)}"`);
      }
      return out;
    });
    failures.push(...bad.map((b) => `${path} ${b}`));
  }
  expect(failures).toEqual([]);
});
