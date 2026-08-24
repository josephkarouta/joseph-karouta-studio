import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError } from "@/lib/credits/server";
import { failGenerationJob } from "@/lib/credits/lifecycle";
import {
  cleanupGenerationStart,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT_PIXELS = 100_000_000;

type TopazChoice = {
  model: string;
  endpoint: string;
  generative: boolean;
};

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
    const scale: 2 | 4 = body?.scale === 4 ? 4 : 2;
    const approach = String(body?.model || "Standard").trim();
    const projectId = String(body?.projectId || "").trim() || null;

    if (!imageBase64) return NextResponse.json({ error: "Image is required." }, { status: 400 });
    if (!process.env.TOPAZ_API_KEY) {
      return NextResponse.json({ error: "Enhancement service is not configured." }, { status: 503 });
    }

    const source = Buffer.from(imageBase64, "base64");
    if (!source.length || source.length > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "The source image must be 4 MB or smaller." }, { status: 400 });
    }

    const metadata = await sharp(source, { failOn: "error" }).metadata();
    if (!metadata.width || !metadata.height) {
      return NextResponse.json({ error: "The uploaded file is not a valid image." }, { status: 400 });
    }

    const outputWidth = metadata.width * scale;
    const outputHeight = metadata.height * scale;
    if (outputWidth * outputHeight > MAX_OUTPUT_PIXELS) {
      return NextResponse.json(
        {
          error: `This ${scale}× upscale would exceed the beta safety limit of 100 megapixels. Use a smaller source or ${scale === 4 ? "2×" : "a smaller source"}.`,
        },
        { status: 400 },
      );
    }

    const choice = getTopazChoice(approach);
    const sourceHash = createHash("sha256").update(source).digest("hex");
    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: "ai-upscaler",
      dedupe: { sourceHash, scale, approach, projectId },
      action: scale === 4 ? "aiUpscale4x" : "aiUpscale2x",
      projectId,
      tool: "ai_upscaler",
      provider: "topaz",
      input: {
        scale,
        approach,
        model: choice.model,
        mimeType,
        projectId,
        outputWidth,
        outputHeight,
        generative: choice.generative,
        sourceHash,
      },
      metadata: {
        tool: "ai_upscaler",
        scale,
        approach,
        model: choice.model,
        project_id: projectId,
        output_width: outputWidth,
        output_height: outputHeight,
      },
    });

    if (startedJob.status !== "queued") {
      return NextResponse.json({
        success: true,
        jobId: startedJob.jobId,
        status: startedJob.status === "finalizing" ? "processing" : startedJob.status,
        model: choice.model,
        creditsReserved: startedJob.creditsReserved,
      });
    }

    // Exactly one request owns provider submission. A retry can safely claim a
    // queued job whose original HTTP invocation ended before reaching Topaz.
    const { data: claimedJob, error: claimError } = await admin
      .from("generation_jobs")
      .update({ status: "processing", error: null })
      .eq("id", startedJob.jobId)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message || "Enhancement job could not be claimed.");
    if (!claimedJob) {
      return NextResponse.json({
        success: true,
        jobId: startedJob.jobId,
        status: "processing",
        model: choice.model,
        creditsReserved: startedJob.creditsReserved,
      });
    }
    providerClaimed = true;

    const form = new FormData();
    form.append(
      "image",
      new Blob([source], { type: mimeType }),
      String(body?.filename || "source-image").slice(0, 160),
    );
    form.append("model", choice.model);
    form.append("output_format", "png");
    form.append("output_width", String(outputWidth));
    form.append("output_height", String(outputHeight));
    if (choice.generative) form.append("enhancement_strength", "5.0");

    const response = await fetch(choice.endpoint, {
      method: "POST",
      headers: { "X-API-Key": process.env.TOPAZ_API_KEY },
      body: form,
    });
    const data = await readJson(response);
    if (!response.ok) {
      console.error("Topaz start provider error:", data?.error?.message || data?.message || response.status);
      throw new Error("The enhancement service could not start this image.");
    }

    const providerId = String(
      data?.process_id || response.headers.get("x-process-id") || data?.request_id || data?.id || "",
    ).trim();
    if (!providerId) throw new Error("The enhancement service returned an invalid job response.");

    const { data: job, error } = await admin
      .from("generation_jobs")
      .update({
        provider_job_id: providerId,
        status: "processing",
        output: { eta: data?.eta || response.headers.get("x-eta") || null, model: choice.model },
      })
      .eq("id", startedJob.jobId)
      .eq("status", "processing")
      .is("provider_job_id", null)
      .select()
      .single();

    if (error || !job) throw new Error(error?.message || "Enhancement job could not be saved.");

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "processing",
      model: choice.model,
      creditsReserved: startedJob.creditsReserved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upscale start failed";
    if (admin && startedJob && providerClaimed) {
      try {
        const failed = await failGenerationJob(admin, {
          jobId: startedJob.jobId,
          expectedStatus: "processing",
          requireMissingProviderId: true,
          reason: message,
          publicError: "Enhancement could not start. Your credits were returned.",
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
        console.error("Topaz start cleanup failed:", cleanupError);
      }
    } else if (admin && startedJob) {
      await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Enhancement could not start. Your credits were returned.",
      });
    }
    console.error("Topaz start error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CreditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upscale could not start." },
      { status: 500 },
    );
  }
}

function getTopazChoice(value: string): TopazChoice {
  const key = value.toLowerCase();
  const standardEndpoint =
    process.env.TOPAZ_IMAGE_ENDPOINT ||
    process.env.TOPAZ_ENHANCE_ENDPOINT ||
    "https://api.topazlabs.com/image/v1/enhance/async";
  const generativeEndpoint =
    process.env.TOPAZ_ENHANCE_GENERATIVE_ENDPOINT || "https://api.topazlabs.com/image/v1/enhance-gen/async";

  if (key.includes("strong") || key.includes("recover")) {
    return { model: process.env.TOPAZ_MODEL_STRONG || "Recover 3", endpoint: generativeEndpoint, generative: true };
  }
  if (key.includes("high")) {
    return { model: process.env.TOPAZ_MODEL_HIGH_FIDELITY || "High Fidelity V2", endpoint: standardEndpoint, generative: false };
  }
  if (key.includes("low")) {
    return { model: process.env.TOPAZ_MODEL_LOW_RES || "Low Resolution V2", endpoint: standardEndpoint, generative: false };
  }
  if (key.includes("art") || key.includes("illustration") || key.includes("cgi")) {
    return { model: process.env.TOPAZ_MODEL_ART || "CGI", endpoint: standardEndpoint, generative: false };
  }
  if (key.includes("text") || key.includes("shape")) {
    return { model: process.env.TOPAZ_MODEL_TEXT || "Text Refine", endpoint: standardEndpoint, generative: false };
  }
  return { model: process.env.TOPAZ_MODEL_STANDARD || "Standard V2", endpoint: standardEndpoint, generative: false };
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
