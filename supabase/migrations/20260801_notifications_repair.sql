-- Heyy Studio V13
-- Repair/create the in-app notifications schema used by the account API,
-- Notifications page and header bell.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'update',
  title text not null default 'Project update',
  message text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- These statements also repair an older/partial notifications table.
alter table public.notifications add column if not exists user_id uuid;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists href text;
alter table public.notifications add column if not exists metadata jsonb;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists created_at timestamptz;

alter table public.notifications alter column id set default gen_random_uuid();
alter table public.notifications alter column type set default 'update';
alter table public.notifications alter column title set default 'Project update';
alter table public.notifications alter column metadata set default '{}'::jsonb;
alter table public.notifications alter column created_at set default now();

update public.notifications set metadata = '{}'::jsonb where metadata is null;
update public.notifications set type = 'update' where type is null;
update public.notifications set title = 'Project update' where title is null;
update public.notifications set created_at = now() where created_at is null;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Clients can read and mark their notifications as read.
-- Only trusted server-side service-role routes create notifications.
grant select, update on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

-- Ask PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';
