# 07. Build plan

Work in order. Check each acceptance item before moving on.

## Phase 1: Foundation
- [x] Scaffold Next.js + TypeScript app, lint, format, Vercel config.
- [x] Add tokens, Plus Jakarta Sans, logo components (from `assets/logos/`).
- [x] Load and type `trades.json` and `trade-pages.json`.
- Accept: app runs, tokens applied, no gray values anywhere in the codebase (search for common gray hexes).

## Phase 2: Trade page template
- [x] Build every section in `04-page-specs.md` as a component, themed by trade.
- [x] Generate `/carpentry`, `/hvac`, `/masonry` from data. HVAC uses the diagnosis variant.
- [x] Responsive down to 320px; mobile sticky bottom bar.
- Accept: at 1440px the three pages match `design/reference-pages/`; copy matches the data file exactly; placeholders untouched; WCAG AA contrast; Lighthouse mobile performance and accessibility 90+.

## Phase 3: Customer service page
- [x] Build `/customer-service` with the branching form.
- Accept: branches show and hide correctly; keyboard and screen reader usable.

## Phase 4: Photo markup tool and forms
- [x] Build the markup tool per `05-features.md`.
- [x] Wire Concept Preview, visit and callback forms to Supabase with uploads, notifications and spam protection.
- Accept: a test submission from a phone stores the photo, annotated image, strokes, notes and fields, and emails the team.

## Phase 5: SEO and launch prep
- [x] Metadata, structured data, sitemap, analytics events, 404 page, privacy and terms pages.
- Accept: every page has unique title and description; events fire.

## Phase 6: Remaining trades and main site (needs owner input)
- [ ] Owner approves colors and copy for the other 20 trades; generate their pages. (Pages are built from draft copy and proposed colors, marked draft and noindex.)
- [ ] Design, then build Solvern Home (main site) with the full trade directory. (First version built at `/`, pending owner review.)
- [ ] Swap final illustrations when supplied.

## Status (2026-09-30)
Phases 1 to 5 are built in `site/` and verified locally: type check, lint, brand and color checks, production build, axe WCAG 2.1 AA on every page at 1440 and 375px, Lighthouse mobile 98 to 99 performance and 100 accessibility, no horizontal scroll at 320px, and a full browser test of the markup tool and both forms. Remaining for Phase 4 acceptance: connect Supabase and Resend, then send a real test from a phone. Phase 6 is drafted and waiting on owner approval.
