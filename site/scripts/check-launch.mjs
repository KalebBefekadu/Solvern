// Lists everything that must be filled in before the site goes live, then fails if anything is left.
// Not part of `verify`: placeholders are expected until the owner supplies real values (docs/08-open-items.md).
import fs from "node:fs";

const problems = [];
const site = fs.readFileSync("src/content/site.ts", "utf8");

site.split("\n").forEach((line, i) => {
  if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
  // Only bracketed text inside string literals is a placeholder (not arrays or regexes).
  for (const str of line.matchAll(/"([^"]*)"/g)) {
    for (const m of str[1].matchAll(/\[[^\]]+\]/g)) problems.push(`src/content/site.ts:${i + 1}  placeholder ${m[0]}`);
  }
});
if (/tel:\+14045550123/.test(site)) problems.push("src/content/site.ts  phone.href is still the design reference's dummy number");
if (/e164:\s*""/.test(site)) problems.push("src/content/site.ts  phone.e164 is empty (the number is left out of structured data)");
if (/applyUrl:\s*""/.test(site)) problems.push("src/content/site.ts  financing.applyUrl is empty");

for (const f of ["src/content/trade-pages.json", "src/content/projects.json"]) {
  const n = (fs.readFileSync(f, "utf8").match(/\[(?:Photo|Customer|Response|YOUR|Wording)[^\]]*\]/g) || []).length;
  if (n) problems.push(`${f}  ${n} placeholder${n === 1 ? "" : "s"} (photos, reviews or owner wording)`);
}
const drafts = Object.keys(JSON.parse(fs.readFileSync("src/content/trade-pages-draft.json", "utf8")).pages);
if (drafts.length) problems.push(`src/content/trade-pages-draft.json  ${drafts.length} trade pages still in draft (noindex): ${drafts.join(", ")}`);

for (const k of ["NEXT_PUBLIC_SITE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "LEAD_NOTIFY_TO", "LEAD_NOTIFY_FROM", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]) {
  if (!process.env[k]) problems.push(`env  ${k} is not set in this shell (set it in Vercel)`);
}

if (problems.length) {
  console.error(`Not ready to launch. ${problems.length} item${problems.length === 1 ? "" : "s"} left:\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("Launch check passed: no placeholders, every service configured.");
