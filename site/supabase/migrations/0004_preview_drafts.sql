-- Private, short-lived workspaces for saving one marked-up photo at a time.
create table if not exists public.preview_drafts (
  id uuid primary key,
  access_hash text not null,
  source_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revision integer not null default 0,
  photos jsonb not null default '[]'::jsonb,
  finalized_lead_id uuid references public.leads (id),
  constraint preview_drafts_photos_array check (jsonb_typeof(photos) = 'array'),
  constraint preview_drafts_photo_limit check (jsonb_array_length(photos) <= 5)
);

create index if not exists preview_drafts_expires_at_idx on public.preview_drafts (expires_at);
alter table public.preview_drafts enable row level security;
-- The site accesses drafts through its server key after checking the HttpOnly session cookie.

-- A draft can yield only one lead, even when two final requests race on separate servers.
alter table public.leads add column if not exists preview_draft_id uuid;
create unique index if not exists leads_preview_draft_id_key
  on public.leads (preview_draft_id) where preview_draft_id is not null;

-- Store the lead and its photos together. A conflicting draft returns the fully
-- committed lead; no caller can observe a lead whose photo insert is pending.
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
