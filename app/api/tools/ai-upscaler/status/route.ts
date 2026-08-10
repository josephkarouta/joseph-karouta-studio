import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { commitCredits, refundCredits } from "@/lib/credits/server";
import { storeGeneratedAsset } from "@/lib/assets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });

    const { data: job } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .single();
    if (!job) return NextResponse.json({ error: "Enhancement job not found." }, { status: 404 });

    if (job.status === "succeeded") {
      return NextResponse.json({ success: true, status: "succeeded", fileUrl: job.output?.asset_url || null });
    }
    if (job.status === "failed") {
      return NextResponse.json({ success: true, status: "failed", error: job.error || "Enhancement failed." });
    }
    if (!process.env.TOPAZ_API_KEY) {
      return NextResponse.json({ error: "TOPAZ_API_KEY is missing." }, { status: 503 });
    }
    if (!job.provider_job_id) {
      return NextResponse.json({ error: "Topaz returned no provider job ID." }, { status: 502 });
    }

    const statusTemplate =
      process.env.TOPAZ_STATUS_ENDPOINT_TEMPLATE || "https://api.topazlabs.com/image/v1/status/{id}";
    const endpoint = statusTemplate.replace("{id}", encodeURIComponent(job.provider_job_id));
    const response = await fetch(endpoint, {
      headers: { "X-API-Key": process.env.TOPAZ_API_KEY },
      cache: "no-store",
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || "Could not check Topaz status.");
    }

    const state = String(data?.status || data?.state || "processing").toLowerCase();
    if (/fail|error|cancel/.test(state)) {
      const message = String(data?.error?.message || data?.message || "Topaz enhancement failed");
      await refundCredits(auth.admin, job.credit_reservation_id, message);
      await auth.admin
        .from("generation_jobs")
        .update({ status: "failed", error: message, output: { ...(job.output || {}), provider_status: data }, completed_at: new Date().toISOString() })
        .eq("id", job.id);
      return NextResponse.json({ success: true, status: "failed", error: message });
    }

    if (/complete|success|finish/.test(state)) {
      const assetUrl = await downloadAndPersist(auth, job);
      return NextResponse.json({ success: true, status: "succeeded", fileUrl: assetUrl });
    }

    await auth.admin
      .from("generation_jobs")
      .update({
        status: "processing",
        output: {
          ...(job.output || {}),
          provider_state: state,
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
      { error: error instanceof Error ? error.message : "Could not check enhancement status." },
      { status: 500 },
    );
  }
}

async function downloadAndPersist(auth: Awaited<ReturnType<typeof requireApiUser>>, job: any) {
  if (job.output?.asset_url) return String(job.output.asset_url);

  const downloadTemplate =
    process.env.TOPAZ_DOWNLOAD_ENDPOINT_TEMPLATE || "https://api.topazlabs.com/image/v1/download/{id}";
  const endpoint = downloadTemplate.replace("{id}", encodeURIComponent(job.provider_job_id));
  const first = await fetch(endpoint, {
    headers: { "X-API-Key": process.env.TOPAZ_API_KEY! },
    redirect: "follow",
  });
  if (!first.ok) {
    const message = await safeResponseMessage(first);
    throw new Error(message || `Topaz download failed (${first.status}).`);
  }

  let imageResponse = first;
  const firstType = first.headers.get("content-type") || "";
  if (firstType.includes("application/json")) {
    const data = await readJson(first);
    const signedUrl = findOutputUrl(data);
    if (!signedUrl) throw new Error("Topaz completed but returned no downloadable image URL.");
    imageResponse = await fetch(signedUrl, { redirect: "follow" });
    if (!imageResponse.ok) throw new Error(`Topaz output download failed (${imageResponse.status}).`);
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  if (!buffer.length) throw new Error("Topaz returned an empty enhanced image.");

  const model = String(job.input?.model || job.output?.model || "Topaz");
  const asset = await storeGeneratedAsset({
    admin: auth.admin,
    userId: auth.user.id,
    projectId: job.input?.projectId || null,
    studio: "ai_tools",
    assetType: "upscaled_image",
    title: `Topaz ${job.input?.scale || 2}x ${model}`,
    buffer,
    extension: "png",
    contentType: imageResponse.headers.get("content-type") || "image/png",
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

  await commitCredits(auth.admin, job.credit_reservation_id, {
    provider_job_id: job.provider_job_id,
    model,
    asset_id: asset.id,
  });
  await auth.admin
    .from("generation_jobs")
    .update({
      status: "succeeded",
      output: { ...(job.output || {}), asset_url: asset.file_url, asset_id: asset.id, model },
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  return String(asset.file_url || "");
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

async function safeResponseMessage(response: Response) {
  try {
    const clone = response.clone();
    const data = await readJson(clone);
    return data?.error?.message || data?.message || "";
  } catch {
    return "";
  }
}

function findOutputUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOutputUrl(item);
      if (found) return found;
    }
  } else if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(record)) {
      if (/output.*url|download.*url|result.*url|url/i.test(key) && typeof item === "string" && /^https?:\/\//.test(item)) {
        return item;
      }
    }
    for (const item of Object.values(record)) {
      const found = findOutputUrl(item);
      if (found) return found;
    }
  }
  return null;
}
