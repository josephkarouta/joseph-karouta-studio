import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  generateArchitectureConcept,
  generateArchitectureDna,
  generateArchitecturePlanSet,
  generateArchitectureVisualPrompts,
  generateAndStorePlanFoundationSheetImage,
  type ArchitectureDna,
  type CanonicalPlanSpec,
  type LiveVisualPrompt,
} from "@/lib/ai/architecture";
import { getAiPlanConfig, type AiPlan } from "@/lib/ai/config";

export type ArchitectureStage = "concept" | "plans" | "visuals" | "design-pack" | "all";

type ArchitectureStageJobInput = {
  projectId?: string;
  stage?: ArchitectureStage;
  planName?: AiPlan;
  credits?: number;
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
  source_brief: Record<string, unknown> | null;
  professional_brief: Record<string, unknown> | null;
  working_mode: string | null;
  status: string;
  completion: number;
  selected_direction_id: string | null;
};

type ExistingVisual = {
  id: string;
  direction_id: string | null;
  visual_type: string;
  image_url: string | null;
  storage_path: string | null;
  is_approved: boolean;
  metadata: Record<string, unknown> | null;
};

export async function processArchitectureStageJob(jobId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Architecture background generation is not configured.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: loadError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tool", "architecture_stage")
    .maybeSingle();

  if (loadError) throw new Error(loadError.message || "Architecture generation job could not be loaded.");
  if (!existing) throw new Error("Architecture generation job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existing.status || ""))) return;
  if (String(existing.status || "") !== "queued") return;

  const { data: claimed, error: claimError } = await admin
    .from("generation_jobs")
    .update({ status: "processing", error: null })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message || "Architecture generation job could not be started.");
  if (!claimed) return;

  const input = (claimed.input || {}) as ArchitectureStageJobInput;
  const projectId = String(input.projectId || claimed.project_id || "").trim();
  const stage = input.stage || "all";
  const planName = input.planName || "free";
  const userId = String(claimed.user_id || "").trim();

  try {
    if (!projectId || !userId) throw new Error("Architecture generation job is missing project context.");

    const state = await runArchitectureStage({ admin, userId, projectId, stage, planName });

    if (claimed.credit_reservation_id) {
      const { error: commitError } = await admin.rpc("heyy_commit_credits", {
        p_reservation_id: claimed.credit_reservation_id,
        p_metadata: {
          studio: "architecture_studio",
          tool: "stage_generation",
          stage,
          project_id: projectId,
        },
      });
      if (commitError) throw new Error(commitError.message || "Architecture credits could not be committed.");
    }

    const { error: completeError } = await admin
      .from("generation_jobs")
      .update({
        status: "succeeded",
        error: null,
        output: {
          stage,
          plan: planName,
          credits_used: Number(input.credits || 0),
          project_status: state.project?.status || null,
          project_completion: state.project?.completion || null,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (completeError) throw new Error(completeError.message || "Architecture generation job could not be completed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Architecture content generation failed.";

    if (claimed.credit_reservation_id) {
      const { error: refundError } = await admin.rpc("heyy_refund_credits", {
        p_reservation_id: claimed.credit_reservation_id,
        p_reason: message.slice(0, 500),
      });
      if (refundError) console.error("Architecture stage background refund failed:", refundError);
    }

    await admin
      .from("generation_jobs")
      .update({
        status: "failed",
        error: publicGenerationError(message),
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.error("Architecture stage background error:", { jobId, stage, message });
  }
}

function planFoundationDirectionContext(project: ProjectRow) {
  return {
    title: "Plan Foundation",
    philosophy: "A program-first architecture foundation. Geometry is established from the user brief, site and Space Program before style directions are explored.",
    site_response: "Use the saved site, access, outdoor requirements and planning assumptions to establish one coherent building footprint.",
    form_strategy: "The plan determines the massing footprint. Later Architecture Directions must inherit this geometry rather than replace it.",
    spatial_strategy: "Prioritise operational adjacencies, clear circulation, aligned vertical cores, access and the user's required spaces.",
    facade_strategy: "Facade character is intentionally deferred until the Direction stage.",
    materials: [],
    roof_strategy: "Roof expression is intentionally deferred until the Direction stage while the plan footprint remains fixed.",
    landscape_strategy: "Site, pool, terraces, access and required outdoor spaces are positioned as part of the plan foundation.",
    sustainability: "Use passive planning principles appropriate to the site at concept level.",
    natural_light_strategy: "Arrange occupied rooms and openings for plausible daylight without locking a facade style.",
    privacy_strategy: "Separate public, private and service zones according to the project brief.",
    cost_level: "To be developed after plan approval",
    image_prompt: "",
    project_name: project.project_name,
  };
}

function planFoundationDna(project: ProjectRow, site: Record<string, unknown> | null): ArchitectureDna {
  const sourceBrief = metadataRecord(project.source_brief);
  const professionalBrief = metadataRecord(project.professional_brief);
  const requestedStoreys = Math.max(
    1,
    Number(site?.desired_floors || sourceBrief.desired_floors || professionalBrief.desired_floors || 1) || 1,
  );
  return {
    identity_name: `${project.project_name} Plan Foundation`,
    design_summary: "Program-first coordinated geometry established before architectural style direction.",
    storeys: requestedStoreys,
    massing: "Derived from the approved canonical plan footprint and level outlines.",
    roof_form: "Deferred to the Architecture Direction stage; must remain compatible with the approved plan footprint.",
    facade_rhythm: "Deferred to the Architecture Direction stage; openings must remain compatible with approved room and circulation logic.",
    window_language: "Deferred to the Architecture Direction stage.",
    entry_expression: "The main entry location is fixed by the canonical plan.",
    landscape_relationship: "Pool, access, terraces, gardens and outdoor rooms are fixed by the canonical site plan before style development.",
    pool_relationship: "Preserve the pool/site relationship established by the canonical plan.",
    material_placement: [],
    signature_elements: ["approved footprint", "aligned vertical cores", "locked site relationships"],
    must_preserve: [
      "canonical building outline",
      "ground-floor footprint",
      "upper-floor stacking",
      "vertical-core coordinates",
      "main-entry location",
      "pool and outdoor-space location",
      "garage and driveway relationship",
      "primary circulation logic",
    ],
    prohibited_changes: [
      "do not replace the approved footprint",
      "do not move stairs or lifts between floors",
      "do not relocate the pool or main entry",
      "do not change the approved floor count",
    ],
    visual_prompt_anchor: "All later design directions and visuals must be developed from the approved plan foundation.",
    footprint_shape: "Defined by canonical_plan.building_outline",
    plan_massing_logic: "The approved canonical plan is the geometry source of truth.",
    vertical_core_strategy: "Use the exact canonical vertical-core coordinates across all levels.",
    upper_level_setback_strategy: "Follow the approved canonical upper-level outline and stacking relationship.",
  };
}

async function ensurePlanAssociationDirection(args: {
  admin: SupabaseClient;
  project: ProjectRow;
  directions: Array<Record<string, unknown>>;
  currentPlan: Record<string, unknown> | null;
}) {
  const existingPlanDirectionId = typeof args.currentPlan?.direction_id === "string"
    ? args.currentPlan.direction_id
    : null;
  if (existingPlanDirectionId) return existingPlanDirectionId;

  if (args.project.selected_direction_id) return args.project.selected_direction_id;

  const existingFoundation = args.directions.find((row) =>
    metadataRecord(row.generation_json).plan_first_foundation === true,
  );
  if (existingFoundation?.id) return String(existingFoundation.id);

  const existingDirection = args.directions.find((row) => row.id);
  if (existingDirection?.id) return String(existingDirection.id);

  const { data, error } = await args.admin
    .from("architecture_directions")
    .insert({
      project_id: args.project.id,
      user_id: args.project.user_id,
      direction_number: 1,
      title: "Plan Foundation",
      philosophy: "Internal plan-first geometry anchor.",
      form_strategy: "Geometry is established from the brief, site and Space Program before style directions.",
      facade_strategy: "Deferred until the Direction stage.",
      materials: [],
      roof_strategy: "Deferred until the Direction stage.",
      landscape_strategy: "Site relationships are established by the plan foundation.",
      sustainability: "Concept-level passive planning assumptions only.",
      cost_level: "Pending direction",
      image_url: null,
      is_selected: false,
      generation_json: {
        mode: "plan_first_foundation",
        plan_first_foundation: true,
        hidden_from_direction_ui: true,
        created_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Plan Foundation reference could not be created.");
  return String(data.id);
}

function planFoundationAssetRecord(asset: {
  imageUrl: string;
  storagePath: string;
  masterImageUrl: string;
  masterStoragePath: string;
  thumbnailImageUrl: string;
  thumbnailStoragePath: string;
  quality?: string;
  tier?: string;
}, model: string) {
  return {
    preview_url: asset.imageUrl,
    preview_storage_path: asset.storagePath,
    master_url: asset.masterImageUrl,
    master_storage_path: asset.masterStoragePath,
    thumbnail_url: asset.thumbnailImageUrl,
    thumbnail_storage_path: asset.thumbnailStoragePath,
    quality: asset.quality || "medium",
    tier: asset.tier || "preview",
    provider: "openai",
    model,
    generated_at: new Date().toISOString(),
  };
}

async function runArchitectureStage(args: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  stage: ArchitectureStage;
  planName: AiPlan;
}) {
  const { admin, userId, projectId, stage, planName } = args;

  const [
    projectResult,
    directionsResult,
    siteResult,
    planningResult,
    materialsResult,
    programResult,
    currentConceptResult,
    currentPlanResult,
    currentVisualsResult,
  ] = await Promise.all([
    admin.from("architecture_projects").select("*").eq("id", projectId).eq("user_id", userId).single(),
    admin.from("architecture_directions").select("*").eq("project_id", projectId).eq("user_id", userId).order("direction_number", { ascending: true }),
    admin.from("architecture_sites").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_planning").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_materials").select("*").eq("project_id", projectId).eq("user_id", userId).eq("is_selected", true).order("sort_order", { ascending: true }),
    admin.from("architecture_space_programs").select("*").eq("project_id", projectId).eq("user_id", userId).order("sort_order", { ascending: true }),
    admin.from("architecture_concepts").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_plan_sets").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_visuals").select("id,direction_id,visual_type,image_url,storage_path,is_approved,metadata").eq("project_id", projectId).eq("user_id", userId),
  ]);

  if (projectResult.error || !projectResult.data) {
    throw new Error(projectResult.error?.message || "Architecture project not found.");
  }

  const project = projectResult.data as ProjectRow;
  const allDirections = (directionsResult.data as Array<Record<string, unknown>> | null) || [];
  const selectedDirection = allDirections.find((row) =>
    row.is_selected === true || (project.selected_direction_id && row.id === project.selected_direction_id),
  ) || null;
  const site = (siteResult.data as Record<string, unknown> | null) || null;
  const planning = (planningResult.data as Record<string, unknown> | null) || null;
  const selectedMaterials = (materialsResult.data as Array<Record<string, unknown>> | null) || [];
  const spaceProgram = (programResult.data as Array<Record<string, unknown>> | null) || [];
  const aiPlan = getAiPlanConfig(planName);
  const existingVisuals = (currentVisualsResult.data as ExistingVisual[] | null) || [];
  let currentConcept = (currentConceptResult.data as Record<string, unknown> | null) || null;
  let currentPlan = (currentPlanResult.data as Record<string, unknown> | null) || null;
  let nextCompletion = Number(project.completion || 0);
  let nextStatus = project.status;

  if (stage !== "plans" && !selectedDirection) {
    throw new Error("Select an Architecture Direction before continuing to Visuals or the Design Pack.");
  }

  if (stage === "plans") {
    const associationDirectionId = await ensurePlanAssociationDirection({
      admin,
      project,
      directions: allDirections,
      currentPlan,
    });
    const foundationDirection = planFoundationDirectionContext(project);
    const foundationDna = planFoundationDna(project, site);

    const generated = await generateArchitecturePlanSet({
      plan: aiPlan,
      project: project as unknown as Record<string, unknown>,
      direction: foundationDirection,
      architectureDna: foundationDna,
      concept: null,
      site,
      planning,
      selectedMaterials,
      spaceProgram,
      planFoundationMode: true,
    });
    const { plan_images, canonical_plan, ...planFields } = generated.planSet;
    const { data: savedPlan, error: planError } = await admin
      .from("architecture_plan_sets")
      .upsert(
        {
          project_id: project.id,
          user_id: project.user_id,
          direction_id: associationDirectionId,
          ...planFields,
          generation_mode: "plan_first",
          generation_json: {
            mode: "plan_first",
            text_model: aiPlan.textModel,
            usage: generated.usage,
            architecture_dna: foundationDna,
            canonical_plan,
            plan_first_geometry_authority: true,
            selected_materials: selectedMaterials,
            saved_space_program: spaceProgram,
            prepared_at: new Date().toISOString(),
            disclaimer: "Concept plans only. Not measured, approved or suitable for construction.",
          },
        },
        { onConflict: "project_id" },
      )
      .select("*")
      .single();
    if (planError || !savedPlan) throw new Error(planError?.message || "Architecture Plan Set could not be saved.");
    currentPlan = savedPlan as Record<string, unknown>;

    await removeStaleVisualFiles(admin, existingVisuals, associationDirectionId, "plans");
    const planRows = mergeVisualRows({
      project,
      directionId: associationDirectionId,
      masterDirectionStoragePath: null,
      prompts: plan_images,
      group: "plans",
      existing: existingVisuals,
      model: aiPlan.textModel,
      usage: generated.usage,
      architectureDna: foundationDna,
      canonicalPlan: canonical_plan,
    }).map((row) => ({
      ...row,
      metadata: {
        ...row.metadata,
        plan_first_geometry_authority: true,
        master_direction_id: null,
        master_direction_storage_path: null,
      },
    }));
    await removeObsoleteVisualRows(admin, existingVisuals, "plans", planRows.map((row) => row.visual_type));
    if (planRows.length) {
      const { error } = await admin.from("architecture_visuals").upsert(planRows, { onConflict: "direction_id,visual_type" });
      if (error) throw new Error(error.message);
    }

    // Generate the entire Plan Foundation as ONE professional multi-floor sheet.
    // The user approves this single coordinated sheet; the crude canonical renderer remains internal only.
    const generatedAsset = await generateAndStorePlanFoundationSheetImage({
      supabase: admin,
      userId: project.user_id,
      projectId: project.id,
      filenamePrefix: "plan-foundation-sheet",
      projectName: project.project_name,
      canonicalPlan: canonical_plan,
      architectureDna: foundationDna,
      plan: aiPlan,
    });

    const foundationRow = planRows.find((item) => item.visual_type === "plan_foundation_sheet");
    const foundationMetadata = metadataRecord(foundationRow?.metadata);
    const { error: renderSaveError } = await admin
      .from("architecture_visuals")
      .update({
        image_url: generatedAsset.imageUrl,
        storage_path: generatedAsset.storagePath,
        is_approved: false,
        metadata: {
          ...foundationMetadata,
          canonical_plan,
          architecture_dna: foundationDna,
          active_plan_view: "technical",
          plan_foundation_sheet_authority: true,
          plan_foundation_version: 2,
          technical_assets: planFoundationAssetRecord(generatedAsset, aiPlan.imageModel),
        },
      })
      .eq("project_id", project.id)
      .eq("user_id", project.user_id)
      .eq("direction_id", associationDirectionId)
      .eq("visual_type", "plan_foundation_sheet");
    if (renderSaveError) throw new Error(renderSaveError.message);

    nextCompletion = Math.max(nextCompletion, 64);
    nextStatus = "Plan Foundation Ready";
  }

  if (stage === "concept" || stage === "all") {
    const direction = selectedDirection as Record<string, unknown>;
    const dnaResult = await generateArchitectureDna({
      plan: aiPlan,
      project: project as unknown as Record<string, unknown>,
      direction,
      site,
      selectedMaterials,
    });
    const architectureDna = dnaResult.architectureDna;
    const generated = await generateArchitectureConcept({
      plan: aiPlan,
      project: project as unknown as Record<string, unknown>,
      direction,
      architectureDna,
      site,
      planning,
      selectedMaterials,
      spaceProgram,
    });
    const previousJson = metadataRecord(currentConcept?.generation_json);
    const { image_prompt, ...conceptFields } = generated.concept;
    const { data, error } = await admin
      .from("architecture_concepts")
      .upsert({
        project_id: project.id,
        user_id: project.user_id,
        direction_id: project.selected_direction_id,
        ...conceptFields,
        image_url: null,
        generation_mode: "internal_only",
        generation_json: {
          ...previousJson,
          mode: "internal_only",
          image_prompt,
          text_model: aiPlan.textModel,
          usage: generated.usage,
          architecture_dna: architectureDna,
          architecture_dna_usage: dnaResult.usage,
          hidden_from_workspace: true,
          prepared_at: new Date().toISOString(),
        },
      }, { onConflict: "project_id" })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "Architecture strategy could not be saved.");
    currentConcept = data as Record<string, unknown>;
  }

  if (stage === "visuals" || stage === "all") {
    const direction = selectedDirection as Record<string, unknown>;
    const dnaResult = await generateArchitectureDna({
      plan: aiPlan,
      project: project as unknown as Record<string, unknown>,
      direction,
      site,
      selectedMaterials,
    });
    const architectureDna = dnaResult.architectureDna;
    const sourceBrief = metadataRecord(project.source_brief);
    const requestedViews = project.workflow_mode === "build_from_scratch"
      ? ["Hero Exterior Concept", "Outdoor Living Concept"]
      : Array.isArray(sourceBrief.camera_views) && (sourceBrief.camera_views as string[]).length
        ? (sourceBrief.camera_views as string[]).slice(0, 2)
        : ["Hero Exterior Concept", "Outdoor Living Concept"];
    const canonicalPlan = canonicalPlanFromRecord(currentPlan?.generation_json) || canonicalPlanFromRecord(currentPlanResult.data?.generation_json);
    if (!canonicalPlan && project.workflow_mode === "build_from_scratch") {
      throw new Error("Prepare and approve the Plan Foundation before preparing Concept Visuals.");
    }

    const generated = await generateArchitectureVisualPrompts({
      plan: aiPlan,
      project: project as unknown as Record<string, unknown>,
      direction,
      architectureDna,
      canonicalPlan,
      concept: currentConcept,
      site,
      selectedMaterials,
      requestedViews,
    });

    await removeStaleVisualFiles(admin, existingVisuals, String(project.selected_direction_id), "visuals");
    const visualRows = mergeVisualRows({
      project,
      directionId: String(project.selected_direction_id),
      masterDirectionStoragePath: typeof direction.image_storage_path === "string" ? direction.image_storage_path : null,
      prompts: generated.visuals,
      group: "visuals",
      existing: existingVisuals,
      model: aiPlan.textModel,
      usage: generated.usage,
      architectureDna,
      canonicalPlan,
    });
    await removeObsoleteVisualRows(admin, existingVisuals, "visuals", visualRows.map((row) => row.visual_type));
    if (visualRows.length) {
      const { error } = await admin.from("architecture_visuals").upsert(visualRows, { onConflict: "direction_id,visual_type" });
      if (error) throw new Error(error.message);
    }
    nextCompletion = Math.max(nextCompletion, 88);
    nextStatus = "Concept Visuals Ready";
  }

  if (stage === "design-pack" || stage === "all") {
    const direction = selectedDirection as Record<string, unknown>;
    const dnaResult = await generateArchitectureDna({
      plan: aiPlan,
      project: project as unknown as Record<string, unknown>,
      direction,
      site,
      selectedMaterials,
    });
    const architectureDna = dnaResult.architectureDna;
    const { data: currentPack } = await admin
      .from("architecture_design_packs")
      .select("version")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    const nextVersion = stage === "design-pack" && currentPack?.version ? Number(currentPack.version) + 1 : Number(currentPack?.version || 1);

    const { error } = await admin
      .from("architecture_design_packs")
      .upsert({
        project_id: project.id,
        user_id: project.user_id,
        direction_id: project.selected_direction_id,
        title: `${project.project_name} Architecture Concept Pack`,
        version: nextVersion,
        status: "Ready",
        included_sections: [
          "Project Brief",
          ...(project.workflow_mode === "build_from_scratch" ? [] : ["Source Input"]),
          "Land & Site",
          "Planning Summary",
          "Space Program",
          "Approved Plan Foundation",
          "Material System",
          "Selected Direction",
          "Concept Visuals",
          "Area Schedule",
          "Concept Disclaimer",
        ],
        generated_at: new Date().toISOString(),
        metadata: {
          mode: "plan_first",
          text_model: aiPlan.textModel,
          architecture_dna: architectureDna,
          canonical_plan: canonicalPlanFromRecord(currentPlan?.generation_json),
          plan_first_geometry_authority: true,
          master_direction_id: project.selected_direction_id,
          master_direction_storage_path: typeof direction.image_storage_path === "string" ? direction.image_storage_path : null,
          selected_materials: selectedMaterials,
          space_program: spaceProgram,
          prepared_at: new Date().toISOString(),
        },
      }, { onConflict: "project_id" });
    if (error) throw new Error(error.message);
    nextCompletion = Math.max(nextCompletion, 100);
    nextStatus = "Concept Pack Ready";
  }

  const { error: projectError } = await admin
    .from("architecture_projects")
    .update({ completion: nextCompletion, status: nextStatus })
    .eq("id", projectId)
    .eq("user_id", userId);
  if (projectError) throw new Error(projectError.message);

  return loadArchitectureStageState(admin, projectId, userId);
}

export async function loadArchitectureStageState(admin: SupabaseClient, projectId: string, userId: string) {
  const [project, concept, planSet, visuals, designPack] = await Promise.all([
    admin.from("architecture_projects").select("*").eq("id", projectId).eq("user_id", userId).single(),
    admin.from("architecture_concepts").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_plan_sets").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_visuals").select("*").eq("project_id", projectId).eq("user_id", userId).order("created_at", { ascending: true }),
    admin.from("architecture_design_packs").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
  ]);

  return {
    project: project.data || null,
    concept: concept.data || null,
    planSet: planSet.data || null,
    visuals: visuals.data || [],
    designPack: designPack.data || null,
  };
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normaliseVisualType(value: string, fallback: string) {
  const normalised = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalised || fallback;
}

function continuityIsCurrent(current: ExistingVisual | undefined, directionId: string) {
  const metadata = metadataRecord(current?.metadata);
  return Boolean(current?.direction_id === directionId && Number(metadata.visual_continuity_version || 0) >= 2 && metadata.master_direction_id === directionId);
}

function mergeVisualRows(args: {
  project: ProjectRow;
  directionId: string;
  masterDirectionStoragePath: string | null;
  prompts: LiveVisualPrompt[];
  group: "plans" | "visuals";
  existing: ExistingVisual[];
  model: string;
  usage: unknown;
  architectureDna: ArchitectureDna;
  canonicalPlan: CanonicalPlanSpec | null;
}) {
  const seen = new Set<string>();
  return args.prompts.map((prompt, index) => {
    let visualType = normaliseVisualType(prompt.visual_type, `${args.group}_${index + 1}`);
    while (seen.has(visualType)) visualType = `${visualType}_${index + 1}`;
    seen.add(visualType);

    const current = args.existing.find((item) => item.visual_type === visualType);
    const currentMetadata = metadataRecord(current?.metadata);
    const sourceLockedProject = args.project.workflow_mode === "plan_to_render";
    const preserveCurrent = Boolean(
      current &&
      continuityIsCurrent(current, args.directionId) &&
      currentMetadata.source_geometry_stale !== true &&
      (!sourceLockedProject || currentMetadata.source_geometry_locked === true),
    );

    return {
      project_id: args.project.id,
      user_id: args.project.user_id,
      direction_id: args.directionId,
      visual_type: visualType,
      title: prompt.title,
      prompt: prompt.prompt,
      image_url: preserveCurrent ? current?.image_url || null : null,
      storage_path: preserveCurrent ? current?.storage_path || null : null,
      is_approved: preserveCurrent ? current?.is_approved || false : false,
      metadata: {
        ...(preserveCurrent ? current?.metadata || {} : {}),
        mode: "live",
        group: args.group,
        prompt_model: args.model,
        prompt_usage: args.usage,
        prompt_prepared_at: new Date().toISOString(),
        visual_continuity_version: 2,
        master_direction_id: args.directionId,
        master_direction_storage_path: args.masterDirectionStoragePath,
        architecture_dna: args.architectureDna,
        canonical_plan: args.canonicalPlan,
        disclaimer: args.group === "plans"
          ? "Canonical conceptual diagram only. Not measured, approved or suitable for construction."
          : "AI-generated conceptual architecture. Not for permit, construction, engineering or regulatory reliance.",
      },
    };
  });
}

async function removeStaleVisualFiles(admin: SupabaseClient, existing: ExistingVisual[], directionId: string, group: "plans" | "visuals") {
  const stalePaths = existing
    .filter((visual) => {
      const metadata = metadataRecord(visual.metadata);
      return metadata.group === group && visual.storage_path && (Number(metadata.visual_continuity_version || 0) < 2 || metadata.master_direction_id !== directionId);
    })
    .map((visual) => visual.storage_path as string);

  if (stalePaths.length) await admin.storage.from("architecture-files").remove(stalePaths);
}

async function removeObsoleteVisualRows(admin: SupabaseClient, existing: ExistingVisual[], group: "plans" | "visuals", nextTypes: string[]) {
  const obsoleteIds = existing
    .filter((visual) => metadataRecord(visual.metadata).group === group && !nextTypes.includes(visual.visual_type))
    .map((visual) => visual.id);
  if (!obsoleteIds.length) return;

  const obsoletePaths = existing
    .filter((visual) => obsoleteIds.includes(visual.id) && visual.storage_path)
    .map((visual) => visual.storage_path as string);

  const { error } = await admin.from("architecture_visuals").delete().in("id", obsoleteIds);
  if (error) throw new Error(error.message);
  if (obsoletePaths.length) await admin.storage.from("architecture-files").remove(obsoletePaths);
}

function dnaFromRecord(value: unknown): ArchitectureDna | null {
  const record = metadataRecord(value);
  const dna = record.architecture_dna;
  return dna && typeof dna === "object" && !Array.isArray(dna) ? (dna as ArchitectureDna) : null;
}

function canonicalPlanFromRecord(value: unknown): CanonicalPlanSpec | null {
  const record = metadataRecord(value);
  const plan = record.canonical_plan;
  return plan && typeof plan === "object" && !Array.isArray(plan) ? (plan as CanonicalPlanSpec) : null;
}

function publicGenerationError(message: string) {
  if (/rate limit|429|too many requests/i.test(message)) {
    return "Architecture generation is temporarily busy. Your credits were returned; please try again shortly.";
  }
  if (/content|safety|policy|moderation/i.test(message)) {
    return "Architecture generation could not complete for this request. Your credits were returned.";
  }
  if (process.env.NEXT_PUBLIC_HEYY_PUBLIC_BETA === "true") {
    return `Plan Foundation failed: ${message.slice(0, 900)} Your credits were returned.`;
  }
  return "Architecture content generation could not be completed. Your credits were returned.";
}
