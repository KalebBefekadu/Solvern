import Image from "next/image";

interface Props {
  slug: string;
  tradeName: string;
  tool: string;
  family: string;
}

/**
 * The render and the annotation intentionally stay separate. The raster carries the
 * material detail; live type keeps the specification language sharp and editable.
 */
export function TradeIllustration({ slug, tradeName, tool, family }: Props) {
  return (
    <figure className="trade-illustration">
      <Image
        className="trade-illustration__image"
        src={`/illustrations/trades/${slug}.jpg`}
        alt={`${tool} for Solvern ${tradeName}, rendered in graphite and brushed metal with the ${tradeName} accent color.`}
        width={1280}
        height={698}
        sizes="(max-width: 1024px) 92vw, 46vw"
        preload
      />
      <figcaption className="trade-illustration__spec" aria-hidden="true">
        <span className="trade-illustration__index">01</span>
        <span className="trade-illustration__line" />
        <span className="trade-illustration__label">
          <b>{tool}</b>
          <small>{family}</small>
        </span>
      </figcaption>
    </figure>
  );
}
