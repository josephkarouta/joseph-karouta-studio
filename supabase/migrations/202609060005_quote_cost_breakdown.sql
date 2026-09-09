-- Heyy Studio · internal Expert cost + management-fee breakdown on client quotes.
-- Quote amount remains PRE-TAX. Stripe Automatic Tax calculates and records the
-- actual GST/tax at checkout based on the client's billing location.

alter table public.workspace_quotes
  add column if not exists expert_cost_amount numeric(12,2),
  add column if not exists management_fee_percent numeric(6,2),
  add column if not exists management_fee_amount numeric(12,2);

comment on column public.workspace_quotes.expert_cost_amount is
  'Internal pre-tax Expert production cost used to build the Heyy Studio client quote.';
comment on column public.workspace_quotes.management_fee_percent is
  'Heyy Studio service/management fee percentage applied to the internal production cost.';
comment on column public.workspace_quotes.management_fee_amount is
  'Pre-tax Heyy Studio service/management fee amount included in the client quote.';
