begin;

create table if not exists public.generation_provider_calls (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text,
  studio text,
  stage text,
  tool text,
  provider text not null,
  model text not null,
  call_kind text not null,
  status text not null check (status in ('succeeded', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  reference_count integer not null default 0 check (reference_count >= 0),
  requested_quality text,
  requested_size text,
  usage jsonb not null default '{}'::jsonb,
  estimated_cost_usd numeric(12,6),
  pricing_basis jsonb not null default '{}'::jsonb,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generation_provider_calls_job_idx
  on public.generation_provider_calls(generation_job_id, started_at);
create index if not exists generation_provider_calls_project_idx
  on public.generation_provider_calls(project_id, started_at desc)
  where project_id is not null;
create index if not exists generation_provider_calls_user_idx
  on public.generation_provider_calls(user_id, started_at desc);

alter table public.generation_provider_calls enable row level security;

drop policy if exists "Users can read own provider generation calls" on public.generation_provider_calls;
create policy "Users can read own provider generation calls"
  on public.generation_provider_calls
  for select
  to authenticated
  using (auth.uid() = user_id);

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
  sum(duration_ms)::bigint as provider_call_duration_ms,
  round(sum(coalesce(estimated_cost_usd, 0))::numeric, 6) as estimated_provider_cost_usd,
  min(started_at) as first_provider_call_at,
  max(completed_at) as last_provider_call_at
from public.generation_provider_calls
group by generation_job_id, user_id, project_id, studio, stage, tool;

grant select on public.generation_provider_calls to authenticated;
grant select on public.generation_provider_cost_summary to authenticated;

commit;
