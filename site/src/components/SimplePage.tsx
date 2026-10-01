import { HUB_THEME } from "@/lib/content";
import { HubHeader } from "./HubHeader";
import { SiteFooter } from "./SiteFooter";
import { BottomBar } from "./BottomBar";

export function SimplePage({ children }: { children: React.ReactNode }) {
  return (
    <div style={HUB_THEME}>
      <HubHeader />
      <main id="main">{children}</main>
      <SiteFooter withTrades />
      <BottomBar primary={{ label: "Concept Preview", href: "/concept-preview" }} />
    </div>
  );
}
