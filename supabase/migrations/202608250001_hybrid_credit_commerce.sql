begin;

-- Phase 7 commercial model:
--   * Free accounts are pay as you go.
--   * Purchased credits never expire.
--   * Starter and Pro credits are replaced at every paid renewal.
--   * Remaining subscription credits are removed when the paid period ends.

alter table public.credit_wallets
  alter column monthly_balance set default 0;

alter table public.credit_top_up_orders
  alter column currency set default 'usd';

alter table public.credit_wallets
  add column if not exists verified_signup_granted_at timestamptz;

-- Verified signup remains an idempotent server-side boundary even though the
-- launch configuration grants zero recurring Free credits. Keeping the amount
-- parameter allows a future one-time welcome promotion without changing the
-- wallet schema or exposing a client-side credit mutation.
create or replace function public.heyy_grant_verified_signup_credits(
  p_user_id uuid,
  p_amount integer default 0
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  wallet public.credit_wallets%rowtype;
  available integer;
begin
  if p_user_id is null or p_amount is null or p_amount < 0 then
    raise exception 'Invalid verified signup credit grant';
  end if;

  insert into public.credit_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  if wallet.verified_signup_granted_at is not null then
    return false;
  end if;

  update public.credit_wallets
  set monthly_balance = monthly_balance + p_amount,
      verified_signup_granted_at = now(),
      updated_at = now()
  where user_id = p_user_id
  returning monthly_balance + purchased_balance - reserved_balance
  into available;

  if p_amount > 0 then
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
      'verified_signup_credit',
      p_amount,
      available,
      jsonb_build_object('source', 'verified_signup')
    );
  end if;

  return true;
end;
$function$;

-- Replacing the monthly bucket is intentionally different from adding a
-- purchased top-up. This function records the expired remainder first, then
-- installs the new plan allowance. Purchased credits are never modified.
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
  previous_monthly integer;
  normalized_source text;
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

  normalized_source := coalesce(nullif(trim(p_source), ''), 'account');

  insert into public.credit_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  -- Do not replace subscription credits while an in-flight provider job owns
  -- a reservation. The webhook or the next authenticated request will retry.
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
    normalized_source,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, grant_key) do nothing
  returning id into grant_id;

  if grant_id is null then
    return false;
  end if;

  previous_monthly := wallet.monthly_balance;

  update public.credit_wallets
  set monthly_balance = 0,
      period_start = p_period_start,
      period_end = p_period_end,
      updated_at = now()
  where user_id = p_user_id
  returning purchased_balance - reserved_balance
  into available;

  if previous_monthly > 0 then
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
      'admin_adjustment',
      'subscription_credits_expired',
      -previous_monthly,
      available,
      jsonb_build_object(
        'grant_key', trim(p_grant_key),
        'plan', p_plan,
        'source', normalized_source,
        'expired_credits', previous_monthly
      ) || coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  update public.credit_wallets
  set monthly_balance = p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning monthly_balance + purchased_balance - reserved_balance
  into available;

  if p_amount > 0 then
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
        'source', normalized_source,
        'replaced_credits', previous_monthly
      ) || coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  return true;
end;
$function$;

revoke execute on function public.heyy_grant_verified_signup_credits(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.heyy_grant_verified_signup_credits(uuid, integer)
  to service_role;

revoke execute on function public.heyy_apply_monthly_credits(
  uuid, text, text, integer, timestamptz, timestamptz, text, jsonb
) from public, anon, authenticated;
grant execute on function public.heyy_apply_monthly_credits(
  uuid, text, text, integer, timestamptz, timestamptz, text, jsonb
) to service_role;

commit;
