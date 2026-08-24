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

const MAX_DELIVERY_ATTEMPTS = 3;

export async function GET(request: Request) {
  try {
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    }
    const auth = await requireGenerationStatusAccess(request, jobId, "ai_upscaler");

    const { data: loadedJob } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .single();

    if (!loadedJob) {
      return NextResponse.json({ error: "Enhancement job not found." }, { status: 404 });
    }
    let job = loadedJob;

    if (job.status === "succeeded") {
      return NextResponse.json({
        success: true,
        status: "succeeded",
        fileUrl: job.output?.asset_url || null,
      });
    }

    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        status: "failed",
        error: job.error || "Enhancement failed.",
      });
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
      return NextResponse.json({
        success: true,
        status: "processing",
        providerState: "finalizing",
        progress: 1,
      });
    }

    if (!process.env.TOPAZ_API_KEY) {
      return NextResponse.json({ error: "Enhancement service is not configured." }, { status: 503 });
    }

    if (!job.provider_job_id) {
      return NextResponse.json({
        success: true,
        status: "processing",
        providerState: "starting",
        progress: null,
      });
    }

    const rememberedState = String(job.output?.provider_state || "").toLowerCase();

    // If Topaz already told us the provider job completed, do not depend on the
    // status endpoint remaining available. Retry only the delivery/persistence step.
    if (isCompleteState(rememberedState)) {
      return await claimCompletedDelivery(auth, job, job.output?.provider_status || null, {
        ...(job.output || {}),
        provider_state: rememberedState,
        progress: 1,
      });
    }

    const statusTemplate =
      process.env.TOPAZ_STATUS_ENDPOINT_TEMPLATE ||
      "https://api.topazlabs.com/image/v1/status/{id}";
    const endpoint = statusTemplate.replace(
      "{id}",
      encodeURIComponent(job.provider_job_id),
    );

    const response = await fetch(endpoint, {
      headers: { "X-API-Key": process.env.TOPAZ_API_KEY },
      cache: "no-store",
    });
    const data = await readJson(response);

    if (!response.ok) {
      const providerMessage = String(
        data?.error?.message ||
          data?.message ||
          `Provider status request failed (${response.status}).`,
      );

      // A missing/invalid provider job cannot recover by polling forever.
      if (response.status === 404 || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        const userMessage =
          response.status === 404
            ? "The enhancement job is no longer available. Your credits were returned."
            : "The enhancement service could not complete this image. Your credits were returned.";

        await failJobAndRefund(auth, job, userMessage, {
          provider_status_code: response.status,
          provider_status_response: data,
          provider_status_error: providerMessage,
        });

        return NextResponse.json({
          success: true,
          status: "failed",
          error: userMessage,
        });
      }

      // Treat rate limits and provider 5xx responses as temporary. Keep the
      // reservation/job alive so the normal UI poll can try again.
      await auth.admin
        .from("generation_jobs")
        .update({
          status: "processing",
          error: null,
          output: {
            ...(job.output || {}),
            provider_state: rememberedState || "processing",
            provider_status_code: response.status,
            provider_status_error: providerMessage,
          },
        })
        .eq("id", job.id);

      return NextResponse.json({
        success: true,
        status: "processing",
        providerState: "retrying",
        progress: job.output?.progress ?? null,
      });
    }

    const state = String(data?.status || data?.state || "processing").toLowerCase();

    if (isFailureState(state)) {
      const providerMessage = String(
        data?.error?.message || data?.message || "Provider enhancement failed.",
      );
      const userMessage = "The enhancement service could not complete this image. Your credits were returned.";

      await failJobAndRefund(auth, job, userMessage, {
        provider_state: state,
        provider_status: data,
        provider_status_error: providerMessage,
      });

      return NextResponse.json({
        success: true,
        status: "failed",
        error: userMessage,
      });
    }

    if (isCompleteState(state)) {
      // Persist the provider-complete state before attempting the download.
      // If the download is temporarily unavailable, the next poll retries only
      // delivery instead of asking Topaz to generate again.
      const completedOutput = {
        ...(job.output || {}),
        provider_state: state,
        provider_status: data,
        progress: data?.progress ?? 1,
        eta: data?.eta ?? null,
      };

      return await claimCompletedDelivery(auth, job, data, completedOutput);
    }

    await auth.admin
      .from("generation_jobs")
      .update({
        status: "processing",
        error: null,
        output: {
          ...(job.output || {}),
          provider_state: state,
          provider_status: data,
          progress: data?.progress ?? null,
          eta: data?.eta ?? job.output?.eta ?? null,
        },
      })
      .eq("id", job.id);

    return NextResponse.json({
      success: true,
      status: "processing",
      providerState: state,
      progress: data?.progress ?? null,
    });
  } catch (error) {
    console.error("Topaz status error:", error);

    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Could not check enhancement status." },
      { status: 500 },
    );
  }
}

async function claimCompletedDelivery(
  auth: GenerationStatusAccess,
  job: any,
  providerStatus: any,
  output: Record<string, unknown>,
) {
  const { data: claimed, error } = await auth.admin
    .from("generation_jobs")
    .update({ status: "finalizing", error: null, output })
    .eq("id", job.id)
    .eq("status", "processing")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message || "Enhancement delivery could not be claimed.");
  if (!claimed) {
    return NextResponse.json({
      success: true,
      status: "processing",
      providerState: "finalizing",
      progress: 1,
    });
  }
  return await finishCompletedJob(auth, claimed, providerStatus);
}

async function finishCompletedJob(
  auth: GenerationStatusAccess,
  job: any,
  providerStatus: any,
) {
  try {
    const assetUrl = await downloadAndPersist(auth, job, providerStatus);

    return NextResponse.json({
      success: true,
      status: "succeeded",
      fileUrl: assetUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enhanced output could not be saved.";
    const { data: currentJob } = await auth.admin
      .from("generation_jobs")
      .select("output")
      .eq("id", job.id)
      .maybeSingle();
    const latestOutput = currentJob?.output || job.output || {};
    const attempts = Number(latestOutput?.delivery_attempts || 0) + 1;

    console.error(
      `Topaz delivery attempt ${attempts}/${MAX_DELIVERY_ATTEMPTS} failed:`,
      error,
    );

    if (attempts >= MAX_DELIVERY_ATTEMPTS && !latestOutput?.asset_url) {
      const userMessage =
        "The enhancement finished, but the final image could not be retrieved. Your credits were returned.";

      await failJobAndRefund(auth, job, userMessage, {
        provider_state: "completed",
        provider_status: providerStatus || job.output?.provider_status || null,
        delivery_attempts: attempts,
        delivery_error: message,
      });

      return NextResponse.json({
        success: true,
        status: "failed",
        error: userMessage,
      });
    }

    const { error: releaseError } = await auth.admin
      .from("generation_jobs")
      .update({
        status: "processing",
        error: null,
        output: {
          ...(job.output || {}),
          ...latestOutput,
          provider_state: "completed",
          provider_status: providerStatus || job.output?.provider_status || null,
          progress: 1,
          delivery_attempts: attempts,
          delivery_error: message,
        },
      })
      .eq("id", job.id)
      .eq("status", "finalizing");
    if (releaseError) throw new Error(releaseError.message || "Enhancement delivery retry could not be recorded.");

    return NextResponse.json({
      success: true,
      status: "processing",
      providerState: "finalizing",
      progress: 1,
    });
  }
}

async function downloadAndPersist(
  auth: GenerationStatusAccess,
  job: any,
  providerStatus: any,
) {
  const model = String(job.input?.model || job.output?.model || "Standard V2");

  // If the asset was already stored during an earlier attempt, only finish the
  // credit/job bookkeeping. This prevents duplicate Assets Library entries.
  if (job.output?.asset_url) {
    await completeGenerationJob(auth.admin, String(job.id), {
      ...(job.output || {}),
      provider_state: "completed",
      credit_state: "committed",
      model,
    }, {
      provider_job_id: job.provider_job_id,
      model,
      asset_id: job.output?.asset_id || null,
    });

    return String(job.output.asset_url);
  }

  const imageResponse = await downloadTopazOutput(
    job.provider_job_id,
    providerStatus,
  );

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  if (!buffer.length) {
    throw new Error("Topaz returned an empty enhanced image.");
  }

  const responseType = imageResponse.headers.get("content-type") || "image/png";
  if (
    /application\/json|text\/|application\/xml|text\/xml/i.test(responseType)
  ) {
    throw new Error(
      `Topaz returned ${responseType} instead of an enhanced image.`,
    );
  }

  const asset = await storeGeneratedAsset({
    admin: auth.admin,
    userId: auth.user.id,
    projectId: job.input?.projectId || null,
    studio: "ai_tools",
    assetType: "upscaled_image",
    title: `AI Upscale ${job.input?.scale || 2}× • ${String(job.input?.approach || "Standard")}`,
    buffer,
    extension: "png",
    contentType: responseType,
    payload: {
      scale: job.input?.scale || 2,
      approach: job.input?.approach || "Standard",
      outputWidth: job.input?.outputWidth || null,
      outputHeight: job.input?.outputHeight || null,
    },
    metadata: {
      provider: "topaz",
      model,
      credit_reservation_id: job.credit_reservation_id,
      provider_job_id: job.provider_job_id,
    },
  });

  // Save the asset link before credit finalisation. If credit bookkeeping has a
  // temporary problem, the next poll reuses this asset instead of creating a duplicate.
  const storedOutput = {
    ...(job.output || {}),
    provider_state: "completed",
    provider_status: providerStatus || job.output?.provider_status || null,
    asset_url: asset.file_url,
    asset_id: asset.id,
    model,
  };

  const { error: saveAssetLinkError } = await auth.admin
    .from("generation_jobs")
    .update({
      status: "finalizing",
      error: null,
      output: storedOutput,
    })
    .eq("id", job.id)
    .eq("status", "finalizing");

  if (saveAssetLinkError) {
    await auth.admin.from("project_assets").delete().eq("id", asset.id);
    const storagePath = String(asset.metadata?.storage_path || "");
    if (storagePath) await auth.admin.storage.from("project-assets").remove([storagePath]);
    throw new Error(
      saveAssetLinkError.message || "Enhanced asset link could not be saved.",
    );
  }

  await completeGenerationJob(auth.admin, String(job.id), {
    ...storedOutput,
    credit_state: "committed",
    delivery_error: null,
  }, {
    provider_job_id: job.provider_job_id,
    model,
    asset_id: asset.id,
  });

  return String(asset.file_url || "");
}

async function downloadTopazOutput(
  providerJobId: string,
  providerStatus: any,
): Promise<Response> {
  let lastError = "Topaz output download failed.";

  // Topaz may include the finished GET URL directly in the completed status response.
  const statusDownloadUrl = validHttpUrl(providerStatus?.download_url);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const signedUrl =
        attempt === 1 && statusDownloadUrl
          ? statusDownloadUrl
          : await requestFreshTopazDownloadUrl(providerJobId);

      const imageResponse = await fetch(signedUrl, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers: {
          Accept: "image/*,application/octet-stream;q=0.9,*/*;q=0.8",
        },
      });

      if (imageResponse.ok) {
        return imageResponse;
      }

      lastError = `Topaz output download failed (${imageResponse.status}).`;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Topaz output download failed.";
    }

    if (attempt < 3) {
      await wait(500 * attempt);
    }
  }

  throw new Error(lastError);
}

async function requestFreshTopazDownloadUrl(providerJobId: string) {
  const downloadTemplate =
    process.env.TOPAZ_DOWNLOAD_ENDPOINT_TEMPLATE ||
    "https://api.topazlabs.com/image/v1/download/{id}";
  const endpoint = downloadTemplate.replace(
    "{id}",
    encodeURIComponent(providerJobId),
  );

  const response = await fetch(endpoint, {
    headers: {
      "X-API-Key": process.env.TOPAZ_API_KEY!,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await readJson(response);

  if (!response.ok) {
    const message = String(
      data?.error?.message ||
        data?.message ||
        `Topaz download-link request failed (${response.status}).`,
    );
    throw new Error(message);
  }

  const signedUrl = validHttpUrl(data?.download_url);
  if (!signedUrl) {
    throw new Error(
      "Topaz completed but returned no downloadable image URL.",
    );
  }

  return signedUrl;
}

async function failJobAndRefund(
  auth: GenerationStatusAccess,
  job: any,
  message: string,
  outputPatch: Record<string, unknown> = {},
) {
  await failGenerationJob(auth.admin, {
    jobId: String(job.id),
    expectedStatus: job.status === "finalizing" ? "finalizing" : "processing",
    reason: message,
    publicError: message,
    outputPatch,
  });
}

function isFailureState(value: string) {
  return /fail|error|cancel/.test(value);
}

function isCompleteState(value: string) {
  return /complete|success|finish/.test(value);
}

function validHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
