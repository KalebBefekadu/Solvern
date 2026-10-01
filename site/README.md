# Solvern Home website

Next.js 16 (App Router, Turbopack) + TypeScript, deployed on Vercel, Supabase for leads and photo storage, Resend for email. Built from the handoff docs in `../docs` (read `../CLAUDE.md` first).

## Run it

```bash
npm install
cp .env.example .env.local   # every value is optional in development
npm run dev                  # http://localhost:3000
```

Without Supabase or Resend keys, development still works end to end: leads are written to `./.data/leads/*.json`, photos to `./.data/uploads`, and emails are printed to the terminal.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (Next.js rules) |
| `npm run check:brand` | Fails on gray hex values, em dashes, emoji, banned words (AI, smart, licensing...), exclamation marks in copy |
| `npm run check:colors` | WCAG AA contrast for all 23 trade themes and a gray check on every trade color and tint |
| `npm test` | Unit and API tests (Vitest): validation, content integrity, markup serialization, the lead and upload routes end to end against the local store |
| `npm run verify` | All of the above, then a production build. Run before every deploy |
| `npm run test:e2e` | Browser tests (Playwright) against the production build, desktop and phone: every page with an axe WCAG 2.1 AA scan and a 320px overflow check, the callback form, photo upload and drawing, Concept Preview and visit submissions, SEO and security headers. Run `npm run build` first |
| `npm run test:visual` | Screenshot comparison only (part of `test:e2e`): 12 pages on desktop and phone plus the open mobile menu, against the baselines in `tests/e2e/__screenshots__`. Linux only, since the baselines come from Linux Chromium (the CI runner); on a Mac they skip. Run `npm run build` first |
| `npm run test:visual:update` | After an approved design change: rewrite the baselines, then review every changed image in the diff before committing |
| `npm run verify:full` | `verify` plus the browser tests |
| `npm run check:launch` | Go-live gate: lists every placeholder still in `site.ts` and the content files, draft trade pages, missing financing link and unset production env vars. Fails until all are done. Not part of `verify` |

CI (`.github/workflows/ci.yml`) runs `verify` and `test:e2e` on every push and pull request.

## Logs

Server code logs through `src/lib/server/log.ts`: one JSON line per event with `level` and `event` (for example `lead.stored`, `lead.failed`, `lead.notification_failed`), ids and counts only. Search Vercel logs for `"level":"error"` or set an alert on it.

## Pages

| Route | Source | Status |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Solvern Home hub: hero, 23-trade directory by family, project types, how it works, team, reviews, financing, service area, FAQ. **Draft design**, owner review |
| `/[trade]` | `src/app/[trade]/page.tsx` | One template for all 23 trades, themed from `trades.json` |
| `/customer-service` | `src/app/customer-service/page.tsx` | Branching callback form. Prefill from email links: `?job=SV-1234&first=Dana&last=Smith&email=...&phone=...&zip=...` |
| `/concept-preview` | `src/app/concept-preview/page.tsx` | Standalone Concept Preview with trade or project picker. Preselect with `?trade=roofing` or `?project=kitchen` |
| `/reviews`, `/financing`, `/about`, `/privacy`, `/terms` | `src/app/*` | Placeholder-driven; privacy and terms are templates for an attorney to review |
| `/sitemap.xml`, `/robots.txt` | `src/app/sitemap.ts`, `robots.ts` | Sitemap lists approved trade pages only |
| `/api/health` | `src/app/api/health/route.ts` | Deploy check, see Production setup |
| `/opengraph-image`, `/<trade>/opengraph-image/card` | `src/lib/og.tsx` | Share cards for links in messages and social posts: the Solvern mark, the page headline and the trade color. Rendered at build time |
| `/apple-icon`, `/manifest.webmanifest` | `src/app/apple-icon.tsx`, `manifest.ts` | Home screen icon and web manifest |

Trade pages never link out to other trades (owner rule). The full directory lives only on the hub, its menu and footer.

## Content (edit data, not code)

| File | Holds |
| --- | --- |
| `src/content/site.ts` | Phone, email, legal name, rating, callback hours, financing partner. **All bracketed placeholders live here.** |
| `src/content/trades.json` | All 23 trades: colors, family, scope, primary action. `colorStatus: approved` or `proposed` |
| `src/content/trade-pages.json` | Approved copy: carpentry, HVAC, masonry |
| `src/content/trade-pages-draft.json` | Draft copy for the other 20 trades, pending owner approval |
| `src/content/seo.json` | Title and meta description for every page |
| `src/content/projects.json` | Hub project types |

### Approving a draft trade

1. Review the copy (readable version: `../docs/content/draft-copy-review.md`).
2. Move that trade's entry from `trade-pages-draft.json` to `trade-pages.json` (drop the `copyStatus` field).
3. If its colors are approved too, set `"colorStatus": "approved"` in `trades.json`.
4. `npm run verify`. The draft banner and `noindex` disappear and the page joins the sitemap automatically.

### Adding a trade

Add the trade to `trades.json`, its copy to `trade-pages.json`, its SEO entry to `seo.json`. No code changes.

### Filling placeholders

Replace values in `src/content/site.ts` only with real information from the owner. Set `phone.e164` to publish the number in structured data. `npm run check:brand` keeps the rest honest.

## Concept Preview and lead flow

1. The visitor uploads 1 to 5 photos and draws on them (`src/components/MarkupTool.tsx`): three pens, one note per stroke group, switching pen starts a new note, Undo, Clear, New note, delete note. Pointer events cover mouse, touch and stylus; strokes are smoothed with `perfect-freehand`. On phones, notes show as a list under the photo.
2. On submit the browser flattens each marked-up photo to PNG, asks `POST /api/uploads` for signed upload URLs, and uploads originals and PNGs **straight to Supabase Storage** (photos never pass through the Vercel function body limit).
3. `POST /api/leads` validates with Zod, checks the honeypot and Cloudflare Turnstile, confirms each upload exists, inserts `leads` and `lead_photos` (strokes as vector JSON, notes as JSON), emails the team with 7-day signed photo links, and emails the customer a confirmation.

Callback requests use the same `/api/leads` route with `type: "callback"`, flagged `existing_job` when a job number is given.

## Production setup

1. **Supabase:** create a project, run `supabase/migrations/0001_leads.sql` (tables, indexes, RLS on with no public policies, private `lead-uploads` bucket), then `0002_lead_hardening.sql` (`updated_at`, length limits, open-leads index). Copy the URL and service role key.
2. **Resend:** verify the sending domain, create an API key.
3. **Turnstile:** create a widget for the domain, copy the site key and secret.
4. **Vercel:** import the `site` folder, set every variable from `.env.example`, deploy. Set them before the build: the Content Security Policy reads `SUPABASE_URL` at build time to allow direct photo uploads, so redeploy after changing it. Point the domain (open item: solvern.com or solvernhome.com) and set `NEXT_PUBLIC_SITE_URL`.
5. Open `https://<domain>/api/health`. It should report `"storage": "supabase"`, `"email": true` and `"turnstile": true`. It returns 503 if leads would be refused.
6. Submit a real test from a phone and confirm the photo, annotated PNG, strokes, notes and fields are stored and the team email arrives (build plan Phase 4 acceptance).

## Code layout

```
src/
  app/                 Routes. Pages are server components; API routes live in app/api
    api/leads          POST: validate, honeypot, Turnstile, store, email. Thin HTTP layer
    api/uploads        POST: signed upload targets (Supabase, or ./.data in development)
    api/health         GET: which services are configured (booleans only)
  components/          UI. Client components are marked "use client"
    form/              useLeadForm and useFieldErrors, shared by both lead forms
  content/             Data the owner edits: site.ts, trades, copy, SEO, projects
  lib/
    content.ts         Typed access to the content files
    markup.ts          Drawing geometry, stroke thinning, PNG flattening
    leads/             Shared by browser and server: constants (limits, topics), schema (Zod), validate (client checks),
                       client (upload and submit)
    metadata.ts        One metadata shape per page: canonical, Open Graph, Twitter
    og.tsx             Share card renderer
    server/            Server only: backend (Supabase or local store), leads (intake logic), notify (Resend),
                       turnstile, http (body limits, origin check), rate-limit, env
  styles/              tokens.css and globals.css
tests/
  unit/, api/          Vitest
  e2e/                 Playwright: pages, forms, focus rings, and visual.spec.ts (screenshots)
    __screenshots__/   Approved baselines, one folder per browser project
```

### Styles

All fixed styling lives in `src/styles/globals.css`, next to the component it belongs to. Modifiers use compound
selectors (`.btn.btn--tall`) so they hold at every width. Inline `style` is kept for three cases only: values that
come from data (trade and pen colors, note positions, photo aspect ratio), the share images (satori reads inline
styles only), and `app/global-error.tsx` (it replaces the root layout, so the stylesheet may not be loaded).

The logo wordmark is one SVG symbol (`public/brand/lockup-symbol.svg`) referenced with `<use>`, so its 3 KB path is
cached instead of repeated in every page. Color still comes from `currentColor`.

## Security

- Leads and photos are written only by server routes with the service role key. Row level security is on with no public policies, and the photo bucket is private; the team email carries 7-day signed links.
- The lead and upload routes refuse cross-site posts, JSON bodies over 1 MB and bursts from one address, then validate every field with Zod. Upload paths must match the pattern the server issued, and every referenced photo must exist before a lead can point at it.
- Content Security Policy, HSTS, `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy are set in `next.config.ts`.
- Customer text is HTML-escaped in emails. Structured data is serialized with `<` escaped.
- Every form attempt carries a request id; a retry after a lost response returns the stored lead instead of saving it twice (`leads.request_id`, unique).
- Customer confirmation emails drop any sentence that still holds a bracketed placeholder, so a customer never receives "[HOURS]".
- Preview deployments (`VERCEL_ENV` other than `production`) serve a disallow-all robots.txt and `X-Robots-Tag: noindex`.

## Forms

Both lead forms run on `src/components/form/useLeadForm.ts` (start, validation, submit, Turnstile reset, server field errors, focus on the first error, analytics) and `useFieldErrors.tsx` (ids and ARIA wiring). Client checks in `src/lib/leads/validate.ts` mirror the Zod schema; a test keeps them in step. Photos the bucket refuses (GIF, AVIF, BMP) or over 15 MB are converted to JPEG in the browser before upload. Leaving a page with unsent marked-up photos asks for confirmation.

## Analytics

`src/lib/analytics.ts` pushes `phone_click`, `cta_click`, `form_start`, `form_submit`, `form_error` (which fields failed), `markup_use` and `financing_click` to `window.dataLayer` (ready for Google Tag Manager or GA4) and dispatches a `solvern:track` DOM event. UTM parameters and click IDs are kept for the session and saved with every lead. Add the GTM snippet or a call tracking number once chosen (open item).

## Font

Plus Jakarta Sans is self-hosted from `src/fonts` (variable, latin subset, SIL Open Font License, `OFL.txt`). No request to Google at runtime.

## Verified on this build

- 2026-10-01 (Next 16): `npm run verify` passes (57 unit and API tests) and `npm run test:e2e` passes (80 browser tests, including 25 screenshot comparisons that matched the Next 15 build pixel for pixel). Lighthouse mobile, median of five runs against the Next 15 build on the same machine: / LCP 2.05 s (Next 15: 2.17 s), /hvac 2.17 s (2.03 s), /carpentry 2.04 s (2.05 s); performance 97 to 99, accessibility, best practices and SEO 100.

- 2026-10-01 (pass 3): `npm run verify` passes (55 unit and API tests) and `npm run test:e2e` passes (55 browser tests on desktop and phone: axe clean on every page, focus rings at 3:1 or better on all 27 pages, no horizontal scroll at 320px or 1440px).
- Type check, lint, brand check and color check pass; production build succeeds.
- axe WCAG 2.1 AA: no violations on every page at 1440px and 375px.
- Lighthouse mobile (pass 3, warm server in a shared container): performance 99, accessibility 100, best practices 100, SEO 100 on /, /carpentry and /customer-service. LCP 1.8 to 2.1 s, CLS 0.
- No horizontal scroll at 320px.
- End to end in a browser: photo upload, drawing with two pens, notes, submit, lead and both images stored, emails generated; callback form branching, prefill, validation, keyboard use and submit; honeypot, path injection and topic tampering rejected server side.
