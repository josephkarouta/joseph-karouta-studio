import "server-only";
import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError } from "@/lib/credits/server";
import type { CreditAction } from "@/lib/credits/config";
import { failGenerationJob } from "@/lib/credits/lifecycle";
import {
  cleanupGenerationStart,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type AspectRatio = "16:9" | "9:16";
type VideoMode = "fast" | "quality";
type VideoResolution = "720p" | "1080p";

export async function POST(request: Request) {
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;
  let startedJob: GenerationJobStart | null = null;
  let providerClaimed = false;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;

    const body = await request.json();
    const imageBase64 = String(body?.imageBase64 || "").trim();
    const mimeType = ["image/png", "image/jpeg", "image/webp"].includes(body?.mimeType)
      ? body.mimeType
      : "image/jpeg";
    const prompt = String(body?.prompt || "").trim();
    const aspect: AspectRatio = body?.aspect === "9:16" ? "9:16" : "16:9";
    const mode: VideoMode = body?.mode === "quality" ? "quality" : "fast";
    const resolution: VideoResolution = body?.resolution === "720p" ? "720p" : "1080p";
    const projectId = String(body?.projectId || "").trim() || null;

    if (!imageBase64 || !prompt) {
      return NextResponse.json({ error: "Image and motion direction are required." }, { status: 400 });
    }
    if (prompt.length < 8) {
      return NextResponse.json({ error: "Describe the motion, camera and timing in more detail." }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Video generation is not configured." }, { status: 503 });
    }

    const imageBytes = Buffer.from(imageBase64, "base64");
    if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "The source image must be 4 MB or smaller." }, { status: 400 });
    }

    const sourceHash = createHash("sha256").update(imageBytes).digest("hex");
    const provider = "google_veo_3_1";
    const requestedModel =
      mode === "quality"
        ? process.env.GEMINI_VIDEO_MODEL_QUALITY || "veo-3.1-generate-preview"
        : process.env.GEMINI_VIDEO_MODEL_FAST || "veo-3.1-fast-generate-preview";
    const durationSeconds = 8;
    const action: CreditAction = getVideoCreditAction(mode, resolution);

    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: "image-to-video",
      dedupe: { sourceHash, prompt, aspect, projectId, mode, resolution, durationSeconds },
      action,
      projectId,
      tool: "image_to_video",
      provider,
      input: {
        prompt,
        aspect,
        mode,
        mimeType,
        projectId,
        model: requestedModel,
        resolution,
        duration_seconds: durationSeconds,
        sourceHash,
      },
      metadata: {
        tool: "image_to_video",
        aspect,
        mode,
        project_id: projectId,
        resolution,
        duration_seconds: durationSeconds,
      },
    });

    if (startedJob.status !== "queued") {
      return NextResponse.json({
        success: true,
        jobId: startedJob.jobId,
        status: startedJob.status === "finalizing" ? "processing" : startedJob.status,
        mode,
        resolution,
        creditsReserved: startedJob.creditsReserved,
      });
    }

    const { data: claimedJob, error: claimError } = await admin
      .from("generation_jobs")
      .update({ status: "processing", error: null })
      .eq("id", startedJob.jobId)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message || "Video job could not be claimed.");
    if (!claimedJob) {
      return NextResponse.json({
        success: true,
        jobId: startedJob.jobId,
        status: "processing",
        mode,
        resolution,
        creditsReserved: startedJob.creditsReserved,
      });
    }
    providerClaimed = true;

    const started = await startVeoVideo({
      imageBase64,
      mimeType,
      prompt,
      aspect,
      mode,
      model: requestedModel,
      resolution,
    });

    const { data: job, error: jobError } = await admin
      .from("generation_jobs")
      .update({
        provider_job_id: started.providerJobId,
        status: "processing",
        output: started.output,
      })
      .eq("id", startedJob.jobId)
      .eq("status", "processing")
      .is("provider_job_id", null)
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message || "The generation job could not be saved.");
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "processing",
      mode,
      resolution: started.resolution,
      creditsReserved: startedJob.creditsReserved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video start failed";
    if (admin && startedJob && providerClaimed) {
      try {
        const failed = await failGenerationJob(admin, {
          jobId: startedJob.jobId,
          expectedStatus: "processing",
          requireMissingProviderId: true,
          reason: message,
          publicError: "Video generation could not start. Your credits were returned.",
        });
        if (!failed) {
          const { data: activeJob } = await admin
            .from("generation_jobs")
            .select("status,provider_job_id")
            .eq("id", startedJob.jobId)
            .maybeSingle();
          if (activeJob?.provider_job_id && ["processing", "finalizing", "succeeded"].includes(String(activeJob.status))) {
            return NextResponse.json({
              success: true,
              jobId: startedJob.jobId,
              status: activeJob.status === "succeeded" ? "succeeded" : "processing",
              creditsReserved: startedJob.creditsReserved,
            });
          }
        }
      } catch (cleanupError) {
        console.error("Image-to-video start cleanup failed:", cleanupError);
      }
    } else if (admin && startedJob) {
      await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Video generation could not start. Your credits were returned.",
      });
    }
    console.error("Image-to-video start error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CreditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Video generation could not start. Your credits were returned." }, { status: 500 });
  }
}

function getVideoCreditAction(mode: VideoMode, resolution: VideoResolution): CreditAction {
  if (mode === "quality") {
    return resolution === "720p" ? "imageToVideoQuality720" : "imageToVideoQuality1080";
  }
  return resolution === "720p" ? "imageToVideoFast720" : "imageToVideoFast1080";
}

async function startVeoVideo({
  imageBase64,
  mimeType,
  prompt,
  aspect,
  mode,
  model,
  resolution,
}: {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  aspect: AspectRatio;
  mode: VideoMode;
  model: string;
  resolution: VideoResolution;
}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const generationPrompt = `${prompt}\n\nProfessional cinematic render. Preserve the supplied image as the opening frame and keep identity, architecture, products, typography and key geometry stable. Prioritize believable physics, polished camera motion, natural environmental movement and coherent detail.`;

  const operation = await ai.models.generateVideos({
    model,
    source: {
      prompt: generationPrompt,
      image: {
        imageBytes: imageBase64,
        mimeType,
      },
    },
    config: {
      numberOfVideos: 1,
      aspectRatio: aspect,
      durationSeconds: 8,
      resolution,
    },
  });

  const operationName = String(operation?.name || "").trim();
  if (!operationName) throw new Error("Video generation did not return a job ID.");

  return {
    provider: "google_veo_3_1",
    providerJobId: operationName,
    model,
    mode,
    resolution,
    durationSeconds: 8,
    output: { operation_name: operationName, model, mode, resolution },
  };
}
