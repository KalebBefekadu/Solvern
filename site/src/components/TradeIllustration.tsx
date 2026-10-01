/**
 * Placeholder from assets/illustrations/placeholder-trade-illustration.svg (560 x 440).
 * Trade illustrations are not final: every trade hero uses this until the owner supplies final art.
 * To swap in final art later, add `illustration` to the trade in trades.json and render it here.
 */
export function TradeIllustration({ tool }: { tool?: string }) {
  return (
    <svg
      viewBox="0 0 560 440"
      width="560"
      height="440"
      role="img"
      aria-label={tool ? `Placeholder for the final ${tool.toLowerCase()} illustration` : "Placeholder for the final trade illustration"}
    >
      <rect x="8" y="8" width="544" height="424" rx="16" fill="#FFFFFF" stroke="#1B2330" strokeWidth="1.5" strokeDasharray="8 8" />
      <g transform="rotate(-35 280 190)">
        <rect x="268" y="150" width="24" height="170" rx="10" fill="#1B2330" />
        <rect x="272" y="160" width="4" height="150" rx="2" fill="#FFFFFF" opacity="0.25" />
        <path d="M214 112 L330 112 Q346 112 346 128 L346 150 L214 150 Q200 150 200 136 L200 126 Q200 112 214 112 Z" fill="#1B2330" />
        <path d="M346 118 L384 104 Q392 101 392 110 L392 132 Q392 140 384 138 L346 144 Z" fill="#1B2330" />
        <rect x="214" y="118" width="120" height="4" rx="2" fill="#FFFFFF" opacity="0.3" />
      </g>
      <text x="280" y="360" textAnchor="middle" fontFamily="var(--font)" fontSize="22" fontWeight="700" fill="#1B2330">
        Add final illustration
      </text>
      <text x="280" y="390" textAnchor="middle" fontFamily="var(--font)" fontSize="14" fill="#1B2330">
        560 x 440, SVG
      </text>
    </svg>
  );
}
