-- Heyy Studio — Expert Network onboarding foundation.
-- Approved applicants become private Expert profiles. Experts never receive
-- Admin access; their project access is granted separately per assignment.

begin;

create table if not exists public.expert_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  application_id uuid unique references public.career_applications(id) on delete set null,
  email text not null,
  full_name text not null,
  studio text not null,
  role_title text,
  location text,
  timezone text,
  years_experience integer,
  specialties text[] not null default '{}'::text[],
  software_tools text[] not null default '{}'::text[],
  languages text[] not null default '{}'::text[],
  availability text not null default 'available',
  portfolio_url text,
  linkedin_url text,
  status text not null default 'invited',
  internal_notes text,
  metadata jsonb not null default '{}'::jsonb,
  invited_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_profiles_studio_check check (
    studio in ('brand_studio','marketing_studio','architecture_studio','interior_studio')
  ),
  constraint expert_profiles_status_check check (
    status in ('invited','active','paused','inactive')
  ),
  constraint expert_profiles_availability_check check (
    availability in ('available','limited','unavailable')
  ),
  constraint expert_profiles_years_experience_check check (
    years_experience is null or (years_experience >= 0 and years_experience <= 60)
  )
);

create unique index if not exists expert_profiles_email_lower_idx
  on public.expert_profiles (lower(email));
create index if not exists expert_profiles_studio_idx
  on public.expert_profiles(studio);
create index if not exists expert_profiles_status_idx
  on public.expert_profiles(status);
create index if not exists expert_profiles_availability_idx
  on public.expert_profiles(availability);

create table if not exists public.expert_invitations (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null references public.expert_profiles(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expert_invitations_profile_idx
  on public.expert_invitations(expert_profile_id, created_at desc);
create index if not exists expert_invitations_expires_idx
  on public.expert_invitations(expires_at);

alter table public.expert_profiles enable row level security;
alter table public.expert_invitations enable row level security;

-- Expert profile access is intentionally API-only for now. Service-role APIs
-- return a customer-safe projection and prevent internal notes or status fields
-- from being changed directly by the browser.
revoke all on table public.expert_profiles from anon, authenticated;
revoke all on table public.expert_invitations from anon, authenticated;
grant all on table public.expert_profiles to service_role;
grant all on table public.expert_invitations to service_role;

notify pgrst, 'reload schema';
commit;
