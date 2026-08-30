begin;

-- Phase 9 Batch 3: admin announcements + reusable operational templates.
-- Business-admin authorization itself stays in auth.users app_metadata; this
-- migration only adds the persistent business data that the role operates on.

create table if not exists public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  preheader text,
  body text not null,
  cta_label text,
  cta_path text,
  audience text not null default 'everyone' check (audience in ('everyone','free','starter','pro','subscribers')),
  channel text not null default 'both' check (channel in ('email','in_app','both')),
  status text not null default 'draft' check (status in ('draft','sending','sent','cancelled','failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid,
  updated_by uuid,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_announcements_created_idx
  on public.admin_announcements(created_at desc);
create index if not exists admin_announcements_status_idx
  on public.admin_announcements(status, created_at desc);

create table if not exists public.admin_saved_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quote','checklist')),
  name text not null,
  studio text,
  service_id text,
  content jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_saved_templates_kind_idx
  on public.admin_saved_templates(kind, enabled, updated_at desc);
create index if not exists admin_saved_templates_match_idx
  on public.admin_saved_templates(kind, studio, service_id, enabled);

alter table public.admin_announcements enable row level security;
alter table public.admin_saved_templates enable row level security;

-- These are server/Admin-managed tables. Customer browsers never receive
-- direct grants; all access is through protected server routes.
grant usage on schema public to service_role;
grant select,insert,update,delete on table public.admin_announcements to service_role;
grant select,insert,update,delete on table public.admin_saved_templates to service_role;

notify pgrst, 'reload schema';
commit;
