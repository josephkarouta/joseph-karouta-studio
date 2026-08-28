-- Heyy Studio utility tools: daily free allowance + subscriber unlimited + PAYG credits.
-- Files themselves are never persisted by this system. Only lightweight usage records are stored.

create table if not exists public.utility_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null check (tool in ('pdf_tools','file_converter')),
  operation text not null,
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  charge_type text not null check (charge_type in ('free','credit','subscriber')),
  credit_reservation_id uuid null references public.credit_reservations(id) on delete set null,
  usage_date date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  failed_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists utility_operations_user_day_idx
  on public.utility_operations(user_id, tool, usage_date, status, charge_type);
create index if not exists utility_operations_expiry_idx
  on public.utility_operations(status, expires_at);

alter table public.utility_operations enable row level security;
drop policy if exists utility_operations_owner_select on public.utility_operations;
create policy utility_operations_owner_select
  on public.utility_operations for select to authenticated
  using (user_id = auth.uid());

create or replace function public.heyy_cleanup_expired_utility_operations(
  p_user_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.utility_operations%rowtype;
  cleaned integer := 0;
begin
  for item in
    select * from public.utility_operations
    where user_id = p_user_id
      and status = 'reserved'
      and expires_at <= now()
    for update
  loop
    if item.charge_type = 'credit' and item.credit_reservation_id is not null then
      perform public.heyy_refund_credits(item.credit_reservation_id, 'Utility operation expired before completion');
    end if;

    update public.utility_operations
    set status = 'failed',
        failed_at = now(),
        metadata = metadata || jsonb_build_object('failure_reason', 'expired')
    where id = item.id;
    cleaned := cleaned + 1;
  end loop;

  return cleaned;
end;
$$;

create or replace function public.heyy_claim_free_utility_operation(
  p_user_id uuid,
  p_tool text,
  p_operation text,
  p_limit integer default 5
) returns table(operation_id uuid, free_used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  used_count integer := 0;
  claimed_id uuid;
  today_utc date := (timezone('utc', now()))::date;
begin
  if p_tool not in ('pdf_tools','file_converter') then
    raise exception 'Unknown utility tool';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid utility limit';
  end if;

  -- Serialise claims per user/tool/day so parallel browser requests cannot exceed the allowance.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_tool || ':' || today_utc::text));

  perform public.heyy_cleanup_expired_utility_operations(p_user_id);

  select count(*)::integer into used_count
  from public.utility_operations
  where user_id = p_user_id
    and tool = p_tool
    and usage_date = today_utc
    and charge_type = 'free'
    and status in ('reserved','completed');

  if used_count >= p_limit then
    return;
  end if;

  insert into public.utility_operations(user_id, tool, operation, status, charge_type, usage_date)
  values (p_user_id, p_tool, p_operation, 'reserved', 'free', today_utc)
  returning id into claimed_id;

  operation_id := claimed_id;
  free_used := used_count + 1;
  return next;
end;
$$;

create or replace function public.heyy_complete_utility_operation(
  p_user_id uuid,
  p_operation_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.utility_operations%rowtype;
begin
  select * into item
  from public.utility_operations
  where id = p_operation_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Utility operation not found'; end if;
  if item.status = 'completed' then
    return jsonb_build_object('chargeType', item.charge_type, 'alreadyCompleted', true);
  end if;
  if item.status <> 'reserved' then raise exception 'Utility operation is %', item.status; end if;

  if item.charge_type = 'credit' and item.credit_reservation_id is not null then
    perform public.heyy_commit_credits(
      item.credit_reservation_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('utility_operation_id', item.id, 'tool', item.tool)
    );
  end if;

  update public.utility_operations
  set status = 'completed',
      completed_at = now(),
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = item.id;

  return jsonb_build_object('chargeType', item.charge_type, 'alreadyCompleted', false);
end;
$$;

create or replace function public.heyy_fail_utility_operation(
  p_user_id uuid,
  p_operation_id uuid,
  p_reason text default 'Utility operation failed'
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.utility_operations%rowtype;
begin
  select * into item
  from public.utility_operations
  where id = p_operation_id and user_id = p_user_id
  for update;

  if not found then return false; end if;
  if item.status = 'failed' then return true; end if;
  if item.status = 'completed' then return false; end if;

  if item.charge_type = 'credit' and item.credit_reservation_id is not null then
    perform public.heyy_refund_credits(item.credit_reservation_id, left(coalesce(p_reason, 'Utility operation failed'), 500));
  end if;

  update public.utility_operations
  set status = 'failed',
      failed_at = now(),
      metadata = metadata || jsonb_build_object('failure_reason', left(coalesce(p_reason, 'Utility operation failed'), 500))
  where id = item.id;

  return true;
end;
$$;

revoke execute on function public.heyy_cleanup_expired_utility_operations(uuid) from public, anon, authenticated;
revoke execute on function public.heyy_claim_free_utility_operation(uuid,text,text,integer) from public, anon, authenticated;
revoke execute on function public.heyy_complete_utility_operation(uuid,uuid,jsonb) from public, anon, authenticated;
revoke execute on function public.heyy_fail_utility_operation(uuid,uuid,text) from public, anon, authenticated;

grant execute on function public.heyy_cleanup_expired_utility_operations(uuid) to service_role;
grant execute on function public.heyy_claim_free_utility_operation(uuid,text,text,integer) to service_role;
grant execute on function public.heyy_complete_utility_operation(uuid,uuid,jsonb) to service_role;
grant execute on function public.heyy_fail_utility_operation(uuid,uuid,text) to service_role;
