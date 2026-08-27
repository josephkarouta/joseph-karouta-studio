import "server-only";
import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/server/auth";
import { storeGeneratedAsset } from "@/lib/assets-server";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";
import {
  requireGenerationStatusAccess,
  type GenerationStatusAccess,
} from "@/lib/generation-jobs/reconciliation-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_DELIVERY_ATTEMPTS = 3;

export async function GET(request: Request) {
  try {
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    const auth = await requireGenerationStatusAccess(request, jobId, "image_to_video");

    const { data: loadedJob, error } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .single();

    if (error || !loadedJob) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
    let job = loadedJob;
    if (job.status === "succeeded") {
      return NextResponse.json({ success: true, status: "succeeded", fileUrl: job.output?.asset_url || null });
    }
    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({ success: true, status: "failed", error: job.error || "Video generation failed." });
    }
    if (job.status === "finalizing") {
      const claimAge = Date.now() - new Date(job.updated_at || 0).getTime();
      if (Number.isFinite(claimAge) && claimAge >= 5 * 60_000) {
        const { data: reclaimed } = await auth.admin
          .from("generation_jobs")
          .update({ status: "processing" })
          .eq("id", job.id)
          .eq("status", "finalizing")
          .eq("updated_at", job.updated_at)
          .select("*")
          .maybeSingle();
        if (reclaimed) job = reclaimed;
      }
    }
    if (job.status === "finalizing") {
      return NextResponse.json({ success: true, status: "processing", providerState: "finalizing" });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Video generation is not configured." }, { status: 503 });
    }
    if (!job.provider_job_id) {
      return NextResponse.json({ success: true, status: "processing", providerState: "starting" });
    }

    if (job.provider === "google_veo_3_1") {
      return await checkVeo(auth, job);
    }
    return await checkOmni(auth, job);
  } catch (error) {
    console.error("Video status error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not check video status." }, { status: 500 });
  }
}

async function checkOmni(auth: GenerationStatusAccess, job: any) {
  const response = await fetch(`${GEMINI_BASE}/files/${encodeURIComponent(job.provider_job_id)}`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    cache: "no-store",
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error?.message || "Could not check Gemini Omni file status.");

  const state = String(data?.state || "PROCESSING").toUpperCase();
  if (state === "FAILED") {
    return await failJob(auth, job, "Video generation failed. Your credits were returned.", data);
  }
  if (state === "ACTIVE") {
    const videoUri = String(job.output?.video_uri || data?.uri || "");
    if (!videoUri) throw new Error("Gemini Omni completed without a downloadable video URI.");
    return await claimAndPersistVideo(auth, job, videoUri, String(job.input?.model || "gemini-omni-flash-preview"));
  }

  await auth.admin
    .from("generation_jobs")
    .update({ status: "processing", output: { ...(job.output || {}), provider_state: state } })
    .eq("id", job.id);
  return NextResponse.json({ success: true, status: "processing", providerState: state });
}

async function checkVeo(auth: GenerationStatusAccess, job: any) {
  const operationName = String(job.provider_job_id || job.output?.operation_name || "");
  if (!operationName) throw new Error("Veo operation ID is missing.");

  const response = await fetch(`${GEMINI_BASE}/${operationName.replace(/^\/+/, "")}`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    cache: "no-store",
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error?.message || "Could not check Veo 3.1 status.");

  if (data?.error) {
    return await failJob(auth, job, "Video generation failed. Your credits were returned.", data);
  }
  if (!data?.done) {
    await auth.admin
      .from("generation_jobs")
      .update({ status: "processing", output: { ...(job.output || {}), operation_state: data } })
      .eq("id", job.id);
    return NextResponse.json({ success: true, status: "processing", providerState: "PROCESSING" });
  }

  const videoUri = String(
    data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || findVideoUri(data) || "",
  );
  if (!videoUri) {
    return await failJob(auth, job, "The video finished without a downloadable file. Your credits were returned.", data);
  }

  return await claimAndPersistVideo(auth, job, videoUri, String(job.input?.model || "veo-3.1-fast-generate-preview"));
}

async function claimAndPersistVideo(
  auth: GenerationStatusAccess,
  job: any,
  videoUri: string,
  model: string,
) {
  const { data: claimed, error: claimError } = await auth.admin
    .from("generation_jobs")
    .update({
      status: "finalizing",
      error: null,
      output: { ...(job.output || {}), video_uri: videoUri },
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .select("*")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message || "Video delivery could not be claimed.");
  if (!claimed) {
    return NextResponse.json({ success: true, status: "processing", providerState: "finalizing" });
  }

  try {
    const assetUrl = await persistVideo(auth, claimed, videoUri, model);
    return NextResponse.json({ success: true, status: "succeeded", fileUrl: assetUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finished video could not be saved.";
    const { data: currentJob } = await auth.admin
      .from("generation_jobs")
      .select("output")
      .eq("id", claimed.id)
      .maybeSingle();
    const latestOutput = currentJob?.output || claimed.output || {};
    const attempts = Number(latestOutput?.delivery_attempts || 0) + 1;

    if (attempts >= MAX_DELIVERY_ATTEMPTS && !latestOutput?.asset_url) {
      return await failJob(auth, claimed, "The video finished, but its file could not be saved. Your credits were returned.", {
        delivery_attempts: attempts,
        delivery_error: message,
      });
    }

    const { error: releaseError } = await auth.admin
      .from("generation_jobs")
      .update({
        status: "processing",
        error: null,
        output: {
          ...(claimed.output || {}),
          ...latestOutput,
          video_uri: videoUri,
          delivery_attempts: attempts,
          delivery_error: message,
        },
      })
      .eq("id", claimed.id)
      .eq("status", "finalizing");
    if (releaseError) throw new Error(releaseError.message || "Video delivery retry could not be recorded.");

    return NextResponse.json({ success: true, status: "processing", providerState: "finalizing" });
  }
}

async function persistVideo(
  auth: GenerationStatusAccess,
  job: any,
  videoUri: string,
  fallbackModel: string,
) {
  const model = String(job.input?.model || job.output?.model || fallbackModel);

  if (job.output?.asset_url) {
    await completeGenerationJob(auth.admin, String(job.id), {
      ...(job.output || {}),
      model,
      delivery_error: null,
    }, {
      provider_job_id: job.provider_job_id,
      model,
      asset_id: job.output?.asset_id || null,
    });
    return String(job.output.asset_url);
  }

  const providerUrl = job.provider === "google_gemini_omni"
    ? `${GEMINI_BASE}/files/${encodeURIComponent(String(job.provider_job_id))}:download?alt=media`
    : /^https?:\/\//i.test(videoUri)
      ? videoUri
      : `${GEMINI_BASE}/${videoUri.replace(/^\/+/, "")}`;
  const response = await fetch(providerUrl, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`The finished video could not be downloaded (${response.status}).`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("The finished video file was empty.");

  const title = String(job.input?.prompt || "Generated video").slice(0, 70);
  const asset = await storeGeneratedAsset({
    admin: auth.admin,
    userId: auth.user.id,
    projectId: job.input?.projectId || null,
    studio: "ai_tools",
    assetType: "generated_video",
    title,
    buffer,
    extension: "mp4",
    contentType: response.headers.get("content-type") || "video/mp4",
    payload: {
      prompt: job.input?.prompt || "",
      aspect: job.input?.aspect || "16:9",
      ...(job.input?.mode ? { mode: job.input.mode } : {}),
      resolution: job.input?.resolution || null,
    },
    metadata: {
      provider: job.provider,
      model,
      credit_reservation_id: job.credit_reservation_id,
      provider_job_id: job.provider_job_id,
    },
  });

  const storedOutput = {
    ...(job.output || {}),
    video_uri: videoUri,
    asset_url: asset.file_url,
    asset_id: asset.id,
    model,
  };
  const { error: saveOutputError } = await auth.admin
    .from("generation_jobs")
    .update({ status: "finalizing", error: null, output: storedOutput })
    .eq("id", job.id)
    .eq("status", "finalizing");
  if (saveOutputError) {
    await auth.admin.from("project_assets").delete().eq("id", asset.id);
    const storagePath = String(asset.metadata?.storage_path || "");
    if (storagePath) await auth.admin.storage.from("project-assets").remove([storagePath]);
    throw new Error(saveOutputError.message || "Saved video link could not be recorded.");
  }

  await completeGenerationJob(auth.admin, String(job.id), {
    ...storedOutput,
    delivery_error: null,
  }, {
    provider_job_id: job.provider_job_id,
    model,
    asset_id: asset.id,
  });

  return String(asset.file_url || "");
}

async function failJob(
  auth: GenerationStatusAccess,
  job: any,
  message: string,
  providerData?: unknown,
) {
  await failGenerationJob(auth.admin, {
    jobId: String(job.id),
    expectedStatus: job.status === "finalizing" ? "finalizing" : "processing",
    reason: message,
    publicError: message,
    outputPatch: { provider_error: providerData || null },
  });
  return NextResponse.json({ success: true, status: "failed", error: message });
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

function findVideoUri(value: unknown): string | null {
  if (!value) return null;
  if (
    typeof value === "string" &&
    ((/^https?:\/\//.test(value) && /video|download|googleapis|storage|files/i.test(value)) || /(?:^|\/)files\//.test(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUri(item);
      if (found) return found;
    }
  } else if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findVideoUri(item);
      if (found) return found;
    }
  }
  return null;
}
