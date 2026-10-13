-- Every committed lead queues delivery in the same transaction, independently of
-- whether email or the external lead platform is currently reachable.
alter table public.lead_sync_outbox add column if not exists lease_token uuid;
alter table public.lead_sync_outbox add column if not exists lease_until timestamptz;
create unique index if not exists lead_sync_outbox_event_key on public.lead_sync_outbox (lead_id, event_type);
drop index if exists public.lead_sync_outbox_pending_idx;
create index lead_sync_outbox_pending_idx on public.lead_sync_outbox (available_at, created_at)
  where state = 'pending';

create or replace function public.queue_lead_deliveries()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.lead_sync_outbox (lead_id, event_type, payload)
  values
    (new.id, 'team_email', '{}'::jsonb),
    (new.id, 'customer_email', '{}'::jsonb),
    (new.id, 'lead_webhook', '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists leads_queue_deliveries on public.leads;
create trigger leads_queue_deliveries after insert on public.leads
  for each row execute function public.queue_lead_deliveries();

revoke all on function public.queue_lead_deliveries() from public, anon, authenticated;
grant execute on function public.queue_lead_deliveries() to service_role;

create or replace function public.claim_lead_delivery()
returns table(job_id uuid, parent_lead_id uuid, kind text, lease_id uuid, frozen_payload jsonb, attempt_number integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.lead_sync_outbox%rowtype;
  v_lease uuid;
begin
  -- A lost worker may already have sent a message. Retry only while provider
  -- idempotency is still useful; older uncertain deliveries need manual review.
  update public.lead_sync_outbox
    set state = case when attempts >= 5 or lease_until < now() - interval '23 hours' then 'failed' else 'pending' end,
        available_at = now(), last_error = 'worker lease expired; inspect delivery',
        lease_token = null, lease_until = null
    where state = 'processing' and lease_until <= now();

  select * into v_job from public.lead_sync_outbox
    where state = 'pending' and available_at <= now()
    order by available_at, created_at, id limit 1 for update skip locked;
  if not found then return; end if;
  v_lease := gen_random_uuid();
  update public.lead_sync_outbox
    set state = 'processing', attempts = attempts + 1,
        lease_token = v_lease, lease_until = now() + interval '2 minutes'
    where id = v_job.id;
  return query select v_job.id, v_job.lead_id, v_job.event_type, v_lease, v_job.payload, v_job.attempts + 1;
end;
$$;

create or replace function public.finish_lead_delivery(p_job_id uuid, p_lease_id uuid, p_success boolean, p_error text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.lead_sync_outbox
    set state = case when p_success then 'delivered' when attempts >= 5 then 'failed' else 'pending' end,
        delivered_at = case when p_success then now() else delivered_at end,
        available_at = case when p_success then available_at else now() + (interval '1 minute' * power(3, attempts - 1)) end,
        last_error = case when p_success then null else left(coalesce(p_error, 'delivery failed'), 300) end,
        lease_token = null, lease_until = null
    where id = p_job_id and lease_token = p_lease_id and state = 'processing';
  return found;
end;
$$;

revoke all on function public.claim_lead_delivery() from public, anon, authenticated;
revoke all on function public.finish_lead_delivery(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_lead_delivery() to service_role;
grant execute on function public.finish_lead_delivery(uuid, uuid, boolean, text) to service_role;
