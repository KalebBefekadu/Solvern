# Solvern Home website

Next.js 15 (App Router) + TypeScript, deployed on Vercel, Supabase for leads and photo storage, Resend for email. Built from the handoff docs in `../docs` (read `../CLAUDE.md` first).

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
| `npm run check:brand` | Fails on gray hex values, em dashes, banned words (AI, smart, licensing...), exclamation marks in copy |
| `npm run check:colors` | WCAG AA contrast for all 23 trade themes and a gray check on every trade color and tint |
| `npm run verify` | All of the above, then a production build. Run before every deploy |

## Pages

| Route | Source | Status |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Solvern Home hub: hero, 23-trade directory by family, project types, how it works, team, reviews, financing, service area, FAQ. **Draft design**, owner review |
| `/[trade]` | `src/app/[trade]/page.tsx` | One template for all 23 trades, themed from `trades.json` |
| `/customer-service` | `src/app/customer-service/page.tsx` | Branching callback form. Prefill from email links: `?job=SV-1234&first=Dana&last=Smith&email=...&phone=...&zip=...` |
| `/concept-preview` | `src/app/concept-preview/page.tsx` | Standalone Concept Preview with trade or project picker. Preselect with `?trade=roofing` or `?project=kitchen` |
| `/reviews`, `/financing`, `/about`, `/privacy`, `/terms` | `src/app/*` | Placeholder-driven; privacy and terms are templates for an attorney to review |
| `/sitemap.xml`, `/robots.txt` | `src/app/sitemap.ts`, `robots.ts` | Sitemap lists approved trade pages only |

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

1. **Supabase:** create a project, run `supabase/migrations/0001_leads.sql` (tables, indexes, RLS on with no public policies, private `lead-uploads` bucket). Copy the URL and service role key.
2. **Resend:** verify the sending domain, create an API key.
3. **Turnstile:** create a widget for the domain, copy the site key and secret.
4. **Vercel:** import the `site` folder, set every variable from `.env.example`, deploy. Point the domain (open item: solvern.com or solvernhome.com) and set `NEXT_PUBLIC_SITE_URL`.
5. Submit a real test from a phone and confirm the photo, annotated PNG, strokes, notes and fields are stored and the team email arrives (build plan Phase 4 acceptance).

## Analytics

`src/lib/analytics.ts` pushes `phone_click`, `cta_click`, `form_start`, `form_submit`, `markup_use` and `financing_click` to `window.dataLayer` (ready for Google Tag Manager or GA4) and dispatches a `solvern:track` DOM event. UTM parameters and click IDs are kept for the session and saved with every lead. Add the GTM snippet or a call tracking number once chosen (open item).

## Font

Plus Jakarta Sans is self-hosted from `src/fonts` (variable, latin subset, SIL Open Font License, `OFL.txt`). No request to Google at runtime.

## Verified on this build

- Type check, lint, brand check and color check pass; production build succeeds (40 static pages).
- axe WCAG 2.1 AA: no violations on every page at 1440px and 375px.
- Lighthouse mobile: performance 98 to 99, accessibility 100, best practices 100, SEO 100. LCP 1.6 to 2.0 s, CLS 0.
- No horizontal scroll at 320px.
- End to end in a browser: photo upload, drawing with two pens, notes, submit, lead and both images stored, emails generated; callback form branching, prefill, validation, keyboard use and submit; honeypot, path injection and topic tampering rejected server side.
