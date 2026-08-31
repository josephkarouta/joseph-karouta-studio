import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError } from "@/lib/credits/server";
import type { CreditAction } from "@/lib/credits/config";
import { processStudioImageJob } from "@/lib/studio/studio-image-async-job";
import {
  cleanupGenerationStart,
  isActiveGenerationStatus,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type InteriorImageType =
  | "space_plan"
  | "furniture_plan"
  | "lighting_plan"
  | "main_space"
  | "alternate_angle"
  | "focal_point"
  | "material_detail"
  | "day_view"
  | "evening_view";
type GenerationStage = "final";

const PLAN_VIEWS = new Set<InteriorImageType>(["space_plan", "furniture_plan", "lighting_plan"]);
const VISUAL_VIEWS = new Set<InteriorImageType>([
  "main_space",
  "alternate_angle",
  "focal_point",
  "material_detail",
  "day_view",
  "evening_view",
]);

function sign(jobId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Server generation signing is not configured.");
  return createHmac("sha256", secret).update(`studio-image:${jobId}`).digest("hex");
}

export async function POST(request: Request) {
  let startedJob: GenerationJobStart | null = null;
  let accepted = false;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const viewType = String(body?.viewType || "") as InteriorImageType;
    const stage: GenerationStage = "final";
    const tweak = String(body?.tweak || "").trim().slice(0, 1000);
    const roomKey = String(body?.roomKey || "").trim().slice(0, 240) || null;
    const roomName = String(body?.roomName || "").trim().slice(0, 240) || null;
    const floorLabel = String(body?.floorLabel || "").trim().slice(0, 160) || null;
    const roomNotes = String(body?.roomNotes || "").trim().slice(0, 1200) || null;
    const sourcePlanAssetId = String(body?.sourcePlanAssetId || "").trim() || null;

    if (!projectId) return NextResponse.json({ error: "Project is required." }, { status: 400 });
    if (!(PLAN_VIEWS.has(viewType) || VISUAL_VIEWS.has(viewType))) {
      return NextResponse.json({ error: "Choose a valid Interior plan or visual." }, { status: 400 });
    }

    const { data: project, error: projectError } = await admin
      .from("studio_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "interior_studio")
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Interior project not found." }, { status: 404 });
    }

    const action: CreditAction = PLAN_VIEWS.has(viewType) ? "interiorPlan" : "interiorProfessionalFinal";
    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: "interior-image",
      dedupe: { projectId, viewType, stage, tweak: tweak || null, roomKey, sourcePlanAssetId },
      action,
      projectId,
      tool: "studio_image",
      provider: "openai",
      input: {
        studio: "interior",
        projectId,
        viewType,
        stage,
        tweak: tweak || null,
        roomKey,
        roomName,
        floorLabel,
        roomNotes,
        sourcePlanAssetId,
      },
      metadata: {
        studio: "interior_studio",
        project_id: projectId,
        visual_type: viewType,
        output_kind: PLAN_VIEWS.has(viewType) ? "plan" : "visual",
        stage,
        room_key: roomKey,
        source_plan_asset_id: sourcePlanAssetId,
        async_generation: true,
      },
    });

    if (!startedJob.created) {
      return NextResponse.json({
        success: true,
        jobId: startedJob.jobId,
        status: ["queued", "processing", "finalizing"].includes(startedJob.status) ? "processing" : startedJob.status,
        creditsReserved: startedJob.creditsReserved,
      });
    }

    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/.netlify/functions/studio-image-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Heyy-Job-Signature": sign(startedJob.jobId) },
      body: JSON.stringify({ jobId: startedJob.jobId }),
      cache: "no-store",
    }).catch(() => null);

    if (response?.status === 202 || response?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      accepted = true;
      await processStudioImageJob(startedJob.jobId);
    } else {
      throw new Error(`Interior background generation could not start (${response?.status || "unavailable"}).`);
    }

    return NextResponse.json({
      success: true,
      status: "processing",
      jobId: startedJob.jobId,
      creditsReserved: startedJob.creditsReserved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interior image generation could not start.";
    if (!accepted && admin && startedJob) {
      const status = await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Interior image generation could not start. Your credits were returned.",
      });
      if (!startedJob.created || isActiveGenerationStatus(status) || status === "succeeded") {
        return NextResponse.json({
          success: true,
          jobId: startedJob.jobId,
          status: ["queued", "processing", "finalizing"].includes(status) ? "processing" : status,
          creditsReserved: startedJob.creditsReserved,
        });
      }
    }

    console.error("Interior image async start error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Interior image generation could not start." }, { status: 500 });
  }
}
