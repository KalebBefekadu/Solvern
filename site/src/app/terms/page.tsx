import type { Metadata } from "next";
import { site } from "@/content/site";
import { SimplePage } from "@/components/SimplePage";

export const metadata: Metadata = {
  title: "Terms of use | Solvern Home",
  description: "The terms that apply when you use the Solvern Home website, request a Concept Preview or estimate, or ask our team in metro Atlanta for a callback.",
  alternates: { canonical: "/terms" },
};

// Template for the owner's attorney to review before launch. Bracketed values are open items.
export default function TermsPage() {
  return (
    <SimplePage>
      <section className="wrap page-head">
        <span className="eyebrow">Legal</span>
        <h1 className="h1">Terms of use</h1>
        <p className="small">Last updated: [DATE]</p>
      </section>
      <section className="wrap" style={{ paddingBottom: 80 }}>
        <div className="prose">
          <p>These terms apply to your use of this website, operated by {site.legalName}, doing business as Solvern Home.</p>
          <h2>Concept Previews and estimates</h2>
          <p>
            A Concept Preview is a concept image for planning. Final materials and measurements are confirmed at your site visit. Estimates sent before a site visit are ranges, not fixed prices. Work begins only under a signed agreement.
          </p>
          <h2>What you send us</h2>
          <p>
            When you upload photos or notes, you confirm you have the right to share them, and you allow us to use them to prepare your Concept Preview and estimate. We will not publish them without your permission.
          </p>
          <h2>Website content</h2>
          <p>The text, design and logos on this site belong to Solvern Home. Please do not copy them without permission.</p>
          <h2>Financing</h2>
          <p>Financing is offered by {site.financing.partner}, subject to their approval and terms.</p>
          <h2>Contact</h2>
          <p>
            Questions about these terms: {site.phone.display} or {site.email}.
          </p>
        </div>
      </section>
    </SimplePage>
  );
}
