-- Heyy Studio — Expert Project Operations MVP.
-- Connects approved Experts to existing production jobs without giving them
-- Admin access or exposing client billing / Heyy Studio margin.

begin;

create or replace function public.current_expert_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ep.id
  from public.expert_profiles ep
  where ep.user_id = auth.uid()
    and ep.status = 'active'
  limit 1;
$$;

revoke all on function public.current_expert_profile_id() from public;
grant execute on function public.current_expert_profile_id() to authenticated;

create table if not exists public.expert_opportunities (
  id uuid primary key default gen_random_uuid(),
  production_job_id text not null,
  expert_profile_id uuid not null references public.expert_profiles(id) on delete cascade,
  status text not null default 'requested',
  shared_scope jsonb not null default '{}'::jsonb,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  quoted_fee_cents integer,
  currency text not null default 'USD',
  turnaround_days integer,
  included_revisions integer,
  expert_notes text,
  quoted_at timestamptz,
  responded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_opportunities_status_check check (
    status in ('requested','quoted','selected','declined','closed','expired')
  ),
  constraint expert_opportunities_fee_check check (
    quoted_fee_cents is null or quoted_fee_cents >= 0
  ),
  constraint expert_opportunities_turnaround_check check (
    turnaround_days is null or (turnaround_days >= 1 and turnaround_days <= 365)
  ),
  constraint expert_opportunities_revisions_check check (
    included_revisions is null or (included_revisions >= 0 and included_revisions <= 50)
  ),
  constraint expert_opportunities_currency_check check (char_length(currency) = 3),
  unique (production_job_id, expert_profile_id)
);

create index if not exists expert_opportunities_profile_status_idx
  on public.expert_opportunities(expert_profile_id, status, created_at desc);
create index if not exists expert_opportunities_job_idx
  on public.expert_opportunities(production_job_id, created_at desc);

create table if not exists public.expert_assignments (
  id uuid primary key default gen_random_uuid(),
  production_job_id text not null unique,
  opportunity_id uuid unique references public.expert_opportunities(id) on delete set null,
  expert_profile_id uuid not null references public.expert_profiles(id) on delete restrict,
  status text not null default 'assigned',
  shared_scope jsonb not null default '{}'::jsonb,
  agreed_fee_cents integer not null,
  currency text not null default 'USD',
  turnaround_days integer,
  included_revisions integer,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  payout_status text not null default 'pending',
  payout_eligible_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_assignments_status_check check (
    status in ('assigned','in_progress','submitted','completed','cancelled')
  ),
  constraint expert_assignments_payout_status_check check (
    payout_status in ('pending','eligible','held','paid')
  ),
  constraint expert_assignments_fee_check check (agreed_fee_cents >= 0),
  constraint expert_assignments_turnaround_check check (
    turnaround_days is null or (turnaround_days >= 1 and turnaround_days <= 365)
  ),
  constraint expert_assignments_revisions_check check (
    included_revisions is null or (included_revisions >= 0 and included_revisions <= 50)
  ),
  constraint expert_assignments_currency_check check (char_length(currency) = 3)
);

create index if not exists expert_assignments_profile_status_idx
  on public.expert_assignments(expert_profile_id, status, assigned_at desc);
create index if not exists expert_assignments_payout_idx
  on public.expert_assignments(expert_profile_id, payout_status, assigned_at desc);

create table if not exists public.expert_project_messages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.expert_assignments(id) on delete cascade,
  sender_type text not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  read_by_expert_at timestamptz,
  read_by_admin_at timestamptz,
  created_at timestamptz not null default now(),
  constraint expert_project_messages_sender_type_check check (
    sender_type in ('expert','admin')
  ),
  constraint expert_project_messages_body_check check (
    char_length(btrim(body)) between 1 and 10000
  )
);

create index if not exists expert_project_messages_assignment_idx
  on public.expert_project_messages(assignment_id, created_at);
create index if not exists expert_project_messages_expert_unread_idx
  on public.expert_project_messages(assignment_id, read_by_expert_at)
  where sender_type = 'admin';
create index if not exists expert_project_messages_admin_unread_idx
  on public.expert_project_messages(assignment_id, read_by_admin_at)
  where sender_type = 'expert';

create table if not exists public.expert_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.expert_assignments(id) on delete cascade,
  production_job_id text not null,
  expert_profile_id uuid not null references public.expert_profiles(id) on delete restrict,
  deliverable_id uuid,
  filename text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text,
  version integer not null default 1,
  notes text,
  status text not null default 'submitted',
  admin_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_submissions_status_check check (
    status in ('submitted','changes_requested','approved','published','rejected')
  ),
  constraint expert_submissions_version_check check (version >= 1)
);

create index if not exists expert_submissions_assignment_idx
  on public.expert_submissions(assignment_id, submitted_at desc);
create index if not exists expert_submissions_job_idx
  on public.expert_submissions(production_job_id, submitted_at desc);

alter table public.expert_opportunities enable row level security;
alter table public.expert_assignments enable row level security;
alter table public.expert_project_messages enable row level security;
alter table public.expert_submissions enable row level security;

-- Experts may only see rows tied to their own active Expert profile. The app
-- still uses server APIs for validation, but these policies protect the data if
-- an authenticated browser client attempts direct table access.
drop policy if exists expert_opportunities_select_own on public.expert_opportunities;
create policy expert_opportunities_select_own
  on public.expert_opportunities for select to authenticated
  using (expert_profile_id = public.current_expert_profile_id());

drop policy if exists expert_opportunities_quote_own on public.expert_opportunities;
create policy expert_opportunities_quote_own
  on public.expert_opportunities for update to authenticated
  using (
    expert_profile_id = public.current_expert_profile_id()
    and status in ('requested','quoted')
  )
  with check (
    expert_profile_id = public.current_expert_profile_id()
    and status in ('requested','quoted','declined')
  );

drop policy if exists expert_assignments_select_own on public.expert_assignments;
create policy expert_assignments_select_own
  on public.expert_assignments for select to authenticated
  using (expert_profile_id = public.current_expert_profile_id());

drop policy if exists expert_messages_select_own on public.expert_project_messages;
create policy expert_messages_select_own
  on public.expert_project_messages for select to authenticated
  using (
    exists (
      select 1 from public.expert_assignments ea
      where ea.id = assignment_id
        and ea.expert_profile_id = public.current_expert_profile_id()
    )
  );

drop policy if exists expert_messages_insert_own on public.expert_project_messages;
create policy expert_messages_insert_own
  on public.expert_project_messages for insert to authenticated
  with check (
    sender_type = 'expert'
    and sender_user_id = auth.uid()
    and exists (
      select 1 from public.expert_assignments ea
      where ea.id = assignment_id
        and ea.expert_profile_id = public.current_expert_profile_id()
    )
  );

drop policy if exists expert_submissions_select_own on public.expert_submissions;
create policy expert_submissions_select_own
  on public.expert_submissions for select to authenticated
  using (expert_profile_id = public.current_expert_profile_id());

drop policy if exists expert_submissions_insert_own on public.expert_submissions;
create policy expert_submissions_insert_own
  on public.expert_submissions for insert to authenticated
  with check (
    expert_profile_id = public.current_expert_profile_id()
    and status = 'submitted'
    and deliverable_id is null
    and admin_notes is null
    and reviewed_at is null
    and published_at is null
    and exists (
      select 1 from public.expert_assignments ea
      where ea.id = assignment_id
        and ea.expert_profile_id = public.current_expert_profile_id()
        and ea.production_job_id = production_job_id
        and ea.status in ('assigned','in_progress','submitted')
    )
  );

revoke all on table public.expert_opportunities from anon;
revoke all on table public.expert_assignments from anon;
revoke all on table public.expert_project_messages from anon;
revoke all on table public.expert_submissions from anon;

-- Column-level grants intentionally exclude Admin-only identifiers/notes.
grant select (
  id, production_job_id, expert_profile_id, status, shared_scope, requested_at,
  expires_at, quoted_fee_cents, currency, turnaround_days, included_revisions,
  expert_notes, quoted_at, responded_at, closed_at, created_at, updated_at
) on table public.expert_opportunities to authenticated;
grant update (
  status, quoted_fee_cents, turnaround_days, included_revisions, expert_notes,
  quoted_at, responded_at, updated_at
) on table public.expert_opportunities to authenticated;

grant select (
  id, production_job_id, opportunity_id, expert_profile_id, status, shared_scope,
  agreed_fee_cents, currency, turnaround_days, included_revisions, assigned_at,
  due_at, started_at, submitted_at, completed_at, payout_status,
  payout_eligible_at, paid_at, payment_reference, created_at, updated_at
) on table public.expert_assignments to authenticated;

grant select (
  id, assignment_id, sender_type, body, read_by_expert_at, read_by_admin_at, created_at
) on table public.expert_project_messages to authenticated;
grant insert (
  assignment_id, sender_type, sender_user_id, body, read_by_expert_at
) on table public.expert_project_messages to authenticated;

grant select (
  id, assignment_id, production_job_id, filename, storage_path, file_size,
  mime_type, version, notes, status, admin_notes, submitted_at, reviewed_at,
  published_at, created_at, updated_at
) on table public.expert_submissions to authenticated;
grant insert (
  assignment_id, production_job_id, expert_profile_id, filename, storage_path,
  file_size, mime_type, version, notes, status, submitted_at, created_at, updated_at
) on table public.expert_submissions to authenticated;

grant all on table public.expert_opportunities to service_role;
grant all on table public.expert_assignments to service_role;
grant all on table public.expert_project_messages to service_role;
grant all on table public.expert_submissions to service_role;

notify pgrst, 'reload schema';
commit;
