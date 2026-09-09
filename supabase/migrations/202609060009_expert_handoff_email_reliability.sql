-- Heyy Studio — harden preferred Expert -> paid assignment handoff.
-- Repairs historic paid quotes and makes the preferred Expert reference durable.

begin;

alter table public.workspace_quotes
  add column if not exists expert_opportunity_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_quotes_expert_opportunity_id_fkey'
  ) then
    alter table public.workspace_quotes
      add constraint workspace_quotes_expert_opportunity_id_fkey
      foreign key (expert_opportunity_id)
      references public.expert_opportunities(id)
      on delete set null;
  end if;
end $$;

create index if not exists workspace_quotes_expert_opportunity_idx
  on public.workspace_quotes(expert_opportunity_id);

-- Keep a durable preferred-Expert snapshot on Studio requests for future
-- quote/payment reconciliation. expert_opportunities.studio_request_id is text
-- while studio_requests.id is uuid in the current production schema.
update public.studio_requests sr
set metadata = coalesce(sr.metadata, '{}'::jsonb) || jsonb_build_object(
      'preferred_expert_opportunity_id', eo.id::text,
      'preferred_expert_profile_id', eo.expert_profile_id::text,
      'preferred_expert_fee_cents', eo.quoted_fee_cents,
      'preferred_expert_currency', coalesce(eo.currency, 'USD'),
      'preferred_expert_turnaround_days', eo.turnaround_days,
      'preferred_expert_included_revisions', eo.included_revisions,
      'preferred_expert_selected_at', coalesce(eo.updated_at, eo.quoted_at, eo.created_at)
    ),
    updated_at = now()
from public.expert_opportunities eo
where eo.studio_request_id = sr.id::text
  and eo.status = 'selected';

-- Backfill the exact Expert opportunity onto quotes. Prefer the selected row;
-- if a historic status changed, fall back to the quote's recorded Expert cost.
update public.workspace_quotes q
set expert_opportunity_id = coalesce(
  (
    select eo.id
    from public.expert_opportunities eo
    where eo.studio_request_id = q.studio_request_id::text
      and eo.status = 'selected'
    order by eo.updated_at desc, eo.created_at desc
    limit 1
  ),
  (
    select eo.id
    from public.expert_opportunities eo
    where eo.studio_request_id = q.studio_request_id::text
      and q.expert_cost_amount is not null
      and eo.quoted_fee_cents = round(q.expert_cost_amount * 100)::integer
      and eo.status in ('selected','quoted','closed')
    order by
      case eo.status when 'selected' then 0 when 'quoted' then 1 else 2 end,
      eo.updated_at desc,
      eo.created_at desc
    limit 1
  )
)
where q.expert_opportunity_id is null
  and q.studio_request_id is not null
  and (
    exists (
      select 1
      from public.expert_opportunities eo
      where eo.studio_request_id = q.studio_request_id::text
        and eo.status = 'selected'
    )
    or exists (
      select 1
      from public.expert_opportunities eo
      where eo.studio_request_id = q.studio_request_id::text
        and q.expert_cost_amount is not null
        and eo.quoted_fee_cents = round(q.expert_cost_amount * 100)::integer
        and eo.status in ('selected','quoted','closed')
    )
  );

-- Link paid opportunities to their production job (Expert Operations stores
-- production_job_id as text; workspace_quotes stores it as uuid).
update public.expert_opportunities eo
set production_job_id = q.production_job_id::text,
    updated_at = now()
from public.workspace_quotes q
where q.expert_opportunity_id = eo.id
  and q.production_job_id is not null
  and lower(coalesce(q.status, '')) = 'paid'
  and eo.production_job_id is distinct from q.production_job_id::text;

-- Repair missing Expert assignments for already-paid jobs such as a payment
-- webhook that created production successfully but missed the Expert handoff.
insert into public.expert_assignments (
  production_job_id,
  opportunity_id,
  expert_profile_id,
  status,
  shared_scope,
  agreed_fee_cents,
  currency,
  turnaround_days,
  included_revisions,
  assigned_by,
  assigned_at,
  due_at,
  payout_status,
  updated_at
)
select
  q.production_job_id::text,
  eo.id,
  eo.expert_profile_id,
  'assigned',
  coalesce(eo.shared_scope, '{}'::jsonb),
  eo.quoted_fee_cents,
  coalesce(eo.currency, 'USD'),
  eo.turnaround_days,
  eo.included_revisions,
  eo.requested_by,
  coalesce(q.paid_at, now()),
  case
    when eo.turnaround_days is not null
      then coalesce(q.paid_at, now()) + make_interval(days => eo.turnaround_days)
    else null
  end,
  'pending',
  now()
from public.workspace_quotes q
join public.expert_opportunities eo
  on eo.id = q.expert_opportunity_id
where lower(coalesce(q.status, '')) = 'paid'
  and q.production_job_id is not null
  and eo.quoted_fee_cents is not null
  and not exists (
    select 1
    from public.expert_assignments ea
    where ea.production_job_id = q.production_job_id::text
  )
on conflict do nothing;

-- Keep the production timeline complete. production_timeline has existed with
-- both uuid/text job IDs across historic schemas, so detect the live type.
do $$
declare
  timeline_job_type text;
begin
  select c.data_type
    into timeline_job_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'production_timeline'
    and c.column_name = 'production_job_id'
  limit 1;

  if timeline_job_type = 'uuid' then
    execute $sql$
      insert into public.production_timeline (
        production_job_id, title, description, status, created_by, event_key
      )
      select
        ea.production_job_id::uuid,
        'Expert Assigned',
        'The preferred Expert was activated automatically after client payment.',
        'Assigned',
        'System',
        'expert_assignment_activated'
      from public.expert_assignments ea
      where ea.production_job_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and not exists (
          select 1 from public.production_timeline pt
          where pt.production_job_id = ea.production_job_id::uuid
            and pt.event_key = 'expert_assignment_activated'
        )
      on conflict do nothing
    $sql$;
  else
    execute $sql$
      insert into public.production_timeline (
        production_job_id, title, description, status, created_by, event_key
      )
      select
        ea.production_job_id,
        'Expert Assigned',
        'The preferred Expert was activated automatically after client payment.',
        'Assigned',
        'System',
        'expert_assignment_activated'
      from public.expert_assignments ea
      where not exists (
        select 1 from public.production_timeline pt
        where pt.production_job_id::text = ea.production_job_id
          and pt.event_key = 'expert_assignment_activated'
      )
      on conflict do nothing
    $sql$;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
