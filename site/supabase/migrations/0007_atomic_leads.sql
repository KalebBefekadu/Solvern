-- All lead types commit their parent row, photos, and optional generation jobs together.
-- The site calls this only with its server-side service role; public clients have no access.
create or replace function public.insert_lead_atomic(p_lead jsonb, p_photos jsonb)
returns table(lead_id uuid, inserted boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_request_id uuid := (p_lead->>'request_id')::uuid;
  v_draft_id uuid := (p_lead->>'preview_draft_id')::uuid;
begin
  if jsonb_typeof(p_lead) <> 'object' or jsonb_typeof(p_photos) <> 'array'
     or jsonb_array_length(p_photos) > 5 then
    raise exception 'Invalid lead input';
  end if;

  insert into public.leads (
    type, trade_slug, name, phone, email, zip, message, preferred_contact,
    existing_job, job_number, topic, source_url, utm, status, request_id, preview_draft_id
  ) values (
    p_lead->>'type', p_lead->>'trade_slug', p_lead->>'name', p_lead->>'phone',
    p_lead->>'email', p_lead->>'zip', p_lead->>'message', p_lead->>'preferred_contact',
    (p_lead->>'existing_job')::boolean, p_lead->>'job_number', p_lead->>'topic',
    p_lead->>'source_url', (p_lead->'utm')::jsonb, p_lead->>'status',
    v_request_id, v_draft_id
  ) returning public.leads.id into v_id;

  insert into public.lead_photos (lead_id, original_path, annotated_path, strokes, notes)
  select v_id, photo.original_path, photo.annotated_path, photo.strokes, photo.notes
  from jsonb_to_recordset(p_photos) as photo(
    original_path text, annotated_path text, strokes jsonb, notes jsonb
  );

  if v_draft_id is not null and p_lead->>'type' = 'concept_preview'
     and p_lead->>'queue_generation' = 'true' then
    insert into public.preview_generation_jobs (lead_id, lead_photo_id)
    select v_id, photo.id from public.lead_photos photo where photo.lead_id = v_id;
  end if;

  return query select v_id, true;
exception when unique_violation then
  -- A concurrent retry may have committed the same request or draft first.
  -- Only return an existing lead for those identities; unrelated conflicts fail.
  select lead.id into v_id from public.leads lead
  where (v_request_id is not null and lead.request_id = v_request_id)
     or (v_draft_id is not null and lead.preview_draft_id = v_draft_id)
  order by lead.created_at limit 1;
  if v_id is null then raise; end if;
  return query select v_id, false;
end;
$$;

revoke all on function public.insert_lead_atomic(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.insert_lead_atomic(jsonb, jsonb) to service_role;
