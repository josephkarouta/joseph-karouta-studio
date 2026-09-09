-- Heyy Studio — Admin-controlled client revision sharing with Experts.
-- Preserve the original client request while allowing Admin to edit or hide
-- the copy that is forwarded into the private Expert workspace.

begin;

alter table public.workspace_revisions
  add column if not exists expert_client_message text,
  add column if not exists expert_show_client_message boolean not null default true;

update public.workspace_revisions
set expert_client_message = message
where expert_client_message is null
  and message is not null;

notify pgrst, 'reload schema';
commit;
