// WCAG 2.1 AA contrast for every trade theme, plus a gray check on tints.
import fs from "node:fs";

const { trades } = JSON.parse(fs.readFileSync("src/content/trades.json", "utf8"));
const INK = "#1B2330";
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const spread = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...v) - Math.min(...v);
};

const fails = [];
for (const t of trades) {
  const checks = [
    ["button text on trade color", t.onColor, t.color, 4.5],
    ["ink text on tint", INK, t.tint, 4.5],
    ["ink text on tint-strong", INK, t.tintStrong, 4.5],
    ["deep eyebrow on white", t.deep, "#FFFFFF", 4.5],
    ["deep eyebrow on tint", t.deep, t.tint, 4.5],
  ];
  for (const [what, fg, bg, min] of checks) {
    const r = ratio(fg, bg);
    if (r < min) fails.push(`${t.slug}: ${what} ${r.toFixed(2)} < ${min}`);
  }
  if (spread(t.tint) < 6) fails.push(`${t.slug}: tint ${t.tint} reads as gray`);
  if (spread(t.color) < 20) fails.push(`${t.slug}: color ${t.color} reads as gray`);
}
if (fails.length) {
  console.error("Color check failed:\n" + fails.join("\n"));
  process.exit(1);
}
console.log(`Color check passed: ${trades.length} trade themes meet WCAG AA and none read as gray.`);
