-- Heyy Studio V13.1 — shared production conversation
-- Run once in Supabase SQL Editor before installing Fix 13.

create extension if not exists pgcrypto;

-- The production_messages table already exists in the V12 production engine.
-- Add only the fields required for shared read state and attachments.
alter table if exists public.production_messages
  add column if not exists sender_user_id uuid null,
  add column if not exists attachment_count integer not null default 0,
  add column if not exists read_by_client_at timestamptz null,
  add column if not exists read_by_admin_at timestamptz null;

-- Avoid showing every historic system message as newly unread immediately after
-- this migration. New messages will receive recipient read timestamps through
-- the API routes.
update public.production_messages
set read_by_client_at = coalesce(read_by_client_at, created_at, now())
where sender_type in ('studio', 'system')
  and read_by_client_at is null;

update public.production_messages
set read_by_admin_at = coalesce(read_by_admin_at, created_at, now())
where sender_type = 'client'
  and read_by_admin_at is null;

create index if not exists production_messages_job_created_idx
  on public.production_messages (production_job_id, created_at);

create index if not exists production_messages_client_unread_idx
  on public.production_messages (production_job_id, read_by_client_at)
  where sender_type in ('studio', 'system');

create index if not exists production_messages_admin_unread_idx
  on public.production_messages (production_job_id, read_by_admin_at)
  where sender_type = 'client';

-- Keep attachment references as text so this repair remains compatible with
-- existing V12 projects regardless of whether their legacy IDs are uuid or text.
create table if not exists public.production_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,
  production_job_id text not null,
  filename text not null,
  mime_type text null,
  file_size bigint null,
  storage_path text not null unique,
  uploaded_by text null,
  created_at timestamptz not null default now()
);

create index if not exists production_message_attachments_message_idx
  on public.production_message_attachments (message_id, created_at);

create index if not exists production_message_attachments_job_idx
  on public.production_message_attachments (production_job_id, created_at);

-- Both tables are accessed only by authenticated server routes. The service
-- role bypasses RLS; no direct browser policies are intentionally created.
alter table public.production_messages enable row level security;
alter table public.production_message_attachments enable row level security;

-- Private storage for small message/reference attachments.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'production-message-files',
  'production-message-files',
  false,
  10485760,
  null
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
