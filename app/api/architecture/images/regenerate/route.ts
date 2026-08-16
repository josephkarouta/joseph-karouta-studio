import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiMode, resolveAiPlan, type ImageGenerationTier } from "@/lib/ai/config";
import { assertRateLimit } from "@/lib/ai/rate-limit";
import { CreditError, reserveCredits, refundCredits } from "@/lib/credits/server";
import type { CreditAction } from "@/lib/credits/config";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import {
  architectureFloorGenerationRole,
  buildArchitectureReferenceBundle,
  type ArchitectureFloorGenerationRole,
} from "@/lib/architecture/reference-bundle";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImageTarget = "direction" | "concept" | "visual";

type RegenerateRequest = {
  projectId?: string;
  targetType?: ImageTarget;
  targetId?: string;
  quality?: ImageGenerationTier;
  planMode?: "technical" | "rendered";
  generationIntent?: ArchitectureFloorGenerationRole;
};

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from the server environment.`);
  return value;
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function validateTargetAndResolveAction(args: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  targetType: ImageTarget;
  targetId: string;
  quality: ImageGenerationTier;
  planMode: "technical" | "rendered";
}): Promise<CreditAction> {
  if (args.quality === "final") return "architectureProfessionalFinal";

  if (args.targetType === "direction") {
    const { data, error } = await args.supabase
      .from("architecture_directions")
      .select("id")
      .eq("id", args.targetId)
      .eq("project_id", args.projectId)
      .eq("user_id", args.userId)
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || "Architecture Direction not found.");
    return "architectureDirection";
  }

  if (args.targetType === "concept") {
    const { data, error } = await args.supabase
      .from("architecture_concepts")
      .select("id")
      .eq("id", args.targetId)
      .eq("project_id", args.projectId)
      .eq("user_id", args.userId)
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || "Architecture Concept not found.");
    return "architectureDirection";
  }

  const { data: visual, error } = await args.supabase
    .from("architecture_visuals")
    .select("id,metadata")
    .eq("id", args.targetId)
    .eq("project_id", args.projectId)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (error || !visual) throw new Error(error?.message || "Architecture visual not found.");

  const group = metadataRecord(visual.metadata).group;
  if (group === "plans" && args.planMode === "technical") {
    return "architectureTechnicalPlan";
  }
  return "architectureVisual";
}

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let jobId: string | null = null;
  let accepted = false;
  let admin: SupabaseClient | null = null;

  try {
    const body = (await request.json()) as RegenerateRequest;
    const projectId = body.projectId?.trim();
    const targetId = body.targetId?.trim();
    const targetType = body.targetType;
    const quality: ImageGenerationTier = body.quality === "final" ? "final" : "preview";
    const planMode = body.planMode === "rendered" ? "rendered" : "technical";

    if (!projectId || !targetId || !targetType) {
      return NextResponse.json(
        { success: false, error: "projectId, targetType and targetId are required." },
        { status: 400 },
      );
    }
    if (!["direction", "concept", "visual"].includes(targetType)) {
      return NextResponse.json({ success: false, error: "Invalid image target." }, { status: 400 });
    }

    const { user, admin: authenticatedAdmin, client: supabase } = await requireApiUser(request);

    const { data: project, error: projectError } = await supabase
      .from("architecture_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: projectError?.message || "Architecture project not found." },
        { status: 404 },
      );
    }

    admin = authenticatedAdmin;

    // Reuse queued/processing jobs only for connected technical PLAN visuals.
    // Direction and Concept images must never reconnect to an orphaned image job:
    // those targets existed before the connected-floor workflow and should keep
    // their original start behavior. A failed background bundle must not trap a
    // Direction preview in a stale queued job for 30 minutes.
    if (targetType === "visual" && planMode === "technical") {
      const activeSince = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: activeJobs, error: activeJobError } = await admin
        .from("generation_jobs")
        .select("id,status,input,created_at")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .eq("tool", "architecture_image")
        .in("status", ["queued", "processing"])
        .gte("created_at", activeSince)
        .order("created_at", { ascending: false })
        .limit(20);

      if (activeJobError) {
        console.error("Architecture active-job lookup failed:", activeJobError.message);
      } else {
        const existingActive = (activeJobs || []).find((row) => {
          const input = metadataRecord(row.input);
          return String(input.targetType || "") === targetType
            && String(input.targetId || "") === targetId
            && String(input.quality || "preview") === quality
            && String(input.planMode || "technical") === planMode;
        });
        if (existingActive) {
          const input = metadataRecord(existingActive.input);
          return NextResponse.json({
            success: true,
            jobId: String(existingActive.id),
            status: "processing",
            reusedExistingJob: true,
            creditsReserved: Number(input.credits || 0),
          });
        }
      }
    }

    assertRateLimit(`architecture-image:${user.id}`, 8, 60_000);

    const action = await validateTargetAndResolveAction({
      supabase,
      userId: user.id,
      projectId,
      targetType,
      targetId,
      quality,
      planMode,
    });

    let generationIntent: ArchitectureFloorGenerationRole = "normal";
    if (targetType === "visual" && planMode === "technical") {
      const { data: targetVisual, error: targetVisualError } = await supabase
        .from("architecture_visuals")
        .select("visual_type,metadata")
        .eq("id", targetId)
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (targetVisualError || !targetVisual) {
        throw new Error(targetVisualError?.message || "Architecture visual not found.");
      }
      generationIntent = architectureFloorGenerationRole(String(targetVisual.visual_type || ""));
      if (generationIntent !== "normal") {
        // Validate the connected reference chain before reserving credits. The
        // background worker validates again immediately before provider work.
        await buildArchitectureReferenceBundle({
          admin,
          userId: user.id,
          projectId,
          targetVisualType: String(targetVisual.visual_type || ""),
        });
      }
    }

    const mode = process.env.NEXT_PUBLIC_MOCK_IMAGES === "true" ? "demo" : getAiMode();
    let credits = 0;
    if (mode !== "demo") {
      const reservation = await reserveCredits({
        admin,
        userId: user.id,
        action,
        metadata: {
          project_id: projectId,
          studio: "architecture_studio",
          target: targetType,
          target_id: targetId,
          quality,
          plan_mode: planMode,
          generation_intent: generationIntent,
        },
      });
      reservationId = reservation.id;
      credits = reservation.amount;
    }

    const { data: job, error: jobError } = await admin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        tool: "architecture_image",
        provider: mode === "demo" ? "demo" : "openai",
        provider_job_id: null,
        credit_reservation_id: reservationId,
        status: "queued",
        input: {
          projectId,
          targetType,
          targetId,
          quality,
          planMode,
          generationIntent,
          planName: resolveAiPlan(user),
          credits,
        },
        output: {},
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message || "Architecture generation job could not be saved.");
    }
    jobId = String(job.id);

    const origin = new URL(request.url).origin;
    const signature = createHmac("sha256", requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"))
      .update(`architecture-image:${jobId}`)
      .digest("hex");

    const backgroundResponse = await fetch(
      `${origin}/.netlify/functions/architecture-image-background`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Heyy-Job-Signature": signature,
        },
        body: JSON.stringify({ jobId }),
        cache: "no-store",
      },
    ).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      accepted = true;
      const { processArchitectureImageJob } = await import("@/lib/architecture/architecture-image-job");
      await processArchitectureImageJob(jobId);
    } else {
      throw new Error(
        `Architecture background generation could not start (${backgroundResponse?.status || "unavailable"}).`,
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      status: "processing",
      creditsReserved: credits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Architecture image generation could not start.";

    if (!accepted && admin && jobId) {
      const { data: failedQueuedJob, error: failError } = await admin
        .from("generation_jobs")
        .update({
          status: "failed",
          error: "Architecture image generation could not start. Your credits were returned.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (failError) {
        console.error("Architecture generation start cleanup failed:", failError.message);
      } else if (failedQueuedJob && reservationId) {
        await refundCredits(admin, reservationId, message);
      }
    } else if (!accepted && admin && reservationId) {
      await refundCredits(admin, reservationId, message);
    }

    console.error("Architecture image start error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof CreditError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
