-- V13 Fix 17: persist one canonical production-service ID across requests,
-- quotes and paid production jobs. Existing display labels remain unchanged.

alter table if exists public.studio_requests
  add column if not exists service_id text;

alter table if exists public.workspace_quotes
  add column if not exists service_id text;

alter table if exists public.production_jobs
  add column if not exists service_id text;

create index if not exists studio_requests_project_service_id_idx
  on public.studio_requests(project_id, service_id, created_at desc);

create index if not exists workspace_quotes_project_service_id_idx
  on public.workspace_quotes(project_id, service_id, created_at desc);

create index if not exists production_jobs_project_service_id_idx
  on public.production_jobs(project_id, service_id, created_at desc);

create temporary table heyy_production_service_aliases (
  service_id text not null,
  studio text not null,
  service_alias text not null
) on commit drop;

insert into heyy_production_service_aliases(service_id, studio, service_alias) values
  ('brand-strategy-finalisation','brand_studio','Brand Strategy Finalisation'),
  ('brand-strategy-finalisation','brand_studio','Brand Strategy'),
  ('brand-creative-direction-production','brand_studio','Creative Direction Production'),
  ('brand-creative-direction-production','brand_studio','Creative Direction'),
  ('brand-logo-finalisation','brand_studio','Logo Finalisation and Master Files'),
  ('brand-logo-finalisation','brand_studio','Logo Finalization and Master Files'),
  ('brand-logo-finalisation','brand_studio','Logo Master Files'),
  ('brand-logo-finalisation','brand_studio','Logo Production'),
  ('brand-logo-finalisation','brand_studio','Logo'),
  ('brand-guidelines-production','brand_studio','Brand Guidelines Production'),
  ('brand-guidelines-production','brand_studio','Brand Guidelines'),
  ('brand-business-card','brand_studio','Business Card Production'),
  ('brand-business-card','brand_studio','Business Card'),
  ('brand-letterhead','brand_studio','Letterhead Production'),
  ('brand-letterhead','brand_studio','Letterhead'),
  ('brand-envelope','brand_studio','Envelope Production'),
  ('brand-envelope','brand_studio','Envelope'),
  ('brand-email-signature','brand_studio','Email Signature Production'),
  ('brand-email-signature','brand_studio','Email Signature'),
  ('brand-presentation','brand_studio','Presentation Production'),
  ('brand-presentation','brand_studio','Presentation'),
  ('brand-social-system','brand_studio','Social Media System Production'),
  ('brand-social-system','brand_studio','Social Media System'),
  ('brand-social-system','brand_studio','Social System Production'),
  ('brand-social-system','brand_studio','Social System'),
  ('brand-website','brand_studio','Website Production'),
  ('brand-website','brand_studio','Website'),
  ('brand-packaging','brand_studio','Packaging Production'),
  ('brand-packaging','brand_studio','Packaging'),
  ('brand-signage','brand_studio','Signage Production'),
  ('brand-signage','brand_studio','Signage'),
  ('brand-merchandise','brand_studio','Merchandise Production'),
  ('brand-merchandise','brand_studio','Merchandise'),
  ('brand-custom-deliverable','brand_studio','Custom Brand Deliverable Production'),
  ('brand-complete-package','brand_studio','Complete Brand Production Package'),
  ('architecture-design-development','architecture_studio','Architecture Design Development'),
  ('architecture-design-development','architecture_studio','Architecture Production'),
  ('architecture-design-development','architecture_studio','Architecture Design Package'),
  ('interior-concept-package','interior_studio','Interior Concept Package'),
  ('interior-concept-package','interior_studio','Interior Production'),
  ('interior-concept-package','interior_studio','Interior Design Package'),
  ('interior-professional-fit-out','interior_studio','Professional Interior Fit-Out Package'),
  ('interior-professional-fit-out','interior_studio','Interior Fit-Out Package'),
  ('marketing-campaign-creative-package','marketing_studio','Marketing Campaign Creative Package'),
  ('marketing-campaign-creative-package','marketing_studio','Marketing Production'),
  ('marketing-campaign-creative-package','marketing_studio','Campaign Creative Package');

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'studio_requests',
    'workspace_quotes',
    'production_jobs'
  ] loop
    execute format($sql$
      update public.%I as target
      set service_id = aliases.service_id
      from heyy_production_service_aliases as aliases
      where target.service_id is null
        and lower(regexp_replace(coalesce(target.studio, ''), '[^a-z0-9]+', '_', 'g')) = aliases.studio
        and lower(regexp_replace(coalesce(target.service, ''), '[^a-z0-9]+', '', 'g')) =
            lower(regexp_replace(aliases.service_alias, '[^a-z0-9]+', '', 'g'))
    $sql$, target_table);
  end loop;
end $$;

-- Preserve unknown/legacy services with a deterministic ID instead of leaving
-- them null. The application registry can still display the original label.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'studio_requests',
    'workspace_quotes',
    'production_jobs'
  ] loop
    execute format($sql$
      update public.%I
      set service_id = trim(both '-' from concat(
        replace(lower(coalesce(studio, 'studio')), '_studio', ''),
        '-',
        regexp_replace(lower(coalesce(service, 'support')), '[^a-z0-9]+', '-', 'g')
      ))
      where service_id is null
    $sql$, target_table);
  end loop;
end $$;

notify pgrst, 'reload schema';
