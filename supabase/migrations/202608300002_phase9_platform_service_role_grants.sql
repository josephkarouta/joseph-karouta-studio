-- Phase 9 QA hardening: Admin platform resources are accessed server-side
-- with the Supabase service role. These grants make the existing Careers,
-- Public Pages and Help Center tables consistent with the other Admin
-- platform resources.

grant select, insert, update, delete
on table public.career_positions
TO service_role;

grant select, insert, update, delete
on table public.public_pages
to service_role;

grant select, insert, update, delete
on table public.help_articles
to service_role;
