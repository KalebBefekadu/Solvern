import { describe, expect, it } from "vitest";
import { FAMILIES, navName, previewTarget, projects, seo, tradeBySlug, tradePage, trades } from "@/lib/content";
import { site, hasPlaceholder } from "@/content/site";

const HEX = /^#[0-9A-F]{6}$/i;

describe("trades.json", () => {
  it("has 23 trades with unique slugs in known families", () => {
    expect(trades).toHaveLength(23);
    expect(new Set(trades.map((t) => t.slug)).size).toBe(23);
    for (const t of trades) expect(FAMILIES, t.slug).toContain(t.family);
  });

  it("gives every trade a full, valid color set", () => {
    for (const t of trades) {
      for (const c of [t.color, t.onColor, t.tint, t.tintStrong, t.deep]) expect(c, `${t.slug} ${c}`).toMatch(HEX);
    }
  });

  it("uses slugs that are safe as routes and lead values", () => {
    for (const t of trades) expect(t.slug).toMatch(/^[a-z-]{2,40}$/);
  });
});

describe("trade pages", () => {
  it("has copy and SEO for every trade, so every trade gets a page", () => {
    for (const t of trades) {
      const page = tradePage(t.slug);
      expect(page, `${t.slug} copy`).toBeDefined();
      expect(seo.trades[t.slug], `${t.slug} seo`).toBeDefined();
      expect(page!.services.length, `${t.slug} services`).toBeGreaterThan(0);
      expect(page!.faq.length, `${t.slug} faq`).toBeGreaterThan(0);
      expect(page!.howItWorks).toHaveLength(4);
      expect(["concept-preview", "diagnosis"]).toContain(page!.primaryAction);
    }
  });

  it("keeps the three designed trades approved", () => {
    for (const slug of ["carpentry", "hvac", "masonry"]) expect(tradePage(slug)?.copyStatus).toBe("approved");
  });

  it("returns nothing for unknown slugs", () => {
    expect(tradePage("not-a-trade")).toBeUndefined();
    expect(tradeBySlug("not-a-trade")).toBeUndefined();
  });
});

describe("projects", () => {
  it("only reference real trades", () => {
    for (const p of projects) for (const slug of p.trades) expect(tradeBySlug(slug), `${p.slug} -> ${slug}`).toBeDefined();
  });

  it("resolve as Concept Preview targets", () => {
    for (const p of projects) expect(previewTarget(`project-${p.slug}`)?.name).toBe(p.formName);
    expect(previewTarget("project-nope")).toBeUndefined();
    expect(previewTarget("carpentry")?.slug).toBe("carpentry");
  });
});

describe("helpers", () => {
  it("writes full trade names for navigation", () => {
    expect(navName({ name: "Concrete / Foundation / Driveway" })).toBe("Concrete, Foundation and Driveway");
    expect(navName({ name: "Doors & Windows" })).toBe("Doors and Windows");
    expect(navName({ name: "Roofing" })).toBe("Roofing");
  });

  it("keeps owner placeholders visible until real values arrive", () => {
    expect(hasPlaceholder("(404) [YOUR NUMBER]")).toBe(true);
    expect(hasPlaceholder("(404) 555-0100")).toBe(false);
    // Structured data only publishes the phone once a real E.164 number is set.
    if (hasPlaceholder(site.phone.display)) expect(site.phone.e164).toBe("");
  });
});

describe("metadata and structured data", () => {
  it("builds consistent page metadata", async () => {
    const { pageMetadata } = await import("@/lib/metadata");
    const m = pageMetadata({ title: "T", description: "D", path: "/x", noindex: true });
    expect(m.alternates?.canonical).toBe("/x");
    expect(m.openGraph).toMatchObject({ title: "T", description: "D", url: "/x" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(pageMetadata({ title: "T", description: "D", path: "/" }).robots).toBeUndefined();
  });

  it("numbers breadcrumbs and makes their URLs absolute", async () => {
    const { breadcrumbJsonLd } = await import("@/lib/structured-data");
    const b = breadcrumbJsonLd([
      { name: "Solvern Home", path: "/" },
      { name: "Solvern HVAC", path: "/hvac" },
    ]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toMatch(/^https?:\/\/.+\/hvac$/);
  });

  it("leaves FAQ structured data out when every answer is a placeholder", async () => {
    const { faqJsonLd } = await import("@/lib/structured-data");
    expect(faqJsonLd([{ q: "Q", a: "[Wording from your financing partner]" }])).toBeNull();
    expect(faqJsonLd([{ q: "Q", a: "Yes." }])?.mainEntity).toHaveLength(1);
  });
});

describe("logo symbol", () => {
  it("is served from public/ under the id the Lockup component uses", async () => {
    const fs = await import("node:fs");
    const logo = fs.readFileSync("src/components/Logo.tsx", "utf8");
    const href = logo.match(/<use href="\/([^"#]+)#([^"]+)"/);
    expect(href).not.toBeNull();
    const svg = fs.readFileSync(`public/${href![1]}`, "utf8");
    expect(svg).toContain(`<symbol id="${href![2]}" viewBox="0 0 671.6 96">`);
    expect(svg).not.toMatch(/fill="#/); // color must come from currentColor
  });
});
