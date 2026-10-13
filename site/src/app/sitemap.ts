import type { MetadataRoute } from "next";
import { site, siteReady } from "@/content/site";
import { tradePage, trades } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (p: string) => new URL(p, site.url).toString();
  const fixed = [
    "/",
    "/concept-preview",
    "/customer-service",
    "/about",
    ...(siteReady.rating ? ["/reviews"] : []),
    ...(siteReady.financing ? ["/financing"] : []),
    ...(siteReady.legal ? ["/privacy", "/terms"] : []),
  ];
  // Only approved trade pages are listed; drafts are noindex until the owner approves their copy.
  const tradeUrls = trades.filter((t) => tradePage(t.slug)?.copyStatus === "approved").map((t) => `/${t.slug}`);
  return [...fixed, ...tradeUrls].map((p) => ({
    url: u(p),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: p === "/" ? 1 : tradeUrls.includes(p) ? 0.8 : 0.5,
  }));
}
