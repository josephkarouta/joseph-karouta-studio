begin;

alter table public.workspace_revisions
  add column if not exists target_files jsonb not null default '[]'::jsonb,
  add column if not exists forwarded_to_expert_at timestamptz,
  add column if not exists forwarded_to_expert_by uuid;

-- Keep existing historical revisions valid. New revision requests save a
-- snapshot of the specific client-visible files included in that revision round.
update public.workspace_revisions
set target_files = '[]'::jsonb
where target_files is null;

grant select (target_files, forwarded_to_expert_at, forwarded_to_expert_by)
  on table public.workspace_revisions to authenticated;

notify pgrst, 'reload schema';
commit;
