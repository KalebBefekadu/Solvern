import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import Link from "next/link";
import { site } from "@/content/site";
import { FAMILY_BLURB, navName, HUB_THEME, projects, seo, tradeBySlug, tradesByFamily } from "@/lib/content";
import { HubHeader } from "@/components/HubHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BottomBar } from "@/components/BottomBar";
import { ArrowRight } from "@/components/Icons";
import { ClosingBand, FaqSection, FinancingBand, HowItWorks, JsonLd, PhotoPlaceholder, ProofRow, ReviewsSection, TeamSection } from "@/components/sections";
import { faqJsonLd, localBusinessJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: seo.home.title,
  description: seo.home.description,
  path: "/",
});

const HOW = [
  { title: "Send a photo", description: "Show us the room or the whole project, and draw on it to point out what you want." },
  { title: "See your Concept Preview", description: "A concept image and an estimate range arrive within 48 hours." },
  { title: "Get a line-by-line estimate", description: "We visit, measure, confirm materials and price every line." },
  { title: "We build it", description: "One team, on schedule, with updates at every stage and a final walkthrough." },
];

const HUB_SERVICES = [
  { title: "Full project management", description: "One project lead plans the work, schedules every trade and is your single point of contact." },
  { title: "Permits and inspections", description: "We coordinate permits and inspections, so the paperwork moves with the schedule." },
  { title: "Design and planning", description: "Layouts, materials and finishes chosen with you, then shown in your Concept Preview." },
  { title: "Updates at every stage", description: "You always know what is happening, what it costs and what comes next." },
];

const FAQ = [
  { q: "How fast can I get an estimate?", a: "Send photos through the Concept Preview form and you will have a concept image and an estimate range within 48 hours." },
  {
    q: "Is the Concept Preview exactly what I will get?",
    a: "It is a concept image for planning. We confirm final materials and measurements at your site visit before any work begins.",
  },
  {
    q: "Can one team really handle my whole project?",
    a: "Yes. Solvern covers 23 trades, so one project lead plans the work, schedules every trade and keeps you updated at every stage.",
  },
  { q: "What if I only need one small job?", a: "We take single repairs too. Every job gets the same standard, and you have one team to call for whatever comes next." },
  {
    q: "Which areas do you serve?",
    a: `Homeowners across metro Atlanta, including ${site.areas.slice(0, -1).join(", ")} and ${site.areas.at(-1)}. Enter your zip code on any form and we will confirm coverage.`,
  },
];

export default function HomePage() {
  const groups = tradesByFamily();
  const primary = { label: "Get my Concept Preview", href: "/concept-preview" };
  return (
    <div style={HUB_THEME}>
      <HubHeader />

      <main id="main">
        <section className="wrap hub-hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <span className="pill">Solvern Home</span>
            <h1 className="h1" id="hero-title">
              One team for every part of your home.
            </h1>
            <p className="lead hub-hero__lead">
              From a single repair to a complete renovation, 23 trades across metro Atlanta under one accountable team. Send a photo and see your project before any work begins.
            </p>
            <div className="btn-row">
              <Link href="/concept-preview" className="btn btn--ink" data-track="cta_click" data-location="hero">
                Get my Concept Preview
              </Link>
              <a href={site.phone.href} className="btn btn--outline" data-location="hero">
                Call {site.phone.display}
              </a>
            </div>
            <ProofRow proofLine="See it first. Built right." />
          </div>
          <div className="hub-hero__aside">
            <div className="hub-stat">
              <b>23</b>
              <span>trades under one name</span>
            </div>
            <div className="hub-stat">
              <b>48 hours</b>
              <span>to your Concept Preview and estimate</span>
            </div>
            <div className="hub-stat">
              <b>1</b>
              <span>team accountable for the result</span>
            </div>
          </div>
        </section>

        <section className="section section--tint" id="trades" aria-labelledby="trades-title">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Every trade</span>
              <h2 className="h2" id="trades-title">
                Everything your home needs, one name.
              </h2>
              <p className="body-l">Choose a trade to see the work, or send a photo of the whole project and we will plan every part.</p>
            </div>
            <div className="directory">
              {groups.map(({ family, trades }) => (
                <div className="family-card" key={family}>
                  <div className="family-card__head">
                    <h3 className="family-card__name">{family}</h3>
                    <span className="small">{FAMILY_BLURB[family]}</span>
                  </div>
                  <ul>
                    {trades.map((t) => (
                      <li key={t.slug}>
                        <Link href={`/${t.slug}`} className="trade-link">
                          <span className="trade-link__name">
                            <span className="trade-link__chip" style={{ ["--sw" as string]: t.color }} aria-hidden="true" />
                            {navName(t)}
                          </span>
                          <ArrowRight />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="projects" aria-labelledby="projects-title">
          <div className="wrap">
            <div className="section-head section-head--split">
              <div className="section-head">
                <span className="eyebrow">Complete projects</span>
                <h2 className="h2" id="projects-title">
                  From first photo to final walkthrough.
                </h2>
              </div>
              <p className="body-l">Bigger projects need many trades. With Solvern they share one plan, one schedule and one team.</p>
            </div>
            <ul className="project-grid">
              {projects.map((p) => (
                <li className="project-card" key={p.slug}>
                  <PhotoPlaceholder shot={p.shot} />
                  <div className="project-card__body">
                    <h3 className="project-card__t">{p.name}</h3>
                    <p>{p.description}</p>
                    <p className="project-card__trades">
                      {p.trades
                        .map((s) => tradeBySlug(s)?.shortName)
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <Link href={`/concept-preview?project=${p.slug}`} className="text-link project-card__link" data-track="cta_click" data-location={`project-${p.slug}`}>
                      See your {p.formName.toLowerCase()} first
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section section--flush-top" aria-labelledby="hub-services-title">
          <div className="wrap">
            <h2 className="h2" id="hub-services-title">
              One plan, one schedule, one team.
            </h2>
            <ul className="promise-grid">
              {HUB_SERVICES.map((s) => (
                <li key={s.title}>
                  <h3 className="step-t">{s.title}</h3>
                  <p>{s.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div id="how">
          <HowItWorks steps={HOW} />
        </div>

        <TeamSection
          shots={[
            "[Photo: Solvern crew in branded uniforms at a whole-home renovation]",
            "[Photo: project lead reviewing a Concept Preview with homeowners]",
            "[Photo: Solvern vehicle and yard sign outside a finished home]",
          ]}
        />

        <ReviewsSection />
        <FinancingBand location="hub" />

        <section className="section section--flush-top" aria-labelledby="areas-title">
          <div className="wrap">
            <div className="band band--closing band--tint">
              <div className="stack stack--14">
                <span className="eyebrow">Service area</span>
                <h2 className="h2" id="areas-title">
                  Serving metro Atlanta.
                </h2>
                <p className="body-l">Enter your zip code on any form and we will confirm coverage.</p>
              </div>
              <ul className="areas" aria-label="Neighborhoods we serve">
                {site.areas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
                <li>And across metro Atlanta</li>
              </ul>
            </div>
          </div>
        </section>

        <FaqSection title="Questions about Solvern" items={FAQ} />
        <ClosingBand headline="See your project before we build it." primary={primary} />
      </main>

      <SiteFooter withTrades />
      <BottomBar primary={{ label: "Concept Preview", href: "/concept-preview" }} />
      <JsonLd data={[localBusinessJsonLd(), faqJsonLd(FAQ)]} />
    </div>
  );
}
