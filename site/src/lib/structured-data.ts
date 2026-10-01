import { site, hasPlaceholder } from "@/content/site";
import type { Faq, Trade, TradePage } from "./content";

const abs = (p: string) => new URL(p, site.url).toString();

/** LocalBusiness on every page. Placeholder values (phone, email) are left out until the owner supplies them. */
export function localBusinessJsonLd() {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": abs("/#business"),
    name: site.name,
    url: site.url,
    slogan: site.tagline,
    description: site.boilerplate,
    areaServed: { "@type": "City", name: "Atlanta", containedInPlace: { "@type": "State", name: "Georgia" } },
    logo: abs("/brand/solvern-lockup.svg"),
  };
  if (site.phone.e164) data.telephone = site.phone.e164;
  if (!hasPlaceholder(site.email)) data.email = site.email;
  return data;
}

export function serviceJsonLd(t: Trade, page: TradePage) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Solvern ${page.shortName}`,
    serviceType: t.name,
    description: t.scope,
    url: abs(`/${t.slug}`),
    provider: { "@id": abs("/#business") },
    areaServed: { "@type": "City", name: "Atlanta" },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${page.shortName} services`,
      itemListElement: page.services.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.title, description: s.description } })),
    },
  };
}

export function faqJsonLd(items: Faq[]) {
  const real = items.filter((f) => !hasPlaceholder(f.a));
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: real.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
