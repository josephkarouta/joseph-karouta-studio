import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAiMode, resolveAiPlan } from "@/lib/ai/config";
import { assertRateLimit } from "@/lib/ai/rate-limit";
import { CreditError, refundCredits, reserveCredits } from "@/lib/credits/server";
import { processArchitectureDirectionJob } from "@/lib/architecture/architecture-direction-job";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateRequest = {
  projectId?: string;
  directionNumber?: number;
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
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }>) {
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

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let jobId: string | null = null;
  let accepted = false;
  let reservedCredits = 0;
  let creditAdmin: SupabaseClient | null = null;

  try {
    const body = (await request.json()) as GenerateRequest;
    const projectId = body.projectId?.trim();
    const directionNumber = body.directionNumber;

    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId is required." }, { status: 400 });
    }
    if (directionNumber !== undefined && (!Number.isInteger(directionNumber) || directionNumber < 1 || directionNumber > 3)) {
      return NextResponse.json({ success: false, error: "directionNumber must be 1, 2 or 3." }, { status: 400 });
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    assertRateLimit(`architecture-directions:${user.id}`, 6, 60_000);

    const { data: project, error: projectError } = await supabase
      .from("architecture_projects")
      .select("id,workflow_mode")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: projectError?.message || "Architecture project not found." },
        { status: 404 },
      );
    }

    if (project.workflow_mode === "build_from_scratch") {
      const [{ data: planSet }, { data: planVisuals }] = await Promise.all([
        supabase
          .from("architecture_plan_sets")
          .select("generation_json")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("architecture_visuals")
          .select("visual_type,image_url,is_approved,metadata")
          .eq("project_id", projectId)
          .eq("user_id", user.id),
      ]);
      const generationJson = planSet?.generation_json && typeof planSet.generation_json === "object"
        ? planSet.generation_json as Record<string, unknown>
        : {};
      const canonicalPlan = generationJson.canonical_plan && typeof generationJson.canonical_plan === "object"
        ? generationJson.canonical_plan as Record<string, unknown>
        : null;
      const levels = Array.isArray(canonicalPlan?.levels) ? canonicalPlan.levels : [];
      if (!planSet || !levels.length) {
        return NextResponse.json(
          { success: false, error: "Prepare the Plan Foundation before generating Architecture Directions." },
          { status: 400 },
        );
      }
      const rows = (planVisuals || []) as Array<Record<string, unknown>>;
      const foundation = rows.find((item) => String(item.visual_type || "") === "plan_foundation_sheet");
      const foundationMetadata = foundation?.metadata && typeof foundation.metadata === "object" && !Array.isArray(foundation.metadata)
        ? foundation.metadata as Record<string, unknown>
        : {};
      const foundationTechnical = foundationMetadata.technical_assets && typeof foundationMetadata.technical_assets === "object" && !Array.isArray(foundationMetadata.technical_assets)
        ? foundationMetadata.technical_assets as Record<string, unknown>
        : {};
      const foundationReady = Boolean(
        foundation &&
        foundation.is_approved === true &&
        (foundationTechnical.master_storage_path || foundationTechnical.preview_storage_path || foundationTechnical.preview_url || foundation.image_url)
      );
      if (!foundationReady) {
        return NextResponse.json(
          {
            success: false,
            error: "Approve the coordinated Plan Foundation before generating Architecture Directions. The approved Plan Foundation sheet is the geometry source of truth.",
          },
          { status: 400 },
        );
      }
    } else if (project.workflow_mode === "plan_to_render") {
      const { count } = await supabase
        .from("architecture_documents")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .like("category", "source-plan-%");
      if (!Number(count || 0)) {
        return NextResponse.json(
          { success: false, error: "Organize at least one source plan before generating Architecture Directions." },
          { status: 400 },
        );
      }
    }

    const minimumMaterials = project.workflow_mode === "build_from_scratch" ? 3 : 1;
    const { count: selectedMaterialCount, error: materialError } = await supabase
      .from("architecture_materials")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("is_selected", true);

    if (materialError) throw new Error(materialError.message);
    if (Number(selectedMaterialCount || 0) < minimumMaterials) {
      return NextResponse.json(
        {
          success: false,
          error: `Select at least ${minimumMaterials} material${minimumMaterials === 1 ? "" : "s"} before generating directions.`,
        },
        { status: 400 },
      );
    }

    const mode = process.env.NEXT_PUBLIC_MOCK_IMAGES === "true" ? "demo" : getAiMode();
    const planName = resolveAiPlan(user);

    creditAdmin = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    if (mode !== "demo") {
      const reservation = await reserveCredits({
        admin: creditAdmin,
        userId: user.id,
        action: "architectureText",
        metadata: {
          project_id: projectId,
          studio: "architecture_studio",
          tool: "directions",
          direction_number: directionNumber || "all",
        },
      });
      reservationId = reservation.id;
      reservedCredits = reservation.amount;
    }

    const { data: job, error: jobError } = await creditAdmin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        tool: "architecture_direction",
        provider: mode === "demo" ? "demo" : "openai",
        provider_job_id: null,
        credit_reservation_id: reservationId,
        status: "queued",
        input: {
          projectId,
          directionNumber: directionNumber || null,
          planName,
          mode,
          credits: reservedCredits,
        },
        output: {},
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message || "Architecture direction job could not be saved.");
    }
    jobId = String(job.id);

    const origin = new URL(request.url).origin;
    const signature = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
      .update(`architecture-direction:${jobId}`)
      .digest("hex");

    const backgroundResponse = await fetch(`${origin}/.netlify/functions/architecture-direction-background`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Heyy-Job-Signature": signature,
      },
      body: JSON.stringify({ jobId }),
      cache: "no-store",
    }).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      accepted = true;
      await processArchitectureDirectionJob(jobId);
    } else {
      throw new Error(`Architecture direction background generation could not start (${backgroundResponse?.status || "unavailable"}).`);
    }

    return NextResponse.json({
      success: true,
      status: "processing",
      jobId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Architecture Direction generation could not start.";

    if (!accepted && creditAdmin && jobId) {
      const { data: failedQueuedJob, error: cleanupError } = await creditAdmin
        .from("generation_jobs")
        .update({
          status: "failed",
          error: "Architecture Direction generation could not start. Your credits were returned.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (cleanupError) {
        console.error("Architecture direction start cleanup failed:", cleanupError.message);
      } else if (failedQueuedJob && reservationId) {
        await refundCredits(creditAdmin, reservationId, message);
      } else if (!failedQueuedJob) {
        const { data: activeJob } = await creditAdmin
          .from("generation_jobs")
          .select("status")
          .eq("id", jobId)
          .maybeSingle();

        if (activeJob && ["processing", "succeeded"].includes(String(activeJob.status))) {
          return NextResponse.json({
            success: true,
            jobId,
            status: activeJob.status === "succeeded" ? "succeeded" : "processing",
          });
        }
      }
    } else if (!accepted && creditAdmin && reservationId) {
      await refundCredits(creditAdmin, reservationId, message);
    }

    console.error("Architecture direction start error:", error);
    if (error instanceof CreditError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
