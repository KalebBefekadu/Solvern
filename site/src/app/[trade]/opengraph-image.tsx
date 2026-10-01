import { notFound } from "next/navigation";
import { tradeBySlug, tradePage, trades } from "@/lib/content";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return trades.filter((t) => tradePage(t.slug)).map((t) => ({ trade: t.slug }));
}

export async function generateImageMetadata({ params }: { params: { trade: string } }) {
  const page = tradePage(params.trade);
  return [{ id: "card", alt: page ? `Solvern ${page.shortName}: ${page.heroHeadline}` : "Solvern Home", size: OG_SIZE, contentType: OG_CONTENT_TYPE }];
}

export default async function Image({ params }: { params: Promise<{ trade: string }> }) {
  const { trade: slug } = await params;
  const t = tradeBySlug(slug);
  const page = tradePage(slug);
  if (!t || !page) notFound();
  return renderOgImage({ eyebrow: `Solvern ${page.shortName}`, title: page.heroHeadline, color: t.color, onColor: t.onColor });
}
