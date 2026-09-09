-- Heyy Studio — production add-ons, paid extra revisions and manual Expert payout details.
-- Launch scope keeps Expert payouts manual while recording eligibility and proof.

begin;

alter table public.expert_profiles
  add column if not exists payout_method text,
  add column if not exists payout_details jsonb not null default '{}'::jsonb;

alter table public.expert_assignments
  add column if not exists payout_proof_path text;

create table if not exists public.production_addons (
  id uuid primary key default gen_random_uuid(),
  production_job_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  status text not null default 'draft',
  title text not null,
  description text,
  currency text not null default 'USD',
  client_amount_cents integer,
  expert_cost_cents integer,
  expert_turnaround_days integer,
  expert_notes text,
  expert_quoted_at timestamptz,
  sent_to_client_at timestamptz,
  stripe_session_id text,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint production_addons_kind_check check (kind in ('extra_revision','additional_scope')),
  constraint production_addons_status_check check (status in ('draft','awaiting_expert_quote','expert_quoted','sent','paid','cancelled')),
  constraint production_addons_client_amount_check check (client_amount_cents is null or client_amount_cents >= 0),
  constraint production_addons_expert_cost_check check (expert_cost_cents is null or expert_cost_cents >= 0),
  constraint production_addons_currency_check check (char_length(currency) = 3)
);

create index if not exists production_addons_job_idx
  on public.production_addons(production_job_id, created_at desc);
create index if not exists production_addons_user_status_idx
  on public.production_addons(user_id, status, created_at desc);
create unique index if not exists production_addons_stripe_session_idx
  on public.production_addons(stripe_session_id)
  where stripe_session_id is not null;

alter table public.production_addons enable row level security;
revoke all on table public.production_addons from anon, authenticated;
grant all on table public.production_addons to service_role;

insert into storage.buckets (id, name, public)
values ('expert-payout-proofs', 'expert-payout-proofs', false)
on conflict (id) do update set public = false;

notify pgrst, 'reload schema';
commit;
