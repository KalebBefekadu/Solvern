import type { Metadata } from "next";
import { site } from "@/content/site";
import { SimplePage } from "@/components/SimplePage";
import { ClosingBand, ReviewsSection } from "@/components/sections";

export const metadata: Metadata = {
  title: "Reviews | Solvern Home",
  description: "What metro Atlanta homeowners say about Solvern Home: one team for 23 trades, a Concept Preview before work begins, and updates at every stage.",
  alternates: { canonical: "/reviews" },
};

/**
 * Reviews come from the Google Business Profile once it exists (05-features.md).
 * Plan: fetch server-side, cache (revalidate daily), render real cards here. Never invent reviews.
 */
export default function ReviewsPage() {
  return (
    <SimplePage>
      <section className="wrap page-head" aria-labelledby="r-title">
        <span className="eyebrow">Reviews</span>
        <h1 className="h1" id="r-title">
          Reviews from homeowners.
        </h1>
        <p className="lead">
          {site.rating.value} from {site.rating.count} reviews on {site.rating.source}. Every review is from a real Solvern customer, shown as written.
        </p>
      </section>
      <ReviewsSection />
      <ClosingBand headline="See your project before we build it." primary={{ label: "Get my Concept Preview", href: "/concept-preview" }} />
    </SimplePage>
  );
}
