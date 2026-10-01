import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { seo, tradeBySlug, tradePage, trades, tradeTheme } from "@/lib/content";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BottomBar } from "@/components/BottomBar";
import { TradeIllustration } from "@/components/TradeIllustration";
import { PreviewForm } from "@/components/PreviewForm";
import { ClosingBand, FaqSection, FinancingBand, HowItWorks, JsonLd, NumberedList, ProofRow, ReviewsSection, SectionHead, TeamSection } from "@/components/sections";
import { faqJsonLd, localBusinessJsonLd, serviceJsonLd } from "@/lib/structured-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return trades.filter((t) => tradePage(t.slug)).map((t) => ({ trade: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ trade: string }> }): Promise<Metadata> {
  const { trade: slug } = await params;
  const t = tradeBySlug(slug);
  const page = tradePage(slug);
  const meta = seo.trades[slug];
  if (!t || !page || !meta) return {};
  const draft = page.copyStatus !== "approved";
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/${slug}` },
    openGraph: { title: meta.title, description: meta.description, url: `/${slug}` },
    // Draft copy stays out of search until the owner approves it.
    robots: draft ? { index: false, follow: true } : undefined,
  };
}

export default async function TradePage({ params }: { params: Promise<{ trade: string }> }) {
  const { trade: slug } = await params;
  const t = tradeBySlug(slug);
  const page = tradePage(slug);
  if (!t || !page) notFound();

  const diagnosis = page.primaryAction === "diagnosis";
  const anchor = diagnosis ? "#visit" : "#preview";
  const primary = { label: page.heroPrimaryButton, href: anchor };
  const draft = page.copyStatus !== "approved";

  return (
    <div style={tradeTheme(t)}>
      {draft && (
        <div className="draft-banner" role="note">
          Draft page: copy and colors pending owner approval.
        </div>
      )}
      <SiteHeader
        variant="trade"
        links={[
          { label: "Services", href: "#services" },
          { label: "Our team", href: "#about" },
          { label: "Reviews", href: "#reviews" },
          { label: "Financing", href: "#financing" },
        ]}
        primary={primary}
      />

      <main id="main">
        <section className="wrap hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <span className="pill">Solvern {page.shortName}</span>
            <h1 className="h1" id="hero-title">
              {page.heroHeadline}
            </h1>
            <p className="lead">{page.heroLead}</p>
            <div className="btn-row">
              <Link href={anchor} className="btn btn--trade" data-track="cta_click" data-location="hero">
                {page.heroPrimaryButton}
              </Link>
              <a href={site.phone.href} className="btn btn--outline" data-location="hero">
                Call {site.phone.display}
              </a>
            </div>
            <ProofRow proofLine={page.heroProofLine} />
          </div>
          <div className="hero__art">
            <TradeIllustration tool={t.tool} />
          </div>
        </section>

        <section className="section" id="services" aria-labelledby="services-title" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <div className="wrap cols-4-8">
            <div className="stack">
              <SectionHead eyebrow="What we do" title={page.servicesTitle} lead={page.servicesLead} id="services-title" />
            </div>
            <NumberedList items={page.services} />
          </div>
        </section>

        <section className="section section--tint" id={diagnosis ? "visit" : "preview"} aria-labelledby="see-title">
          <div className="wrap">
            <SectionHead eyebrow="See it first" title={page.seeItFirstTitle} lead={page.seeItFirstLead} id="see-title" />
            <PreviewForm
              trade={{
                slug: t.slug,
                name: t.name,
                diagnosis,
                photoSubject: page.photoSubject,
                formPlaceholder: page.formPlaceholder,
                exampleNotes: page.conceptMarkupExampleNotes,
              }}
            />
          </div>
        </section>

        <TeamSection shots={page.teamPhotoShotList} />
        <HowItWorks steps={page.howItWorks} />
        <ReviewsSection topic={page.topic} />
        <FinancingBand location={`trade-${slug}`} />
        <FaqSection title={`Questions about ${page.topic}`} items={page.faq} />
        <ClosingBand headline={page.closingHeadline} primary={primary} />
      </main>

      <SiteFooter />
      <BottomBar primary={{ label: diagnosis ? "Request a visit" : "Concept Preview", href: anchor }} />

      <JsonLd data={[localBusinessJsonLd(), serviceJsonLd(t, page), faqJsonLd(page.faq)]} />
    </div>
  );
}
