-- Heyy Studio — refresh the four launch Expert Network opportunities.
-- Content-only update: preserves existing career_position IDs and applications.
-- 23 September 2026

begin;

update public.career_positions
set
  title = 'Brand Designer',
  department = 'Brand Studio',
  location = 'Remote / Worldwide',
  employment_type = 'Project-based',
  summary = $txt$Heyy Studio is expanding its Expert Network and is looking for experienced Brand Designers to collaborate on selected client projects.$txt$,
  description = jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Role Description',
        'paragraphs', jsonb_build_array(
          $txt$This is a project-based opportunity, not a full-time position. Experts are contacted when a project matches their skills and experience. You’ll receive the project brief, review the scope, provide your fee and timeline, and decide whether you would like to take it on.$txt$,
          $txt$Projects begin with a creative direction already developed through Heyy Studio. Your role is to bring that direction to a professional, refined and production-ready standard — rather than restarting the creative process from scratch.$txt$
        )
      ),
      jsonb_build_object(
        'title', 'Projects may include',
        'bullets', jsonb_build_array(
          'Logo refinement and master artwork',
          'Brand identity systems and guidelines',
          'Typography, colour and visual systems',
          'Packaging, stationery, presentations, signage and merchandise',
          'Digital brand applications',
          'Editable source files and production-ready deliverables'
        )
      ),
      jsonb_build_object(
        'title', 'What we''re looking for',
        'paragraphs', jsonb_build_array(
          $txt$Agency, studio or independent project experience is welcome. A formal design qualification is useful but not required — the quality of your work and experience matters more.$txt$
        ),
        'bullets', jsonb_build_array(
          'A strong portfolio in branding and visual identity',
          'Professional typography, layout and production skills',
          'Experience developing and refining brand systems',
          'Strong Adobe Illustrator, InDesign and/or Figma skills',
          'The ability to develop an approved direction into polished final work',
          'Strong attention to detail and file preparation',
          'Clear communication and reliable project delivery',
          'Confidence working independently and remotely'
        )
      ),
      jsonb_build_object(
        'title', 'How the Expert Network works',
        'paragraphs', jsonb_build_array(
          $txt$This is a project-based Expert Network opportunity. Joining the Expert Network does not guarantee ongoing work or create an employment relationship with Heyy Studio.$txt$,
          $txt$When a suitable project becomes available, shortlisted experts may be invited to review the brief and submit their fee and estimated timeline. Work only begins after the scope, fee and project are confirmed.$txt$
        ),
        'bullets', jsonb_build_array(
          'Location: Remote / Worldwide',
          'Engagement: Project-based',
          'Applications: Portfolio or LinkedIn profile required'
        )
      )
    )
  ),
  updated_at = now()
where lower(title) in ('freelance brand designer', 'brand designer');

update public.career_positions
set
  title = 'Architect',
  department = 'Architecture Studio',
  location = 'Remote / Worldwide',
  employment_type = 'Project-based / Contract',
  summary = $txt$Heyy Studio is expanding its Expert Network and is looking for experienced Architects to collaborate on selected client projects.$txt$,
  description = jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Role Description',
        'paragraphs', jsonb_build_array(
          $txt$This is a project-based opportunity, not a full-time position. Experts are contacted when a project matches their experience, qualifications and location. You’ll receive the project brief, review the scope, provide your fee and timeline, and decide whether you would like to take it on.$txt$,
          $txt$Projects may begin with an architectural concept already developed through Heyy Studio. Your role is to professionally develop, coordinate and validate the concept within the agreed scope and your professional qualifications.$txt$
        )
      ),
      jsonb_build_object(
        'title', 'Projects may include',
        'bullets', jsonb_build_array(
          'Concept development and design refinement',
          'Architectural drawings and planning documentation',
          'Floor plans, elevations, sections and drawing packages',
          'Detailed project documentation and specifications',
          'Architectural visualisation and presentation',
          'Planning and documentation support',
          'Technical coordination with relevant consultants where required',
          'Preparation of professional project deliverables'
        )
      ),
      jsonb_build_object(
        'title', 'What we''re looking for',
        'paragraphs', jsonb_build_array(
          $txt$Because requirements differ between countries and jurisdictions, experts are responsible for only accepting work that falls within their professional qualifications, registrations and permitted scope of practice.$txt$
        ),
        'bullets', jsonb_build_array(
          'A strong architecture portfolio and professional design-development capability',
          'Proficiency with relevant CAD, architectural and presentation software',
          'Strong understanding of architectural documentation and design development',
          'Ability to professionally assess and develop concept-stage work',
          'Understanding of planning requirements and local professional obligations relevant to the services you provide',
          'Appropriate qualifications, registrations or professional status where required for the services offered',
          'Strong attention to detail and documentation',
          'Clear communication and reliable project delivery',
          'Confidence working independently and remotely'
        )
      ),
      jsonb_build_object(
        'title', 'How the Expert Network works',
        'paragraphs', jsonb_build_array(
          $txt$This is a project-based Expert Network opportunity.$txt$,
          $txt$When a suitable project becomes available, shortlisted experts may be invited to review the brief and submit their fee and estimated timeline. Work only begins after the scope, fee and project are confirmed.$txt$
        ),
        'bullets', jsonb_build_array(
          'Location: Remote / Worldwide',
          'Engagement: Project-based / Contract',
          'Applications: Portfolio or LinkedIn profile required'
        )
      )
    )
  ),
  updated_at = now()
where lower(title) in ('freelance architect', 'architect');

update public.career_positions
set
  title = 'Marketing Specialist',
  department = 'Marketing Studio',
  location = 'Remote / Worldwide',
  employment_type = 'Project-based / Contract',
  summary = $txt$Heyy Studio is expanding its Expert Network and is looking for experienced Marketing Specialists to collaborate on selected client projects.$txt$,
  description = jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Role Description',
        'paragraphs', jsonb_build_array(
          $txt$This is a project-based opportunity, not a full-time position. Experts are contacted when a project matches their skills and experience. You’ll receive the project brief, review the scope, provide your fee and timeline, and decide whether you would like to take it on.$txt$,
          $txt$Projects may begin with a marketing strategy, campaign direction or creative concept already developed through Heyy Studio. Your role is to refine, develop and turn that direction into polished, channel-ready marketing work.$txt$
        )
      ),
      jsonb_build_object(
        'title', 'Projects may include',
        'bullets', jsonb_build_array(
          'Campaign planning and execution',
          'Content planning and content systems',
          'Messaging and copy refinement',
          'Social media and digital campaign development',
          'Launch and promotional asset coordination',
          'Email and digital marketing support',
          'Campaign schedules and rollout planning',
          'Production-ready campaign files and handover documentation'
        )
      ),
      jsonb_build_object(
        'title', 'What we''re looking for',
        'paragraphs', jsonb_build_array(
          $txt$Experience across agencies, brands, startups or independent client work is welcome.$txt$
        ),
        'bullets', jsonb_build_array(
          'Strong experience across campaigns, content, digital marketing or creative marketing',
          'Ability to work from an existing strategy and approved creative direction',
          'Understanding of audiences, channels and campaign delivery',
          'Experience with social and digital marketing',
          'Strong written communication and messaging skills',
          'Ability to turn strategy into practical campaign deliverables',
          'Strong organisational and project-management skills',
          'Clear communication and reliable project delivery',
          'Confidence working independently and remotely'
        )
      ),
      jsonb_build_object(
        'title', 'How the Expert Network works',
        'paragraphs', jsonb_build_array(
          $txt$This is a project-based Expert Network opportunity.$txt$,
          $txt$When a suitable project becomes available, shortlisted experts may be invited to review the brief and submit their fee and estimated timeline. Work only begins after the scope, fee and project are confirmed.$txt$
        ),
        'bullets', jsonb_build_array(
          'Location: Remote / Worldwide',
          'Engagement: Project-based / Contract',
          'Applications: Portfolio, LinkedIn profile or relevant work examples required'
        )
      )
    )
  ),
  updated_at = now()
where lower(title) in ('freelance marketing specialist', 'marketing specialist');

update public.career_positions
set
  title = 'Interior Designer',
  department = 'Interior Studio',
  location = 'Remote / Worldwide',
  employment_type = 'Project-based / Contract',
  summary = $txt$Heyy Studio is expanding its Expert Network and is looking for experienced Interior Designers to collaborate on selected client projects.$txt$,
  description = jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Role Description',
        'paragraphs', jsonb_build_array(
          $txt$This is a project-based opportunity, not a full-time position. Experts are contacted when a project matches their skills, experience and location. You’ll receive the project brief, review the scope, provide your fee and timeline, and decide whether you would like to take it on.$txt$,
          $txt$Projects may begin with an interior concept and visual direction already developed through Heyy Studio. Your role is to develop that approved direction into practical, coordinated and production-ready interior design deliverables.$txt$
        )
      ),
      jsonb_build_object(
        'title', 'Projects may include',
        'bullets', jsonb_build_array(
          'Interior layouts and design development',
          'Finishes, furniture and lighting development',
          'Material and product sourcing',
          'Furniture and fixture selection',
          'Schedules and specifications',
          'Presentation and documentation packages',
          'Detailed design development',
          'Fit-out coordination within the agreed scope',
          'Supplier and consultant coordination where required'
        )
      ),
      jsonb_build_object(
        'title', 'What we''re looking for',
        'paragraphs', jsonb_build_array(
          $txt$Relevant qualifications and professional experience are preferred, particularly where the project scope requires specialised documentation or local professional requirements.$txt$
        ),
        'bullets', jsonb_build_array(
          'A strong residential, hospitality, retail or commercial interior portfolio',
          'Strong understanding of materials, furniture, lighting and spatial planning',
          'Experience developing concepts into practical design solutions',
          'Ability to prepare clear schedules, specifications and project documentation',
          'Relevant interior design and presentation software skills',
          'Strong attention to detail and material selection',
          'Experience working with suppliers and project stakeholders',
          'Clear communication and reliable project delivery',
          'Confidence working independently and remotely'
        )
      ),
      jsonb_build_object(
        'title', 'How the Expert Network works',
        'paragraphs', jsonb_build_array(
          $txt$This is a project-based Expert Network opportunity.$txt$,
          $txt$When a suitable project becomes available, shortlisted experts may be invited to review the brief and submit their fee and estimated timeline. Work only begins after the scope, fee and project are confirmed.$txt$
        ),
        'bullets', jsonb_build_array(
          'Location: Remote / Worldwide',
          'Engagement: Project-based / Contract',
          'Applications: Portfolio or LinkedIn profile required'
        )
      )
    )
  ),
  updated_at = now()
where lower(title) in ('freelance interior designer', 'interior designer');

notify pgrst, 'reload schema';
commit;
