import type { Metadata } from "next";
import { site } from "@/content/site";

interface PageMeta {
  title: string;
  description: string;
  /** Path from the site root, used for the canonical URL and og:url. */
  path: string;
  /** Draft pages stay out of search until the owner approves them. */
  noindex?: boolean;
  /** Share image. Defaults to the site card; trade pages pass their own. */
  image?: { url: string; alt: string };
}

const SITE_CARD = { url: "/opengraph-image", alt: "Solvern Home: one team for every part of your home, across metro Atlanta.", width: 1200, height: 630 };

/**
 * One shape of metadata for every page: canonical, Open Graph and Twitter all agree.
 * Share images are rendered by the opengraph-image routes (src/lib/og.tsx).
 */
export function pageMetadata({ title, description, path, noindex, image }: PageMeta): Metadata {
  const images = [image ? { ...SITE_CARD, ...image } : SITE_CARD];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: site.name, locale: "en_US", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
