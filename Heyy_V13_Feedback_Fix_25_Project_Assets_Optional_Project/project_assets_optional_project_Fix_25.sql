-- Heyy Studio Feedback Fix 25
-- AI Tools can create global user assets that are not attached to a Studio project.
-- The V13 project_assets design already treats project_id as optional; this aligns
-- an older live database constraint with the current application schema.

begin;

alter table public.project_assets
  alter column project_id drop not null;

notify pgrst, 'reload schema';

commit;
