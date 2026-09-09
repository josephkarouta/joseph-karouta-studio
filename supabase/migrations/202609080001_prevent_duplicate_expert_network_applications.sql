-- Heyy Studio — prevent duplicate Expert Network applications by email.
-- Existing historical duplicates are left untouched; this guard blocks every
-- new duplicate even if two submissions race at the same time.

begin;

create or replace function public.prevent_duplicate_expert_network_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.application_kind = 'expert_network' then
    new.email := lower(btrim(new.email));

    -- Serialize submissions for the same normalized email so two browser tabs
    -- or near-simultaneous requests cannot both pass the duplicate check.
    perform pg_advisory_xact_lock(hashtextextended(new.email, 0));

    if exists (
      select 1
      from public.career_applications existing_application
      where existing_application.application_kind = 'expert_network'
        and lower(btrim(existing_application.email)) = new.email
    ) or exists (
      select 1
      from public.expert_profiles existing_profile
      where lower(btrim(existing_profile.email)) = new.email
    ) then
      raise exception using
        errcode = '23505',
        message = 'expert_network_email_already_registered';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_expert_network_application_trigger
  on public.career_applications;

create trigger prevent_duplicate_expert_network_application_trigger
before insert on public.career_applications
for each row
execute function public.prevent_duplicate_expert_network_application();

notify pgrst, 'reload schema';
commit;
