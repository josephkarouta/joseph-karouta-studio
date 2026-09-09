-- Heyy Studio — keep Expert extra-revision pricing separate from the client price.
-- Experts quote the amount they expect to receive. Heyy Studio then adds the
-- same management-fee percentage used for the main project before presenting
-- the extra-revision price to the client.

begin;

alter table public.expert_opportunities
  add column if not exists extra_revision_fee_cents integer;

alter table public.expert_assignments
  add column if not exists extra_revision_fee_cents integer;

alter table public.workspace_quotes
  add column if not exists expert_extra_revision_cost_amount numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'expert_opportunities_extra_revision_fee_check'
  ) then
    alter table public.expert_opportunities
      add constraint expert_opportunities_extra_revision_fee_check
      check (extra_revision_fee_cents is null or extra_revision_fee_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'expert_assignments_extra_revision_fee_check'
  ) then
    alter table public.expert_assignments
      add constraint expert_assignments_extra_revision_fee_check
      check (extra_revision_fee_cents is null or extra_revision_fee_cents >= 0);
  end if;
end $$;

comment on column public.expert_opportunities.extra_revision_fee_cents is
  'Private Expert fee expected for one additional revision round. Never shown directly to the client.';
comment on column public.expert_assignments.extra_revision_fee_cents is
  'Private Expert fee expected for one additional revision round, copied from the selected Expert quote at assignment.';
comment on column public.workspace_quotes.expert_extra_revision_cost_amount is
  'Internal Expert cost for one extra revision. workspace_quotes.extra_revision_fee remains the client-facing pre-tax price after Heyy Studio management fee.';

commit;
