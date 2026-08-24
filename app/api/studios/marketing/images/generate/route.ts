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

type MarketingVisualType = "key_visual" | "social_feed" | "story_cover" | "carousel_cover" | "landing_hero" | "email_header" | "display_ad" | "outdoor_poster";
type GenerationStage = "preview" | "final";
const VISUALS = new Set<MarketingVisualType>(["key_visual", "social_feed", "story_cover", "carousel_cover", "landing_hero", "email_header", "display_ad", "outdoor_poster"]);

function sign(jobId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  return createHmac("sha256", secret).update(`studio-image:${jobId}`).digest("hex");
}

async function latestPreview(admin: any, projectId: string, viewType: string) {
  const { data } = await admin.from("project_assets").select("id,file_url").eq("project_id", projectId).eq("studio", "marketing_studio").eq("asset_type", `marketing_visual_${viewType}_preview`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data || null;
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
    const viewType = String(body?.viewType || "") as MarketingVisualType;
    const stage = String(body?.stage || "preview") as GenerationStage;
    const tweak = String(body?.tweak || "").trim().slice(0, 1000);
    if (!projectId) return NextResponse.json({ error: "Project is required." }, { status: 400 });
    if (!VISUALS.has(viewType)) return NextResponse.json({ error: "Choose a valid campaign visual." }, { status: 400 });
    if (!(stage === "preview" || stage === "final")) return NextResponse.json({ error: "Choose Preview or Professional Final." }, { status: 400 });

    const { data: project, error: projectError } = await admin.from("studio_projects").select("id").eq("id", projectId).eq("user_id", auth.user.id).eq("studio", "marketing_studio").single();
    if (projectError || !project) return NextResponse.json({ error: projectError?.message || "Marketing project not found." }, { status: 404 });
    if (stage === "final" && !(await latestPreview(admin, projectId, viewType))?.file_url) {
      return NextResponse.json({ error: "Generate the Preview for this campaign visual before creating its Professional Final." }, { status: 409 });
    }

    const action: CreditAction = stage === "final" ? "marketingProfessionalFinal" : "marketingVisualPreview";
    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: "marketing-image",
      dedupe: { projectId, viewType, stage, tweak: tweak || null },
      action,
      projectId,
      tool: "studio_image",
      provider: "openai",
      input: { studio: "marketing", projectId, viewType, stage, tweak: tweak || null },
      metadata: { studio: "marketing_studio", project_id: projectId, visual_type: viewType, stage, async_generation: true },
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
    else throw new Error(`Marketing background generation could not start (${response?.status || "unavailable"}).`);

    return NextResponse.json({ success: true, status: "processing", jobId, creditsReserved: startedJob.creditsReserved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Marketing visual generation could not start.";
    if (!accepted && admin && startedJob) {
      const status = await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Marketing visual generation could not start. Your credits were returned.",
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
    console.error("Marketing image async start error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
