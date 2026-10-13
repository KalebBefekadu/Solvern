-- Solvern Home: management-platform and external-integration foundation.
-- The public site still writes only through the service-role server route.

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  event_type text not null,
  actor_type text not null default 'system' check (actor_type in ('system', 'team', 'integration')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists lead_events_lead_created_idx on public.lead_events (lead_id, created_at desc);
alter table public.lead_events enable row level security;

create table if not exists public.lead_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  event_type text not null,
  payload jsonb not null,
  attempts integer not null default 0 check (attempts >= 0),
  state text not null default 'pending' check (state in ('pending', 'processing', 'delivered', 'failed')),
  last_error text
);

create index if not exists lead_sync_outbox_pending_idx
  on public.lead_sync_outbox (available_at, created_at)
  where state in ('pending', 'failed');

alter table public.lead_sync_outbox enable row level security;

alter table public.leads add column if not exists assigned_to text;
alter table public.leads add column if not exists external_system text;
alter table public.leads add column if not exists external_id text;
create unique index if not exists leads_external_identity_key
  on public.leads (external_system, external_id)
  where external_system is not null and external_id is not null;
