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

## 2026-10-01: build pass 2, production hardening (Claude)
No approved design, copy or color was changed.
- 2026-10-01: Finished the verify run that pass 1 stopped on. It passed; the fixes below came from a code review and new tests.
- 2026-10-01: Hub hero no longer scrolls sideways at 320px (stat panel padding and number size reduced on phones only).
- 2026-10-01: Lead and upload routes now refuse cross-site posts, bodies over 1 MB, and bursts from one address (8 leads or 20 upload batches per 10 minutes, per server instance). Turnstile stays the main spam control.
- 2026-10-01: A lead whose photo rows fail to save is removed again, so a retry never leaves a half-saved lead. Calls to Resend and Turnstile time out instead of hanging a submission.
- 2026-10-01: Drawn strokes are thinned before upload (points closer than about 0.1% of the photo are dropped, at most 1,500 points per stroke). Long strokes from high-rate pens can no longer push a request over the size limit. Limits on photos, strokes, notes and note length live in one file shared by the drawing tool and the server.
- 2026-10-01: Security headers: Content Security Policy, HSTS, frame blocking. Adding Google Tag Manager later needs its hosts added to the policy in `site/next.config.ts`.
- 2026-10-01: Added `/api/health` (reports which services are configured, never their values), error pages, unit and API tests (Vitest), browser tests on desktop and phone with an axe accessibility scan (Playwright), and a GitHub Actions workflow that runs all of it on every push and pull request.
- PENDING 2026-10-01: On /customer-service, the topic select and the message box share the label "What would you like to discuss?" when the visitor picks Yes (that is how the approved design reads). Screen reader users hear two fields with the same name. Proposed: label the message box "Tell us more". Not changed until the owner approves.

## 2026-10-01: build pass 3, review across SEO, reliability, accessibility and code quality (Claude)
No approved design, copy or color was changed.
- 2026-10-01: Share cards (Open Graph and Twitter) for every page, rendered from the brand: the mark, Plus Jakarta Sans, the page headline and the trade color. Not an illustration. Static 600 and 800 weights of the same font were cut for the renderer (`src/fonts/og`), which cannot read the variable file.
- 2026-10-01: Every page now uses one metadata helper, so canonical, Open Graph and Twitter tags always agree. Before this, most pages had no share image and no Twitter tags.
- 2026-10-01: Breadcrumb structured data on trade pages; the four named service areas are listed in the business structured data. Home screen icon and web manifest added.
- 2026-10-01: Vercel preview deployments are kept out of search (robots disallow and noindex header).
- 2026-10-01: Customer confirmation emails leave out any sentence that still holds a placeholder. `npm run check:launch` lists everything left to fill in before go-live.
- 2026-10-01: A retried form submission is stored once (request id per attempt, migration 0002). Migration 0002 also adds `updated_at` and database length limits.
- 2026-10-01: Photos in formats the bucket refuses (GIF, AVIF, BMP), or over 15 MB, are converted to JPEG in the browser instead of failing at upload. The drop zone line no longer says "JPG or PNG, up to 15 MB" since any phone photo now works.
- 2026-10-01: Leaving a page with unsent marked-up photos asks first. Forms report `form_error` to analytics and set `aria-busy` while sending. The mobile menu closes on Escape and returns focus to its button.
- 2026-10-01: Both forms share one submission hook and one set of client validators (tested to match the server). The hub header is one component. Lint now fails on warnings.
- 2026-10-01: The logo SVG is about 6 KB smaller per copy (coordinates rounded to 2 decimals, no visible change).

## 2026-10-01: build pass 4, accessibility beyond axe (Claude)
- 2026-10-01: The blue focus ring measured 2.92:1 on the ink footer, the ink phone card and the hub financing band, under the 3:1 WCAG asks. On those surfaces the ring now takes the surface's text color (white on ink, the trade's text color on trade bands). A browser test checks every focusable element on all 27 pages.
- 2026-10-01: Windows high contrast mode keeps the pen colors, trade swatches, note markers and drawings, which carry meaning in their color. The selected pen gets an outline.
- 2026-10-01: Print styles leave out navigation, sticky bars and forms.
- 2026-10-01: The mobile menu's links render only while it is open (about 3.5 KB less HTML per page).
- 2026-10-01: Dependencies: Next 15.5.27 (newest 15.x) pins PostCSS 8.4.31, which has published advisories. An npm override moves it to 8.5.28; `npm audit --omit=dev` now reports 0. The one remaining advisory is in Vitest 3 (dev only, affects running untrusted test code). Vitest 4 crashes npm 10's resolver, so the upgrade waits for npm 11 in CI. Next 16 is a major upgrade and is not taken in this pass.
