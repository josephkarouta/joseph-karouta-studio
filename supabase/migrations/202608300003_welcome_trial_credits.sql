-- Heyy Studio - one-time verified welcome credits
-- Free accounts have no recurring AI allowance. Newly verified Free accounts
-- may receive the configured one-time welcome balance from the application.
-- The balance expires 30 days after it is granted and is never re-granted.

begin;

create or replace function public.heyy_grant_verified_signup_credits(
  p_user_id uuid,
  p_amount integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  verified_at timestamptz;
  wallet public.credit_wallets%rowtype;
  grant_amount integer;
  available integer;
  granted_at timestamptz := now();
  expires_at timestamptz := now() + interval '30 days';
begin
  if p_user_id is null or p_amount is null or p_amount < 0 then
    raise exception 'Invalid verified signup credit grant';
  end if;

  select email_confirmed_at
  into verified_at
  from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'Auth user not found';
  end if;

  if verified_at is null then
    raise exception 'Email verification required before credits can be granted';
  end if;

  insert into public.credit_wallets(user_id, monthly_balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select *
  into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  if wallet.verified_signup_granted_at is not null then
    return false;
  end if;

  grant_amount := greatest(0, p_amount - wallet.monthly_balance);

  update public.credit_wallets
  set monthly_balance = greatest(monthly_balance, p_amount),
      period_start = granted_at,
      period_end = expires_at,
      verified_signup_granted_at = granted_at,
      updated_at = granted_at
  where user_id = p_user_id
  returning monthly_balance + purchased_balance - reserved_balance
  into available;

  if grant_amount > 0 then
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
      'verified_signup',
      grant_amount,
      available,
      jsonb_build_object(
        'source', 'verified_email_welcome_promo',
        'expires_at', expires_at,
        'one_time', true
      )
    );
  end if;

  return true;
end;
$$;

revoke all on function public.heyy_grant_verified_signup_credits(uuid, integer) from public;
grant execute on function public.heyy_grant_verified_signup_credits(uuid, integer) to service_role;

commit;
