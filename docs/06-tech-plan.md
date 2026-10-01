# 06. Tech plan

Recommended stack (the owner already builds with it): **Next.js (App Router) + TypeScript, deployed on Vercel, Supabase for data and file storage.** Confirm with the owner before choosing otherwise.

- **Styling:** CSS variables from `tokens/tokens.css`, with Tailwind or CSS Modules. Per-trade theme set on the page root.
- **Content:** `docs/content/trades.json` and `trade-pages.json` move into the app (for example `content/`), typed with a `Trade` and `TradePage` type. Pages are statically generated with `generateStaticParams` over the trades.
- **Fonts:** `next/font/google` for Plus Jakarta Sans.
- **Images:** `next/image`; SVG illustrations inline or as components.
- **Forms:** server actions or route handlers; validation with Zod.
- **Data (Supabase):**
  - `leads`: id, created_at, type (`concept_preview` | `visit` | `callback`), trade_slug, name, phone, email, zip, message, preferred_contact, existing_job (bool), job_number, topic, source_url, utm (jsonb), status.
  - `lead_photos`: id, lead_id, original_path, annotated_path, strokes (jsonb), notes (jsonb).
  - Storage bucket `lead-uploads` (private). Row level security: inserts from the site only through a server route; no public reads.
- **Email:** a transactional provider (for example Resend) for team notifications and customer confirmations.
- **SEO:** metadata per trade (title and description patterns in `brand-kit/13-seo-and-local-search.md`), LocalBusiness and Service structured data, sitemap, robots.
- **Later:** interactive 3D trade tools with React Three Fiber (glTF, compressed, lazy-loaded after the page is usable; budgets in `brand-kit/09-3d-trade-tools.md`).
