# Solvern Production Readiness Assessment

Assessment date: October 12, 2026
Scope: Public website, lead capture, APIs, data handling, launch operations, and marketing readiness

## Overall assessment

Solvern is a strong launch candidate, but it is not ready for unrestricted production traffic. The public experience is polished, the core website is functional, and the engineering baseline is stronger than a typical early launch.

The remaining launch risk sits mainly in production configuration, distributed abuse controls, malware screening, lead delivery operations, legal verification, and management operations.

The recommended decision is to complete the priority zero items in this assessment before paid advertising or a grand opening campaign. After those controls are verified in staging, the site can support a measured launch while the management portal, analytics, and operating workflows continue in parallel.

### October 12 feature update

The Concept Preview workflow now saves one photo at a time with color-linked comment rows below the image. Save and removal operations have retry IDs; final draft submission inserts the lead and selected photos atomically. Supabase uploads above 6 MB use resumable chunks. Expired draft cleanup and an optional private image-generation queue are implemented but require production scheduling and credentials. Generated images wait for team review. These changes reduce risk, but they do not close the broader upload-security, notification-outbox, monitoring, legal, or business-configuration launch gates below. The generation flag remains off by default.

The readiness follow-up also removes personal query data from lead attribution, limits stored campaign fields to an allowlist, requires a Turnstile-verified photo draft before production upload-target issuance, and adds a single atomic database function for all lead types. Migration `0007_atomic_leads.sql` passed local PostgreSQL checks for rollback, duplicate requests, and queued preview jobs. Migration `0008_lead_delivery_outbox.sql` adds three delivery jobs in the lead transaction and a private worker with retries and terminal failure states; its local PostgreSQL queue, retry, and privilege checks passed. Neither migration has been deployed to Solvern staging or production.

On October 13, the production Supabase draft-save path gained server-side image decoding, format and dimension checks, and metadata-free re-encoding to server-owned paths. Migration `0009_distributed_rate_limit.sql` adds an atomic shared counter keyed by a server-side HMAC, with 30-day counter retention through the maintenance worker. The health endpoint now reports an unhealthy production deployment when launch-critical integrations are absent. A narrow-screen drawing-toolbar overflow was fixed. These changes passed local automated checks but have not been tested against Solvern staging storage.

## Assessment scorecard

| Area | Status | Assessment |
| --- | --- | --- |
| User experience and visual design | Strong | Polished, responsive pages with a clear conversion path |
| Code quality and automated testing | Strong | Build, lint, type checking, formatting, and automated tests pass |
| Accessibility | Good | Automated checks pass; manual assistive-technology testing remains |
| Search visibility foundation | Good | Metadata, structured data, canonical URLs, and sitemap are present |
| Application security | Good baseline | Strong validation and headers; production draft saves normalize images and shared limits are coded, but staging verification and malware screening are still required |
| Production configuration | Blocked | Required business details and environment values remain incomplete |
| Lead operations | Needs work | Lead capture works, but delivery and management operations are incomplete |
| Privacy and legal | Needs verification | Consent, licensing, claims, retention, and legal text require review |
| Analytics and marketing | Incomplete | Event foundations exist, but production conversion tracking is not connected |
| Reliability and monitoring | Incomplete | Preview-generation and lead-delivery queues are implemented; staging delivery, alerts, error tracking, and recovery testing remain incomplete |

## Priority zero work before launch

These items should be completed before the website receives paid campaign traffic or is presented as fully operational.

### 1. Complete the launch configuration

Resolve the current launch check failures. Add the final phone number, email address, legal entity, service hours, response commitments, ratings, review sources, financing details, verified project proof, and every required production environment variable.

### 2. Verify production infrastructure

Configure and test:

- Supabase
- Resend
- Cloudflare Turnstile
- The production site URL
- Lead notification recipients
- The external lead webhook and signing secret

Validate each service through a staging deployment instead of checking only whether variables exist.

### 3. Harden photo uploads

- Require Turnstile before issuing upload targets. Implemented through draft creation; verify against the real Cloudflare service in staging.
- Use a distributed rate limiter. Migration `0009` and the production API integration are implemented; apply and verify them in Solvern staging, including trusted client-IP headers.
- Bind each upload batch to a lead or session identifier.
- Validate actual file signatures rather than trusting file extensions. Implemented at production draft save; verify with real storage in staging.
- Normalize images on the server. Implemented for Supabase-backed draft saves; local test storage still uses test fixtures directly.
- Strip GPS and other EXIF metadata. The server re-encodes saved images without source metadata; verify with representative customer devices in staging.
- Limit decoded image dimensions. Implemented with an 8,192-pixel edge and 32-megapixel cap.
- Scan or quarantine uploads before internal access.
- Delete uploads that are never attached to a submitted lead.

Production upload targets now require a draft ID, and a new draft requires a successful Turnstile challenge. Preview-draft uploads are bound to that draft and its authenticated cookie. On save, the server checks the actual decoded format and writes a separate normalized object that the signed upload token cannot change. Production rate limits use a shared PostgreSQL counter and fail closed when it is unavailable; the application sends only a keyed digest of the route and client address to the database. Source objects remain private and the expired-draft maintenance route can remove them without deleting lead-referenced normalized files; that route has not been scheduled in production. Previously uploaded non-draft objects and other abandoned objects still need a retention path. Resumable transfer improves reliability but does not replace malware screening.

### 4. Keep personal information out of URLs

The callback page no longer reads name, email, phone, ZIP, or job details from query parameters, and its copy no longer promises URL prefill. Lead submission now stores a restricted page path instead of the full URL; campaign fields are allowed by name and filtered for safe identifier values on both client and server. No active support-email link generator was found in this checkout. Audit external or previously sent links before launch, and use a short-lived opaque token or server-side lookup if prefill is reintroduced.

### 5. Move notifications to durable background processing

Return success after the lead is committed to the database. Process customer email, internal email, and external webhooks through the existing outbox foundation with:

- Retries
- Exponential backoff
- Idempotency
- Dead-letter handling
- Operator visibility

The database trigger and worker now queue all three deliveries in the lead transaction. Email bodies are frozen before first send and use stable Resend idempotency keys; webhook events use a stable event ID. Local PostgreSQL assertions cover job creation, retry, completion, and restricted privileges. Apply migration `0008`, configure and schedule the private worker, test provider outages and dead-letter alerts, and verify delivery through Solvern staging before closing this launch gate.

### 6. Make lead creation atomic

Create the lead and its photo records in one database transaction or stored function so interruptions cannot leave partial records.

The new `insert_lead_atomic` database function handles callback, visit, and Concept Preview leads, including photos and optional generation jobs in one transaction. Local PostgreSQL assertions passed. Apply migration `0007_atomic_leads.sql` and run the same cases in Solvern staging before marking this production-verified.

### 7. Verify operating claims and licensing

Confirm that published claims are accurate and operationally supported, including:

- Response times
- Coverage across 23 trades
- Technician standards
- Permit and inspection handling
- Financing
- Warranties
- Service areas
- Licenses and insurance
- Subcontractor arrangements

### 8. Finalize privacy, terms, and contact consent

Add:

- The final legal identity and contact information
- Transactional communication disclosure
- Separate optional marketing consent
- Consent version, timestamp, and source
- Photo-use language
- Data-retention terms
- A customer data request and deletion process

Obtain qualified legal review before publication.

### 9. Publish genuine trust evidence

Replace remaining placeholders with real project photos, team information, verified customer reviews, a working phone number, and complete business information. Do not fabricate reviews or condition rewards on a positive rating.

### 10. Rebuild visual regression baselines

Review and regenerate the Linux screenshot baselines so continuous integration compares the current design rather than older placeholder pages.

### 11. Establish production monitoring and recovery

Add:

- Error tracking
- External uptime monitoring
- Alerts for failed leads, uploads, emails, and integrations
- Searchable log retention
- Supabase backup and recovery verification
- A tested restore procedure
- Incident contacts
- Key-rotation procedures
- Post-deployment smoke tests
- Rollback instructions

## Launch approval conditions

The platform should meet all of these conditions before a full launch:

- The launch check passes with verified production values.
- A staging lead completes the full path from submission through database storage, email delivery, and external-system delivery.
- Photo upload controls and abandoned-upload cleanup are active.
- Legal and operating claims have documented approval.
- Monitoring alerts and the rollback procedure have been tested.
- Every new lead has an assigned owner and response target.

## Priority one work after launch

Complete these items during the first two weeks of controlled production use.

- Build the authenticated management portal with a lead queue, assignment, timeline, status, notes, estimates, scheduling, files, retry controls, service targets, and reporting.
- Connect analytics only after consent controls are active.
- Configure website analytics, advertising conversions, call tracking, and offline conversion import without sending personal information to analytics tools.
- Add a dedicated confirmation page with a reference number, clear next steps, and an expected response window.
- Add visit scheduling or calendar integration.
- Test whether requiring both phone and email reduces completion rates. Consider accepting one verified contact method.
- Add Safari, Firefox, and real-iPhone testing for photos, HEIC files, canvas markup, uploads, and form completion.
- Complete manual testing with VoiceOver or NVDA, keyboard navigation, 200% and 400% zoom, high contrast, reduced motion, and voice control.
- Verify SPF, DKIM, and DMARC together with bounce, complaint, reply, and sender-reputation monitoring.
- Collect production Core Web Vitals and set performance budgets for important pages.
- Load the markup editor only when the customer reaches or uses that feature.
- Update project documentation so it reflects the current approved trade pages and production architecture.
- Add code scanning, dependency updates, secret scanning, and production-only launch checks to continuous integration.
- Protect the release branch and require passing checks plus staging approval before production deployment.

## Priority two growth and operating maturity

- Create service-area pages and real project case studies.
- Add a controlled content workflow with revisions, approvals, and scheduled publishing.
- Build a customer portal for project status, appointments, files, and communication.
- Report lead quality, booked jobs, revenue, and campaign return by acquisition source.
- Add capacity controls by trade, ZIP code, and appointment availability.
- Establish customer review, referral, and repeat-business programs.
- Document the lead API and webhook contract with timestamped signatures, replay protection, contract tests, and secret rotation.
- Define retention schedules for lead and photo data and automate deletion.
- Run load, abuse, migration, webhook-retry, and disaster-recovery exercises.
- Document subcontractor vetting, quality assurance, complaint escalation, cancellation, no-show, and warranty procedures.
- Plan major dependency upgrades after the launch stabilization period.

## Detailed findings

### Security and privacy

The application already uses server and client validation, same-origin checks, size limits, a honeypot, private storage, row-level security, signed photo URLs, escaped email content, signed webhook payloads, and strong browser security headers.

The main remaining exposure is the upload path. A shared rate limiter is implemented but still needs migration and trusted-header verification in Solvern staging; malware screening or quarantine is not yet implemented. The production Supabase draft-save path independently decodes uploads, checks the actual format, enforces decoded size limits, and re-encodes saved images without source metadata. That path has only local unit coverage, not a Solvern staging integration test. Browser normalization converts large and browser-decodable HEIC/HEIF files to JPEG; support for other HEIC/HEIF variants needs device testing. Original raw uploads may retain EXIF data in private storage until expired-draft maintenance runs, so scheduling cleanup and defining retention remain important. Other orphaned uploads still need cleanup.

The callback form no longer consumes personal details from query parameters, and lead attribution stores only a restricted page path and filtered campaign identifiers. URLs can still appear in browser history, logs, analytics, referral headers, email-security scanners, and integration payloads; existing external links should be audited, and any future prefill must use a temporary token.

### Lead reliability and management

The site can capture a lead and queue team email, customer email, and webhook delivery in the same transaction. In the Supabase path, the web request no longer waits for those downstream services. The private delivery worker has bounded retries and a terminal failed state, but the scheduler, real provider tests, alerting, and operator response remain unverified. Local development continues to send notifications directly so its integration tests can run without Supabase.

The management platform remains an architectural foundation rather than an operating product. A production team still needs lead assignment, status history, ownership, notes, estimates, scheduling, retry handling, service-target alerts, and reporting. The promised Concept Preview also needs a visible operational queue and ownership model.

### Legal claims and customer consent

The business should verify the license and qualifying-agent requirements that apply to its work in Georgia, along with permit, insurance, subcontractor, warranty, and financing obligations. The promise of a concept and estimate within 48 hours should remain only if staffing and operating procedures can consistently support it.

Forms should distinguish communications needed to respond to a customer request from optional marketing messages. Record the consent text version, timestamp, source page, and selected channel. Final privacy and terms documents should describe photo handling, retention, sharing, deletion requests, and the legal business identity.

### Marketing and conversion

The site has useful metadata, trade pages, canonical URLs, structured data, and a working sitemap. Marketing readiness still depends on authentic project proof, complete business details, a verified business profile, consent-aware analytics, call tracking, and reporting from lead source through booked revenue.

Paid campaigns should begin only after conversion tracking and lead-response procedures have been tested end to end.

### Performance and compatibility

The image assets are reasonably sized, fonts are self-hosted, and the application renders pages on the server. Local response times are not evidence of production performance. The launch team should collect real-user measurements on mobile networks and test Safari, Firefox, iOS photos, HEIC files, canvas markup, and interrupted uploads.

### Accessibility

Automated accessibility checks, focus treatment, mobile overflow checks, semantic headings, and form labels provide a good baseline. Manual testing remains necessary because automated tools cannot fully assess screen-reader announcements, keyboard drawing controls, zoom behavior, voice control, motion preferences, and the clarity of customer instructions.

### Release process and recovery

The repository includes automated verification and end-to-end tests, but the production release path should also require the launch gate, security scanning, dependency monitoring, protected branches, staging approval, deployment smoke tests, and a tested rollback.

Backups are incomplete until a restore exercise confirms that lead and photo data can be recovered within the required time.

## Verification completed

| Check | Result |
| --- | --- |
| TypeScript checking | Passed |
| Lint | Passed |
| Formatting | Passed |
| Brand and color checks | Passed |
| Unit and API tests | 77 passed |
| Production build | Passed |
| Generated routes | 39 |
| End-to-end tests | 65 passed, 1 intentionally skipped, 0 failed; visual baselines were excluded from the October 13 rerun |
| Sitemap crawl | 27 URLs returned 200 |
| Production dependency audit | 0 known vulnerabilities at audit time |
| Visual and accessibility inspection | Responsive layout, headings, labels, and mobile presentation reviewed |
| October 13 readiness follow-up | Type checking, lint, formatting, brand checks, 77 unit/API tests, and production build passed; 65 functional browser tests passed; the 320px overflow check passed 12 repeated parallel runs |
| Database migrations | All nine migrations applied to isolated local PostgreSQL; assertions passed for atomic lead writes, outbox behavior, shared rate-limit blocking and expiry, four-client concurrent increments, and worker-only grants |

These results describe the audited local codebase and local test environment. They do not confirm production network performance, third-party service delivery, legal compliance, business capacity, or disaster recovery.

The October 13 launch check still fails with 30 reported items, including business identity and contact placeholders, project proof, and required environment values absent from the local shell. The new generation queue was tested against a temporary local PostgreSQL database, not the Solvern Supabase project or a paid image-generation API.

## Recommended implementation sequence

| Order | Workstream | Required outcome |
| --- | --- | --- |
| 1 | Business and legal inputs | Approve identity, contact details, claims, licenses, service area, financing, warranties, privacy, terms, and consent language |
| 2 | Production services | Configure Supabase, Resend, Turnstile, monitoring, and external lead delivery in staging |
| 3 | Security and reliability | Harden uploads, remove personal data from URLs, make writes atomic, and activate the durable outbox |
| 4 | Release verification | Run the launch gate, integration tests, visual baselines, accessibility review, smoke tests, and rollback exercise |
| 5 | Controlled launch | Begin with limited traffic, monitor lead delivery and response targets, and resolve failures before increasing spend |
| 6 | Operational expansion | Build the management portal, analytics reporting, scheduling, and customer-status experience |

## Reference sources

- [Georgia State Licensing Board for Residential and Commercial General Contractors](https://sos.ga.gov/state-licensing-board-residential-and-commercial-general-contractors)
- [Georgia contractor licensing frequently asked questions](https://sos.ga.gov/page/residential-and-commercial-general-contractors-frequently-asked-questions)
- [Federal Trade Commission consumer reviews and testimonials guidance](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers)

This assessment is a technical and operational readiness review. It is not legal advice. Qualified counsel should review licensing, privacy, consent, financing, warranty, employment, and subcontractor obligations before launch.
