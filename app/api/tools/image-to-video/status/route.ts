import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { commitCredits, refundCredits } from "@/lib/credits/server";
import { storeGeneratedAsset } from "@/lib/assets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });

    const { data: job, error } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .single();

    if (error || !job) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
    if (job.status === "succeeded") {
      return NextResponse.json({ success: true, status: "succeeded", fileUrl: job.output?.asset_url || null });
    }
    if (job.status === "failed") {
      return NextResponse.json({ success: true, status: "failed", error: job.error || "Video generation failed." });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 503 });
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not check video status." },
      { status: 500 },
    );
  }
}

async function checkOmni(auth: Awaited<ReturnType<typeof requireApiUser>>, job: any) {
  const response = await fetch(`${GEMINI_BASE}/files/${encodeURIComponent(job.provider_job_id)}`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    cache: "no-store",
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error?.message || "Could not check Gemini Omni file status.");

  const state = String(data?.state || "PROCESSING").toUpperCase();
  if (state === "FAILED") {
    return await failJob(auth, job, data?.error?.message || "Video generation failed.", data);
  }
  if (state === "ACTIVE") {
    const videoUri = String(job.output?.video_uri || data?.uri || "");
    if (!videoUri) throw new Error("Gemini Omni completed without a downloadable video URI.");
    const assetUrl = await persistVideo(auth, job, videoUri, String(job.input?.model || "gemini-omni-flash-preview"));
    return NextResponse.json({ success: true, status: "succeeded", fileUrl: assetUrl });
  }

  await auth.admin
    .from("generation_jobs")
    .update({ status: "processing", output: { ...(job.output || {}), provider_state: state } })
    .eq("id", job.id);
  return NextResponse.json({ success: true, status: "processing", providerState: state });
}

async function checkVeo(auth: Awaited<ReturnType<typeof requireApiUser>>, job: any) {
  const operationName = String(job.provider_job_id || job.output?.operation_name || "");
  if (!operationName) throw new Error("Veo operation ID is missing.");

  const response = await fetch(`${GEMINI_BASE}/${operationName.replace(/^\/+/, "")}`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    cache: "no-store",
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error?.message || "Could not check Veo 3.1 status.");

  if (data?.error) {
    return await failJob(auth, job, data.error?.message || "Veo 3.1 generation failed.", data);
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
    return await failJob(auth, job, "Veo 3.1 completed without a downloadable video.", data);
  }

  const assetUrl = await persistVideo(auth, job, videoUri, String(job.input?.model || "veo-3.1-generate-preview"));
  return NextResponse.json({ success: true, status: "succeeded", fileUrl: assetUrl });
}

async function persistVideo(
  auth: Awaited<ReturnType<typeof requireApiUser>>,
  job: any,
  videoUri: string,
  fallbackModel: string,
) {
  if (job.output?.asset_url) return String(job.output.asset_url);

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

  const model = String(job.input?.model || job.output?.model || fallbackModel);
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
      mode: job.input?.mode || "preview",
      resolution: job.input?.resolution || null,
    },
    metadata: {
      provider: job.provider,
      model,
      credit_reservation_id: job.credit_reservation_id,
      provider_job_id: job.provider_job_id,
    },
  });

  await commitCredits(auth.admin, job.credit_reservation_id, {
    provider_job_id: job.provider_job_id,
    model,
    asset_id: asset.id,
  });
  await auth.admin
    .from("generation_jobs")
    .update({
      status: "succeeded",
      output: {
        ...(job.output || {}),
        video_uri: videoUri,
        asset_url: asset.file_url,
        asset_id: asset.id,
        model,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  return String(asset.file_url || "");
}

async function failJob(
  auth: Awaited<ReturnType<typeof requireApiUser>>,
  job: any,
  message: string,
  providerData?: unknown,
) {
  await refundCredits(auth.admin, job.credit_reservation_id, message);
  await auth.admin
    .from("generation_jobs")
    .update({
      status: "failed",
      error: message,
      output: { ...(job.output || {}), provider_error: providerData || null },
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);
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
