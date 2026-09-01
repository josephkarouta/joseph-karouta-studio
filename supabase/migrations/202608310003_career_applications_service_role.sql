-- Heyy Studio — Careers application Admin/service-role access hardening.
-- Non-destructive. Public reads remain disabled; CV files remain private.

begin;

grant select, insert, update, delete
on table public.career_applications
to service_role;

-- The public application route validates the selected position with the
-- service-role client before accepting a submission.
grant select
on table public.career_positions
to service_role;

notify pgrst, 'reload schema';
commit;
