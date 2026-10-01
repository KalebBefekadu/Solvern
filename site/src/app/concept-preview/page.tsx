import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { Suspense } from "react";
import { HUB_THEME, PROJECT_PREFIX, projects, tradePage, trades } from "@/lib/content";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PreviewForm, type TradeOption } from "@/components/PreviewForm";
import { PreviewFormWithQuery } from "@/components/PreviewFormWithQuery";
import { HowItWorks, JsonLd, SectionHead } from "@/components/sections";
import { localBusinessJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Get your Concept Preview | Solvern Home",
  description: "Send a photo of your home, draw on it to show what you want, and get a concept image and an estimate within 48 hours from Solvern Home in metro Atlanta.",
  path: "/concept-preview",
});

function options(): TradeOption[] {
  const projectOpts: TradeOption[] = projects.map((p) => ({
    slug: `${PROJECT_PREFIX}${p.slug}`,
    name: p.formName,
    diagnosis: false,
    photoSubject: "space",
    formPlaceholder: p.formPlaceholder,
    exampleNotes: ["Open this wall up to the kitchen.", "New flooring through here."],
  }));
  const tradeOpts: TradeOption[] = trades
    .map((t) => ({ t, page: tradePage(t.slug) }))
    .filter((x) => x.page)
    .map(({ t, page }) => ({
      slug: t.slug,
      name: t.name,
      diagnosis: page!.primaryAction === "diagnosis",
      photoSubject: page!.photoSubject,
      formPlaceholder: page!.formPlaceholder,
      exampleNotes: page!.conceptMarkupExampleNotes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...projectOpts, ...tradeOpts];
}

const STEPS = [
  { title: "Send a photo", description: "Draw on it to show what you want, in a few seconds." },
  { title: "See it first", description: "Your Concept Preview and estimate arrive within 48 hours." },
  { title: "Confirm on site", description: "We measure, confirm materials and give you a line-by-line estimate." },
  { title: "We build it", description: "On schedule, with updates at every stage and a final walkthrough." },
];

export default function ConceptPreviewPage() {
  const opts = options();
  return (
    <div style={HUB_THEME}>
      <SiteHeader
        variant="trade"
        links={[
          { label: "Trades", href: "/#trades" },
          { label: "Projects", href: "/#projects" },
          { label: "Reviews", href: "/reviews" },
          { label: "Financing", href: "/financing" },
        ]}
      />
      <main id="main">
        <section className="section section--tint" aria-labelledby="cp-title">
          <div className="wrap">
            <SectionHead
              as="h1"
              eyebrow="Concept Preview"
              title="See your project before we build it."
              lead="Upload a photo, draw on it to show what you want, and get a concept image and estimate within 48 hours."
              id="cp-title"
            />
            <Suspense fallback={<PreviewForm tradeOptions={opts} />}>
              <PreviewFormWithQuery options={opts} />
            </Suspense>
            <p className="small" style={{ marginTop: 24, maxWidth: 760 }}>
              Every concept image is labeled Concept Preview. Concept image for planning. Final materials and measurements are confirmed at your site visit.
            </p>
          </div>
        </section>
        <HowItWorks steps={STEPS} />
      </main>
      <SiteFooter />
      <JsonLd data={localBusinessJsonLd()} />
    </div>
  );
}
