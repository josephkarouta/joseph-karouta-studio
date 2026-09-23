-- Heyy Studio — keep the four public Expert Network opportunity badges consistent.
-- Brand Designer previously used "Project-based" while the other live roles use
-- "Project-based / Contract". This updates the existing record in place.

begin;

update public.career_positions
set
  employment_type = 'Project-based / Contract',
  updated_at = now()
where lower(title) in ('freelance brand designer', 'brand designer');

notify pgrst, 'reload schema';
commit;
