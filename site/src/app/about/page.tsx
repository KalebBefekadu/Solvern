import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/content/site";
import { SimplePage } from "@/components/SimplePage";
import { ClosingBand, NumberedList, TeamSection } from "@/components/sections";

export const metadata: Metadata = pageMetadata({
  title: "About Solvern Home: one team for 23 trades in metro Atlanta",
  description: "Solvern Home is one accountable team for 23 trades across metro Atlanta. See your project in a Concept Preview first, then we build it right.",
  path: "/about",
});

const VALUES = [
  { title: "Precise", description: "We measure twice, quote clearly and finish what we promise." },
  { title: "Clear", description: "You always know what is happening, what it costs and what comes next." },
  { title: "Accountable", description: "One team owns the result. No finger pointing between trades." },
  { title: "Crafted", description: "The finish matters, including the parts nobody sees." },
  { title: "Respectful", description: "Of your home, your schedule and your budget." },
];

export default function AboutPage() {
  return (
    <SimplePage>
      <section className="wrap page-head" aria-labelledby="a-title">
        <span className="eyebrow">About Solvern</span>
        <h1 className="h1" id="a-title">
          Making home improvement clear, confident and certain.
        </h1>
        <p className="lead">{site.boilerplate}</p>
      </section>
      <section className="section section--tint" aria-labelledby="v-title">
        <div className="wrap cols-4-8">
          <div className="stack" style={{ gap: 16 }}>
            <span className="eyebrow">How we work</span>
            <h2 className="h2" id="v-title">
              Five standards on every job.
            </h2>
            <p className="body-l">Whether it is a single repair or a whole home, the standard does not change.</p>
          </div>
          <NumberedList items={VALUES} />
        </div>
      </section>
      <TeamSection
        id="team"
        shots={["[Photo: the Solvern team in branded uniforms]", "[Photo: project lead with homeowners at a final walkthrough]", "[Photo: Solvern technician arriving at a home]"]}
      />
      <ClosingBand headline="See your project before we build it." primary={{ label: "Get my Concept Preview", href: "/concept-preview" }} />
    </SimplePage>
  );
}
