-- The most recent photo mutation is retained so a retry after a lost response
-- can return the committed revision instead of presenting a false conflict.
alter table public.preview_drafts
  add column if not exists last_mutation jsonb;

alter table public.preview_drafts
  add constraint preview_drafts_last_mutation_shape
  check (last_mutation is null or (
    jsonb_typeof(last_mutation) = 'object'
    and last_mutation ? 'id'
    and last_mutation ? 'digest'
  ));
