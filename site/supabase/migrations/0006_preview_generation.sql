-- Generated previews are private staff review artifacts. The customer-facing
-- 48-hour promise and lead intake do not depend on the optional worker.
create table public.preview_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  lead_photo_id uuid not null unique references public.lead_photos (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed', 'uncertain')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  output_path text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preview_generation_output_ready check (status <> 'ready' or output_path is not null)
);

create index preview_generation_claim_idx
  on public.preview_generation_jobs (available_at, created_at) where status = 'queued';
alter table public.preview_generation_jobs enable row level security;

-- The lead, its immutable photo snapshots, and generation jobs commit together.
-- p_lead.queue_generation is a server-controlled switch, never a customer field.
create or replace function public.insert_preview_lead(p_lead jsonb, p_photos jsonb)
returns table(lead_id uuid, inserted boolean)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_lead->>'preview_draft_id' is null or jsonb_typeof(p_photos) <> 'array' then
    raise exception 'Invalid preview lead input';
  end if;

  insert into public.leads (
    type, trade_slug, name, phone, email, zip, message, preferred_contact,
    existing_job, job_number, topic, source_url, utm, status, request_id, preview_draft_id
  ) values (
    p_lead->>'type', p_lead->>'trade_slug', p_lead->>'name', p_lead->>'phone',
    p_lead->>'email', p_lead->>'zip', p_lead->>'message', p_lead->>'preferred_contact',
    (p_lead->>'existing_job')::boolean, p_lead->>'job_number', p_lead->>'topic',
    p_lead->>'source_url', (p_lead->'utm')::jsonb, p_lead->>'status',
    (p_lead->>'request_id')::uuid, (p_lead->>'preview_draft_id')::uuid
  ) returning public.leads.id into v_id;

  insert into public.lead_photos (lead_id, original_path, annotated_path, strokes, notes)
  select v_id, x.original_path, x.annotated_path, x.strokes, x.notes
  from jsonb_to_recordset(p_photos) as x(
    original_path text, annotated_path text, strokes jsonb, notes jsonb
  );

  if p_lead->>'type' = 'concept_preview' and p_lead->>'queue_generation' = 'true' then
    insert into public.preview_generation_jobs (lead_id, lead_photo_id)
    select v_id, lp.id from public.lead_photos lp where lp.lead_id = v_id;
  end if;

  return query select v_id, true;
exception when unique_violation then
  select l.id into v_id from public.leads l
  where l.preview_draft_id = (p_lead->>'preview_draft_id')::uuid;
  if v_id is null then raise; end if;
  return query select v_id, false;
end;
$$;

revoke all on function public.insert_preview_lead(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.insert_preview_lead(jsonb, jsonb) to service_role;

-- A short transaction-level lock serializes claims across all worker instances.
-- Expired leases are uncertain: the provider may have completed after timeout.
create function public.claim_preview_generation_job()
returns table(job_id uuid, lease_id uuid, photo_id uuid, parent_lead_id uuid, attempt_number integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_job public.preview_generation_jobs%rowtype;
  v_lease uuid;
begin
  perform pg_advisory_xact_lock(93188421);
  update public.preview_generation_jobs
    set status = 'uncertain', error_code = 'lease_expired', lease_token = null,
        lease_until = null, updated_at = now()
    where status = 'processing' and lease_until <= now();
  if exists (select 1 from public.preview_generation_jobs where status = 'processing') then
    return;
  end if;
  select * into v_job from public.preview_generation_jobs
    where status = 'queued' and available_at <= now()
    order by available_at, created_at, id limit 1 for update skip locked;
  if not found then return; end if;
  v_lease := gen_random_uuid();
  update public.preview_generation_jobs
    set status = 'processing', attempts = attempts + 1, lease_token = v_lease,
        lease_until = now() + interval '10 minutes', updated_at = now()
    where id = v_job.id;
  return query select v_job.id, v_lease, v_job.lead_photo_id, v_job.lead_id, v_job.attempts + 1;
end;
$$;

create function public.finish_preview_generation_job(
  p_job_id uuid, p_lease_id uuid, p_status text, p_output_path text, p_error_code text
)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('ready', 'failed', 'uncertain', 'queued') then
    raise exception 'Invalid job status';
  end if;
  if p_status = 'ready' and p_output_path is null then
    raise exception 'Ready jobs need an output path';
  end if;
  if p_status = 'queued' and exists (
    select 1 from public.preview_generation_jobs
    where id = p_job_id and attempts >= 3
  ) then
    p_status := 'failed';
  end if;
  update public.preview_generation_jobs
    set status = p_status, output_path = p_output_path, error_code = p_error_code,
        available_at = case when p_status = 'queued' then now() + (interval '1 minute' * power(3, attempts)) else available_at end,
        lease_token = null, lease_until = null, updated_at = now()
    where id = p_job_id and lease_token = p_lease_id and status = 'processing';
  return found;
end;
$$;

revoke all on function public.claim_preview_generation_job() from public, anon, authenticated;
revoke all on function public.finish_preview_generation_job(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_preview_generation_job() to service_role;
grant execute on function public.finish_preview_generation_job(uuid, uuid, text, text, text) to service_role;
