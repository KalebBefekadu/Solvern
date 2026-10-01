import { HUB_THEME, tradesByFamily } from "@/lib/content";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { BottomBar } from "./BottomBar";

export function SimplePage({ children }: { children: React.ReactNode }) {
  const groups = tradesByFamily();
  return (
    <div style={HUB_THEME}>
      <SiteHeader
        variant="hub"
        links={[
          { label: "Projects", href: "/#projects" },
          { label: "How it works", href: "/#how" },
          { label: "Reviews", href: "/reviews" },
          { label: "Financing", href: "/financing" },
        ]}
        primary={{ label: "Get my Concept Preview", href: "/concept-preview" }}
        tradeGroups={groups.map((g) => ({ family: g.family, trades: g.trades.map((t) => ({ slug: t.slug, shortName: t.shortName, color: t.color })) }))}
      />
      <main id="main">{children}</main>
      <SiteFooter withTrades />
      <BottomBar primary={{ label: "Concept Preview", href: "/concept-preview" }} />
    </div>
  );
}
