-- Solvern Home: lead capture (06-tech-plan.md)
-- Run in the Supabase SQL editor or with `supabase db push`.

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('concept_preview', 'visit', 'callback')),
  trade_slug text,
  name text not null,
  phone text not null,
  email text not null,
  zip text not null,
  message text not null default '',
  preferred_contact text check (preferred_contact in ('phone', 'text', 'email')),
  existing_job boolean not null default false,
  job_number text,
  topic text,
  source_url text not null default '',
  utm jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'preview_sent', 'site_visit', 'won', 'lost', 'closed'))
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_type_status_idx on public.leads (type, status);
create index if not exists leads_trade_idx on public.leads (trade_slug);

create table if not exists public.lead_photos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  original_path text not null,
  annotated_path text,
  strokes jsonb not null default '{}'::jsonb,
  notes jsonb not null default '[]'::jsonb
);

create index if not exists lead_photos_lead_idx on public.lead_photos (lead_id);

-- Row level security: on, with no policies for anon or authenticated.
-- The site writes only through server routes using the service role key, which bypasses RLS.
-- Nothing is publicly readable.
alter table public.leads enable row level security;
alter table public.lead_photos enable row level security;

-- Private storage bucket for customer photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-uploads', 'lead-uploads', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
