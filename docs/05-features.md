# 05. Features

## Concept Preview with photo markup (signature feature)
Goal: a homeowner uploads a photo, draws on it to show what they want, adds a note per drawing, and submits. The team replies within 48 hours with a concept image and an estimate range. **Production of the concept image is manual for now** (team uses image tools, then reviews it). No automation or model API on the site.

Markup tool behavior (owner's spec):
- Upload 1 to 5 photos; draw on one at a time.
- **Three pens only:** blue #2F63D6, orange #E8742C, green #1FA35B.
- Each time a pen starts a new stroke group, a **note box** opens anchored to that drawing, bordered in the pen color and numbered (Note 1, Note 2). Switching pen color starts a new note.
- Undo and Clear. Notes can be edited or deleted.
- Works with touch (phone) and mouse. Freehand strokes, smoothed.
- On submit, save: original photo, strokes as vector data (JSON), a flattened annotated image (PNG), the notes, and the form fields.
- Diagnosis trades (HVAC, plumbing, electrical, smart home) use the same tool with copy about circling the problem.
- Suggested build: HTML canvas or SVG with pointer events (for example `perfect-freehand` for stroke smoothing). Keep it dependency-light.

Form fields: what would you like (or what is happening), name, zip, phone, email. Confirmation: "Received. Your Concept Preview and estimate will arrive within 48 hours." Every concept image shown to a customer carries a "Concept Preview" badge and the caption "Concept image for planning. Final materials and measurements are confirmed at your site visit."

## Callback hub
See `04-page-specs.md`. Submissions go to the same lead inbox with a type of `callback`, flagged `existing_job` when a job number is given. Target response time is an open item.

## Financing
Placeholder band on every trade page. Plan: partner with a home improvement financing platform (candidates the owner is comparing: Wisetack, Hearth, GreenSky). The partner handles approval and credit. Build the band so the partner's link or embedded prequalification widget can drop in later. Never state rates, terms or approval claims until the partner provides approved wording.

## Reviews
Show a rating summary and review cards. Source: Google Business Profile once it exists. Until then keep bracketed placeholders; never invent reviews. Later: fetch reviews server-side and cache.

## Lead handling
All forms (Concept Preview, visit request, callback) create a lead record, store uploads, and notify the team by email (and optionally SMS). Include trade, source page and UTM parameters. Spam protection with a honeypot plus a CAPTCHA such as Cloudflare Turnstile.

## Analytics
Track: phone clicks, primary CTA clicks, form starts, form submits, markup tool usage, financing clicks. Call tracking number is an open item.
