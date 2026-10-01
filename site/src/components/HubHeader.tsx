import { tradesByFamily } from "@/lib/content";
import { SiteHeader } from "./SiteHeader";

const HUB_LINKS = [
  { label: "Projects", href: "/#projects" },
  { label: "How it works", href: "/#how" },
  { label: "Reviews", href: "/reviews" },
  { label: "Financing", href: "/financing" },
];

/** Header for Solvern Home pages: the full trades menu (never shown on trade pages, owner rule). */
export function HubHeader() {
  const tradeGroups = tradesByFamily().map((g) => ({
    family: g.family,
    trades: g.trades.map((t) => ({ slug: t.slug, shortName: t.shortName, color: t.color })),
  }));
  return <SiteHeader variant="hub" links={HUB_LINKS} primary={{ label: "Get my Concept Preview", href: "/concept-preview" }} tradeGroups={tradeGroups} />;
}
