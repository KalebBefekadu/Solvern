import Link from "next/link";
import { site } from "@/content/site";
import type { Faq, Item } from "@/lib/content";
import { CameraIcon, Star, Stars } from "./Icons";

export function SectionHead({ eyebrow, title, lead, id, as = "h2" }: { eyebrow?: string; title: string; lead?: string; id?: string; as?: "h1" | "h2" }) {
  const H = as;
  return (
    <div className="section-head">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <H className={as === "h1" ? "h1" : "h2"} id={id}>
        {title}
      </H>
      {lead && <p className="body-l">{lead}</p>}
    </div>
  );
}

export function ProofRow({ proofLine }: { proofLine: string }) {
  return (
    <div className="proof-row">
      <span className="rating">
        <Star size={18} />
        {site.rating.value} from {site.rating.count} reviews
      </span>
      <span>{proofLine}</span>
    </div>
  );
}

export function NumberedList({ items }: { items: Item[] }) {
  return (
    <ol className="numbered">
      {items.map((s, i) => (
        <li key={s.title}>
          <span className="numbered__n" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="numbered__t">{s.title}</h3>
          <p>{s.description}</p>
        </li>
      ))}
    </ol>
  );
}

export function PhotoPlaceholder({ shot }: { shot: string }) {
  return (
    <div className="photo-ph" role="img" aria-label={shot.replace(/^\[Photo: |\]$/g, "")}>
      <CameraIcon />
      <span aria-hidden="true">{shot}</span>
    </div>
  );
}

export function TeamSection({ shots, id = "about" }: { shots: string[]; id?: string }) {
  return (
    <section className="section" id={id} aria-labelledby={`${id}-title`}>
      <div className="wrap">
        <div className="section-head section-head--split">
          <div className="section-head">
            <span className="eyebrow">Our team at work</span>
            <h2 className="h2" id={`${id}-title`}>
              Real people, in your home, doing it right.
            </h2>
          </div>
          <p className="body-l">Every Solvern technician arrives in uniform, walks you through the plan and leaves the space clean.</p>
        </div>
        <div className="photo-grid">
          {shots.slice(0, 3).map((s) => (
            <PhotoPlaceholder key={s} shot={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks({ steps, title = "Simple from the first photo to the final walkthrough." }: { steps: Item[]; title?: string }) {
  return (
    <section className="section" aria-labelledby="how-title">
      <div className="wrap">
        <div className="section-head" style={{ maxWidth: "none", gap: 40 }}>
          <span className="eyebrow">How it works</span>
        </div>
        <h2 className="h2" id="how-title" style={{ marginTop: 40 }}>
          {title}
        </h2>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="step-n" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="step-t">{s.title}</h3>
              <p>{s.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ReviewsSection({ topic }: { topic?: string }) {
  const placeholder = topic ? `[Customer review mentioning ${topic}]` : "[Customer review]";
  return (
    <section className="section section--tint" id="reviews" aria-labelledby="reviews-title">
      <div className="wrap">
        <div className="reviews-head">
          <div className="section-head">
            <span className="eyebrow">Reviews</span>
            <h2 className="h2" id="reviews-title">
              What homeowners say.
            </h2>
          </div>
          <div className="rating-summary">
            <div className="stack" style={{ gap: 6 }}>
              <span className="rating-big">{site.rating.value}</span>
              <Stars label={`Rated ${site.rating.value} out of 5`} />
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span style={{ fontWeight: 700 }}>
                {site.rating.count} reviews on {site.rating.source}
              </span>
              <Link href="/reviews" className="text-link">
                Read all reviews
              </Link>
            </div>
          </div>
        </div>
        <div className="review-grid">
          {[0, 1, 2].map((i) => (
            <blockquote className="review-card" key={i}>
              <Stars label="5 out of 5" />
              <p className="body-l">{placeholder}</p>
              <footer>
                <span className="avatar" aria-hidden="true">
                  [A]
                </span>
                <span style={{ fontSize: 15, lineHeight: "22px", fontWeight: 700 }}>
                  [Name]
                  <br />
                  <span style={{ fontWeight: 500 }}>[Neighborhood], via {site.rating.source}</span>
                </span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinancingBand({ location }: { location: string }) {
  const href = site.financing.applyUrl || "/financing";
  return (
    <section className="section" id="financing" aria-labelledby="financing-title" style={{ paddingTop: 80 }}>
      <div className="wrap">
        <div className="band">
          <div className="stack" style={{ gap: 14 }}>
            <h2 className="h2" id="financing-title">
              Pay over time.
            </h2>
            <p style={{ fontSize: 18, lineHeight: "29px" }}>
              Monthly payment options through {site.financing.partner} for projects over {site.financing.minimum}. Apply in minutes and know your options before work begins.
            </p>
          </div>
          <div className="band__cta">
            <a href={href} className="btn btn--white" data-track="financing_click" data-location={location}>
              See financing options
            </a>
            <span className="small">{site.financing.terms}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ title, items }: { title: string; items: Faq[] }) {
  return (
    <section className="section section--tint" id="faq" aria-labelledby="faq-title">
      <div className="wrap cols-4-8">
        <h2 className="h2" id="faq-title">
          {title}
        </h2>
        <div className="faq">
          {items.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingBand({ headline, primary }: { headline: string; primary: { label: string; href: string } }) {
  return (
    <section className="section" style={{ paddingTop: 0 }} aria-labelledby="closing-title">
      <div className="wrap" style={{ paddingTop: 80 }}>
        <div className="band band--closing">
          <h2 className="h2 h2--xl" id="closing-title">
            {headline}
          </h2>
          <div className="btn-row">
            <Link href={primary.href} className="btn btn--ink" data-track="cta_click" data-location="closing">
              {primary.label}
            </Link>
            <a href={site.phone.href} className="btn btn--outline" data-location="closing">
              Call {site.phone.display}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Structured data. Null entries (sections with nothing publishable yet) are dropped. */
export function JsonLd({ data }: { data: object | (object | null)[] }) {
  const items = Array.isArray(data) ? data.filter((d): d is object => d !== null) : [data];
  if (!items.length) return null;
  const json = items.length === 1 ? items[0] : items;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }} />;
}
