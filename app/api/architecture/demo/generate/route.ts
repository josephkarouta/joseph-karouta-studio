import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type DemoStage = "concept" | "plans" | "visuals" | "design-pack" | "all";

type DemoRequest = {
  projectId?: string;
  stage?: DemoStage;
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

type DirectionRow = {
  id: string;
  project_id: string;
  user_id: string;
  direction_number: number;
  title: string;
  philosophy: string | null;
  site_response: string | null;
  form_strategy: string | null;
  spatial_strategy: string | null;
  facade_strategy: string | null;
  materials: Array<{ name: string; role: string; description: string }> | null;
  roof_strategy: string | null;
  landscape_strategy: string | null;
  sustainability: string | null;
  natural_light_strategy: string | null;
  privacy_strategy: string | null;
  cost_level: string | null;
  image_url: string | null;
  is_selected: boolean;
};

type SiteRow = {
  plot_area: number | null;
  width: number | null;
  depth: number | null;
  desired_floors: number | null;
  terrain: string | null;
  orientation: string | null;
  corner_lot: string | null;
  climate_notes: string | null;
  site_notes: string | null;
};

type PlanningRow = {
  zoning: string | null;
  site_coverage_percent: number | null;
  floor_area_ratio: number | null;
  max_height_m: number | null;
  max_floors: number | null;
  front_setback_m: number | null;
  rear_setback_m: number | null;
  side_setback_m: number | null;
  parking_requirement: string | null;
  open_space_requirement: string | null;
  verification_status: string;
  confidence: string;
};

type SelectedMaterial = {
  material_key: string;
  name: string;
  category: string;
  finish: string | null;
  application: string | null;
  image_url: string | null;
};

type SpaceProgramRow = {
  space_name: string;
  level: string;
  quantity: number;
  area_each_m2: number;
  total_area_m2: number;
  zone: string;
  priority: string;
};

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from the server environment.`);
  return value;
}

async function createAuthenticatedSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Safe to ignore when headers are already committed.
          }
        },
      },
    },
  );
}

const visualDefinitions = [
  { visual_type: "concept_strategy", title: "Architecture Concept Strategy", image_url: "/architecture/demo/concept-strategy-board.jpg", group: "concept" },
  { visual_type: "functional_zoning", title: "Functional Zoning Diagram", image_url: "/architecture/demo/plan-functional-zoning.jpg", group: "plans" },
  { visual_type: "ground_floor", title: "Ground Floor Concept", image_url: "/architecture/demo/plan-ground-floor.jpg", group: "plans" },
  { visual_type: "upper_floor", title: "Upper Floor Concept", image_url: "/architecture/demo/plan-upper-floor.jpg", group: "plans" },
  { visual_type: "circulation", title: "Circulation Diagram", image_url: "/architecture/demo/plan-circulation.jpg", group: "plans" },
  { visual_type: "front_exterior", title: "Front Exterior", image_url: "/architecture/demo/visual-front-exterior.jpg", group: "visuals" },
  { visual_type: "rear_exterior", title: "Rear Exterior", image_url: "/architecture/demo/visual-rear-exterior.jpg", group: "visuals" },
  { visual_type: "street_view", title: "Street View", image_url: "/architecture/demo/visual-street-view.jpg", group: "visuals" },
  { visual_type: "aerial_view", title: "Aerial View", image_url: "/architecture/demo/visual-aerial-view.jpg", group: "visuals" },
  { visual_type: "day_view", title: "Day View", image_url: "/architecture/demo/visual-day.jpg", group: "visuals" },
  { visual_type: "night_view", title: "Night View", image_url: "/architecture/demo/visual-night.jpg", group: "visuals" },
  { visual_type: "facade_alternative_a", title: "Façade Alternative A", image_url: "/architecture/demo/visual-facade-alternative-a.jpg", group: "visuals" },
  { visual_type: "facade_alternative_b", title: "Façade Alternative B", image_url: "/architecture/demo/visual-facade-alternative-b.jpg", group: "visuals" },
] as const;

function floorCount(project: ProjectRow, site: SiteRow | null, planning: PlanningRow | null) {
  return Math.max(
    1,
    Math.min(
      6,
      project.source_brief?.desired_floors || site?.desired_floors || planning?.max_floors || 2,
    ),
  );
}

function estimateTotalArea(project: ProjectRow, site: SiteRow | null, planning: PlanningRow | null) {
  const plot = Number(site?.plot_area || 0);
  const coverage = Number(planning?.site_coverage_percent || 45) / 100;
  const floors = floorCount(project, site, planning);
  const coverageArea = plot > 0 ? plot * coverage * floors : 360;
  const farArea = plot > 0 && planning?.floor_area_ratio ? plot * Number(planning.floor_area_ratio) : coverageArea;
  return Math.round(Math.max(160, Math.min(1600, Math.min(coverageArea || farArea, farArea || coverageArea))));
}

function createAreaSchedule(project: ProjectRow, site: SiteRow | null, planning: PlanningRow | null) {
  const total = estimateTotalArea(project, site, planning);
  const requested = project.selected_spaces || [];
  const base = [
    { space: "Entrance & circulation", level: "Ground", percentage: 0.1 },
    { space: "Living", level: "Ground", percentage: 0.16 },
    { space: "Dining", level: "Ground", percentage: 0.1 },
    { space: "Kitchen", level: "Ground", percentage: 0.11 },
    { space: "Bedrooms", level: floorCount(project, site, planning) > 1 ? "Upper" : "Ground", percentage: 0.25 },
    { space: "Bathrooms", level: "All levels", percentage: 0.08 },
    { space: "Service & storage", level: "Ground", percentage: 0.08 },
    { space: "Flexible / study", level: floorCount(project, site, planning) > 1 ? "Upper" : "Ground", percentage: 0.06 },
    { space: "Covered outdoor", level: "Ground", percentage: 0.06 },
  ];

  const extras = requested
    .filter((space) => !base.some((item) => item.space.toLowerCase().includes(space.toLowerCase())))
    .slice(0, 4)
    .map((space) => ({ space, level: space === "Basement" ? "Basement" : "Ground / Upper", percentage: 0.04 }));

  const combined = [...base, ...extras];
  const totalPercentage = combined.reduce((sum, item) => sum + item.percentage, 0);

  return combined.map((item) => ({
    space: item.space,
    level: item.level,
    approx_area_m2: Math.max(6, Math.round((item.percentage / totalPercentage) * total)),
  }));
}

function createConcept(project: ProjectRow, direction: DirectionRow, site: SiteRow | null, planning: PlanningRow | null) {
  const floors = floorCount(project, site, planning);
  const materialNames = (direction.materials || []).map((material) => material.name).join(", ");
  const location = [project.city, project.region, project.country].filter(Boolean).join(", ") || "the project location";
  const brief = project.source_brief || {};
  const isSketch = project.workflow_mode === "sketch_to_real";
  const isPlan = project.workflow_mode === "plan_to_render";
  const sourceType = brief.source_type || (isSketch ? "uploaded sketch" : isPlan ? "uploaded plan" : "saved project brief");

  const workflowSummary = isSketch
    ? `${direction.title} develops the ${sourceType} into a coordinated architectural concept while preserving ${brief.preserve_elements || "the source drawing’s defining idea"} and resolving ${brief.requested_changes || "materials, openings, shade and realistic construction depth"}.`
    : isPlan
      ? `${direction.title} develops the ${sourceType} into ${brief.render_target || "a coordinated architectural visualisation direction"}. The concept ${brief.geometry_rule?.toLowerCase() || "respects the uploaded geometry"} while coordinating façade, massing, landscape and requested camera views.`
      : `${direction.title} develops the selected architectural direction into a coordinated concept for a ${project.project_type || "project"} in ${location}.`;

  return {
    project_id: project.id,
    user_id: project.user_id,
    direction_id: direction.id,
    title: `${direction.title} — ${isSketch ? "Sketch Interpretation Strategy" : isPlan ? "Plan Visualisation Strategy" : "Architecture Strategy"}`,
    summary: `${workflowSummary} It organises the site, movement, public and private zones, daylight, landscape and material language as one coherent system.`,
    site_response: direction.site_response || `The concept responds to ${location}, the available source drawing and current planning assumptions.`,
    functional_zoning: isPlan
      ? `The uploaded plan remains the primary spatial reference. The ${floors}-level organisation is interpreted externally so public rooms, private rooms, service zones and circulation are legible in the massing and façade.`
      : `The ${floors}-level organisation separates arrival and service functions from the main living sequence. Public spaces form the social heart, private rooms occupy protected zones, and outdoor areas extend the most important internal rooms.`,
    circulation: direction.direction_number === 1
      ? isSketch
        ? "Movement follows the source drawing’s clearest axis, with new circulation added only where needed to make the concept practical."
        : "Movement follows the courtyard or central edge, allowing landscape to act as the visual reference throughout the project."
      : direction.direction_number === 2
        ? "A clear gallery or connecting spine links the main zones and maintains a continuous relationship with landscape."
        : "A strong entry axis leads into a central vertical or sculptural space, with circulation wrapping around the project’s main feature.",
    entry_sequence: "The arrival progresses from a clearly defined exterior threshold to a sheltered entrance, then opens toward the project’s primary spatial moment rather than revealing everything from the street.",
    public_private_zones: "Shared spaces are grouped for easy use, while private rooms are positioned away from the main arrival and service routes to improve privacy and acoustic separation.",
    indoor_outdoor_relationship: direction.direction_number === 1
      ? "A protected courtyard or framed garden becomes the main outdoor room."
      : direction.direction_number === 2
        ? "The massing opens toward several garden conditions, allowing landscape to enter the project."
        : "Large framed openings connect the main interior spaces to the rear garden while the street side remains more controlled.",
    natural_light: direction.natural_light_strategy || "Daylight is controlled through orientation, overhangs, screens and internal voids.",
    ventilation: "Opposing operable openings, shaded outdoor rooms and vertical air paths support natural ventilation whenever climate and air quality permit.",
    privacy: direction.privacy_strategy || "Views are framed selectively and private rooms are protected by distance, screening and layered façades.",
    material_language: materialNames
      ? `The palette combines ${materialNames}. ${brief.materials ? `The client preference for ${brief.materials} is carried into the concept.` : "Materials are applied according to function, durability and human scale."}`
      : `The material palette follows ${brief.materials || "durable external surfaces, warm interior finishes and precise shading elements"}.`,
    landscape_integration: direction.landscape_strategy || `Landscape supports shade, privacy and arrival using ${brief.landscape_style || "site-appropriate planting"}.`,
    sustainability: direction.sustainability || "Passive design, efficient systems and water-conscious landscape strategies support lower operational demand.",
    image_url: "/architecture/demo/concept-strategy-board.jpg",
    generation_mode: "demo",
    generation_json: { mode: "demo", workflow_mode: project.workflow_mode, source: "heyy-architecture-source-demo-v1", source_brief: brief },
  };
}

function createPlanSet(project: ProjectRow, direction: DirectionRow, site: SiteRow | null, planning: PlanningRow | null) {
  const total = estimateTotalArea(project, site, planning);
  const width = Number(site?.width || 20);
  const depth = Number(site?.depth || 30);
  const floors = floorCount(project, site, planning);
  const brief = project.source_brief || {};
  const isSketch = project.workflow_mode === "sketch_to_real";
  const isPlan = project.workflow_mode === "plan_to_render";

  return {
    project_id: project.id,
    user_id: project.user_id,
    direction_id: direction.id,
    title: `${direction.title} ${isSketch ? "Sketch Development Set" : isPlan ? "Plan Interpretation Set" : "Concept Plan Set"}`,
    planning_assumptions: [
      isSketch
        ? `The uploaded ${brief.source_type || "sketch"} is treated as a concept source, not a measured or approved drawing.`
        : isPlan
          ? `The uploaded ${brief.source_type || "plan"} is the primary geometry reference. Current rule: ${brief.geometry_rule || "keep the uploaded geometry"}.`
          : `Concept developed for approximately ${floors} floor${floors === 1 ? "" : "s"}.`,
      `Concept developed for approximately ${floors} floor${floors === 1 ? "" : "s"}.`,
      planning?.site_coverage_percent ? `Working site coverage assumption: ${planning.site_coverage_percent}%.` : "Working site coverage assumption remains conceptual.",
      planning?.front_setback_m ? `Front setback assumption: ${planning.front_setback_m} m.` : "Front setback requires verification.",
      planning?.rear_setback_m ? `Rear setback assumption: ${planning.rear_setback_m} m.` : "Rear setback requires verification.",
      "All dimensions, structure, services, accessibility, fire safety and planning controls require professional verification.",
    ],
    area_schedule: createAreaSchedule(project, site, planning),
    room_relationships: [
      { from: "Entrance", to: "Living / central space", relationship: "Direct but visually controlled" },
      { from: "Kitchen", to: "Dining", relationship: "Immediate operational connection" },
      { from: "Living", to: "Primary outdoor space", relationship: "Wide indoor-outdoor opening" },
      { from: "Bedrooms", to: "Family circulation", relationship: "Private and separated from arrival" },
      { from: "Parking / service", to: "Secondary entry", relationship: "Practical service connection" },
    ],
    conceptual_dimensions: [
      { label: "Working site width", value: `${width} m` },
      { label: "Working site depth", value: `${depth} m` },
      { label: isPlan ? "Uploaded geometry rule" : "Indicative structural grid", value: isPlan ? brief.geometry_rule || "Keep uploaded geometry" : "3.6–6.0 m" },
      { label: "Main circulation width", value: "1.2–1.8 m" },
      { label: "Primary living depth", value: "5.5–7.5 m" },
      { label: "Indicative total floor area", value: `${total} m²` },
    ],
    total_estimated_area: total,
    generation_mode: "demo",
    generation_json: { mode: "demo", workflow_mode: project.workflow_mode, source: "heyy-architecture-source-demo-v1", source_brief: brief },
  };
}

async function upsertVisuals(
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>,
  project: ProjectRow,
  direction: DirectionRow,
  groups: string[],
) {
  const rows = visualDefinitions
    .filter((visual) => groups.includes(visual.group))
    .map((visual) => ({
      project_id: project.id,
      user_id: project.user_id,
      direction_id: direction.id,
      visual_type: visual.visual_type,
      title:
        project.workflow_mode === "sketch_to_real"
          ? `${visual.title} · Sketch Interpretation`
          : project.workflow_mode === "plan_to_render"
            ? `${visual.title} · Plan Render`
            : visual.title,
      prompt: `Demo image for ${visual.title} based on ${direction.title} and the ${project.source_brief?.source_type || "saved architecture brief"}.`,
      image_url: visual.image_url,
      storage_path: null,
      metadata: { mode: "demo", group: visual.group, workflow_mode: project.workflow_mode, requested_views: project.source_brief?.camera_views || [], source: "heyy-architecture-source-demo-v1" },
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("architecture_visuals")
    .upsert(rows, { onConflict: "direction_id,visual_type" });

  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DemoRequest;
    const projectId = body.projectId?.trim();
    const stage = body.stage || "all";
    const validStages: DemoStage[] = ["concept", "plans", "visuals", "design-pack", "all"];

    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId is required." }, { status: 400 });
    }

    if (!validStages.includes(stage)) {
      return NextResponse.json({ success: false, error: "Invalid demo generation stage." }, { status: 400 });
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const [projectResult, siteResult, planningResult, materialsResult, programResult] = await Promise.all([
      supabase.from("architecture_projects").select("*").eq("id", projectId).eq("user_id", user.id).single(),
      supabase.from("architecture_sites").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_planning").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_materials").select("material_key,name,category,finish,application,image_url").eq("project_id", projectId).eq("user_id", user.id).eq("is_selected", true).order("sort_order", { ascending: true }),
      supabase.from("architecture_space_programs").select("space_name,level,quantity,area_each_m2,total_area_m2,zone,priority").eq("project_id", projectId).eq("user_id", user.id).order("sort_order", { ascending: true }),
    ]);

    if (projectResult.error || !projectResult.data) {
      return NextResponse.json({ success: false, error: projectResult.error?.message || "Architecture project not found." }, { status: 404 });
    }

    const project = projectResult.data as ProjectRow;
    if (!project.selected_direction_id) {
      return NextResponse.json({ success: false, error: "Select an Architecture Direction before continuing." }, { status: 400 });
    }

    const { data: directionData, error: directionError } = await supabase
      .from("architecture_directions")
      .select("*")
      .eq("id", project.selected_direction_id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .single();

    if (directionError || !directionData) {
      return NextResponse.json({ success: false, error: directionError?.message || "Selected direction not found." }, { status: 404 });
    }

    const direction = directionData as DirectionRow;
    const site = (siteResult.data as SiteRow | null) || null;
    const planning = (planningResult.data as PlanningRow | null) || null;
    const selectedMaterials = (materialsResult.data as SelectedMaterial[] | null) || [];
    const savedProgram = (programResult.data as SpaceProgramRow[] | null) || [];
    const materialNames = selectedMaterials.map((material) => material.name);
    let nextCompletion = project.completion || 0;
    let nextStatus = project.status;

    if (stage === "concept" || stage === "all") {
      const { error } = await supabase
        .from("architecture_concepts")
        .upsert(
          {
            ...createConcept(project, direction, site, planning),
            material_language: materialNames.length
              ? `The selected project palette combines ${materialNames.join(", ")}. Final finishes, assemblies, suppliers and performance must be professionally verified.`
              : createConcept(project, direction, site, planning).material_language,
            functional_zoning: savedProgram.length
              ? `The saved Space Program contains ${savedProgram.length} spaces totalling approximately ${Math.round(savedProgram.reduce((sum, item) => sum + Number(item.total_area_m2 || 0), 0))} m² before circulation, structure and services are verified.`
              : createConcept(project, direction, site, planning).functional_zoning,
            generation_json: {
              ...createConcept(project, direction, site, planning).generation_json,
              selected_materials: selectedMaterials,
              space_program: savedProgram,
            },
          },
          { onConflict: "project_id" },
        );
      if (error) throw new Error(error.message);
      await upsertVisuals(supabase, project, direction, ["concept"]);
      nextCompletion = Math.max(nextCompletion, 75);
      nextStatus = "Concept Ready";
    }

    if (stage === "plans" || stage === "all") {
      const { error } = await supabase
        .from("architecture_plan_sets")
        .upsert(
          {
            ...createPlanSet(project, direction, site, planning),
            area_schedule: savedProgram.length
              ? savedProgram.map((item) => ({
                  space: item.quantity > 1 ? `${item.space_name} × ${item.quantity}` : item.space_name,
                  level: item.level,
                  approx_area_m2: Math.round(Number(item.total_area_m2 || 0)),
                }))
              : createPlanSet(project, direction, site, planning).area_schedule,
            total_estimated_area: savedProgram.length
              ? Math.round(savedProgram.reduce((sum, item) => sum + Number(item.total_area_m2 || 0), 0))
              : createPlanSet(project, direction, site, planning).total_estimated_area,
            generation_json: {
              ...createPlanSet(project, direction, site, planning).generation_json,
              selected_materials: selectedMaterials,
              saved_space_program: savedProgram,
            },
          },
          { onConflict: "project_id" },
        );
      if (error) throw new Error(error.message);
      await upsertVisuals(supabase, project, direction, ["plans"]);
      nextCompletion = Math.max(nextCompletion, 83);
      nextStatus = "Plans Ready";
    }

    if (stage === "visuals" || stage === "all") {
      await upsertVisuals(supabase, project, direction, ["visuals"]);
      nextCompletion = Math.max(nextCompletion, 92);
      nextStatus = "Visuals Ready";
    }

    if (stage === "design-pack" || stage === "all") {
      const { data: currentPack } = await supabase
        .from("architecture_design_packs")
        .select("version")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      const nextVersion = stage === "design-pack" && currentPack?.version ? Number(currentPack.version) + 1 : Number(currentPack?.version || 1);
      const { error } = await supabase
        .from("architecture_design_packs")
        .upsert(
          {
            project_id: project.id,
            user_id: project.user_id,
            direction_id: direction.id,
            title: `${project.project_name} Architecture Design Pack`,
            version: nextVersion,
            status: "Ready",
            included_sections: [
              "Project Brief",
              ...(project.workflow_mode === "build_from_scratch" ? [] : [project.workflow_mode === "sketch_to_real" ? "Sketch Source" : "Plan Source"]),
              "Land & Site",
              "Planning Summary",
              "Space Program",
              "Material System",
              "Selected Direction",
              "Architecture Strategy",
              "Concept Plans",
              "Area Schedule",
              "Architectural Visuals",
              "Planning Disclaimer",
            ],
            generated_at: new Date().toISOString(),
            metadata: {
              mode: "demo",
              workflow_mode: project.workflow_mode,
              source_brief: project.source_brief || null,
              selected_materials: selectedMaterials,
              space_program: savedProgram,
              source: "heyy-architecture-smart-demo-v1",
            },
          },
          { onConflict: "project_id" },
        );
      if (error) throw new Error(error.message);
      nextCompletion = Math.max(nextCompletion, 96);
      nextStatus = "Design Pack Ready";
    }

    const { data: updatedProject, error: projectUpdateError } = await supabase
      .from("architecture_projects")
      .update({ completion: nextCompletion, status: nextStatus })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (projectUpdateError) throw new Error(projectUpdateError.message);

    const [conceptResult, planResult, visualResult, packResult] = await Promise.all([
      supabase.from("architecture_concepts").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_plan_sets").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_visuals").select("*").eq("project_id", projectId).eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("architecture_design_packs").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
    ]);

    return NextResponse.json({
      success: true,
      mode: "demo",
      project: updatedProject,
      concept: conceptResult.data || null,
      planSet: planResult.data || null,
      visuals: visualResult.data || [],
      designPack: packResult.data || null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Demo architecture content could not be prepared." },
      { status: 500 },
    );
  }
}
