// Enforces the non-negotiable rules in CLAUDE.md across source, content and public assets:
// no gray hex values, no em dashes, no banned words, no licensing mentions, no exclamation marks in copy.
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "public"];
const EXT = /\.(tsx?|css|json|svg|md)$/;
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.test(e.name)) files.push(p);
  }
};
ROOTS.forEach((r) => fs.existsSync(r) && walk(r));

const problems = [];
const report = (f, line, msg) => problems.push(`${f}:${line}  ${msg}`);

// A hex reads as gray when its channels are nearly equal. White is the page ground and allowed.
const isGray = (hex) => {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (r === 255 && g === 255 && b === 255) return false;
  return Math.max(r, g, b) - Math.min(r, g, b) < 7;
};

const BANNED = [
  [/\bAI\b/, "AI"],
  [/artificial intelligence/i, "artificial intelligence"],
  [/powered by/i, "powered by"],
  [/\bsmart\b(?!\s+home)/i, "smart (outside 'smart home')"],
  [/algorithm/i, "algorithm"],
  [/cutting[- ]edge/i, "cutting-edge"],
  [/\binnovative\b/i, "innovative"],
  [/next[- ]gen/i, "next-gen"],
  [/revolutionary/i, "revolutionary"],
  [/\bdisrupt/i, "disrupt"],
  [/\blicen[cs]/i, "licensing"],
  [/\baffordable\b/i, "affordable"],
  [/\bcheap\b/i, "cheap"],
  [/world[- ]class/i, "world-class"],
  [/best in atlanta/i, "best in Atlanta"],
  [/\brendering\b/i, "rendering (say Concept Preview)"],
  [/self[- ]performed|subcontracted/i, "self-performed / subcontracted"],
];
const SKIP_WORDS = new Set(["scripts/check-brand.mjs"]);

for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const lines = text.split("\n");
  const isFont = f.includes("/fonts/");
  lines.forEach((ln, i) => {
    const n = i + 1;
    if (ln.includes("—")) report(f, n, "em dash");
    for (const m of ln.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) if (isGray(m[0])) report(f, n, `gray color ${m[0]}`);
    if (/\b(gray|grey|silver|slategray)\b/i.test(ln) && /(color|background|fill|stroke|border)\s*[:=]/i.test(ln)) report(f, n, "named gray color");
    if (isFont || SKIP_WORDS.has(f)) return;
    // Code comments may discuss the rules; check only non-comment text.
    const code = ln.replace(/\/\/.*$|\/\*.*?\*\/|^\s*\*.*$/g, "");
    for (const [re, label] of BANNED) if (re.test(code)) report(f, n, `banned word: ${label}`);
    if (f.endsWith(".json") && /"[^"]*\w![^=][^"]*"/.test(code)) report(f, n, "exclamation mark in copy");
  });
}

if (problems.length) {
  console.error(`Brand check failed (${problems.length}):\n` + problems.join("\n"));
  process.exit(1);
}
console.log(`Brand check passed: ${files.length} files, no gray, no em dashes, no banned words.`);
