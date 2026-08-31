-- READ-ONLY PREFLIGHT — Heyy Studio credit denomination x10.
-- Safe to run before the migration. It does not create/update/delete anything.
-- Send the result rows back for review before running the x10 migration.

with summary as (
  select
    'credit_wallets'::text as area,
    count(*)::bigint as row_count,
    coalesce(sum(monthly_balance),0)::bigint as value_1,
    coalesce(sum(purchased_balance),0)::bigint as value_2,
    coalesce(sum(reserved_balance),0)::bigint as value_3,
    'monthly / purchased / reserved'::text as meaning
  from public.credit_wallets

  union all
  select
    'credit_reservations',
    count(*),
    coalesce(sum(amount),0)::bigint,
    count(*) filter (where status = 'reserved')::bigint,
    coalesce(sum(amount) filter (where status = 'reserved'),0)::bigint,
    'all amount / active rows / active amount'
  from public.credit_reservations

  union all
  select
    'credit_usage_events',
    count(*),
    coalesce(sum(abs(amount)),0)::bigint,
    coalesce(sum(available_balance),0)::bigint,
    count(*) filter (where available_balance is not null)::bigint,
    'absolute amount total / available-balance sum / rows with balance'
  from public.credit_usage_events

  union all
  select
    'credit_monthly_grants',
    count(*),
    coalesce(sum(amount),0)::bigint,
    0::bigint,
    0::bigint,
    'grant amount total'
  from public.credit_monthly_grants

  union all
  select
    'credit_top_up_orders',
    count(*),
    coalesce(sum(credits),0)::bigint,
    coalesce(sum(amount_total),0)::bigint,
    0::bigint,
    'credit total / MONEY cents total (money will NOT be scaled)'
  from public.credit_top_up_orders

  union all
  select
    'generation_jobs',
    count(*),
    count(*) filter (where (input->>'credits') ~ '^-?[0-9]+([.][0-9]+)?$')::bigint,
    count(*) filter (where (output->>'credits_used') ~ '^-?[0-9]+([.][0-9]+)?$')::bigint,
    count(*) filter (where status in ('queued','processing','finalizing'))::bigint,
    'rows / input.credits rows / output.credits_used rows / active jobs'
  from public.generation_jobs

  union all
  select
    'payment_records_credit_packs',
    count(*),
    count(*) filter (where (metadata->>'credits') ~ '^-?[0-9]+([.][0-9]+)?$')::bigint,
    coalesce(sum(amount_total),0)::bigint,
    0::bigint,
    'pack rows / metadata.credits rows / MONEY cents total (money will NOT be scaled)'
  from public.payment_records
  where payment_type = 'credit_pack'
)
select * from summary
union all
select
  'optional_project_version_history',
  coalesce((select n_live_tup::bigint from pg_stat_user_tables where schemaname='public' and relname='project_version_history'),0),
  case when to_regclass('public.project_version_history') is null then 0 else 1 end,
  case when exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='project_version_history' and column_name='credit_cost'
  ) then 1 else 0 end,
  0,
  'approx rows / table exists / credit_cost column exists'
order by area;
