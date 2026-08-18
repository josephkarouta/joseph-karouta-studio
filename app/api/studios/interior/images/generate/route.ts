import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, reserveCredits, refundCredits } from "@/lib/credits/server";
import type { CreditAction } from "@/lib/credits/config";
import { processStudioImageJob } from "@/lib/studio/studio-image-async-job";

export const runtime = "nodejs";
export const maxDuration = 60;

type PlanType = "space_plan" | "furniture_plan" | "lighting_plan";
type VisualType = "main_space" | "alternate_angle" | "focal_point" | "material_detail" | "day_view" | "evening_view";
type ImageType = PlanType | VisualType;
type GenerationStage = "technical" | "preview" | "final";

const PLANS = new Set<ImageType>(["space_plan", "furniture_plan", "lighting_plan"]);
const VISUALS = new Set<ImageType>(["main_space", "alternate_angle", "focal_point", "material_detail", "day_view", "evening_view"]);

function sign(jobId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  return createHmac("sha256", secret).update(`studio-image:${jobId}`).digest("hex");
}

async function hasApprovedInteriorAsset(admin: any, projectId: string, viewType: "space_plan" | "main_space") {
  const { data } = await admin.from("project_assets").select("asset_type,metadata").eq("project_id", projectId).eq("studio", "interior_studio").order("created_at", { ascending: false }).limit(80);
  return (data || []).some((asset: any) => {
    const type = String(asset.asset_type || "");
    const meta = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
    const view = String(meta.view_type || "");
    const approved = meta.approved === true || meta.approved === "true";
    if (!approved) return false;
    if (view === viewType) return true;
    return viewType === "space_plan"
      ? type.includes("interior_plan_space_plan")
      : type.includes("interior_visual_main_space");
  });
}

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let jobId: string | null = null;
  let accepted = false;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const imageType = String(body?.viewType || "") as ImageType;
    const stage = String(body?.stage || "preview") as GenerationStage;
    const isPlan = PLANS.has(imageType);
    const isVisual = VISUALS.has(imageType);
    if (!projectId) return NextResponse.json({ error: "Project is required." }, { status: 400 });
    if (!isPlan && !isVisual) return NextResponse.json({ error: "Choose a valid interior plan or visual." }, { status: 400 });
    if (!(["technical", "preview", "final"] as string[]).includes(stage)) return NextResponse.json({ error: "Choose a valid generation stage." }, { status: 400 });
    if (isVisual && stage === "technical") return NextResponse.json({ error: "Interior visuals begin with a preview, then a professional final." }, { status: 400 });

    const { data: project, error: projectError } = await admin.from("studio_projects").select("id,input").eq("id", projectId).eq("user_id", auth.user.id).eq("studio", "interior_studio").single();
    if (projectError || !project) return NextResponse.json({ error: projectError?.message || "Interior project not found." }, { status: 404 });

    if ((imageType === "furniture_plan" || imageType === "lighting_plan" || isVisual) && !(await hasApprovedInteriorAsset(admin, projectId, "space_plan"))) {
      return NextResponse.json({ error: "Generate and approve the Furniture & Space Plan first." }, { status: 409 });
    }

    if (isVisual && imageType !== "main_space" && !(await hasApprovedInteriorAsset(admin, projectId, "main_space"))) {
      return NextResponse.json({ error: "Generate and approve the Main Space Perspective first. It becomes the visual anchor for every other Interior view." }, { status: 409 });
    }

    const action: CreditAction = stage === "technical" ? "interiorTechnicalPlan" : stage === "preview" ? "interiorPreview" : "interiorProfessionalFinal";
    const reservation = await reserveCredits({ admin, userId: auth.user.id, action, metadata: { studio: "interior_studio", project_id: projectId, image_type: imageType, stage, async_generation: true } });
    reservationId = reservation.id;

    const { data: job, error: jobError } = await admin.from("generation_jobs").insert({
      user_id: auth.user.id,
      project_id: projectId,
      tool: "studio_image",
      provider: "openai",
      provider_job_id: null,
      credit_reservation_id: reservation.id,
      status: "queued",
      input: {
        studio: "interior",
        projectId,
        viewType: imageType,
        stage,
        credits: reservation.amount,
        sourcePlanImageUrls: Array.isArray((project.input as any)?.sourcePlanImageUrls)
          ? (project.input as any).sourcePlanImageUrls.slice(0, 6)
          : [],
      },
      output: {},
    }).select().single();
    if (jobError || !job) throw new Error(jobError?.message || "Interior image job could not be saved.");
    jobId = String(job.id);

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

    return NextResponse.json({ success: true, status: "processing", jobId, creditsReserved: reservation.amount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interior image generation could not start.";
    if (!accepted && admin && jobId) {
      const { data: failedQueuedJob, error: cleanupError } = await admin.from("generation_jobs")
        .update({ status: "failed", error: "Interior image generation could not start. Your credits were returned.", completed_at: new Date().toISOString() })
        .eq("id", jobId).eq("status", "queued").select("id").maybeSingle();
      if (cleanupError) console.error("Interior image start cleanup failed:", cleanupError.message);
      else if (failedQueuedJob && reservationId) await refundCredits(admin, reservationId, message);
    } else if (!accepted && admin && reservationId) {
      await refundCredits(admin, reservationId, message);
    }
    console.error("Interior image async start error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
