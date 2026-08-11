import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { commitCredits, refundCredits } from "@/lib/credits/server";
import { storeGeneratedAsset } from "@/lib/assets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_DELIVERY_ATTEMPTS = 3;

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    }

    const { data: job } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Enhancement job not found." }, { status: 404 });
    }

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

    if (!process.env.TOPAZ_API_KEY) {
      return NextResponse.json({ error: "Enhancement service is not configured." }, { status: 503 });
    }

    if (!job.provider_job_id) {
      return NextResponse.json({ error: "Enhancement job is missing its provider reference." }, { status: 502 });
    }

    const rememberedState = String(job.output?.provider_state || "").toLowerCase();

    // If Topaz already told us the provider job completed, do not depend on the
    // status endpoint remaining available. Retry only the delivery/persistence step.
    if (isCompleteState(rememberedState)) {
      return await finishCompletedJob(auth, job, job.output?.provider_status || null);
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

      await auth.admin
        .from("generation_jobs")
        .update({
          status: "processing",
          error: null,
          output: completedOutput,
        })
        .eq("id", job.id);

      const completedJob = { ...job, output: completedOutput };
      return await finishCompletedJob(auth, completedJob, data);
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

async function finishCompletedJob(
  auth: Awaited<ReturnType<typeof requireApiUser>>,
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
    const attempts = Number(job.output?.delivery_attempts || 0) + 1;

    console.error(
      `Topaz delivery attempt ${attempts}/${MAX_DELIVERY_ATTEMPTS} failed:`,
      error,
    );

    if (attempts >= MAX_DELIVERY_ATTEMPTS) {
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

    await auth.admin
      .from("generation_jobs")
      .update({
        status: "processing",
        error: null,
        output: {
          ...(job.output || {}),
          provider_state: "completed",
          provider_status: providerStatus || job.output?.provider_status || null,
          progress: 1,
          delivery_attempts: attempts,
          delivery_error: message,
        },
      })
      .eq("id", job.id);

    return NextResponse.json({
      success: true,
      status: "processing",
      providerState: "finalizing",
      progress: 1,
    });
  }
}

async function downloadAndPersist(
  auth: Awaited<ReturnType<typeof requireApiUser>>,
  job: any,
  providerStatus: any,
) {
  const model = String(job.input?.model || job.output?.model || "Standard V2");

  // If the asset was already stored during an earlier attempt, only finish the
  // credit/job bookkeeping. This prevents duplicate Assets Library entries.
  if (job.output?.asset_url) {
    const creditState = await finalizeCredits(auth, job, model, job.output?.asset_id || null);

    await auth.admin
      .from("generation_jobs")
      .update({
        status: "succeeded",
        error: null,
        output: {
          ...(job.output || {}),
          provider_state: "completed",
          credit_state: creditState,
          model,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

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
      status: "processing",
      error: null,
      output: storedOutput,
    })
    .eq("id", job.id);

  if (saveAssetLinkError) {
    throw new Error(
      saveAssetLinkError.message || "Enhanced asset link could not be saved.",
    );
  }

  const creditState = await finalizeCredits(auth, job, model, asset.id);

  await auth.admin
    .from("generation_jobs")
    .update({
      status: "succeeded",
      error: null,
      output: {
        ...storedOutput,
        credit_state: creditState,
        delivery_error: null,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

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

async function finalizeCredits(
  auth: Awaited<ReturnType<typeof requireApiUser>>,
  job: any,
  model: string,
  assetId: string | null,
) {
  if (!job.credit_reservation_id) return "missing";

  const { data: reservation, error } = await auth.admin
    .from("credit_reservations")
    .select("status")
    .eq("id", job.credit_reservation_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Credit reservation could not be checked.");
  }

  const state = String(reservation?.status || "missing");

  if (state === "reserved") {
    await commitCredits(auth.admin, job.credit_reservation_id, {
      provider_job_id: job.provider_job_id,
      model,
      asset_id: assetId,
    });
    return "committed";
  }

  // A prior successful commit is idempotently accepted.
  if (state === "committed") return "committed";

  // If a long-running async job was already automatically refunded/expired,
  // still deliver the paid provider result instead of breaking the user's asset.
  if (state === "refunded" || state === "expired") return state;

  return state;
}

async function failJobAndRefund(
  auth: Awaited<ReturnType<typeof requireApiUser>>,
  job: any,
  message: string,
  outputPatch: Record<string, unknown> = {},
) {
  if (job.credit_reservation_id) {
    await refundCredits(auth.admin, job.credit_reservation_id, message);
  }

  await auth.admin
    .from("generation_jobs")
    .update({
      status: "failed",
      error: message,
      output: {
        ...(job.output || {}),
        ...outputPatch,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);
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
