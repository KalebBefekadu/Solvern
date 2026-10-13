# Concept Preview launch checklist

The customer saves one photo at a time. A mark creates a numbered comment row below the image. Final submission stores the selected photos and notes once. Optional generation creates private drafts for team review; the team sends the finished Concept Preview and estimate within the existing 48-hour promise.

## Implemented and locally verified

- One-to-five-photo sequential editor, color-linked comment rows, undo/redo, save-before-next, saved-photo removal, refresh recovery, desktop and mobile browser flows.
- Draft revision checks and mutation IDs for safe retries after a lost save or delete response.
- Atomic final lead, photo, and optional generation-job insertion; one job per submitted photo. Global worker claim allows one processing job at a time. Bounded retries and uncertain outcomes prevent blind duplicate generation.
- Private generated files, staff review mail, and manual-attention mail for terminal failures. Customer delivery remains a team action.
- Resumable Supabase uploads above 6 MB, with six-megabyte chunks, bounded network retries, and visible progress.
- Expired draft cleanup preserves lead-referenced uploads. The worker uses the Storage API, never direct Storage table deletion.
- Local PostgreSQL migration and queue behavior checks; project typecheck, lint, format, brand, color, unit/API tests, production build, and desktop/mobile browser suite.

## Required before enabling generation

1. Apply migrations `0001` through `0006` in the **Solvern** Supabase project. Check that the private bucket, RLS, RPC grants, and job indexes match the local migration results. Do not apply them to an unrelated project.
2. Configure Supabase, Resend, Turnstile, `OPENAI_API_KEY`, `LEAD_NOTIFY_TO`, and `PREVIEW_WORKER_SECRET` or `CRON_SECRET` in the deployment. Check `/api/health` reports `storage: supabase`, `email: true`, and `previewGeneration: configured` after enabling the flag.
3. Configure a private scheduler that calls `/api/preview-generation/worker` with its bearer secret at least once per minute while requests may arrive. Each call processes at most one photo. Ensure the hosting plan supports that frequency and a 300-second function duration. Schedule `/api/preview-drafts/maintenance` daily with the same secret.
4. Submit a five-photo request on the deployed site. Verify five jobs, one active at a time, five private generated images, five review notifications, and no customer-facing generated image before team review. Repeat with a failed provider response and an interrupted worker; verify retry cap, `uncertain` state, and manual fallback.
5. Compare at least 20 representative source/markup/result sets across trades and lighting conditions. Review preservation of room geometry, correct interpretation of each colored note, absence of markup artifacts, and whether ambiguous requests were left for review. Record generation latency, cost per accepted image, and rejection reasons. Adjust model, quality, prompt, or budget only from those results.
6. Test real iPhone Safari and Android Chrome, including HEIC, 15 MB photos, slow or interrupted upload, page refresh, two-tab edits, five-photo completion, keyboard and screen reader navigation, and 320 px width. Confirm the staff review link and manual delivery workflow with the actual team.

## Rollback and operations

Set `PREVIEW_GENERATION_ENABLED=false` to stop queuing new work while keeping lead intake and manual Concept Preview delivery available. Existing queued jobs stay in the database; pause the worker scheduler if generation itself must stop. Monitor `preview_generation_jobs` for `failed`, `uncertain`, or old `queued` rows, and alert staff when a review email fails. Keep the original and annotation with every lead so the team can finish manually. Preserve generated and submitted assets according to the business retention policy; the seven-day draft cleanup removes only unreferenced working uploads.
