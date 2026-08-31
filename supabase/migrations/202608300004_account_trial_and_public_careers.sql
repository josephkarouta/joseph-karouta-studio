-- Heyy Studio Phase 9 QA follow-up
-- 1) Keep one-time welcome-credit eligibility durable across account deletion.
-- 2) Allow the public site to read only published Careers/Help/Public Page rows
--    through the existing RLS policies.

begin;

create extension if not exists pgcrypto;

-- Deliberately survives auth-user deletion. Only a one-way hash of the
-- normalized email is retained so deleting/recreating the same account cannot
-- repeatedly claim a one-time signup promotion.
create table if not exists public.welcome_trial_claims (
  identity_hash text primary key check (char_length(identity_hash) = 64),
  first_claimed_at timestamptz not null default now(),
  source text not null default 'verified_email'
);

alter table public.welcome_trial_claims enable row level security;
revoke all on table public.welcome_trial_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.welcome_trial_claims to service_role;

-- Backfill currently active accounts that already crossed the verified-signup
-- boundary, including accounts whose welcome amount was configured as zero.
insert into public.welcome_trial_claims(identity_hash, first_claimed_at, source)
select
  encode(digest(lower(trim(u.email)), 'sha256'), 'hex'),
  coalesce(w.verified_signup_granted_at, now()),
  'wallet_backfill'
from public.credit_wallets w
join auth.users u on u.id = w.user_id
where w.verified_signup_granted_at is not null
  and coalesce(trim(u.email), '') <> ''
on conflict (identity_hash) do nothing;

-- Phase 9 communication history may outlive account deletion. Use successful
-- historic welcome sends to protect deleted customers from receiving another
-- one-time signup promotion if they recreate the same email address.
insert into public.welcome_trial_claims(identity_hash, first_claimed_at, source)
select
  encode(digest(lower(trim(recipient_email)), 'sha256'), 'hex'),
  min(coalesce(sent_at, created_at)),
  'welcome_email_backfill'
from public.communication_sends
where template_key = 'welcome'
  and status = 'sent'
  and coalesce(trim(recipient_email), '') <> ''
group by encode(digest(lower(trim(recipient_email)), 'sha256'), 'hex')
on conflict (identity_hash) do nothing;

create or replace function public.heyy_grant_verified_signup_credits(
  p_user_id uuid,
  p_amount integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  verified_at timestamptz;
  user_email text;
  wallet public.credit_wallets%rowtype;
  grant_amount integer;
  available integer;
  granted_at timestamptz := now();
  expires_at timestamptz := now() + interval '30 days';
  identity_hash_value text;
  claimed_hash text;
begin
  if p_user_id is null or p_amount is null or p_amount < 0 then
    raise exception 'Invalid verified signup credit grant';
  end if;

  select email_confirmed_at, email
  into verified_at, user_email
  from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'Auth user not found';
  end if;

  if verified_at is null then
    raise exception 'Email verification required before credits can be granted';
  end if;

  if coalesce(trim(user_email), '') = '' then
    raise exception 'Verified email is required before credits can be granted';
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

  identity_hash_value := encode(digest(lower(trim(user_email)), 'sha256'), 'hex');

  insert into public.welcome_trial_claims(identity_hash, first_claimed_at, source)
  values (identity_hash_value, granted_at, 'verified_signup')
  on conflict (identity_hash) do nothing
  returning identity_hash into claimed_hash;

  -- The email already claimed the signup promotion on a previous account.
  -- Mark this wallet as processed so normal account reconciliation cannot keep
  -- retrying the grant, but do not alter purchased/subscription balances.
  if claimed_hash is null then
    update public.credit_wallets
    set verified_signup_granted_at = granted_at,
        updated_at = granted_at
    where user_id = p_user_id;
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
        'one_time', true,
        'identity_lifetime_limit', true
      )
    );
  end if;

  return true;
end;
$$;

revoke all on function public.heyy_grant_verified_signup_credits(uuid, integer) from public;
grant execute on function public.heyy_grant_verified_signup_credits(uuid, integer) to service_role;

-- The existing RLS policies already restrict these tables to published rows.
-- Table privileges were missing, causing the public APIs to receive permission
-- errors and silently render no positions/articles/pages.
grant select on table public.career_positions to anon, authenticated;
grant select on table public.help_articles to anon, authenticated;
grant select on table public.public_pages to anon, authenticated;

-- Ensure already-published rows have a useful publication timestamp for the
-- public API sort order.
update public.career_positions
set published_at = coalesce(published_at, updated_at, created_at, now())
where status = 'published' and published_at is null;

update public.help_articles
set published_at = coalesce(published_at, updated_at, created_at, now())
where status = 'published' and published_at is null;

update public.public_pages
set published_at = coalesce(published_at, updated_at, created_at, now())
where status = 'published' and published_at is null;

commit;
