// Derives tint, tint-strong and deep values for trades whose colors are not yet approved,
// using the same lightness and chroma pattern as the approved carpentry, HVAC and masonry values.
// Structure & Shell bases from v1 read as gray (chroma under 0.05), so they get proposed new hues.
// Usage: node scripts/derive-trade-colors.mjs <in trades.json> <out trades.json>
import { oklch, formatHex, wcagContrast, clampChroma } from "culori";
import fs from "node:fs";

const [, , inPath, outPath] = process.argv;
const data = JSON.parse(fs.readFileSync(inPath, "utf8"));
const INK = "#1B2330";

// Proposed replacement bases for gray-reading slate trades (owner review required).
const PROPOSED_BASE = {
  roofing: { l: 0.37, c: 0.085, h: 255 }, // deep navy
  "garage-doors": { l: 0.47, c: 0.13, h: 282 }, // indigo
  siding: { l: 0.56, c: 0.1, h: 238 }, // steel blue
  "windows-doors": { l: 0.68, c: 0.1, h: 228 }, // sky blue
  insulation: { l: 0.74, c: 0.09, h: 290 }, // periwinkle
};

const hex = (o) => formatHex(clampChroma({ mode: "oklch", ...o }, "oklch"));

for (const t of data.trades) {
  if (t.status === "designed") {
    t.colorStatus = "approved";
    continue;
  }
  const v1 = t.color;
  let base = oklch(t.color);
  if (PROPOSED_BASE[t.slug]) {
    t.color = hex(PROPOSED_BASE[t.slug]);
    base = oklch(t.color);
  }
  const h = base.h ?? 0;
  t.tint = hex({ l: 0.965, c: 0.014, h });
  t.tintStrong = hex({ l: 0.905, c: 0.034, h });
  t.deep = hex({ l: 0.41, c: Math.min(0.11, Math.max(0.06, base.c * 0.85)), h });
  t.onColor = wcagContrast(t.color, "#FFFFFF") >= 4.5 ? "#FFFFFF" : INK;
  t.colorStatus = "proposed";
  t.v1Color = v1;
}
data._note =
  "Source of truth for all 23 trades. carpentry, hvac and masonry colors are approved v2 values (colorStatus: approved). " +
  "The other 20 use tint/tintStrong/deep derived from the approved pattern by scripts/derive-trade-colors.mjs (colorStatus: proposed). " +
  "Roofing, garage doors, siding, windows and doors, and insulation have proposed new base hues because the v1 slate values read as gray; v1Color keeps the original.";
fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");
for (const t of data.trades)
  console.log(
    t.slug.padEnd(14),
    t.color,
    t.tint,
    t.tintStrong,
    t.deep,
    "on",
    t.onColor === INK ? "ink" : "white",
    "onC",
    wcagContrast(t.color, t.onColor).toFixed(2),
    "deep/tint",
    wcagContrast(t.deep, t.tint).toFixed(2),
    "ink/strong",
    wcagContrast(INK, t.tintStrong).toFixed(2),
  );
