-- Heyy Studio — reconcile extra revisions paid before Expert-fee allocation was added.
-- Historical extra-revision purchases used the standard 25% Heyy management-fee
-- model, so the Expert portion is 80% of the pre-tax client add-on amount.

begin;

with backfilled as (
  update public.production_addons
  set expert_cost_cents = round(client_amount_cents * 0.80)::integer,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('expert_fee_backfilled', true),
      updated_at = now()
  where kind = 'extra_revision'
    and status = 'paid'
    and client_amount_cents is not null
    and client_amount_cents > 0
    and coalesce(expert_cost_cents, 0) = 0
  returning production_job_id, expert_cost_cents
), totals as (
  select production_job_id, sum(expert_cost_cents)::integer as extra_cents
  from backfilled
  group by production_job_id
)
update public.expert_assignments ea
set agreed_fee_cents = coalesce(ea.agreed_fee_cents, 0) + totals.extra_cents,
    updated_at = now()
from totals
where ea.production_job_id = totals.production_job_id;

notify pgrst, 'reload schema';
commit;
