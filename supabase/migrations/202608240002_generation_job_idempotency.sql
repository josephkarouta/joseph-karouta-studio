begin;

-- A generation request key makes HTTP retries return the original job. The
-- active key prevents two concurrent requests for the same logical generation
-- from reserving twice, even if the browser produced two different request
-- identifiers (for example, a double click in two tabs).
alter table public.generation_jobs
  add column if not exists request_key text,
  add column if not exists active_key text;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_request_key_length_check;
alter table public.generation_jobs
  add constraint generation_jobs_request_key_length_check
  check (request_key is null or char_length(request_key) between 1 and 240);

alter table public.generation_jobs
  drop constraint if exists generation_jobs_active_key_length_check;
alter table public.generation_jobs
  add constraint generation_jobs_active_key_length_check
  check (active_key is null or char_length(active_key) between 1 and 240);

-- "finalizing" is used by polled providers while exactly one request owns the
-- download/persistence step. Other polls keep reporting the job as processing.
alter table public.generation_jobs
  drop constraint if exists generation_jobs_status_check;
alter table public.generation_jobs
  add constraint generation_jobs_status_check
  check (status in ('queued', 'processing', 'finalizing', 'succeeded', 'failed', 'cancelled'));

create unique index if not exists generation_jobs_user_request_key_unique
  on public.generation_jobs (user_id, request_key)
  where request_key is not null;

create unique index if not exists generation_jobs_user_active_key_unique
  on public.generation_jobs (user_id, active_key)
  where active_key is not null
    and status in ('queued', 'processing', 'finalizing');

-- Reserve credits and create the durable queued job in one database
-- transaction. Locking the user's wallet serializes all concurrent paid and
-- free job starts for that user before either idempotency check is evaluated.
create or replace function public.heyy_start_generation_job(
  p_user_id uuid,
  p_request_key text,
  p_active_key text,
  p_project_id text,
  p_tool text,
  p_provider text,
  p_action text,
  p_amount integer,
  p_input jsonb,
  p_metadata jsonb
)
returns table(
  job_id uuid,
  reservation_id uuid,
  credits_reserved integer,
  created boolean,
  job_status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  wallet public.credit_wallets%rowtype;
  v_job_id uuid;
  v_reservation_id uuid;
  v_existing_amount integer;
  v_status text;
  available integer;
  clean_request_key text := trim(coalesce(p_request_key, ''));
  clean_active_key text := trim(coalesce(p_active_key, ''));
  clean_tool text := trim(coalesce(p_tool, ''));
  clean_provider text := trim(coalesce(p_provider, ''));
  clean_action text := trim(coalesce(p_action, ''));
begin
  if p_user_id is null
    or clean_request_key = ''
    or char_length(clean_request_key) > 240
    or clean_active_key = ''
    or char_length(clean_active_key) > 240
    or clean_tool = ''
    or clean_provider = ''
    or p_amount is null
    or p_amount < 0
    or (p_amount > 0 and clean_action = '')
  then
    raise exception 'Invalid generation job request';
  end if;

  insert into public.credit_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  -- A retried HTTP request always receives its original job, including after
  -- that job reaches a terminal state.
  select j.id, j.credit_reservation_id, coalesce(r.amount, 0), j.status
  into v_job_id, v_reservation_id, v_existing_amount, v_status
  from public.generation_jobs j
  left join public.credit_reservations r on r.id = j.credit_reservation_id
  where j.user_id = p_user_id
    and j.request_key = clean_request_key
  limit 1;

  if found then
    return query select v_job_id, v_reservation_id, v_existing_amount, false, v_status;
    return;
  end if;

  -- A separate request identifier for the same still-running logical action is
  -- also a duplicate. This closes the double-click/multi-tab race.
  select j.id, j.credit_reservation_id, coalesce(r.amount, 0), j.status
  into v_job_id, v_reservation_id, v_existing_amount, v_status
  from public.generation_jobs j
  left join public.credit_reservations r on r.id = j.credit_reservation_id
  where j.user_id = p_user_id
    and j.active_key = clean_active_key
    and j.status in ('queued', 'processing', 'finalizing')
  order by j.created_at desc
  limit 1;

  if found then
    return query select v_job_id, v_reservation_id, v_existing_amount, false, v_status;
    return;
  end if;

  if p_amount > 0 then
    available := wallet.monthly_balance + wallet.purchased_balance - wallet.reserved_balance;
    if available < p_amount then
      raise exception 'Insufficient credits: available %, required %', available, p_amount;
    end if;

    update public.credit_wallets
    set reserved_balance = reserved_balance + p_amount
    where user_id = p_user_id;

    insert into public.credit_reservations(user_id, action, amount, metadata)
    values (
      p_user_id,
      clean_action,
      p_amount,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_reservation_id;

    insert into public.credit_usage_events(
      user_id,
      reservation_id,
      event_type,
      action,
      amount,
      available_balance,
      project_id,
      metadata
    )
    values (
      p_user_id,
      v_reservation_id,
      'reserved',
      clean_action,
      p_amount,
      available - p_amount,
      coalesce(p_metadata, '{}'::jsonb)->>'project_id',
      coalesce(p_metadata, '{}'::jsonb)
    );
  else
    v_reservation_id := null;
  end if;

  insert into public.generation_jobs(
    user_id,
    project_id,
    tool,
    provider,
    provider_job_id,
    credit_reservation_id,
    status,
    input,
    output,
    request_key,
    active_key
  )
  values (
    p_user_id,
    nullif(trim(coalesce(p_project_id, '')), ''),
    clean_tool,
    clean_provider,
    null,
    v_reservation_id,
    'queued',
    coalesce(p_input, '{}'::jsonb) || jsonb_build_object('credits', p_amount),
    '{}'::jsonb,
    clean_request_key,
    clean_active_key
  )
  returning id into v_job_id;

  return query select v_job_id, v_reservation_id, p_amount, true, 'queued'::text;
end;
$function$;

revoke execute on function public.heyy_start_generation_job(
  uuid, text, text, text, text, text, text, integer, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.heyy_start_generation_job(
  uuid, text, text, text, text, text, text, integer, jsonb, jsonb
) to service_role;

-- Once the provider result has been saved in its durable project/asset table,
-- commit the reservation and mark the job succeeded in the same transaction.
-- A failure in either mutation rolls both back; a retry returns true.
create or replace function public.heyy_complete_generation_job(
  p_job_id uuid,
  p_output jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  job public.generation_jobs%rowtype;
begin
  select *
  into job
  from public.generation_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Generation job not found';
  end if;
  if job.status = 'succeeded' then
    return true;
  end if;
  if job.status in ('failed', 'cancelled') then
    raise exception 'Generation job is %', job.status;
  end if;

  if job.credit_reservation_id is not null then
    perform public.heyy_commit_credits(
      job.credit_reservation_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('generation_job_id', job.id)
    );
  end if;

  update public.generation_jobs
  set project_id = coalesce(nullif(coalesce(p_metadata, '{}'::jsonb)->>'project_id', ''), project_id),
      status = 'succeeded',
      error = null,
      output = coalesce(p_output, output, '{}'::jsonb),
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = job.id;

  return true;
end;
$function$;

revoke execute on function public.heyy_complete_generation_job(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.heyy_complete_generation_job(uuid, jsonb, jsonb)
  to service_role;

-- Refund and mark failed together. The expected-status guard prevents a lost
-- dispatch response from failing a job that a worker has already claimed.
create or replace function public.heyy_fail_generation_job(
  p_job_id uuid,
  p_expected_status text,
  p_reason text,
  p_public_error text,
  p_output_patch jsonb default '{}'::jsonb,
  p_require_provider_job_id_null boolean default false
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  job public.generation_jobs%rowtype;
begin
  select *
  into job
  from public.generation_jobs
  where id = p_job_id
  for update;

  if not found then
    return false;
  end if;
  if job.status = 'succeeded' then
    return false;
  end if;
  if coalesce(trim(p_expected_status), '') <> ''
    and job.status <> trim(p_expected_status)
  then
    return false;
  end if;
  if p_require_provider_job_id_null and job.provider_job_id is not null then
    return false;
  end if;

  if job.credit_reservation_id is not null then
    perform public.heyy_refund_credits(
      job.credit_reservation_id,
      left(coalesce(nullif(trim(p_reason), ''), 'Generation failed'), 500)
    );
  end if;

  update public.generation_jobs
  set status = 'failed',
      error = coalesce(nullif(trim(p_public_error), ''), 'Generation could not be completed. Your credits were returned.'),
      output = coalesce(output, '{}'::jsonb) || coalesce(p_output_patch, '{}'::jsonb),
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = job.id;

  return true;
end;
$function$;

revoke execute on function public.heyy_fail_generation_job(uuid, text, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.heyy_fail_generation_job(uuid, text, text, text, jsonb, boolean)
  to service_role;

commit;
