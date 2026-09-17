begin;

-- A failed provider call is not part of successful output cost.
-- Keep its duration/error for reliability analysis, but do not assign a synthetic
-- generation charge in Heyy's local estimate.
update public.generation_provider_calls
set
  estimated_cost_usd = null,
  pricing_basis = coalesce(pricing_basis, '{}'::jsonb) ||
    jsonb_build_object(
      'failed_call_excluded_from_total', true,
      'updated_at', now()
    )
where status = 'failed';

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
