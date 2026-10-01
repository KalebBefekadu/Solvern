# Decision log

Add a dated line for every decision the owner makes during development.

## 2026-09-30: build pass 1 (Claude)
Decisions below were made during development. Items marked PENDING need Kaleb's approval; nothing approved was changed.
- 2026-09-30: Code lives in `site/` (Next.js 15 App Router, TypeScript, Vercel, Supabase, Resend, Turnstile). Owner chose the subfolder.
- 2026-09-30: Owner asked for the full build in one pass: phases 1 to 5, draft copy for the other 20 trades, and a first Solvern Home hub page. No new illustrations; the placeholder SVG is used in every trade hero.
- 2026-09-30: Plus Jakarta Sans is self-hosted (variable woff2, OFL) instead of loaded from Google Fonts. Same font, faster first paint, no third-party request.
- 2026-09-30: Photos upload straight from the browser to Supabase Storage with signed URLs, so 5 phone photos never hit Vercel's 4.5 MB function limit.
- 2026-09-30: Markup tool adds a "New note" button (start a new note with the same pen) and a note list under the photo on phones, where floating note boxes would cover the picture. Spec behavior is otherwise unchanged.
- 2026-09-30: The standalone /concept-preview page offers the 6 hub project types as well as the 23 trades.
- 2026-09-30: On light trade colors (HVAC, painting, insulation and other ink-text trades) the white "See financing options" button uses the trade's deep color for its text, to pass WCAG AA. Dark trades keep the approved trade-color text.
- 2026-09-30: Draft trade pages show a "Draft page" banner, are noindex and stay out of the sitemap until approved.
- PENDING 2026-09-30: Tint, tint-strong and deep regenerated for the 20 undesigned trades; new base hues proposed for roofing, garage doors, siding, windows and doors, insulation. See docs/10-color-proposals.md.
- PENDING 2026-09-30: Draft copy for 20 trades (docs/content/draft-copy-review.md), SEO titles and descriptions for every page (site/src/content/seo.json), hub page copy and layout, project types, about, financing FAQ, privacy and terms templates.
