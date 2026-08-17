import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateArchitectureDirection } from "@/lib/ai/architecture";
import { getAiPlanConfig, type AiPlan } from "@/lib/ai/config";

export type ArchitectureDirectionJobInput = {
  projectId?: string;
  directionNumber?: number;
  planName?: AiPlan;
  mode?: "live" | "demo";
  credits?: number;
};

type SourceBrief = {
  source_type?: string | null;
  source_status?: string | null;
  desired_floors?: number | null;
  preserve_elements?: string | null;
  requested_changes?: string | null;
  interpretation_level?: string | null;
  render_target?: string | null;
  geometry_rule?: string | null;
  time_of_day?: string | null;
  materials?: string | null;
  landscape_style?: string | null;
  surrounding_context?: string | null;
  render_mood?: string | null;
  camera_views?: string[];
};

type ProjectRow = {
  id: string;
  user_id: string;
  project_name: string;
  workflow_mode: string;
  project_type: string | null;
  scope: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  architectural_style: string | null;
  selected_spaces: string[] | null;
  notes: string | null;
  source_notes: string | null;
  source_brief: SourceBrief | null;
  status: string;
  completion: number;
  selected_direction_id: string | null;
};

type SiteRow = {
  land_start: string;
  address: string | null;
  plot_area: number | null;
  width: number | null;
  depth: number | null;
  desired_floors: number | null;
  terrain: string | null;
  corner_lot: string | null;
  orientation: string | null;
  climate_notes: string | null;
  site_notes: string | null;
};

type PlanningRow = {
  zoning: string | null;
  permitted_use: string | null;
  site_coverage_percent: number | null;
  floor_area_ratio: number | null;
  max_height_m: number | null;
  max_floors: number | null;
  front_setback_m: number | null;
  rear_setback_m: number | null;
  side_setback_m: number | null;
  parking_requirement: string | null;
  open_space_requirement: string | null;
  overlays: string | null;
  restrictions: string | null;
  authority_name: string | null;
  source_reference: string | null;
  verification_status: string;
  confidence: string;
  notes: string | null;
};

type ExistingDirection = {
  id: string;
  direction_number: number;
  is_selected: boolean;
  generation_json: Record<string, unknown> | null;
  image_storage_path: string | null;
};

type SelectedMaterial = {
  material_key: string;
  name: string;
  category: string;
  finish: string | null;
  application: string | null;
  image_url: string | null;
};

type DirectionUpsertPayload = Record<string, unknown> & {
  image_storage_path: string | null;
};


function assetPaths(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return [record.preview_storage_path, record.master_storage_path, record.thumbnail_storage_path]
    .filter((path): path is string => typeof path === "string" && Boolean(path));
}


function locationLabel(project: ProjectRow) {
  return [project.city, project.region, project.country].filter(Boolean).join(", ") || "the project location";
}

function contextPhrase(project: ProjectRow, site: SiteRow | null) {
  const projectType = project.project_type || "residential project";
  const plot = site?.plot_area ? `${site.plot_area} m² plot` : "available site";
  const terrain = site?.terrain && site.terrain !== "Unknown" ? site.terrain.toLowerCase() : "site conditions";
  return `${projectType.toLowerCase()} on a ${plot}, responding to ${terrain} in ${locationLabel(project)}`;
}

function planningPhrase(planning: PlanningRow | null) {
  const facts = [
    planning?.site_coverage_percent ? `${planning.site_coverage_percent}% site coverage assumption` : null,
    planning?.floor_area_ratio ? `FAR/FSR ${planning.floor_area_ratio}` : null,
    planning?.max_floors ? `${planning.max_floors} maximum floors` : null,
  ].filter(Boolean);

  return facts.length > 0
    ? `The concept acknowledges the current ${facts.join(", ")}, subject to professional verification.`
    : "The concept uses conservative planning assumptions until local requirements are professionally verified.";
}

function nextVariation(existing: ExistingDirection | undefined) {
  const stored = existing?.generation_json?.demo_variation;
  const current = typeof stored === "number" ? stored : 0;
  return current + 1;
}

function demoSourceDirection(
  number: number,
  project: ProjectRow,
  site: SiteRow | null,
  planning: PlanningRow | null,
  existing?: ExistingDirection,
) {
  const variation = nextVariation(existing);
  const isSketch = project.workflow_mode === "sketch_to_real";
  const brief = project.source_brief || {};
  const context = contextPhrase(project, site);
  const planContext = planningPhrase(planning);
  const preferredStyle = project.architectural_style || "contemporary";
  const floors = brief.desired_floors || site?.desired_floors || planning?.max_floors || 2;
  const sourceType = brief.source_type || (isSketch ? "uploaded sketch" : "uploaded plan");
  const preserve = brief.preserve_elements || "the source drawing’s strongest proportions and defining architectural idea";
  const changes = brief.requested_changes || "façade rhythm, shading, materials and realistic architectural resolution";
  const materials = brief.materials || "stone, textured render, timber and refined metalwork";
  const landscape = brief.landscape_style || "site-appropriate planted landscape";
  const surroundings = brief.surrounding_context || "the project’s street, neighbouring buildings and outdoor setting";
  const geometryRule = brief.geometry_rule || "respect the uploaded geometry";
  const renderTarget = brief.render_target || "a coordinated exterior visualisation set";
  const timeOfDay = brief.time_of_day || "Day";
  const imageUrls: Record<number, string> = {
    1: "/architecture/demo/direction-a-courtyard.jpg",
    2: "/architecture/demo/direction-b-pavilion.jpg",
    3: "/architecture/demo/direction-c-sculptural.jpg",
  };

  const sketchTitles: Record<number, string[]> = {
    1: ["Faithful Sketch Interpretation", "The Preserved Drawing", "Sketch Realised"],
    2: ["Refined Sketch Evolution", "The Developed Composition", "Sketch Refined"],
    3: ["Bold Sketch Reimagining", "The Expressive Transformation", "Sketch Reframed"],
  };
  const planTitles: Record<number, string[]> = {
    1: ["Calm Minimal Façade", "Measured Stone Expression", "Quiet Plan Realisation"],
    2: ["Layered Landscape Façade", "Horizontal Garden Expression", "Plan to Pavilion"],
    3: ["Sculptural Landmark Façade", "Vertical Feature Expression", "Plan to Icon"],
  };
  const titleSets = isSketch ? sketchTitles : planTitles;
  const title = titleSets[number][(variation - 1) % titleSets[number].length];

  const routes = isSketch
    ? {
        1: {
          philosophy: `A faithful architectural interpretation of the ${sourceType}. The route protects ${preserve} while resolving the drawing into a believable ${floors}-level ${project.project_type || "building"}.`,
          form: `The massing follows the source silhouette and major proportions closely. Depth, structure, roof thickness and openings are clarified without changing the drawing’s central identity.`,
          spatial: `The implied organisation of the sketch is translated into practical public, private and service zones, with circulation kept simple and consistent with the source composition.`,
          facade: `A restrained ${preferredStyle.toLowerCase()} façade uses ${materials}. Openings, shading and details are added carefully so the result feels real rather than redesigned.`,
          cost: "Controlled premium",
        },
        2: {
          philosophy: `A refined evolution of the ${sourceType}. The source remains recognisable, but ${changes} are improved to create a more resolved and contemporary architectural proposal.`,
          form: `The sketch geometry is cleaned, balanced and layered. Selected volumes extend or recess to create stronger entry, shade and indoor-outdoor relationships.`,
          spatial: `The source idea is reorganised where necessary to improve arrival, circulation, privacy and room-to-landscape connections while retaining its overall character.`,
          facade: `The façade develops a clearer hierarchy of solid walls, glazing, screens and material zones using ${materials}.`,
          cost: "High-end",
        },
        3: {
          philosophy: `A bold reimagining inspired by the ${sourceType}. The route keeps the drawing’s emotional idea but transforms it into a stronger architectural statement for ${context}.`,
          form: `The sketch becomes a sculptural composition with a stronger entrance, vertical or cantilevered feature and deeper shadow lines.`,
          spatial: `A dramatic central space or framed axis becomes the organising element, while private and service functions remain protected behind the expressive outer form.`,
          facade: `A high-contrast ${preferredStyle.toLowerCase()} language combines monolithic surfaces, deep reveals, feature screens and ${materials}.`,
          cost: "Signature premium",
        },
      }
    : {
        1: {
          philosophy: `A calm and precise visual development of the ${sourceType}. The proposal will ${geometryRule.toLowerCase()} while turning it into ${renderTarget.toLowerCase()}.`,
          form: `The ${floors}-level massing follows the plan footprint with controlled projections, parapets and a clearly defined entrance.`,
          spatial: `The exterior expression reflects the plan’s internal hierarchy: public spaces receive broader openings, private rooms use controlled windows and service zones remain visually quiet.`,
          facade: `A minimal ${preferredStyle.toLowerCase()} composition uses ${materials}, consistent window rhythms and deep shading to create a realistic, buildable visual direction.`,
          cost: "Controlled premium",
        },
        2: {
          philosophy: `A landscape-connected interpretation of the ${sourceType}, using horizontal layers, terraces and planting to soften the building and connect it to ${surroundings}.`,
          form: `The plan becomes a sequence of visually connected volumes with extended roof lines, terraces and shaded outdoor rooms.`,
          spatial: `Façade openings and terraces respond to the plan’s main rooms and requested views, helping the exterior communicate the internal layout.`,
          facade: `Stone or rendered cores are balanced with glazing, screens and warm soffits. The visual set emphasises landscape, depth and horizontal movement.`,
          cost: "High-end",
        },
        3: {
          philosophy: `A sculptural visual direction that respects the plan but gives the project a stronger public identity and memorable street presence.`,
          form: `Selected plan edges are expressed as bold frames, vertical elements or cantilevered features while the underlying footprint remains legible.`,
          spatial: `The main entry and principal internal spaces are expressed externally through height, voids, framed glazing and a strong architectural focal point.`,
          facade: `A dramatic ${preferredStyle.toLowerCase()} palette combines ${materials}, deep shadow and a feature façade element designed for ${timeOfDay.toLowerCase()} presentation.`,
          cost: "Signature premium",
        },
      };

  const route = routes[number as 1 | 2 | 3];
  return {
    project_id: project.id,
    user_id: project.user_id,
    direction_number: number,
    title,
    philosophy: route.philosophy,
    site_response: `${isSketch ? "The interpretation" : "The render direction"} responds to ${context}, ${surroundings} and the available source information. ${planContext}`,
    form_strategy: route.form,
    spatial_strategy: route.spatial,
    facade_strategy: route.facade,
    materials: [
      { name: materials.split(",")[0]?.trim() || "Primary material", role: "Primary exterior", description: "Defines the main architectural volumes." },
      { name: "Textured render", role: "Secondary surfaces", description: "Balances the primary material and catches soft shadow." },
      { name: "Glazing and screens", role: "Openings and climate layer", description: "Coordinates views, privacy and solar control." },
      { name: "Landscape planting", role: "Site integration", description: `Connects the project to ${landscape}.` },
    ],
    roof_strategy: number === 2 ? "Extended horizontal roof planes create shade and connect the building to outdoor rooms." : number === 3 ? "A stepped roof and selected higher volume reinforce the project’s main architectural feature." : "A controlled roof profile follows the source geometry and keeps the composition calm.",
    landscape_strategy: `The proposal uses ${landscape} to frame arrival, soften boundaries and support the requested exterior views.`,
    sustainability: "Shading, controlled glazing, passive ventilation opportunities, durable materials and roof-ready solar zones are integrated at concept level.",
    natural_light_strategy: "Openings are coordinated with the source drawing or plan, then refined to improve daylight while controlling glare and privacy.",
    privacy_strategy: "Street-facing views are controlled through screens, setbacks, planting and selective glazing, while important rooms open toward protected outdoor areas.",
    cost_level: route.cost,
    image_prompt: `Demo mode: ${title}, based on ${sourceType}, ${preferredStyle} architecture, ${materials}, ${timeOfDay} presentation, ${landscape}.`,
    image_url: imageUrls[number],
    image_storage_path: null,
    generation_status: "complete",
    generation_error: null,
    generation_json: {
      mode: "demo",
      workflow_mode: project.workflow_mode,
      demo_variation: variation,
      source: "heyy-architecture-source-demo-v1",
      source_brief: brief,
    },
    generated_at: new Date().toISOString(),
    text_model: "demo-source-text-v1",
    image_model: "demo-image-v1",
    is_selected: existing?.is_selected || false,
  };
}

function demoDirection(
  number: number,
  project: ProjectRow,
  site: SiteRow | null,
  planning: PlanningRow | null,
  existing?: ExistingDirection,
) {
  if (project.workflow_mode === "sketch_to_real" || project.workflow_mode === "plan_to_render") {
    return demoSourceDirection(number, project, site, planning, existing);
  }

  const variation = nextVariation(existing);
  const projectContext = contextPhrase(project, site);
  const planContext = planningPhrase(planning);
  const preferredStyle = project.architectural_style || "contemporary";
  const floors = site?.desired_floors || planning?.max_floors || 2;

  const titleSets: Record<number, string[]> = {
    1: ["The Shaded Courtyard", "Courtyard Sanctuary", "The Private Garden House"],
    2: ["The Landscape Pavilions", "Connected Pavilion House", "The Horizon Residence"],
    3: ["The Sculpted Landmark", "Vertical Stone House", "The Framed Monument"],
  };
  const title = titleSets[number][(variation - 1) % titleSets[number].length];

  if (number === 1) {
    return {
      project_id: project.id,
      user_id: project.user_id,
      direction_number: 1,
      title,
      philosophy: `A private, climate-aware interpretation of ${projectContext}. The building is organised around a protected internal garden so daily life feels calm, shaded and inward-looking while still receiving generous daylight.`,
      site_response: `The mass is placed close to the buildable envelope and carved around a central courtyard. Service spaces protect the harsher edges, while living areas open toward the courtyard and the best available orientation. ${planContext}`,
      form_strategy: `A composed ${floors}-level perimeter volume is broken by deep recesses, shaded terraces and the central void. The overall form remains low, quiet and grounded rather than visually exposed.`,
      spatial_strategy: "Arrival moves from a compressed entrance into the courtyard heart. Public rooms form one side of the garden, private rooms occupy the quieter wing, and circulation continuously reconnects to landscape and daylight.",
      facade_strategy: `A restrained ${preferredStyle.toLowerCase()} façade uses solid walls, screened openings and deep reveals. Street-facing glazing is controlled, while courtyard elevations become warmer and more transparent.`,
      materials: [
        { name: "Warm limestone", role: "Primary exterior", description: "A calm, durable skin that anchors the house to the site." },
        { name: "Textured render", role: "Secondary walls", description: "Softens large surfaces and creates subtle shadow movement." },
        { name: "Timber screens", role: "Privacy layer", description: "Filters sun and views around bedrooms and circulation." },
        { name: "Bronzed metal", role: "Details", description: "Adds refined frames, gates and shading edges." },
      ],
      roof_strategy: "Mostly concealed flat roofs with carefully located higher volumes for stair, daylight and ventilation elements.",
      landscape_strategy: "A planted central courtyard becomes the project’s main outdoor room, supported by shaded edge gardens and water-efficient native planting.",
      sustainability: "Passive shade, protected openings, thermal mass, courtyard ventilation, rainwater collection and roof-ready solar zones reduce operational demand.",
      natural_light_strategy: "Daylight arrives from the protected courtyard, clerestories and narrow light slots, reducing glare while bringing light deep into the plan.",
      privacy_strategy: "The street elevation is selective and screened. Primary rooms turn inward so privacy is created by the architecture rather than curtains alone.",
      cost_level: "Premium",
      image_prompt: "Demo mode: private courtyard-based contemporary residence with warm stone, timber screens, shaded internal garden and controlled street openings.",
      image_url: "/architecture/demo/direction-a-courtyard.jpg",
      image_storage_path: null,
      generation_status: "complete",
      generation_error: null,
      generation_json: { mode: "demo", demo_variation: variation, source: "heyy-architecture-demo-v1" },
      generated_at: new Date().toISOString(),
      text_model: "demo-text-v1",
      image_model: "demo-image-v1",
      is_selected: existing?.is_selected || false,
    };
  }

  if (number === 2) {
    return {
      project_id: project.id,
      user_id: project.user_id,
      direction_number: 2,
      title,
      philosophy: `An open, landscape-connected solution for ${projectContext}. Instead of one compact object, the project becomes a family of pavilions joined by shaded circulation and outdoor rooms.`,
      site_response: `The pavilions align with the longest site dimension and open toward the strongest view, garden or rear setback. Built and planted zones alternate to create a lighter footprint. ${planContext}`,
      form_strategy: `A series of horizontal ${floors}-level volumes are separated by courtyards, breezeways and glazed links. Roof planes visually connect the composition while allowing different functions to read clearly.`,
      spatial_strategy: "Living, private and service functions occupy distinct pavilions. A central gallery becomes the organising spine, making circulation intuitive and maintaining a constant relationship with landscape.",
      facade_strategy: `Long eaves, large recessed glazing and slender structural rhythms produce an elegant ${preferredStyle.toLowerCase()} expression. Solid service cores balance the more transparent living pavilions.`,
      materials: [
        { name: "Light stone", role: "Solid pavilion cores", description: "Defines grounded volumes and high-privacy rooms." },
        { name: "Low-iron glass", role: "Landscape connection", description: "Creates broad framed views while remaining deeply shaded." },
        { name: "Natural timber", role: "Soffits and screens", description: "Warms the long roof planes and outdoor living spaces." },
        { name: "Dark aluminium", role: "Frames", description: "Keeps glazed openings visually precise and lightweight." },
      ],
      roof_strategy: "Broad low-pitch or flat pavilion roofs with deep overhangs, separated drainage zones and integrated solar surfaces.",
      landscape_strategy: "Garden rooms sit between pavilions, with a continuous planted edge, pool terrace and shaded outdoor living sequence.",
      sustainability: "Cross-ventilation, controlled solar exposure, deep eaves, efficient pavilion zoning and landscape cooling support passive comfort.",
      natural_light_strategy: "Two-sided daylight reaches most key rooms, while roof overhangs and planted courts reduce heat and glare.",
      privacy_strategy: "Pavilion separation creates distance between public and private rooms. Screens and planting protect glazed areas without losing openness.",
      cost_level: "High-end",
      image_prompt: "Demo mode: horizontal pavilion residence connected to landscape, deep floating roofs, glass living spaces, stone cores and lush garden rooms.",
      image_url: "/architecture/demo/direction-b-pavilion.jpg",
      image_storage_path: null,
      generation_status: "complete",
      generation_error: null,
      generation_json: { mode: "demo", demo_variation: variation, source: "heyy-architecture-demo-v1" },
      generated_at: new Date().toISOString(),
      text_model: "demo-text-v1",
      image_model: "demo-image-v1",
      is_selected: existing?.is_selected || false,
    };
  }

  return {
    project_id: project.id,
    user_id: project.user_id,
    direction_number: 3,
    title,
    philosophy: `A bold, memorable architectural statement for ${projectContext}. The project uses vertical composition, carved mass and a strong entry gesture to create a recognisable identity from the street.`,
    site_response: `The footprint is consolidated to release a larger garden zone and improve visual impact. The most public corner becomes a sculptural marker, while private spaces step back behind layered façades. ${planContext}`,
    form_strategy: `Interlocking volumes rise across approximately ${floors} levels, with one dominant frame or cantilever defining the silhouette. Voids, double-height spaces and terraces prevent the mass from feeling heavy.`,
    spatial_strategy: "A dramatic entry sequence leads into a double-height central space. Public rooms connect vertically and visually, while private zones become quieter upper-level volumes with controlled outlooks.",
    facade_strategy: `A powerful ${preferredStyle.toLowerCase()} façade combines carved stone or concrete planes, deep apertures and one expressive framed opening. Night lighting reinforces the geometry without becoming decorative.`,
    materials: [
      { name: "Board-formed concrete", role: "Sculptural mass", description: "Creates weight, texture and a strong architectural identity." },
      { name: "Dark stone", role: "Feature planes", description: "Emphasises the entry and major vertical elements." },
      { name: "Bronze fins", role: "Sun and privacy control", description: "Adds depth and a refined rhythm to large openings." },
      { name: "Clear glass", role: "Framed views", description: "Reveals selected internal volumes and the double-height heart." },
      { name: "Warm timber", role: "Interior contrast", description: "Balances the stronger exterior palette with human warmth." },
    ],
    roof_strategy: "Layered flat roofs and terraces are integrated into the sculptural composition, with parapets concealing services and drainage.",
    landscape_strategy: "A generous rear garden contrasts with the strong street massing. Sculptural planting and a defined arrival court reinforce the architectural geometry.",
    sustainability: "Compact massing, external shading, high-performance glazing, thermal mass, roof solar capacity and zoned conditioning improve efficiency.",
    natural_light_strategy: "Double-height openings, a central light void and carefully framed side windows create dramatic but controlled daylight conditions.",
    privacy_strategy: "Deep reveals, vertical fins and offset upper volumes protect private rooms while allowing selected long views.",
    cost_level: "High-end",
    image_prompt: "Demo mode: sculptural vertical contemporary residence, dramatic framed façade, textured concrete, dark stone, bronze fins and cinematic entry.",
    image_url: "/architecture/demo/direction-c-sculptural.jpg",
    image_storage_path: null,
    generation_status: "complete",
    generation_error: null,
    generation_json: { mode: "demo", demo_variation: variation, source: "heyy-architecture-demo-v1" },
    generated_at: new Date().toISOString(),
    text_model: "demo-text-v1",
    image_model: "demo-image-v1",
    is_selected: existing?.is_selected || false,
  };
}



export async function processArchitectureDirectionJob(jobId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Architecture direction background generation is not configured.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingJob, error: loadError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tool", "architecture_direction")
    .maybeSingle();

  if (loadError) throw new Error(loadError.message || "Architecture direction job could not be loaded.");
  if (!existingJob) throw new Error("Architecture direction job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existingJob.status || ""))) return;
  if (String(existingJob.status || "") !== "queued") return;

  const { data: claimed, error: claimError } = await admin
    .from("generation_jobs")
    .update({ status: "processing", error: null })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message || "Architecture direction job could not be started.");
  if (!claimed) return;

  const input = (claimed.input || {}) as ArchitectureDirectionJobInput;
  const projectId = String(input.projectId || claimed.project_id || "").trim();
  const userId = String(claimed.user_id || "").trim();
  const directionNumber = input.directionNumber;
  const planName = input.planName || "free";
  const mode = input.mode || "live";

  try {
    if (!projectId || !userId) throw new Error("Architecture direction job is missing project context.");

    const result = await runArchitectureDirections({
      admin,
      userId,
      projectId,
      directionNumber,
      planName,
      mode,
    });

    if (claimed.credit_reservation_id) {
      const { error: commitError } = await admin.rpc("heyy_commit_credits", {
        p_reservation_id: claimed.credit_reservation_id,
        p_metadata: {
          studio: "architecture_studio",
          tool: "directions",
          project_id: projectId,
          direction_number: directionNumber || "all",
        },
      });
      if (commitError) throw new Error(commitError.message || "Architecture direction credits could not be committed.");
    }

    const { error: completeError } = await admin
      .from("generation_jobs")
      .update({
        status: "succeeded",
        error: null,
        output: {
          mode,
          plan: planName,
          credits_used: Number(input.credits || 0),
          direction_number: directionNumber || null,
          directions_count: result.directions.length,
          project_status: result.project?.status || null,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (completeError) throw new Error(completeError.message || "Architecture direction job could not be completed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Architecture direction generation failed.";

    if (claimed.credit_reservation_id) {
      const { error: refundError } = await admin.rpc("heyy_refund_credits", {
        p_reservation_id: claimed.credit_reservation_id,
        p_reason: message.slice(0, 500),
      });
      if (refundError) console.error("Architecture direction background refund failed:", refundError);
    }

    await admin
      .from("generation_jobs")
      .update({
        status: "failed",
        error: publicGenerationError(message),
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.error("Architecture direction background error:", {
      jobId,
      directionNumber: directionNumber || "all",
      message,
    });
  }
}

async function runArchitectureDirections(args: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  directionNumber?: number;
  planName: AiPlan;
  mode: "live" | "demo";
}) {
  const { admin, userId, projectId, directionNumber, planName, mode } = args;

  const [projectResult, siteResult, planningResult, existingResult, materialsResult, planResult] = await Promise.all([
    admin.from("architecture_projects").select("*").eq("id", projectId).eq("user_id", userId).single(),
    admin.from("architecture_sites").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_planning").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_directions").select("id,direction_number,is_selected,generation_json,image_storage_path").eq("project_id", projectId).eq("user_id", userId),
    admin.from("architecture_materials").select("material_key,name,category,finish,application,image_url").eq("project_id", projectId).eq("user_id", userId).eq("is_selected", true).order("sort_order", { ascending: true }),
    admin.from("architecture_plan_sets").select("title,planning_assumptions,area_schedule,room_relationships,conceptual_dimensions,total_estimated_area,generation_json").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
  ]);

  if (projectResult.error || !projectResult.data) {
    throw new Error(projectResult.error?.message || "Architecture project not found.");
  }

  const project = projectResult.data as ProjectRow;
  const site = (siteResult.data as SiteRow | null) || null;
  const planning = (planningResult.data as PlanningRow | null) || null;
  const existing = (existingResult.data as ExistingDirection[] | null) || [];
  const selectedMaterials = (materialsResult.data as SelectedMaterial[] | null) || [];
  const planFoundation = planResult.data && typeof planResult.data === "object"
    ? planResult.data as unknown as Record<string, unknown>
    : null;
  const minimumMaterials = project.workflow_mode === "build_from_scratch" ? 3 : 1;

  if (project.workflow_mode === "build_from_scratch" && !planFoundation) {
    throw new Error("Prepare and approve the Plan Foundation before generating Architecture Directions.");
  }

  if (selectedMaterials.length < minimumMaterials) {
    throw new Error(`Select at least ${minimumMaterials} material${minimumMaterials === 1 ? "" : "s"} before generating directions.`);
  }

  const materialNames = selectedMaterials.map((material) => material.name);
  const numbers = directionNumber ? [directionNumber] : [1, 2, 3];
  const aiPlan = getAiPlanConfig(planName);
  const payloads: DirectionUpsertPayload[] = [];

  for (const number of numbers) {
    const current = existing.find((item) => item.direction_number === number);

    if (mode === "demo") {
      const base = demoDirection(number, project, site, planning, current);
      const materialStrategy = selectedMaterials.map((material, index) => ({
        name: material.name,
        role: material.application || material.category,
        description: `${material.finish || "Selected finish"}. Applied as part of Direction ${String.fromCharCode(64 + number)} with final supplier and performance verification required.`,
        image_url: material.image_url,
        priority: index + 1,
      }));
      payloads.push({
        ...base,
        image_url: null,
        image_storage_path: null,
        generation_status: "text_complete",
        generation_error: null,
        materials: materialStrategy,
        facade_strategy: `${base.facade_strategy} The selected project palette is ${materialNames.join(", ")}.`,
        image_prompt: `${base.image_prompt} Use the selected material palette: ${materialNames.join(", ")}.`,
        generation_json: {
          ...(base.generation_json || {}),
          selected_material_keys: selectedMaterials.map((material) => material.material_key),
          selected_materials: selectedMaterials,
        },
      });
      continue;
    }

    const generated = await generateArchitectureDirection({
      plan: aiPlan,
      directionNumber: number,
      project: project as unknown as Record<string, unknown>,
      site: site as unknown as Record<string, unknown> | null,
      planning: planning as unknown as Record<string, unknown> | null,
      selectedMaterials: selectedMaterials as unknown as Array<Record<string, unknown>>,
      planFoundation: project.workflow_mode === "build_from_scratch" ? planFoundation : null,
    });

    payloads.push({
      project_id: project.id,
      user_id: project.user_id,
      direction_number: number,
      ...generated.direction,
      image_url: null,
      image_storage_path: null,
      generation_status: "text_complete",
      generation_error: null,
      generation_json: {
        mode: "live",
        plan: planName,
        selected_material_keys: selectedMaterials.map((material) => material.material_key),
        selected_materials: selectedMaterials,
        plan_first_geometry_authority: project.workflow_mode === "build_from_scratch",
        plan_foundation_snapshot: project.workflow_mode === "build_from_scratch" ? planFoundation : null,
        usage: generated.usage,
        image_usage: null,
        preview_assets: null,
        image_tier: "preview",
        image_quality: aiPlan.previewImageQuality,
        disclaimer: "AI-generated conceptual architecture. Not for permit, construction, engineering or regulatory reliance.",
      },
      generated_at: new Date().toISOString(),
      text_model: aiPlan.textModel,
      image_model: null,
      is_selected: current?.is_selected || false,
    });
  }

  const { error: upsertError } = await admin
    .from("architecture_directions")
    .upsert(payloads, { onConflict: "project_id,direction_number" });

  if (upsertError) throw new Error(upsertError.message);

  const oldStoragePaths = Array.from(new Set(existing
    .filter((item) => numbers.includes(item.direction_number))
    .flatMap((item) => [
      item.image_storage_path,
      ...assetPaths(item.generation_json?.preview_assets),
      ...assetPaths(item.generation_json?.final_assets),
    ])
    .filter((path): path is string => typeof path === "string" && Boolean(path))));

  if (oldStoragePaths.length) {
    await admin.storage.from("architecture-files").remove(oldStoragePaths);
  }

  const nextStatus = project.selected_direction_id ? "Direction Selected" : "Directions Ready";
  const { data: updatedProject, error: projectError } = await admin
    .from("architecture_projects")
    .update({ status: nextStatus, completion: Math.max(project.completion || 0, 68) })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (projectError) throw new Error(projectError.message);

  const { data: directions, error: directionsError } = await admin
    .from("architecture_directions")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("direction_number", { ascending: true });

  if (directionsError) throw new Error(directionsError.message);

  return {
    project: updatedProject,
    directions: directions || [],
  };
}

function publicGenerationError(message: string) {
  if (/credit|balance|insufficient/i.test(message)) return message;
  if (/select at least/i.test(message)) return message;
  if (/not found|authentication|permission|policy|row-level|rls/i.test(message)) return message;
  return "Architecture Direction generation failed. Your reserved credits were returned.";
}
