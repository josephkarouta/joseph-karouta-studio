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

type PlanType = "space_plan" | "furniture_plan" | "lighting_plan";
type VisualType = "main_space" | "alternate_angle" | "focal_point" | "material_detail" | "day_view" | "evening_view";
type ImageType = PlanType | VisualType;
type GenerationStage = "technical" | "preview" | "final";

const PLANS = new Set<ImageType>(["space_plan", "furniture_plan", "lighting_plan"]);
const VISUALS = new Set<ImageType>(["main_space", "alternate_angle", "focal_point", "material_detail", "day_view", "evening_view"]);
const SOURCE_PLAN_TYPES = new Set(["interior_source_plan_preview", "interior_source_document"]);

function sign(jobId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  return createHmac("sha256", secret).update(`studio-image:${jobId}`).digest("hex");
}

async function hasApprovedInteriorAsset(admin: any, projectId: string, viewType: "space_plan" | "main_space") {
  const { data } = await admin.from("project_assets").select("asset_type,metadata").eq("project_id", projectId).eq("studio", "interior_studio").order("created_at", { ascending: false }).limit(100);
  return (data || []).some((asset: any) => {
    const type = String(asset.asset_type || "");
    const meta = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
    const view = String(meta.view_type || "");
    const approved = meta.approved === true || meta.approved === "true";
    if (!approved) return false;
    if (view === viewType && !meta.room_key) return true;
    if (viewType === "space_plan") return type.includes("interior_plan_space_plan");
    return type.includes("interior_visual_main_space") && !meta.room_key;
  });
}

async function hasApprovedRoomMain(admin: any, projectId: string, roomKey: string) {
  const { data } = await admin
    .from("project_assets")
    .select("asset_type,metadata")
    .eq("project_id", projectId)
    .eq("studio", "interior_studio")
    .like("asset_type", "interior_visual_main_space_%")
    .order("created_at", { ascending: false })
    .limit(80);
  return (data || []).some((asset: any) => {
    const meta = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
    return String(meta.room_key || "") === roomKey && (meta.approved === true || meta.approved === "true");
  });
}

export async function POST(request: Request) {
  let jobId: string | null = null;
  let startedJob: GenerationJobStart | null = null;
  let accepted = false;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const imageType = String(body?.viewType || "") as ImageType;
    const stage = String(body?.stage || "preview") as GenerationStage;
    const roomKey = String(body?.roomKey || "").trim().slice(0, 240);
    const roomName = String(body?.roomName || "").trim().slice(0, 160);
    const floorLabel = String(body?.floorLabel || "").trim().slice(0, 160);
    const roomNotes = String(body?.roomNotes || "").trim().slice(0, 500);
    const sourcePlanAssetId = String(body?.sourcePlanAssetId || "").trim();
    const isPlan = PLANS.has(imageType);
    const isVisual = VISUALS.has(imageType);

    if (!projectId) return NextResponse.json({ error: "Project is required." }, { status: 400 });
    if (!isPlan && !isVisual) return NextResponse.json({ error: "Choose a valid interior plan or visual." }, { status: 400 });
    if (!( ["technical", "preview", "final"] as string[]).includes(stage)) return NextResponse.json({ error: "Choose a valid generation stage." }, { status: 400 });
    if (isVisual && stage === "technical") return NextResponse.json({ error: "Interior visuals begin with a preview, then a professional final." }, { status: 400 });

    const { data: project, error: projectError } = await admin.from("studio_projects").select("id,input").eq("id", projectId).eq("user_id", auth.user.id).eq("studio", "interior_studio").single();
    if (projectError || !project) return NextResponse.json({ error: projectError?.message || "Interior project not found." }, { status: 404 });

    const projectInput = project.input && typeof project.input === "object" ? project.input as Record<string, unknown> : {};
    const existingDesign = String(projectInput.projectStartMode || "") === "existing";

    if (existingDesign) {
      if (isPlan) {
        return NextResponse.json({ error: "Existing Design uses the uploaded plans directly. Generate room-based concept visuals instead of new AI plans." }, { status: 409 });
      }
      if (!roomKey || !roomName || !floorLabel || !sourcePlanAssetId) {
        return NextResponse.json({ error: "Choose a mapped room and its uploaded plan before generating the concept visual." }, { status: 400 });
      }

      const { data: sourcePlan, error: sourcePlanError } = await admin
        .from("project_assets")
        .select("id,asset_type,file_url,thumbnail_url,metadata")
        .eq("id", sourcePlanAssetId)
        .eq("project_id", projectId)
        .eq("user_id", auth.user.id)
        .eq("studio", "interior_studio")
        .maybeSingle();
      if (sourcePlanError || !sourcePlan || !SOURCE_PLAN_TYPES.has(String(sourcePlan.asset_type || ""))) {
        return NextResponse.json({ error: "The selected uploaded plan could not be verified." }, { status: 404 });
      }
      const sourceMeta = sourcePlan.metadata && typeof sourcePlan.metadata === "object" ? sourcePlan.metadata as Record<string, unknown> : {};
      const contentType = String(sourceMeta.content_type || "").toLowerCase();
      if (!(sourceMeta.ai_reference === true || sourceMeta.ai_reference === "true") || !contentType.startsWith("image/")) {
        return NextResponse.json({ error: "This plan does not have an image reference available for AI visualisation." }, { status: 409 });
      }

      if (imageType !== "main_space" && !(await hasApprovedRoomMain(admin, projectId, roomKey))) {
        return NextResponse.json({ error: `Approve the Main Concept for ${roomName} before generating another view of that room.` }, { status: 409 });
      }
    } else {
      if ((imageType === "furniture_plan" || imageType === "lighting_plan" || isVisual) && !(await hasApprovedInteriorAsset(admin, projectId, "space_plan"))) {
        return NextResponse.json({ error: "Generate and approve the Furniture & Space Plan first." }, { status: 409 });
      }
      if (isVisual && imageType !== "main_space" && !(await hasApprovedInteriorAsset(admin, projectId, "main_space"))) {
        return NextResponse.json({ error: "Generate and approve the Main Space Perspective first. It becomes the visual anchor for every other Interior view." }, { status: 409 });
      }
    }

    const action: CreditAction = stage === "technical" ? "interiorTechnicalPlan" : stage === "preview" ? "interiorPreview" : "interiorProfessionalFinal";
    const jobInput = {
      studio: "interior",
      projectId,
      viewType: imageType,
      stage,
      sourcePlanImageUrls: Array.isArray(projectInput.sourcePlanImageUrls) ? projectInput.sourcePlanImageUrls.slice(0, 6) : [],
      roomKey: roomKey || null,
      roomName: roomName || null,
      floorLabel: floorLabel || null,
      roomNotes: roomNotes || null,
      sourcePlanAssetId: sourcePlanAssetId || null,
    };
    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: "interior-image",
      dedupe: jobInput,
      action,
      projectId,
      tool: "studio_image",
      provider: "openai",
      input: jobInput,
      metadata: {
        studio: "interior_studio",
        project_id: projectId,
        image_type: imageType,
        stage,
        async_generation: true,
        room_key: roomKey || null,
        room_name: roomName || null,
        source_plan_asset_id: sourcePlanAssetId || null,
      },
    });
    jobId = startedJob.jobId;

    if (!startedJob.created && startedJob.status !== "queued") {
      return NextResponse.json({
        success: true,
        jobId,
        status: startedJob.status === "finalizing" ? "processing" : startedJob.status,
        creditsReserved: startedJob.creditsReserved,
      });
    }

    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/.netlify/functions/studio-image-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Heyy-Job-Signature": sign(jobId) },
      body: JSON.stringify({ jobId }),
      cache: "no-store",
    }).catch(() => null);
    if (response?.status === 202 || response?.ok) accepted = true;
    else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) { accepted = true; await processStudioImageJob(jobId); }
    else throw new Error(`Interior background generation could not start (${response?.status || "unavailable"}).`);

    return NextResponse.json({ success: true, status: "processing", jobId, creditsReserved: startedJob.creditsReserved });
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
          status: status === "finalizing" || status === "queued" ? "processing" : status,
          creditsReserved: startedJob.creditsReserved,
        });
      }
    }
    console.error("Interior image async start error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
