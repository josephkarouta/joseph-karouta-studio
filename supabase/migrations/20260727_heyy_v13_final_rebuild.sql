-- Heyy Studio V13 consolidated platform additions.
-- This migration deliberately does not alter the working quote, Stripe, payment
-- or production tables. It adds shared credits, Studio projects, assets, public
-- content, careers, help, contact and generation monitoring around them.

create extension if not exists pgcrypto;

create table if not exists public.credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_balance integer not null default 40 check (monthly_balance >= 0),
  purchased_balance integer not null default 0 check (purchased_balance >= 0),
  reserved_balance integer not null default 0 check (reserved_balance >= 0),
  period_start timestamptz not null default date_trunc('month', now()),
  period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  amount integer not null check (amount > 0),
  status text not null default 'reserved' check (status in ('reserved','committed','refunded','expired')),
  metadata jsonb not null default '{}'::jsonb,
  failure_reason text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  committed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credit_reservations_user_created_idx on public.credit_reservations(user_id, created_at desc);
create index if not exists credit_reservations_status_expiry_idx on public.credit_reservations(status, expires_at);

create table if not exists public.credit_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid references public.credit_reservations(id) on delete set null,
  event_type text not null check (event_type in ('reserved','committed','refunded','monthly_grant','top_up','admin_adjustment')),
  action text not null,
  amount integer not null,
  available_balance integer,
  project_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists credit_usage_events_user_created_idx on public.credit_usage_events(user_id, created_at desc);

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  studio text not null check (studio in ('interior_studio','marketing_studio')),
  project_name text not null,
  project_type text,
  status text not null default 'active',
  progress integer not null default 20 check (progress between 0 and 100),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  summary text,
  current_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_projects_user_updated_idx on public.studio_projects(user_id, updated_at desc);

create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text,
  studio text,
  asset_type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  file_url text,
  thumbnail_url text,
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_assets_user_created_idx on public.project_assets(user_id, created_at desc);
create index if not exists project_assets_project_idx on public.project_assets(project_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text,
  tool text not null,
  provider text not null,
  provider_job_id text,
  credit_reservation_id uuid references public.credit_reservations(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed','cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists generation_jobs_user_created_idx on public.generation_jobs(user_id, created_at desc);
create index if not exists generation_jobs_provider_idx on public.generation_jobs(provider, provider_job_id);

create table if not exists public.public_pages (
  slug text primary key,
  title text not null,
  eyebrow text,
  summary text,
  content jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_positions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text,
  location text not null default 'Remote / Worldwide',
  employment_type text not null default 'Contract',
  summary text,
  description jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  published_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_applications (
  id uuid primary key default gen_random_uuid(),
  position_id uuid references public.career_positions(id) on delete set null,
  name text not null,
  email text not null,
  location text,
  portfolio_url text,
  linkedin_url text,
  message text,
  resume_url text,
  status text not null default 'new' check (status in ('new','reviewing','shortlisted','rejected','hired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null default 'Getting started',
  summary text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','reviewing','replied','closed','spam')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.heyy_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'credit_wallets','credit_reservations','studio_projects','project_assets','generation_jobs',
    'public_pages','career_positions','career_applications','help_articles','contact_submissions'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.heyy_touch_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.heyy_create_user_wallet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.credit_wallets(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists heyy_create_wallet_after_signup on auth.users;
create trigger heyy_create_wallet_after_signup after insert on auth.users for each row execute function public.heyy_create_user_wallet();
insert into public.credit_wallets(user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.heyy_reserve_credits(
  p_user_id uuid,
  p_action text,
  p_amount integer,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  wallet public.credit_wallets%rowtype;
  reservation_id uuid;
  available integer;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'Invalid credit reservation';
  end if;
  insert into public.credit_wallets(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into wallet from public.credit_wallets where user_id = p_user_id for update;
  available := wallet.monthly_balance + wallet.purchased_balance - wallet.reserved_balance;
  if available < p_amount then raise exception 'Insufficient credits: available %, required %', available, p_amount; end if;
  update public.credit_wallets set reserved_balance = reserved_balance + p_amount where user_id = p_user_id;
  insert into public.credit_reservations(user_id, action, amount, metadata)
  values (p_user_id, p_action, p_amount, coalesce(p_metadata, '{}'::jsonb)) returning id into reservation_id;
  insert into public.credit_usage_events(user_id, reservation_id, event_type, action, amount, available_balance, project_id, metadata)
  values (p_user_id, reservation_id, 'reserved', p_action, p_amount, available - p_amount, p_metadata->>'project_id', coalesce(p_metadata, '{}'::jsonb));
  return reservation_id;
end;
$$;

create or replace function public.heyy_commit_credits(
  p_reservation_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  reservation public.credit_reservations%rowtype;
  wallet public.credit_wallets%rowtype;
  monthly_used integer;
  purchased_used integer;
  available integer;
begin
  select * into reservation from public.credit_reservations where id = p_reservation_id for update;
  if not found then raise exception 'Credit reservation not found'; end if;
  if reservation.status = 'committed' then return true; end if;
  if reservation.status <> 'reserved' then raise exception 'Credit reservation is %', reservation.status; end if;
  select * into wallet from public.credit_wallets where user_id = reservation.user_id for update;
  monthly_used := least(wallet.monthly_balance, reservation.amount);
  purchased_used := reservation.amount - monthly_used;
  if wallet.purchased_balance < purchased_used then raise exception 'Credit balance changed before commit'; end if;
  update public.credit_wallets set
    monthly_balance = monthly_balance - monthly_used,
    purchased_balance = purchased_balance - purchased_used,
    reserved_balance = greatest(0, reserved_balance - reservation.amount)
  where user_id = reservation.user_id
  returning monthly_balance + purchased_balance - reserved_balance into available;
  update public.credit_reservations set status = 'committed', committed_at = now(), metadata = metadata || coalesce(p_metadata, '{}'::jsonb) where id = reservation.id;
  insert into public.credit_usage_events(user_id, reservation_id, event_type, action, amount, available_balance, project_id, metadata)
  values (reservation.user_id, reservation.id, 'committed', reservation.action, -reservation.amount, available, coalesce(p_metadata->>'project_id', reservation.metadata->>'project_id'), reservation.metadata || coalesce(p_metadata, '{}'::jsonb));
  return true;
end;
$$;

create or replace function public.heyy_refund_credits(
  p_reservation_id uuid,
  p_reason text default 'Generation failed'
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  reservation public.credit_reservations%rowtype;
  available integer;
begin
  select * into reservation from public.credit_reservations where id = p_reservation_id for update;
  if not found then return false; end if;
  if reservation.status = 'refunded' then return true; end if;
  if reservation.status <> 'reserved' then return false; end if;
  update public.credit_wallets set reserved_balance = greatest(0, reserved_balance - reservation.amount) where user_id = reservation.user_id
  returning monthly_balance + purchased_balance - reserved_balance into available;
  update public.credit_reservations set status = 'refunded', refunded_at = now(), failure_reason = left(p_reason, 500) where id = reservation.id;
  insert into public.credit_usage_events(user_id, reservation_id, event_type, action, amount, available_balance, project_id, metadata)
  values (reservation.user_id, reservation.id, 'refunded', reservation.action, 0, available, reservation.metadata->>'project_id', jsonb_build_object('reason', left(p_reason, 500)));
  return true;
end;
$$;

grant execute on function public.heyy_reserve_credits(uuid,text,integer,jsonb) to service_role;
grant execute on function public.heyy_commit_credits(uuid,jsonb) to service_role;
grant execute on function public.heyy_refund_credits(uuid,text) to service_role;

alter table public.credit_wallets enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.credit_usage_events enable row level security;
alter table public.studio_projects enable row level security;
alter table public.project_assets enable row level security;
alter table public.notifications enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.public_pages enable row level security;
alter table public.career_positions enable row level security;
alter table public.career_applications enable row level security;
alter table public.help_articles enable row level security;
alter table public.contact_submissions enable row level security;

-- User-owned records.
do $$
declare t text;
begin
  foreach t in array array['credit_wallets','credit_reservations','credit_usage_events','studio_projects','project_assets','notifications','generation_jobs'] loop
    execute format('drop policy if exists %I_owner_select on public.%I', t, t);
    execute format('create policy %I_owner_select on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end $$;

drop policy if exists studio_projects_owner_insert on public.studio_projects;
create policy studio_projects_owner_insert on public.studio_projects for insert to authenticated with check (user_id = auth.uid());
drop policy if exists studio_projects_owner_update on public.studio_projects;
create policy studio_projects_owner_update on public.studio_projects for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists studio_projects_owner_delete on public.studio_projects;
create policy studio_projects_owner_delete on public.studio_projects for delete to authenticated using (user_id = auth.uid());

drop policy if exists project_assets_owner_insert on public.project_assets;
create policy project_assets_owner_insert on public.project_assets for insert to authenticated with check (user_id = auth.uid());
drop policy if exists project_assets_owner_update on public.project_assets;
create policy project_assets_owner_update on public.project_assets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists project_assets_owner_delete on public.project_assets;
create policy project_assets_owner_delete on public.project_assets for delete to authenticated using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public read-only published content.
drop policy if exists public_pages_published_read on public.public_pages;
create policy public_pages_published_read on public.public_pages for select to anon, authenticated using (status = 'published');
drop policy if exists careers_published_read on public.career_positions;
create policy careers_published_read on public.career_positions for select to anon, authenticated using (status = 'published' and (closes_at is null or closes_at > now()));
drop policy if exists help_articles_published_read on public.help_articles;
create policy help_articles_published_read on public.help_articles for select to anon, authenticated using (status = 'published');

-- Public form submissions; reads remain service-role/admin only.
drop policy if exists career_applications_public_insert on public.career_applications;
create policy career_applications_public_insert on public.career_applications for insert to anon, authenticated with check (true);
drop policy if exists contact_submissions_public_insert on public.contact_submissions;
create policy contact_submissions_public_insert on public.contact_submissions for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());

-- Seed editable public-page records without replacing existing admin edits.
insert into public.public_pages(slug,title,eyebrow,summary,status,published_at) values
  ('about','About Heyy Studio','Create with AI. Build with Experts.','Heyy Studio connects guided AI creation, organized project workspaces and professional production.','published',now()),
  ('terms','Terms and Conditions','Legal','The rules governing access to Heyy Studio, subscriptions, credits and expert production.','published',now()),
  ('privacy','Privacy Policy','Trust','How Heyy Studio handles account, project, payment and generation data.','published',now()),
  ('refunds','Refund Policy','Billing','How subscription, credit and custom production refund requests are reviewed.','published',now()),
  ('responsible-ai','Responsible AI','Trust','How Heyy Studio communicates AI limits, user responsibility and professional-review boundaries.','published',now()),
  ('security','Security','Trust','Platform safeguards for identity, payment, private project data and files.','published',now()),
  ('content-policy','Content Policy','Trust','Rules for responsible generation and uploaded content.','published',now())
on conflict (slug) do nothing;

-- Existing Brand image code and V13 tools use this bucket. Keep it public for
-- current compatibility; project ownership and storage paths remain user scoped.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('project-assets','project-assets',true,104857600,array['image/png','image/jpeg','image/webp','video/mp4','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Idempotent purchased-credit top-ups from Stripe Checkout.
create table if not exists public.credit_top_up_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  pack_id text not null,
  credits integer not null check (credits > 0),
  amount_total integer,
  currency text not null default 'usd',
  created_at timestamptz not null default now()
);
create index if not exists credit_top_up_orders_user_created_idx on public.credit_top_up_orders(user_id, created_at desc);
alter table public.credit_top_up_orders enable row level security;
drop policy if exists credit_top_up_orders_owner_select on public.credit_top_up_orders;
create policy credit_top_up_orders_owner_select on public.credit_top_up_orders for select to authenticated using (user_id = auth.uid());

create or replace function public.heyy_apply_credit_top_up(
  p_user_id uuid,
  p_stripe_session_id text,
  p_pack_id text,
  p_credits integer,
  p_amount_total integer,
  p_currency text default 'usd'
) returns boolean
language plpgsql security definer set search_path = public as $$
declare available integer;
begin
  if p_user_id is null or coalesce(p_stripe_session_id,'') = '' or p_credits <= 0 then
    raise exception 'Invalid credit top-up';
  end if;
  if exists(select 1 from public.credit_top_up_orders where stripe_session_id = p_stripe_session_id) then
    return true;
  end if;
  insert into public.credit_wallets(user_id) values (p_user_id) on conflict (user_id) do nothing;
  insert into public.credit_top_up_orders(user_id,stripe_session_id,pack_id,credits,amount_total,currency)
  values(p_user_id,p_stripe_session_id,p_pack_id,p_credits,p_amount_total,lower(coalesce(p_currency,'usd')));
  update public.credit_wallets set purchased_balance = purchased_balance + p_credits where user_id = p_user_id
  returning monthly_balance + purchased_balance - reserved_balance into available;
  insert into public.credit_usage_events(user_id,event_type,action,amount,available_balance,metadata)
  values(p_user_id,'top_up','credit_top_up',p_credits,available,jsonb_build_object('stripe_session_id',p_stripe_session_id,'pack_id',p_pack_id,'amount_total',p_amount_total,'currency',lower(coalesce(p_currency,'usd'))));
  return true;
exception when unique_violation then
  return true;
end;
$$;
grant execute on function public.heyy_apply_credit_top_up(uuid,text,text,integer,integer,text) to service_role;
