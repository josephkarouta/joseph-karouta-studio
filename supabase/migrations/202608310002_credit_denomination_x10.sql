-- Heyy Studio — 10x credit denomination migration.
-- 1 old Heyy credit = 10 new Heyy credits.
-- IMPORTANT: review the read-only preflight before applying this migration.
-- Idempotency: the permanent migration marker + advisory transaction lock make
-- a second run a no-op. Money amounts and plan/pack USD prices are NOT changed.

begin;

create table if not exists public.credit_denomination_migrations (
  key text primary key,
  factor integer not null check (factor > 0),
  metadata jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now()
);

grant select on table public.credit_denomination_migrations to service_role;

-- Temporary helper used only inside this migration transaction. It scales
-- known credit-denominated JSON fields and deliberately leaves money fields
-- such as amount_total untouched.
create or replace function public.heyy__scale_credit_json_x10(value jsonb)
returns jsonb
language plpgsql
immutable
as $function$
declare
  result jsonb := coalesce(value, '{}'::jsonb);
  key text;
  raw text;
begin
  foreach key in array array['credit_cost','credits','credits_used','replaced_credits','expired_credits'] loop
    raw := result->>key;
    if raw is not null and raw ~ '^-?[0-9]+([.][0-9]+)?$' then
      result := jsonb_set(result, array[key], to_jsonb((raw::numeric) * 10), false);
    end if;
  end loop;
  return result;
end;
$function$;

do $migration$
declare
  migration_key constant text := 'credits_x10_20260831';
  version_table_exists boolean;
  version_credit_column_exists boolean;
begin
  perform pg_advisory_xact_lock(hashtext(migration_key));

  if exists (
    select 1 from public.credit_denomination_migrations where key = migration_key
  ) then
    raise notice 'Heyy Studio credit denomination x10 already applied; no changes made.';
    return;
  end if;

  -- Core balances. Monthly/subscription, purchased and currently reserved
  -- balances remain in exactly the same proportions.
  update public.credit_wallets
  set monthly_balance = monthly_balance * 10,
      purchased_balance = purchased_balance * 10,
      reserved_balance = reserved_balance * 10;

  update public.credit_reservations
  set amount = amount * 10,
      metadata = public.heyy__scale_credit_json_x10(metadata);

  update public.credit_usage_events
  set amount = amount * 10,
      available_balance = case when available_balance is null then null else available_balance * 10 end,
      metadata = public.heyy__scale_credit_json_x10(metadata);

  update public.credit_monthly_grants
  set amount = amount * 10,
      metadata = public.heyy__scale_credit_json_x10(metadata);

  update public.credit_top_up_orders
  set credits = credits * 10;

  -- Durable generation history. These are display/audit quantities only; job
  -- provider IDs, statuses, timestamps and project data are untouched.
  update public.generation_jobs
  set input = jsonb_set(
        input,
        '{credits}',
        to_jsonb(((input->>'credits')::numeric) * 10),
        false
      )
  where (input->>'credits') ~ '^-?[0-9]+([.][0-9]+)?$';

  update public.generation_jobs
  set output = jsonb_set(
        output,
        '{credits_used}',
        to_jsonb(((output->>'credits_used')::numeric) * 10),
        false
      )
  where output is not null
    and (output->>'credits_used') ~ '^-?[0-9]+([.][0-9]+)?$';

  -- Payment money is never multiplied. Only credit-pack descriptions and the
  -- stored credit quantity are moved to the new denomination so old invoices /
  -- Payment History remain understandable after the cutover.
  update public.payment_records
  set metadata = public.heyy__scale_credit_json_x10(metadata),
      description = case related_id
        when 'small' then 'Heyy Studio 1,000-credit pack'
        when 'medium' then 'Heyy Studio 3,000-credit pack'
        when 'large' then 'Heyy Studio 7,500-credit pack'
        else description
      end
  where payment_type = 'credit_pack';

  -- Version History is present in some evolved databases even though its
  -- creation migration is not in every archive. Scale it only when both the
  -- table and denomination-sensitive column actually exist.
  version_table_exists := to_regclass('public.project_version_history') is not null;
  select exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='project_version_history'
      and column_name='credit_cost'
  ) into version_credit_column_exists;

  if version_table_exists and version_credit_column_exists then
    execute 'update public.project_version_history set credit_cost = credit_cost * 10 where credit_cost is not null';
  end if;

  insert into public.credit_denomination_migrations(key, factor, metadata)
  values (
    migration_key,
    10,
    jsonb_build_object(
      'old_unit', 1,
      'new_units', 10,
      'prices_changed', false,
      'project_version_history_scaled', version_table_exists and version_credit_column_exists
    )
  );
end;
$migration$;

drop function if exists public.heyy__scale_credit_json_x10(jsonb);

notify pgrst, 'reload schema';
commit;
