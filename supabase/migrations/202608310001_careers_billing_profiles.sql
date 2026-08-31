-- Heyy Studio — Careers application files + customer billing profiles.
-- Non-destructive. Adds a private resume bucket and invoice/billing snapshot fields.

begin;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'career-application-files',
  'career-application-files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Files are written/read through server-side service-role routes only. Do not
-- add a public storage policy for CVs/resumes.

create table if not exists public.billing_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_type text not null default 'personal' check (customer_type in ('personal','business')),
  legal_name text,
  company_name text,
  company_number text,
  tax_id text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_profiles_country_code_check check (country_code is null or char_length(country_code) = 2)
);

alter table public.billing_profiles enable row level security;

drop policy if exists billing_profiles_owner_select on public.billing_profiles;
create policy billing_profiles_owner_select
  on public.billing_profiles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists billing_profiles_owner_insert on public.billing_profiles;
create policy billing_profiles_owner_insert
  on public.billing_profiles for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists billing_profiles_owner_update on public.billing_profiles;
create policy billing_profiles_owner_update
  on public.billing_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.billing_profiles from anon;
grant select, insert, update on table public.billing_profiles to authenticated;
grant all on table public.billing_profiles to service_role;

alter table public.payment_records
  add column if not exists billing_customer_type text,
  add column if not exists billing_company_name text,
  add column if not exists billing_company_number text,
  add column if not exists billing_tax_id text,
  add column if not exists billing_address_line1 text,
  add column if not exists billing_address_line2 text,
  add column if not exists billing_city text,
  add column if not exists billing_state_region text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_country_code text;

alter table public.payment_records
  drop constraint if exists payment_records_billing_customer_type_check;
alter table public.payment_records
  add constraint payment_records_billing_customer_type_check
  check (billing_customer_type is null or billing_customer_type in ('personal','business'));

-- Phase 9 already grants service_role access, but repeat the required grants
-- idempotently so a fresh database has the complete contract.
grant select, insert, update on table public.payment_records to service_role;

notify pgrst, 'reload schema';
commit;
