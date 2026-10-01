# CLAUDE.md: Solvern website

You are building the production website for **Solvern Home**, a residential construction company in metro Atlanta with 23 trades under one brand. Read this file first, then the docs in the order listed. The owner, Kaleb, is the final decision-maker on every brand choice.

## Code
The app lives in `site/` (see `site/README.md`). Run `npm run verify` there before every deploy: it enforces the no-gray, no-em-dash and banned-word rules and WCAG contrast for every trade.

## Read in this order
1. `docs/01-product-brief.md`: the business, customer, positioning and every decision made so far.
2. `docs/02-design-v2.md`: the approved visual direction. **It overrides the brand kit wherever they differ** (font, no gray, carpentry color).
3. `docs/03-site-architecture.md`: pages, routes and navigation rules.
4. `docs/04-page-specs.md`: section-by-section spec for the trade page and the customer service page.
5. `docs/05-features.md`: Concept Preview with photo markup, callback hub, financing, reviews, forms.
6. `docs/06-tech-plan.md`: stack, data model, integrations.
7. `docs/07-build-plan.md`: phased tasks with acceptance criteria. Work through it in order.
8. `docs/08-open-items.md`: placeholders and decisions still open. Never invent answers to these.
9. `docs/10-color-proposals.md` and `docs/content/draft-copy-review.md`: pending approvals for the 20 undesigned trades.
10. `docs/brand-kit/`: the full v1 brand book (voice, logo, SEO, touchpoints). Still valid except where v2 overrides it.

Visual targets: `design/reference-pages/*.html` are static exports of the approved designs at 1440px. Match them, then make them responsive. Do not ship those files.
Data: `docs/content/trades.json` (all 23 trades) and `docs/content/trade-pages.json` (approved copy for carpentry, HVAC, masonry).
Tokens: `tokens/tokens.css`. Logos: `assets/logos/`. Illustration placeholder: `assets/illustrations/placeholder-trade-illustration.svg`.

## Non-negotiable rules
- **No gray anywhere.** No gray backgrounds, borders, placeholders or text. White ground, ink (#1B2330) text, trade tints for structure. If a color reads as gray, flag it.
- **One font:** Plus Jakarta Sans.
- **Copy voice:** sentence case, plain and specific, no exclamation marks, no emoji, **no em dashes** (use a colon, comma or period).
- **Never say AI in customer-facing copy.** Banned words: AI, artificial intelligence, powered by, smart (except the product name "smart home"), algorithm, cutting-edge, innovative, next-gen, revolutionary, disrupt. The Concept Preview is never called an "AI rendering". The brand is quietly tech-enabled; craft is the headline.
- **Never mention licensing** anywhere on the site.
- **Do not mark trades as self-performed or subcontracted.**
- **Placeholders stay placeholders.** Bracketed text like [YOUR NUMBER] or [4.9] must never be replaced with invented numbers, reviews, projects, prices or stats. Keep them visible and list them in `docs/08-open-items.md`.
- **Trade illustrations are not final.** Use the placeholder SVG (560 x 440) in every trade hero until the owner supplies final art.
- **Accessibility:** WCAG 2.1 AA contrast, real buttons, links and labels, visible focus rings, 44px touch targets, works at 320px.
- **Performance:** phone number and primary CTA usable before anything heavy loads. LCP under 2.5s on mobile.

## Working style
- Build the three designed trades (carpentry, HVAC, masonry) and the customer service page first. Other trades come from the same template and `trades.json` once their copy exists.
- Keep one trade page template driven by data. Adding a trade should mean adding data, not code.
- Ask the owner before changing any approved design decision. Log decisions in `docs/decision-log.md`.
