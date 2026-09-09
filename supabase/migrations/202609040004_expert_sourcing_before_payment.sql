-- Heyy Studio — move Expert sourcing to the pre-payment Studio Request stage.
-- Existing Expert Project Operations tables stay in place. This migration makes
-- opportunities usable before a production job exists, then lets payment link
-- the selected Expert to the newly-created production job.

begin;

alter table public.expert_opportunities
  add column if not exists studio_request_id text;

alter table public.expert_opportunities
  alter column production_job_id drop not null;

alter table public.expert_opportunities
  drop constraint if exists expert_opportunities_production_job_id_expert_profile_id_key;

alter table public.expert_opportunities
  drop constraint if exists expert_opportunities_source_check;

alter table public.expert_opportunities
  add constraint expert_opportunities_source_check check (
    studio_request_id is not null or production_job_id is not null
  );

alter table public.expert_opportunities
  drop constraint if exists expert_opportunities_request_expert_key;

alter table public.expert_opportunities
  add constraint expert_opportunities_request_expert_key
  unique (studio_request_id, expert_profile_id);

alter table public.expert_opportunities
  add constraint expert_opportunities_production_job_id_expert_profile_id_key
  unique (production_job_id, expert_profile_id);

create unique index if not exists expert_opportunities_one_selected_request_uidx
  on public.expert_opportunities(studio_request_id)
  where studio_request_id is not null and status = 'selected';

create index if not exists expert_opportunities_request_idx
  on public.expert_opportunities(studio_request_id, created_at desc)
  where studio_request_id is not null;

-- Keep direct table access least-privilege while allowing an Expert to read the
-- opportunity identifier needed by the pre-payment flow.
grant select (studio_request_id) on table public.expert_opportunities to authenticated;

grant all on table public.expert_opportunities to service_role;

notify pgrst, 'reload schema';
commit;
