import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import Link from "next/link";
import { site } from "@/content/site";
import { SimplePage } from "@/components/SimplePage";
import { FaqSection } from "@/components/sections";

export const metadata: Metadata = pageMetadata({
  title: "Financing: pay over time | Solvern Home",
  description: "Monthly payment options for Solvern Home projects across metro Atlanta. Know your options before work begins, then see your project in a Concept Preview.",
  path: "/financing",
});

/**
 * The financing partner (candidates: Wisetack, Hearth, GreenSky) handles approval and credit.
 * Drop their link into site.financing.applyUrl or embed their prequalification widget below.
 * Never state rates, terms or approval claims until the partner provides approved wording.
 */
export default function FinancingPage() {
  return (
    <SimplePage>
      <section className="wrap page-head" aria-labelledby="f-title">
        <span className="eyebrow">Financing</span>
        <h1 className="h1" id="f-title">
          Pay over time.
        </h1>
        <p className="lead">
          Monthly payment options through {site.financing.partner} for projects over {site.financing.minimum}. Apply in minutes and know your options before work begins.
        </p>
      </section>
      <section className="wrap" style={{ paddingBottom: 40 }} aria-label="Prequalification">
        <div className="band" style={{ gridTemplateColumns: "1fr" }}>
          <div className="band__cta">
            <a href={site.financing.applyUrl || "#financing-apply"} className="btn btn--white" data-track="financing_click" data-location="financing-page">
              See financing options
            </a>
            <span className="small">{site.financing.terms}</span>
          </div>
        </div>
        <div className="notice" id="financing-apply" style={{ marginTop: 20 }}>
          [Prequalification widget or link from {site.financing.partner}]
        </div>
      </section>
      <FaqSection
        title="Questions about financing"
        items={[
          { q: "Who provides the financing?", a: `Financing is provided by ${site.financing.partner}, who handles the application and approval.` },
          { q: "Does checking my options affect my credit?", a: "[Wording from your financing partner]" },
          { q: "Can I finance any project?", a: `Projects over ${site.financing.minimum} can be financed. ${site.financing.terms}` },
          { q: "When should I apply?", a: "Any time before work begins. Many homeowners apply after their Concept Preview and estimate, so they know the full picture." },
        ]}
      />
      <section className="section">
        <div className="wrap btn-row">
          <Link href="/concept-preview" className="btn btn--ink" data-track="cta_click" data-location="financing-page">
            Get my Concept Preview
          </Link>
        </div>
      </section>
    </SimplePage>
  );
}
