# 08. Open items (do not invent answers)

| Item | Placeholder in designs |
| --- | --- |
| Phone number | (404) [YOUR NUMBER] |
| Email | [YOUR EMAIL] |
| Legal name | [LEGAL NAME] doing business as Solvern Home |
| Domain | solvern.com or solvernhome.com |
| Rating and review count | [4.9], [000], [Google] |
| Real reviews | [Customer review ...] |
| Team photos | Shot list in `content/trade-pages.json` |
| Financing partner, minimum amount, terms | [FINANCING PARTNER], [$ AMOUNT] |
| Callback response time and hours | [30 MINUTES], [HOURS], [DAYS AND HOURS] |
| Job number format | [SV-1234] |
| HVAC response time | [Response time you commit to] |
| Final trade illustrations and rendering style | Placeholder SVG |
| Colors for 20 undesigned trades | Computed in `trades.json`, needs review (slate family reads gray) |
| Copy for 20 undesigned trades | Write in the same voice, owner approves |
| Main site (Solvern Home) design | Not designed yet |
| Launch date and budget | Not set |

## Added during the build (2026-09-30)
All placeholders are set in one file: `site/src/content/site.ts`.

| Item | Where it shows |
| --- | --- |
| Real phone number for `tel:` links and structured data (`phone.href`, `phone.e164`) | Every page. Links currently use the reference file's dummy (404) 555-0123 |
| Approve or change proposed colors for 20 trades | docs/10-color-proposals.md |
| Approve draft copy for 20 trades | docs/content/draft-copy-review.md |
| Approve hub (Solvern Home) design and copy | `/` |
| Approve SEO titles and descriptions | site/src/content/seo.json |
| Approve project types and their trade lists | site/src/content/projects.json |
| Service areas beyond Buckhead, Alpharetta, Decatur, Marietta | Hub, FAQ |
| Financing FAQ answer on credit checks | [Wording from your financing partner] on /financing |
| Financing apply link or widget (`financing.applyUrl`) | /financing, every financing band |
| Privacy and terms: attorney review, [DATE], [Retention period set by the owner] | /privacy, /terms |
| Team notification inbox and sending address (LEAD_NOTIFY_TO, LEAD_NOTIFY_FROM) | Vercel env |
| Supabase project, Resend key, Turnstile keys | Vercel env, see site/README.md |
| Analytics tool (GTM or GA4) and call tracking number | Events already fire to dataLayer |
| Project and Concept Preview example photos | Hub project cards use placeholders |

## Added during build pass 2 (2026-10-01)

| Item | Where it shows |
| --- | --- |
| Approve relabeling the callback message box (two fields share "What would you like to discuss?") | /customer-service, see docs/decision-log.md |
| When GTM or GA4 is chosen, add its hosts to the Content Security Policy | site/next.config.ts |
| After the first deploy, open `/api/health` and confirm `storage` is `supabase`, and `email` and `turnstile` are true | Production |
| Before launch, run `npm run check:launch` in `site/` and clear every line it prints | site/src/content, Vercel env |
| Run `supabase/migrations/0002_lead_hardening.sql` after 0001 | Supabase SQL editor |
