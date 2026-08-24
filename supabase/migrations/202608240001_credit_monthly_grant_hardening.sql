begin;

-- Monthly allowances need their own durable idempotency record. Stripe can
-- deliver checkout, invoice and subscription events more than once, and the
-- account summary can be loaded concurrently in several browser tabs.
create table if not exists public.credit_monthly_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_key text not null,
  plan text not null check (plan in ('free', 'starter', 'pro')),
  amount integer not null check (amount >= 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credit_monthly_grants_period_check check (period_end > period_start),
  constraint credit_monthly_grants_user_key_unique unique (user_id, grant_key)
);

create index if not exists credit_monthly_grants_user_created_idx
  on public.credit_monthly_grants (user_id, created_at desc);

alter table public.credit_monthly_grants enable row level security;

drop policy if exists credit_monthly_grants_owner_select
  on public.credit_monthly_grants;

create policy credit_monthly_grants_owner_select
  on public.credit_monthly_grants
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.credit_monthly_grants from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.credit_monthly_grants from authenticated;
grant select on table public.credit_monthly_grants to authenticated;
grant all on table public.credit_monthly_grants to service_role;

create or replace function public.heyy_apply_monthly_credits(
  p_user_id uuid,
  p_grant_key text,
  p_plan text,
  p_amount integer,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_source text default 'account',
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  wallet public.credit_wallets%rowtype;
  grant_id uuid;
  available integer;
begin
  if p_user_id is null
    or coalesce(trim(p_grant_key), '') = ''
    or p_plan not in ('free', 'starter', 'pro')
    or p_amount is null
    or p_amount < 0
    or p_period_start is null
    or p_period_end is null
    or p_period_end <= p_period_start
  then
    raise exception 'Invalid monthly credit grant';
  end if;

  insert into public.credit_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  -- Do not replace the monthly bucket while a provider job still owns a
  -- reservation from the previous period. The next account/API request will
  -- retry this grant after that job commits or refunds.
  if wallet.reserved_balance > 0 then
    return false;
  end if;

  insert into public.credit_monthly_grants(
    user_id,
    grant_key,
    plan,
    amount,
    period_start,
    period_end,
    source,
    metadata
  )
  values (
    p_user_id,
    trim(p_grant_key),
    p_plan,
    p_amount,
    p_period_start,
    p_period_end,
    coalesce(nullif(trim(p_source), ''), 'account'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, grant_key) do nothing
  returning id into grant_id;

  if grant_id is null then
    return false;
  end if;

  update public.credit_wallets
  set monthly_balance = p_amount,
      period_start = p_period_start,
      period_end = p_period_end,
      updated_at = now()
  where user_id = p_user_id
  returning monthly_balance + purchased_balance - reserved_balance
  into available;

  insert into public.credit_usage_events(
    user_id,
    event_type,
    action,
    amount,
    available_balance,
    metadata
  )
  values (
    p_user_id,
    'monthly_grant',
    'monthly_credit_grant',
    p_amount,
    available,
    jsonb_build_object(
      'grant_key', trim(p_grant_key),
      'plan', p_plan,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'source', coalesce(nullif(trim(p_source), ''), 'account')
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  return true;
end;
$function$;

-- All wallet mutations are server-only. SECURITY DEFINER functions must not
-- inherit PostgreSQL's default PUBLIC execute permission.
revoke execute on function public.heyy_apply_monthly_credits(
  uuid, text, text, integer, timestamptz, timestamptz, text, jsonb
) from public, anon, authenticated;

grant execute on function public.heyy_apply_monthly_credits(
  uuid, text, text, integer, timestamptz, timestamptz, text, jsonb
) to service_role;

revoke execute on function public.heyy_reserve_credits(uuid, text, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.heyy_commit_credits(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.heyy_refund_credits(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.heyy_grant_verified_signup_credits(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.heyy_apply_credit_top_up(uuid, text, text, integer, integer, text)
  from public, anon, authenticated;

grant execute on function public.heyy_reserve_credits(uuid, text, integer, jsonb)
  to service_role;
grant execute on function public.heyy_commit_credits(uuid, jsonb)
  to service_role;
grant execute on function public.heyy_refund_credits(uuid, text)
  to service_role;
grant execute on function public.heyy_grant_verified_signup_credits(uuid, integer)
  to service_role;
grant execute on function public.heyy_apply_credit_top_up(uuid, text, text, integer, integer, text)
  to service_role;

commit;
