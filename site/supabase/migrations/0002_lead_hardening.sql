-- Solvern Home: lead table hardening. Safe to run more than once.

-- When a lead's status or details change in the dashboard, record when.
alter table public.leads add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at before update on public.leads
for each row execute function public.touch_updated_at();

-- Length limits that mirror the API validation (src/lib/leads/schema.ts), as a second line of defense.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_field_lengths') then
    alter table public.leads add constraint leads_field_lengths check (
      char_length(name) <= 200
      and char_length(phone) <= 30
      and char_length(email) <= 200
      and char_length(zip) <= 10
      and char_length(message) <= 2000
      and char_length(coalesce(job_number, '')) <= 40
      and char_length(coalesce(topic, '')) <= 80
      and char_length(source_url) <= 500
    );
  end if;
end;
$$;

-- The team works the newest open leads first.
create index if not exists leads_open_idx on public.leads (created_at desc) where status in ('new', 'contacted');

-- One id per form attempt (sent by the browser), so a retry after a lost response is stored once.
alter table public.leads add column if not exists request_id uuid;
create unique index if not exists leads_request_id_key on public.leads (request_id) where request_id is not null;
