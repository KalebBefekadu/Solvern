-- One shared fixed-window counter per route and client, updated atomically by PostgreSQL.
-- The application sends only an HMAC digest, never an IP address.
create table if not exists public.rate_limit_buckets (
  key_hash text primary key,
  window_id bigint not null,
  hit_count integer not null check (hit_count > 0),
  updated_at timestamptz not null default now(),
  constraint rate_limit_key_hash_shape check (key_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists rate_limit_buckets_updated_idx on public.rate_limit_buckets (updated_at);
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now double precision := extract(epoch from clock_timestamp());
  v_window bigint;
  v_count integer;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit arguments';
  end if;
  v_window := floor(v_now / p_window_seconds)::bigint;
  insert into public.rate_limit_buckets as bucket (key_hash, window_id, hit_count, updated_at)
  values (p_key_hash, v_window, 1, clock_timestamp())
  on conflict (key_hash) do update
    set window_id = excluded.window_id,
        hit_count = case when bucket.window_id = excluded.window_id then bucket.hit_count + 1 else 1 end,
        updated_at = excluded.updated_at
  returning hit_count into v_count;

  return query select v_count <= p_limit,
    case when v_count <= p_limit then 0 else greatest(1, ceil((v_window + 1) * p_window_seconds - v_now)::integer) end;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create or replace function public.prune_rate_limit_buckets()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_removed integer;
begin
  delete from public.rate_limit_buckets
  where key_hash in (
    select key_hash from public.rate_limit_buckets
    where updated_at < clock_timestamp() - interval '30 days'
    order by updated_at
    limit 1000
  );
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

revoke all on function public.prune_rate_limit_buckets() from public, anon, authenticated;
grant execute on function public.prune_rate_limit_buckets() to service_role;
