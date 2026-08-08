import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  generateArchitectureConcept,
  generateArchitectureDna,
  generateArchitecturePlanSet,
  generateArchitectureVisualPrompts,
  type ArchitectureDna,
  type CanonicalPlanSpec,
  type LiveVisualPrompt,
} from "@/lib/ai/architecture";
import { getAiMode, getAiPlanConfig, resolveAiPlan } from "@/lib/ai/config";
import { assertRateLimit } from "@/lib/ai/rate-limit";
import { CreditError, commitCredits, refundCredits, reserveCredits } from "@/lib/credits/server";

export const runtime = "nodejs";

type ArchitectureStage = "concept" | "plans" | "visuals" | "design-pack" | "all";

type StageRequest = {
  projectId?: string;
  stage?: ArchitectureStage;
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
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Cookie writes are optional after the response is committed.
          }
        },
      },
    },
  );
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normaliseVisualType(value: string, fallback: string) {
  const normalised = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalised || fallback;
}

function continuityIsCurrent(
  current: ExistingVisual | undefined,
  directionId: string,
) {
  const metadata = metadataRecord(current?.metadata);
  return Boolean(
    current?.direction_id === directionId &&
    Number(metadata.visual_continuity_version || 0) >= 2 &&
    metadata.master_direction_id === directionId,
  );
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
      (!sourceLockedProject || currentMetadata.source_geometry_locked === true)
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
        disclaimer:
          args.group === "plans"
            ? "Canonical conceptual diagram only. Not measured, approved or suitable for construction."
            : "AI-generated conceptual architecture. Not for permit, construction, engineering or regulatory reliance.",
      },
    };
  });
}

async function removeStaleVisualFiles(
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>,
  existing: ExistingVisual[],
  directionId: string,
  group: "plans" | "visuals",
) {
  const stalePaths = existing
    .filter((visual) => {
      const metadata = metadataRecord(visual.metadata);
      return metadata.group === group &&
        visual.storage_path &&
        (
          Number(metadata.visual_continuity_version || 0) < 2 ||
          metadata.master_direction_id !== directionId
        );
    })
    .map((visual) => visual.storage_path as string);

  if (stalePaths.length) {
    await supabase.storage.from("architecture-files").remove(stalePaths);
  }
}

async function removeObsoleteVisualRows(
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>,
  existing: ExistingVisual[],
  group: "plans" | "visuals",
  nextTypes: string[],
) {
  const obsoleteIds = existing
    .filter((visual) => metadataRecord(visual.metadata).group === group && !nextTypes.includes(visual.visual_type))
    .map((visual) => visual.id);
  if (!obsoleteIds.length) return;

  const obsoletePaths = existing
    .filter((visual) => obsoleteIds.includes(visual.id) && visual.storage_path)
    .map((visual) => visual.storage_path as string);

  const { error } = await supabase.from("architecture_visuals").delete().in("id", obsoleteIds);
  if (error) throw new Error(error.message);
  if (obsoletePaths.length) await supabase.storage.from("architecture-files").remove(obsoletePaths);
}

async function loadResponseState(
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>,
  projectId: string,
  userId: string,
) {
  const [project, concept, planSet, visuals, designPack] = await Promise.all([
    supabase.from("architecture_projects").select("*").eq("id", projectId).eq("user_id", userId).single(),
    supabase.from("architecture_concepts").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    supabase.from("architecture_plan_sets").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    supabase.from("architecture_visuals").select("*").eq("project_id", projectId).eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("architecture_design_packs").select("*").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
  ]);

  return {
    project: project.data || null,
    concept: concept.data || null,
    planSet: planSet.data || null,
    visuals: visuals.data || [],
    designPack: designPack.data || null,
  };
}

function dnaFromRecord(value: unknown): ArchitectureDna | null {
  const record = metadataRecord(value);
  const dna = record.architecture_dna;
  return dna && typeof dna === "object" && !Array.isArray(dna)
    ? (dna as ArchitectureDna)
    : null;
}

function canonicalPlanFromRecord(value: unknown): CanonicalPlanSpec | null {
  const record = metadataRecord(value);
  const plan = record.canonical_plan;
  return plan && typeof plan === "object" && !Array.isArray(plan)
    ? (plan as CanonicalPlanSpec)
    : null;
}

export async function POST(request: Request) {
  let creditReservationId: string | null = null;
  let creditAdmin: SupabaseClient | null = null;
  try {
    const body = (await request.json()) as StageRequest;
    const projectId = body.projectId?.trim();
    const stage = body.stage || "all";
    const validStages: ArchitectureStage[] = ["concept", "plans", "visuals", "design-pack", "all"];

    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId is required." }, { status: 400 });
    }
    if (!validStages.includes(stage)) {
      return NextResponse.json({ success: false, error: "Invalid Architecture generation stage." }, { status: 400 });
    }
    if (getAiMode() !== "live") {
      return NextResponse.json(
        { success: false, error: "Live Architecture generation is disabled. Set AI_MODE=live or use the demo route." },
        { status: 409 },
      );
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    assertRateLimit(`architecture-stages:${user.id}`, 8, 60_000);

    const [
      projectResult,
      directionResult,
      siteResult,
      planningResult,
      materialsResult,
      programResult,
      currentConceptResult,
      currentPlanResult,
      currentVisualsResult,
    ] = await Promise.all([
      supabase.from("architecture_projects").select("*").eq("id", projectId).eq("user_id", user.id).single(),
      supabase.from("architecture_directions").select("*").eq("project_id", projectId).eq("user_id", user.id).eq("is_selected", true).maybeSingle(),
      supabase.from("architecture_sites").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_planning").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_materials").select("*").eq("project_id", projectId).eq("user_id", user.id).eq("is_selected", true).order("sort_order", { ascending: true }),
      supabase.from("architecture_space_programs").select("*").eq("project_id", projectId).eq("user_id", user.id).order("sort_order", { ascending: true }),
      supabase.from("architecture_concepts").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_plan_sets").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_visuals").select("id,direction_id,visual_type,image_url,storage_path,is_approved,metadata").eq("project_id", projectId).eq("user_id", user.id),
    ]);

    if (projectResult.error || !projectResult.data) {
      return NextResponse.json(
        { success: false, error: projectResult.error?.message || "Architecture project not found." },
        { status: 404 },
      );
    }

    const project = projectResult.data as ProjectRow;
    if (!project.selected_direction_id || !directionResult.data) {
      return NextResponse.json(
        { success: false, error: "Select an Architecture Direction before continuing." },
        { status: 400 },
      );
    }

    const direction = directionResult.data as Record<string, unknown>;
    const site = (siteResult.data as Record<string, unknown> | null) || null;
    const planning = (planningResult.data as Record<string, unknown> | null) || null;
    const selectedMaterials = (materialsResult.data as Array<Record<string, unknown>> | null) || [];
    const spaceProgram = (programResult.data as Array<Record<string, unknown>> | null) || [];
    const aiPlanName = resolveAiPlan(user);
    const aiPlan = getAiPlanConfig(aiPlanName);
    creditAdmin = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const reservation = await reserveCredits({
      admin: creditAdmin,
      userId: user.id,
      action: "architectureText",
      metadata: { project_id: projectId, studio: "architecture_studio", tool: "stage_generation", stage },
    });
    creditReservationId = reservation.id;
    const existingVisuals = (currentVisualsResult.data as ExistingVisual[] | null) || [];
    let currentConcept = (currentConceptResult.data as Record<string, unknown> | null) || null;
    let currentPlan = (currentPlanResult.data as Record<string, unknown> | null) || null;
    let nextCompletion = Number(project.completion || 0);
    let nextStatus = project.status;

    const existingDna =
      dnaFromRecord(currentConcept?.generation_json) ||
      dnaFromRecord(currentPlan?.generation_json);

    const dnaResult = existingDna
      ? { architectureDna: existingDna, usage: null }
      : await generateArchitectureDna({
          plan: aiPlan,
          project: project as unknown as Record<string, unknown>,
          direction,
          site,
          selectedMaterials,
        });
    const architectureDna = dnaResult.architectureDna;
    const masterDirectionStoragePath =
      typeof direction.image_storage_path === "string" ? direction.image_storage_path : null;

    if (stage === "concept" || stage === "all") {
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
      const { data, error } = await supabase
        .from("architecture_concepts")
        .upsert(
          {
            project_id: project.id,
            user_id: project.user_id,
            direction_id: project.selected_direction_id,
            ...conceptFields,
            image_url: (currentConcept?.image_url as string | null) || null,
            generation_mode: "live",
            generation_json: {
              ...previousJson,
              mode: "live",
              image_prompt,
              text_model: aiPlan.textModel,
              usage: generated.usage,
              architecture_dna: architectureDna,
              architecture_dna_usage: dnaResult.usage,
              visual_continuity_version: 2,
              master_direction_id: project.selected_direction_id,
              master_direction_storage_path: masterDirectionStoragePath,
              selected_materials: selectedMaterials,
              space_program: spaceProgram,
              prepared_at: new Date().toISOString(),
              disclaimer: "AI-generated conceptual architecture. Not for permit, construction, engineering or regulatory reliance.",
            },
          },
          { onConflict: "project_id" },
        )
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message || "Architecture Concept could not be saved.");
      currentConcept = data as Record<string, unknown>;
      nextCompletion = Math.max(nextCompletion, 75);
      nextStatus = "Concept Ready";
    }

    if (stage === "plans" || stage === "all") {
      const generated = await generateArchitecturePlanSet({
        plan: aiPlan,
        project: project as unknown as Record<string, unknown>,
        direction,
        architectureDna,
        concept: currentConcept,
        site,
        planning,
        selectedMaterials,
        spaceProgram,
      });
      const { plan_images, canonical_plan, ...planFields } = generated.planSet;
      const { data: savedPlan, error: planError } = await supabase
        .from("architecture_plan_sets")
        .upsert(
          {
            project_id: project.id,
            user_id: project.user_id,
            direction_id: project.selected_direction_id,
            ...planFields,
            generation_mode: "live",
            generation_json: {
              mode: "live",
              text_model: aiPlan.textModel,
              usage: generated.usage,
              architecture_dna: architectureDna,
              canonical_plan,
              visual_continuity_version: 2,
              master_direction_id: project.selected_direction_id,
              master_direction_storage_path: masterDirectionStoragePath,
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

      await removeStaleVisualFiles(supabase, existingVisuals, project.selected_direction_id, "plans");
      const planRows = mergeVisualRows({
        project,
        directionId: project.selected_direction_id,
        masterDirectionStoragePath,
        prompts: plan_images,
        group: "plans",
        existing: existingVisuals,
        model: aiPlan.textModel,
        usage: generated.usage,
        architectureDna,
        canonicalPlan: canonical_plan,
      });
      await removeObsoleteVisualRows(
        supabase,
        existingVisuals,
        "plans",
        planRows.map((row) => row.visual_type),
      );
      if (planRows.length) {
        const { error } = await supabase
          .from("architecture_visuals")
          .upsert(planRows, { onConflict: "direction_id,visual_type" });
        if (error) throw new Error(error.message);
      }
      nextCompletion = Math.max(nextCompletion, 83);
      nextStatus = "Plans Ready";
    }

    if (stage === "visuals" || stage === "all") {
      const requestedViews = Array.isArray(project.source_brief?.camera_views)
        ? (project.source_brief?.camera_views as string[])
        : [];
      const canonicalPlan =
        canonicalPlanFromRecord(currentPlan?.generation_json) ||
        canonicalPlanFromRecord(currentPlanResult.data?.generation_json);

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

      await removeStaleVisualFiles(supabase, existingVisuals, project.selected_direction_id, "visuals");
      const visualRows = mergeVisualRows({
        project,
        directionId: project.selected_direction_id,
        masterDirectionStoragePath,
        prompts: generated.visuals,
        group: "visuals",
        existing: existingVisuals,
        model: aiPlan.textModel,
        usage: generated.usage,
        architectureDna,
        canonicalPlan,
      });
      await removeObsoleteVisualRows(
        supabase,
        existingVisuals,
        "visuals",
        visualRows.map((row) => row.visual_type),
      );
      if (visualRows.length) {
        const { error } = await supabase
          .from("architecture_visuals")
          .upsert(visualRows, { onConflict: "direction_id,visual_type" });
        if (error) throw new Error(error.message);
      }
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
      const nextVersion = stage === "design-pack" && currentPack?.version
        ? Number(currentPack.version) + 1
        : Number(currentPack?.version || 1);

      const { error } = await supabase
        .from("architecture_design_packs")
        .upsert(
          {
            project_id: project.id,
            user_id: project.user_id,
            direction_id: project.selected_direction_id,
            title: `${project.project_name} Architecture Design Pack`,
            version: nextVersion,
            status: "Ready",
            included_sections: [
              "Project Brief",
              ...(project.workflow_mode === "build_from_scratch" ? [] : ["Source Input"]),
              "Land & Site",
              "Planning Summary",
              "Space Program",
              "Material System",
              "Selected Direction",
              "Architecture DNA",
              "Architecture Strategy",
              "Canonical Concept Plans",
              "Area Schedule",
              "Architectural Visuals",
              "Planning Disclaimer",
            ],
            generated_at: new Date().toISOString(),
            metadata: {
              mode: "live",
              text_model: aiPlan.textModel,
              architecture_dna: architectureDna,
              canonical_plan: canonicalPlanFromRecord(currentPlan?.generation_json),
              visual_continuity_version: 2,
              master_direction_id: project.selected_direction_id,
              master_direction_storage_path: masterDirectionStoragePath,
              selected_materials: selectedMaterials,
              space_program: spaceProgram,
              prepared_at: new Date().toISOString(),
            },
          },
          { onConflict: "project_id" },
        );
      if (error) throw new Error(error.message);
      nextCompletion = Math.max(nextCompletion, 100);
      nextStatus = "Design Pack Ready";
    }

    const { error: projectError } = await supabase
      .from("architecture_projects")
      .update({ completion: nextCompletion, status: nextStatus })
      .eq("id", projectId)
      .eq("user_id", user.id);
    if (projectError) throw new Error(projectError.message);

    const state = await loadResponseState(supabase, projectId, user.id);
    if (creditReservationId && creditAdmin) {
      await commitCredits(creditAdmin, creditReservationId, { project_id: projectId, stage });
      creditReservationId = null;
    }
    return NextResponse.json({
      success: true,
      mode: "live",
      plan: aiPlanName,
      visualContinuityVersion: 2,
      ...state,
    });
  } catch (error) {
    if (creditReservationId && creditAdmin) await refundCredits(creditAdmin, creditReservationId, error instanceof Error ? error.message : "Architecture content generation failed");
    if (error instanceof CreditError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Architecture content could not be prepared." },
      { status: 500 },
    );
  }
}
