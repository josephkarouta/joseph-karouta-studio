begin;

alter table public.expert_submissions
  add column if not exists batch_id uuid,
  add column if not exists batch_sequence integer;

-- Group legacy uploads that were submitted together (same assignment, minute and note)
-- so the current test data becomes one review package instead of one package per file.
with grouped as (
  select
    id,
    first_value(id) over (
      partition by assignment_id, date_trunc('minute', submitted_at), coalesce(notes, '')
      order by id::text
    ) as resolved_batch_id
  from public.expert_submissions
  where batch_id is null
)
update public.expert_submissions es
set batch_id = grouped.resolved_batch_id
from grouped
where es.id = grouped.id
  and es.batch_id is null;

with batches as (
  select
    assignment_id,
    batch_id,
    min(submitted_at) as first_submitted_at
  from public.expert_submissions
  where batch_id is not null
  group by assignment_id, batch_id
), ranked as (
  select
    assignment_id,
    batch_id,
    dense_rank() over (
      partition by assignment_id
      order by first_submitted_at asc, batch_id asc
    )::integer as resolved_sequence
  from batches
)
update public.expert_submissions es
set batch_sequence = ranked.resolved_sequence
from ranked
where es.assignment_id = ranked.assignment_id
  and es.batch_id = ranked.batch_id
  and es.batch_sequence is null;

alter table public.expert_submissions
  alter column batch_id set default gen_random_uuid();

update public.expert_submissions
set batch_id = gen_random_uuid()
where batch_id is null;

update public.expert_submissions
set batch_sequence = 1
where batch_sequence is null;

alter table public.expert_submissions
  alter column batch_id set not null,
  alter column batch_sequence set not null;

alter table public.expert_submissions
  drop constraint if exists expert_submissions_batch_sequence_check;
alter table public.expert_submissions
  add constraint expert_submissions_batch_sequence_check check (batch_sequence >= 1);

create index if not exists expert_submissions_batch_idx
  on public.expert_submissions(assignment_id, batch_sequence desc, batch_id, submitted_at desc);

grant select (batch_id, batch_sequence) on table public.expert_submissions to authenticated;
grant insert (batch_id, batch_sequence) on table public.expert_submissions to authenticated;

notify pgrst, 'reload schema';
commit;
