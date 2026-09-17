begin;

-- Failed provider calls with no reported usage should not carry a synthetic
-- fixed output-image estimate.
update public.generation_provider_calls
set
  estimated_cost_usd = null,
  pricing_basis = jsonb_build_object(
    'version', '2026-09-14',
    'source', 'failed-call-no-usage',
    'note', 'No provider usage was returned. Failed call excluded from local cost total.'
  )
where status = 'failed'
  and coalesce(usage, '{}'::jsonb) = '{}'::jsonb;

create or replace view public.generation_provider_cost_summary
with (security_invoker = true)
as
select
  generation_job_id,
  user_id,
  project_id,
  studio,
  stage,
  tool,
  count(*) as provider_call_count,
  count(*) filter (where status = 'succeeded') as successful_provider_call_count,
  count(*) filter (where status = 'failed') as failed_provider_call_count,
  sum(duration_ms)::bigint as provider_call_duration_ms,
  round(
    sum(
      case
        when status = 'succeeded' then coalesce(estimated_cost_usd, 0)
        else 0
      end
    )::numeric,
    6
  ) as estimated_provider_cost_usd,
  min(started_at) as first_provider_call_at,
  max(completed_at) as last_provider_call_at
from public.generation_provider_calls
group by generation_job_id, user_id, project_id, studio, stage, tool;

grant select on public.generation_provider_cost_summary to authenticated;
grant select on public.generation_provider_cost_summary to service_role;

commit;
