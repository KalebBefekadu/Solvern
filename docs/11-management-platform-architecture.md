# Management platform and lead integration

## Release boundary

The launch site owns marketing, customer intake, uploads, attribution and the first durable lead record. The future management portal owns assignment, contact history, estimates, appointments, status changes and reporting.

The portal should be a separate authenticated application. It may share the Supabase project and TypeScript contracts, but it must not share public routes, browser credentials or client bundles with the marketing site.

## Current flow

```text
Landing page or callback form
  -> POST /api/leads
  -> validate, rate-limit and verify Turnstile
  -> store lead and photo records in Supabase
  -> notify the team and customer
  -> POST a signed lead.created event to the configured lead platform
```

The customer submission succeeds after the lead is stored. Email or lead-platform outages are logged and never make the customer resubmit a lead that is already durable.

## Connector contract

Set these server-only values:

- `LEAD_PLATFORM_WEBHOOK_URL`: HTTPS endpoint owned by the management or lead platform.
- `LEAD_PLATFORM_WEBHOOK_SECRET`: shared secret used to sign the exact request body.

Every event is JSON and carries:

- `X-Solvern-Event: lead.created`
- `X-Solvern-Event-Id: lead.created:<lead id>`
- `X-Solvern-Signature: sha256=<HMAC-SHA256 of the raw body>`

The receiver must compute the signature from the raw request bytes, compare it with a constant-time comparison, reject old or duplicate event IDs, and return a 2xx response only after it has stored the event.

The version 1 payload includes contact details, request details, source URL, attribution and photo count. It intentionally excludes image bytes and storage credentials. Media access will use a separately authorized, short-lived URL flow when the management product is selected.

## Data foundation

Migration `site/supabase/migrations/0003_management_foundation.sql` adds:

- `lead_events`: append-only audit history for system, team and integration actions.
- `lead_sync_outbox`: durable delivery queue with attempts, state and next-available time.
- `assigned_to`, `external_system` and `external_id` on leads.

The launch connector delivers immediately. The outbox table is the next reliability step once the external platform is selected: enqueue in the same database transaction as the lead, drain from a scheduled worker, retry with backoff and move repeated failures to a visible failed state.

## Portal boundaries

The management portal should use Supabase Auth or the company's identity provider and enforce roles server-side:

- `dispatcher`: triage, assign and schedule.
- `estimator`: view project details and create estimates.
- `manager`: change ownership, close leads and view reporting.
- `admin`: manage users, integrations and retention settings.

Every mutation writes a `lead_events` row. Customer photos remain in the private bucket. The portal requests short-lived signed URLs only after authorization. No service-role key is sent to a browser.

## Next implementation sequence

1. Choose the lead-management product and confirm whether it accepts webhooks, requires a pull API or provides its own SDK.
2. Map Solvern statuses and contact preferences to that product's fields.
3. Add the outbox worker and delivery dashboard.
4. Scaffold the authenticated portal shell and role checks.
5. Add lead list, lead detail, activity timeline, assignment and status updates.
6. Add estimates, appointments and reporting after the operating workflow is approved.

This sequence keeps the launch intake stable while leaving room to replace or add a lead platform without rewriting the customer-facing forms.
