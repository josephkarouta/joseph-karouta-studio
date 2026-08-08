import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  generateArchitectureDna,
  generateArchitecturePlanSet,
  type ArchitectureDna,
  type CanonicalPlanSpec,
  type LivePlanSet,
} from "@/lib/ai/architecture";
import { getAiMode, getAiPlanConfig, resolveAiPlan } from "@/lib/ai/config";
import { assertRateLimit } from "@/lib/ai/rate-limit";
import { CreditError, commitCredits, refundCredits, reserveCredits } from "@/lib/credits/server";

export const runtime = "nodejs";

type TweakScope = "local_area" | "current_floor" | "all_connected";
type RequestBody = {
  projectId?: string;
  action?: "tweak" | "revert";
  instruction?: string;
  scope?: TweakScope;
};

type HistoryEntry = {
  version: number;
  saved_at: string;
  instruction: string;
  scope: TweakScope;
  affected: string[];
  snapshot: {
    title: string;
    planning_assumptions: unknown[];
    area_schedule: unknown[];
    room_relationships: unknown[];
    conceptual_dimensions: unknown[];
    total_estimated_area: number | null;
    canonical_plan: CanonicalPlanSpec;
  };
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
            // Cookie writes can be unavailable after a response is committed.
          }
        },
      },
    },
  );
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function architectureDnaFrom(value: unknown): ArchitectureDna | null {
  const record = recordValue(value);
  const dna = record.architecture_dna;
  return dna && typeof dna === "object" && !Array.isArray(dna)
    ? dna as ArchitectureDna
    : null;
}

function canonicalPlanFrom(value: unknown): CanonicalPlanSpec | null {
  const record = recordValue(value);
  const plan = record.canonical_plan;
  return plan && typeof plan === "object" && !Array.isArray(plan)
    ? plan as CanonicalPlanSpec
    : null;
}

function historyFrom(value: unknown): HistoryEntry[] {
  return arrayValue(recordValue(value).plan_version_history)
    .filter((item): item is HistoryEntry => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .slice(-10);
}

function affectedPlanTypes(scope: TweakScope, instruction: string) {
  const text = instruction.toLowerCase();
  const structural = /stair|core|column|structure|load|wall|footprint|void|shaft|roof|facade|façade|entry|garage|pool|setback|wet area|bath|kitchen/.test(text);
  const upperMentioned = /upper|first floor|second floor|level 1|level 2|upstairs/.test(text);
  const groundMentioned = /ground|lower|entry level|downstairs/.test(text);

  if (scope === "all_connected" || structural) {
    return [
      "functional_zoning", "ground_floor", "upper_floor", "site_plan", "circulation",
      "north_elevation", "south_elevation", "east_elevation", "west_elevation",
      "section_longitudinal", "section_transverse", "perspective_front", "perspective_rear", "perspective_aerial",
    ];
  }

  const floor = upperMentioned && !groundMentioned ? "upper_floor" : "ground_floor";
  return scope === "current_floor"
    ? [floor, "functional_zoning", "circulation", "section_longitudinal", "section_transverse"]
    : [floor, "functional_zoning", "circulation"];
}

function clearGeneratedAssets(metadataInput: unknown, planVersion: number, instruction: string) {
  const metadata = { ...recordValue(metadataInput) };
  delete metadata.technical_assets;
  delete metadata.rendered_preview_assets;
  delete metadata.rendered_final_assets;
  delete metadata.active_plan_view;
  return {
    ...metadata,
    needs_regeneration: true,
    plan_version: planVersion,
    last_tweak_instruction: instruction,
    invalidated_at: new Date().toISOString(),
  };
}

async function markAffectedOutputs(args: {
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>;
  projectId: string;
  userId: string;
  affected: string[];
  planVersion: number;
  instruction: string;
}) {
  const { data: visualRows, error } = await args.supabase
    .from("architecture_visuals")
    .select("*")
    .eq("project_id", args.projectId)
    .eq("user_id", args.userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  for (const visual of visualRows || []) {
    const metadata = recordValue(visual.metadata);
    const group = String(metadata.group || "");
    if (group === "plans" && args.affected.includes(String(visual.visual_type))) {
      const { error: updateError } = await args.supabase
        .from("architecture_visuals")
        .update({
          image_url: null,
          storage_path: null,
          is_approved: false,
          metadata: clearGeneratedAssets(metadata, args.planVersion, args.instruction),
        })
        .eq("id", visual.id)
        .eq("user_id", args.userId);
      if (updateError) throw new Error(updateError.message);
    } else if (group === "visuals") {
      const { error: updateError } = await args.supabase
        .from("architecture_visuals")
        .update({
          is_approved: false,
          metadata: {
            ...metadata,
            needs_review: true,
            connected_plan_version: args.planVersion,
            review_reason: args.instruction,
          },
        })
        .eq("id", visual.id)
        .eq("user_id", args.userId);
      if (updateError) throw new Error(updateError.message);
    }
  }

  const { data: refreshed, error: refreshError } = await args.supabase
    .from("architecture_visuals")
    .select("*")
    .eq("project_id", args.projectId)
    .eq("user_id", args.userId)
    .order("created_at", { ascending: true });
  if (refreshError) throw new Error(refreshError.message);
  return refreshed || [];
}

export async function POST(request: Request) {
  let creditReservationId: string | null = null;
  let creditAdmin: SupabaseClient | null = null;

  try {
    const body = await request.json() as RequestBody;
    const projectId = body.projectId?.trim();
    const action = body.action || "tweak";
    const instruction = body.instruction?.trim() || "";
    const scope: TweakScope = body.scope === "local_area" || body.scope === "current_floor"
      ? body.scope
      : "all_connected";

    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId is required." }, { status: 400 });
    }
    if (action === "tweak" && !instruction) {
      return NextResponse.json({ success: false, error: "Describe the Small Tweak before applying it." }, { status: 400 });
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const [projectResult, directionResult, siteResult, planningResult, materialsResult, programResult, conceptResult, planResult] = await Promise.all([
      supabase.from("architecture_projects").select("*").eq("id", projectId).eq("user_id", user.id).single(),
      supabase.from("architecture_directions").select("*").eq("project_id", projectId).eq("user_id", user.id).eq("is_selected", true).maybeSingle(),
      supabase.from("architecture_sites").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_planning").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_materials").select("*").eq("project_id", projectId).eq("user_id", user.id).eq("is_selected", true),
      supabase.from("architecture_space_programs").select("*").eq("project_id", projectId).eq("user_id", user.id).order("sort_order", { ascending: true }),
      supabase.from("architecture_concepts").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("architecture_plan_sets").select("*").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
    ]);

    if (projectResult.error || !projectResult.data) throw new Error(projectResult.error?.message || "Architecture project not found.");
    if (!directionResult.data) throw new Error("Select an Architecture Direction first.");
    if (!planResult.data) throw new Error("Generate the connected technical plan before applying a Small Tweak.");

    const currentPlan = planResult.data;
    const currentJson = recordValue(currentPlan.generation_json);
    const currentCanonicalPlan = canonicalPlanFrom(currentJson);
    if (!currentCanonicalPlan) throw new Error("The connected Canonical Plan Specification is missing.");
    const currentVersion = Math.max(1, Number(currentJson.plan_version || 1));
    const history = historyFrom(currentJson);

    if (action === "revert") {
      const previous = history[history.length - 1];
      if (!previous) {
        return NextResponse.json({ success: false, error: "There is no earlier Small Tweak version to restore." }, { status: 409 });
      }
      const nextVersion = currentVersion + 1;
      const remainingHistory = history.slice(0, -1);
      const { data: restored, error: restoreError } = await supabase
        .from("architecture_plan_sets")
        .update({
          title: previous.snapshot.title,
          planning_assumptions: previous.snapshot.planning_assumptions,
          area_schedule: previous.snapshot.area_schedule,
          room_relationships: previous.snapshot.room_relationships,
          conceptual_dimensions: previous.snapshot.conceptual_dimensions,
          total_estimated_area: previous.snapshot.total_estimated_area,
          generation_json: {
            ...currentJson,
            canonical_plan: previous.snapshot.canonical_plan,
            plan_version: nextVersion,
            plan_version_history: remainingHistory,
            estimate: null,
            last_tweak: {
              action: "revert",
              restored_version: previous.version,
              reverted_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", currentPlan.id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (restoreError || !restored) throw new Error(restoreError?.message || "The previous plan version could not be restored.");
      const visuals = await markAffectedOutputs({
        supabase,
        projectId,
        userId: user.id,
        affected: previous.affected,
        planVersion: nextVersion,
        instruction: `Reverted: ${previous.instruction}`,
      });
      return NextResponse.json({ success: true, planSet: restored, visuals, affected: previous.affected, reverted: true });
    }

    if (getAiMode() !== "live") {
      return NextResponse.json(
        { success: false, error: "Small Tweak requires live Architecture AI. Set AI_MODE=live before applying connected plan changes." },
        { status: 409 },
      );
    }

    assertRateLimit(`architecture-plan-tweak:${user.id}`, 6, 60_000);
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
      metadata: { project_id: projectId, studio: "architecture_studio", tool: "small_tweak", scope },
    });
    creditReservationId = reservation.id;

    const project = projectResult.data as Record<string, unknown>;
    const direction = directionResult.data as Record<string, unknown>;
    const site = siteResult.data as Record<string, unknown> | null;
    const planning = planningResult.data as Record<string, unknown> | null;
    const materials = materialsResult.data as Array<Record<string, unknown>> || [];
    const spaceProgram = programResult.data as Array<Record<string, unknown>> || [];
    const concept = conceptResult.data as Record<string, unknown> | null;
    const existingDna = architectureDnaFrom(currentJson) || architectureDnaFrom(recordValue(concept?.generation_json));
    const dnaResult = existingDna
      ? { architectureDna: existingDna, usage: null }
      : await generateArchitectureDna({ plan: aiPlan, project, direction, site, selectedMaterials: materials });

    const existingPlan: LivePlanSet = {
      title: String(currentPlan.title || "Connected Architecture Plan"),
      planning_assumptions: arrayValue(currentPlan.planning_assumptions) as string[],
      area_schedule: arrayValue(currentPlan.area_schedule) as LivePlanSet["area_schedule"],
      room_relationships: arrayValue(currentPlan.room_relationships) as LivePlanSet["room_relationships"],
      conceptual_dimensions: arrayValue(currentPlan.conceptual_dimensions) as LivePlanSet["conceptual_dimensions"],
      total_estimated_area: Number(currentPlan.total_estimated_area || 0),
      canonical_plan: currentCanonicalPlan,
      plan_images: [],
    };

    const generated = await generateArchitecturePlanSet({
      plan: aiPlan,
      project,
      direction,
      architectureDna: dnaResult.architectureDna,
      concept,
      site,
      planning,
      selectedMaterials: materials,
      spaceProgram,
      existingPlan,
      adjustmentInstruction: instruction,
      adjustmentScope: scope,
    });

    const { plan_images: _planImages, canonical_plan, ...planFields } = generated.planSet;
    const affected = affectedPlanTypes(scope, instruction);
    const nextVersion = currentVersion + 1;
    const nextHistory: HistoryEntry[] = [
      ...history,
      {
        version: currentVersion,
        saved_at: new Date().toISOString(),
        instruction,
        scope,
        affected,
        snapshot: {
          title: String(currentPlan.title || "Connected Architecture Plan"),
          planning_assumptions: arrayValue(currentPlan.planning_assumptions),
          area_schedule: arrayValue(currentPlan.area_schedule),
          room_relationships: arrayValue(currentPlan.room_relationships),
          conceptual_dimensions: arrayValue(currentPlan.conceptual_dimensions),
          total_estimated_area: currentPlan.total_estimated_area === null ? null : Number(currentPlan.total_estimated_area || 0),
          canonical_plan: currentCanonicalPlan,
        },
      },
    ].slice(-10);

    const { data: savedPlan, error: saveError } = await supabase
      .from("architecture_plan_sets")
      .update({
        ...planFields,
        generation_json: {
          ...currentJson,
          mode: "live",
          text_model: aiPlan.textModel,
          usage: generated.usage,
          architecture_dna: dnaResult.architectureDna,
          canonical_plan,
          selected_materials: materials,
          saved_space_program: spaceProgram,
          plan_version: nextVersion,
          plan_version_history: nextHistory,
          estimate: null,
          last_tweak: {
            instruction,
            scope,
            affected,
            applied_at: new Date().toISOString(),
          },
          prepared_at: new Date().toISOString(),
        },
      })
      .eq("id", currentPlan.id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (saveError || !savedPlan) throw new Error(saveError?.message || "The connected plan could not be updated.");

    const visuals = await markAffectedOutputs({
      supabase,
      projectId,
      userId: user.id,
      affected,
      planVersion: nextVersion,
      instruction,
    });

    if (creditReservationId && creditAdmin) {
      await commitCredits(creditAdmin, creditReservationId, { project_id: projectId, scope, plan_version: nextVersion });
      creditReservationId = null;
    }

    return NextResponse.json({
      success: true,
      planSet: savedPlan,
      visuals,
      affected,
      planVersion: nextVersion,
    });
  } catch (error) {
    if (creditReservationId && creditAdmin) {
      await refundCredits(creditAdmin, creditReservationId, error instanceof Error ? error.message : "Architecture plan tweak failed");
    }
    if (error instanceof CreditError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "The plan tweak could not be applied." },
      { status: 500 },
    );
  }
}
