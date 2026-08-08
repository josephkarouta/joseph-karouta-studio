-- Heyy Studio V13.1 — Stripe Customer Portal and subscription lifecycle fields.
-- Safe to run more than once.

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists currency text,
  add column if not exists amount integer;

create index if not exists user_subscriptions_customer_idx
  on public.user_subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists user_subscriptions_subscription_idx
  on public.user_subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.user_subscriptions to service_role;

alter table public.user_subscriptions enable row level security;

drop policy if exists user_subscriptions_owner_select on public.user_subscriptions;
create policy user_subscriptions_owner_select
  on public.user_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
