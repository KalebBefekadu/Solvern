# 04. Page specs

Reference designs: `design/reference-pages/carpentry.html`, `hvac.html`, `masonry.html`, `customer-service.html`. Copy: `content/trade-pages.json`.

## Trade page template (section order)
1. **Header.** Logo (links to main site). Nav: Services, Our team, Reviews, Financing. Right: "Customer service" text link, phone number, one ink pill button ("Get my Concept Preview", or "Request a visit" for diagnosis trades). Sticky on scroll. Mobile: logo, phone icon button, menu button, plus a sticky bottom bar with "Call" and the primary action.
2. **Hero.** Trade badge pill ("Solvern Carpentry") in `--trade`. H1, lead, primary button in `--trade`, secondary outlined "Call (404) [YOUR NUMBER]". Proof row: star + "[4.9] from [000] reviews" and the proof line. Right: trade illustration (placeholder SVG).
3. **What we do.** Eyebrow, title, lead on the left; numbered services list (01 to 05) on the right with `--trade-tint-strong` dividers.
4. **See it first** (`--trade-tint` background). Left: photo markup tool (see `05-features.md`). Right: form. Visual trades: "Get my Concept Preview". Diagnosis trades: "Request a visit", with copy about showing where the problem is.
5. **Our team at work.** Title + short lead, then three photos: one large (spans two rows) and two stacked. Shot list per trade in `teamPhotoShotList`.
6. **How it works.** Four numbered steps (trade-colored circles).
7. **Reviews** (`--trade-tint`). Rating summary ("[4.9]", stars, "[000] reviews on [Google]", "Read all reviews"), then three review cards. Placeholders until real reviews are connected.
8. **Financing.** Rounded band in `--trade`: "Pay over time." Partner name, minimum amount and terms are placeholders. Button "See financing options".
9. **FAQ** (`--trade-tint`). Four questions from the data file.
10. **Closing CTA** band in `--trade-tint-strong`: closing headline, primary button, call button.
11. **Footer** (ink). Logo, one-line boilerplate, Contact (phone, email), Company (About, Reviews, Financing), Help (Customer service, Request a callback), legal line. **No trade directory on trade pages.**

Removed on purpose (do not add back): recent projects section, bottom row of team photos, callback section, 23-trade directory, "All trades" menu.

## Customer service page (`/customer-service`)
Modeled on Aspect's callback page (https://www.aspect.co.uk/callback/). Header: logo, "Customer service" label, phone.
- H1 "Request a callback." Lead promising a reply within [RESPONSE TIME] during [HOURS].
- **Branching form**, three numbered steps:
  1. *About your request:* "Is this about a job you have already booked?" Yes / No / Not sure.
     - Yes: Job number (format [SV-1234]) and "What would you like to discuss?" (Arrival time update, Billing or payment question, Change booking details, Cancel a booking, Ongoing or follow-on work, Issue with work carried out).
     - No or Not sure: "What type of enquiry?" (New project or estimate, Help or advice, Careers at Solvern, Partnerships). "New project" should route people to the Concept Preview.
  2. *Tell us more:* message, zip code (to confirm coverage).
  3. *How to reach you:* first and last name, phone, email, preferred contact (Phone call / Text / Email).
- Side panels: "Prefer to call?" (ink panel, phone, hours), "Already a customer?" (support link in emails pre-fills the form), "Planning something new?" (Concept Preview button).
