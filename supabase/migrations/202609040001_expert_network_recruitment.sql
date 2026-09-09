-- Heyy Studio — Expert Network recruitment foundation.
-- Reuses the proven public application infrastructure while expanding the
-- candidate profile for project-based freelance experts.

begin;

alter table public.career_applications
  add column if not exists application_kind text not null default 'expert_network',
  add column if not exists source text not null default 'direct',
  add column if not exists timezone text,
  add column if not exists years_experience integer,
  add column if not exists specialties text[] not null default '{}'::text[],
  add column if not exists software_tools text[] not null default '{}'::text[],
  add column if not exists languages text[] not null default '{}'::text[],
  add column if not exists availability text;

alter table public.career_applications
  drop constraint if exists career_applications_status_check;
alter table public.career_applications
  add constraint career_applications_status_check
  check (status in ('new','reviewing','shortlisted','approved','rejected','hired'));

alter table public.career_applications
  drop constraint if exists career_applications_application_kind_check;
alter table public.career_applications
  add constraint career_applications_application_kind_check
  check (application_kind in ('expert_network','employment'));

alter table public.career_applications
  drop constraint if exists career_applications_availability_check;
alter table public.career_applications
  add constraint career_applications_availability_check
  check (availability is null or availability in ('available','limited','unavailable'));

alter table public.career_applications
  drop constraint if exists career_applications_years_experience_check;
alter table public.career_applications
  add constraint career_applications_years_experience_check
  check (years_experience is null or (years_experience >= 0 and years_experience <= 60));

create index if not exists career_applications_source_idx
  on public.career_applications(source);
create index if not exists career_applications_availability_idx
  on public.career_applications(availability);
create index if not exists career_applications_application_kind_idx
  on public.career_applications(application_kind);

-- Seed the first four Expert Network opportunities only when a position with
-- the same title does not already exist. Existing Admin-created roles are kept.
insert into public.career_positions (
  title, department, location, employment_type, summary, description, status, published_at
)
select
  'Freelance Brand Designer',
  'Brand Studio',
  'Remote / Worldwide',
  'Freelance / Project-based',
  'Join selected Heyy Studio brand projects to refine approved AI directions into professional, editable and production-ready brand work.',
  jsonb_build_object('sections', jsonb_build_array(
    jsonb_build_object('title','What you may work on','bullets',jsonb_build_array(
      'Logo refinement and master artwork',
      'Brand identity systems and guidelines',
      'Packaging, stationery, presentations, signage, merchandise and digital applications',
      'Preparing editable source files and production-ready deliverables'
    )),
    jsonb_build_object('title','What we are looking for','bullets',jsonb_build_array(
      'Strong branding and visual identity portfolio',
      'Professional typography, layout and production-file skills',
      'Ability to develop an approved concept rather than restart the creative direction without reason',
      'Clear communication, reliable delivery and comfort working remotely'
    )),
    jsonb_build_object('title','How projects work','paragraphs',jsonb_build_array(
      'This is not a full-time position. Heyy Studio contacts shortlisted experts when a suitable project becomes available. You review the private brief, quote your fee and timeline, and only proceed when the project is confirmed.'
    ))
  )),
  'published',
  now()
where not exists (
  select 1 from public.career_positions where lower(title) = lower('Freelance Brand Designer')
);

insert into public.career_positions (
  title, department, location, employment_type, summary, description, status, published_at
)
select
  'Freelance Marketing Specialist',
  'Marketing Studio',
  'Remote / Worldwide',
  'Freelance / Project-based',
  'Support selected Heyy Studio campaigns by turning approved strategy and creative direction into polished, channel-ready marketing work.',
  jsonb_build_object('sections', jsonb_build_array(
    jsonb_build_object('title','What you may work on','bullets',jsonb_build_array(
      'Campaign planning and channel execution',
      'Content systems, messaging and copy refinement',
      'Social, digital and launch asset coordination',
      'Production-ready campaign files, schedules and handover documentation'
    )),
    jsonb_build_object('title','What we are looking for','bullets',jsonb_build_array(
      'Strong campaign, content, digital marketing or creative-marketing experience',
      'Ability to work from an existing strategy and approved concept',
      'Understanding of channels, audiences, content systems and campaign delivery',
      'Clear communication, reliable delivery and comfort working remotely'
    )),
    jsonb_build_object('title','How projects work','paragraphs',jsonb_build_array(
      'This is a project-based Expert Network. You are contacted only when a client scope matches your experience and availability. You quote before accepting the project.'
    ))
  )),
  'published',
  now()
where not exists (
  select 1 from public.career_positions where lower(title) = lower('Freelance Marketing Specialist')
);

insert into public.career_positions (
  title, department, location, employment_type, summary, description, status, published_at
)
select
  'Freelance Architect',
  'Architecture Studio',
  'Remote / Worldwide',
  'Freelance / Project-based',
  'Develop selected Heyy Studio architecture concepts into professionally coordinated project deliverables within your qualifications and local professional obligations.',
  jsonb_build_object('sections', jsonb_build_array(
    jsonb_build_object('title','What you may work on','bullets',jsonb_build_array(
      'Design development and coordinated drawing packages',
      'CAD, BIM, planning and documentation support',
      'Professional visualisation and architectural presentation',
      'Technical coordination with project-specific consultants where required'
    )),
    jsonb_build_object('title','What we are looking for','bullets',jsonb_build_array(
      'Strong architecture portfolio and professional design-development capability',
      'Proficiency with relevant CAD, BIM and presentation software',
      'Understanding of the limits of concept-stage AI outputs and the need for professional verification',
      'Appropriate qualifications, registrations or professional status for the services you offer'
    )),
    jsonb_build_object('title','How projects work','paragraphs',jsonb_build_array(
      'Heyy Studio shares a project brief only after identifying a potential match. You review the scope, confirm your professional capacity, provide a quote and timeline, and are assigned only after approval.'
    ))
  )),
  'published',
  now()
where not exists (
  select 1 from public.career_positions where lower(title) = lower('Freelance Architect')
);

insert into public.career_positions (
  title, department, location, employment_type, summary, description, status, published_at
)
select
  'Freelance Interior Designer',
  'Interior Studio',
  'Remote / Worldwide',
  'Freelance / Project-based',
  'Develop approved Heyy Studio interior concepts into coordinated design, sourcing and production-ready project packages.',
  jsonb_build_object('sections', jsonb_build_array(
    jsonb_build_object('title','What you may work on','bullets',jsonb_build_array(
      'Interior layouts, finishes, furniture and lighting development',
      'Material and product sourcing support',
      'Schedules, specifications and presentation packages',
      'Detailed design and fit-out coordination within the agreed scope'
    )),
    jsonb_build_object('title','What we are looking for','bullets',jsonb_build_array(
      'Strong residential, hospitality, retail or commercial interior portfolio',
      'Good understanding of materials, furniture, lighting and spatial planning',
      'Ability to turn an approved concept into practical and editable project information',
      'Clear communication, reliable delivery and comfort working remotely'
    )),
    jsonb_build_object('title','How projects work','paragraphs',jsonb_build_array(
      'This is freelance, project-based work. Shortlisted experts are contacted when a project matches their skills and availability. Every assignment is quoted and agreed separately.'
    ))
  )),
  'published',
  now()
where not exists (
  select 1 from public.career_positions where lower(title) = lower('Freelance Interior Designer')
);

grant select, insert, update on table public.career_applications to service_role;

notify pgrst, 'reload schema';
commit;
