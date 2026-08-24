import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, reserveCredits, refundCredits } from "@/lib/credits/server";
import { processTextToImageJob } from "@/lib/tools/text-to-image-job";

export const runtime = "nodejs";
export const maxDuration = 60;

const REFERENCE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;
const ALLOWED_SIZES = ["1024x1024", "1536x1024", "1024x1536", "1536x864", "864x1536"] as const;
type ImageSize = (typeof ALLOWED_SIZES)[number];

type RequestInput = {
  prompt: string;
  styleNotes: string;
  quality: "preview" | "high";
  size: ImageSize;
  projectId: string | null;
  referenceImage: File | null;
};

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let jobId: string | null = null;
  let referencePath: string | null = null;
  let accepted = false;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const input = await readRequestInput(request);
    const { prompt, styleNotes, quality, size, projectId, referenceImage } = input;

    if (prompt.length < 8) {
      return NextResponse.json({ error: "Describe the image in more detail." }, { status: 400 });
    }

    if (referenceImage) {
      if (!REFERENCE_TYPES.includes(referenceImage.type)) {
        return NextResponse.json({ error: "Reference image must be PNG, JPEG or WebP." }, { status: 400 });
      }
      if (referenceImage.size > MAX_REFERENCE_BYTES) {
        return NextResponse.json({ error: "Reference image must be 4 MB or smaller." }, { status: 400 });
      }

      const extension = referenceImage.type === "image/png" ? "png" : referenceImage.type === "image/webp" ? "webp" : "jpg";
      referencePath = `${auth.user.id}/tools/text-to-image-references/${Date.now()}-${randomUUID()}.${extension}`;
      const { error: uploadError } = await auth.admin.storage
        .from("project-assets")
        .upload(referencePath, Buffer.from(await referenceImage.arrayBuffer()), {
          contentType: referenceImage.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw new Error(`Reference upload failed: ${uploadError.message}`);
    }

    const action = quality === "high" ? "textToImageHigh" : "textToImagePreview";
    const reservation = await reserveCredits({
      admin: auth.admin,
      userId: auth.user.id,
      action,
      metadata: {
        tool: "text_to_image",
        project_id: projectId,
        size,
        quality,
        reference_image: Boolean(referenceImage),
      },
    });
    reservationId = reservation.id;

    const referenceInstruction = referenceImage
      ? "\nA reference image is attached. Use it as a genuine visual reference for the subject, identity, composition, materials, colors, styling, or design language wherever relevant to the user's request. Follow the written prompt as the primary instruction. Do not add text, logos, or details from the reference unless the prompt asks for them."
      : "";
    const fullPrompt = `${prompt}\n\nArt direction and restrictions: ${styleNotes || "Use premium composition, coherent lighting, realistic material detail and no unnecessary readable text."}${referenceInstruction}\nNo watermark. Avoid fake logos and unreadable decorative paragraphs.`;
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

    const { data: job, error: jobError } = await auth.admin
      .from("generation_jobs")
      .insert({
        user_id: auth.user.id,
        project_id: projectId,
        tool: "text_to_image",
        provider: "openai",
        provider_job_id: null,
        credit_reservation_id: reservation.id,
        status: "queued",
        input: {
          prompt,
          fullPrompt,
          styleNotes,
          quality,
          size,
          projectId,
          model,
          credits: reservation.amount,
          referencePath,
          referenceName: referenceImage?.name || null,
          referenceType: referenceImage?.type || null,
        },
        output: {},
      })
      .select()
      .single();

    if (jobError || !job) throw new Error(jobError?.message || "Generation job could not be saved.");
    jobId = String(job.id);

    const origin = new URL(request.url).origin;
    const signature = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
      .update(`text-to-image:${jobId}`)
      .digest("hex");

    const backgroundResponse = await fetch(`${origin}/.netlify/functions/text-to-image-background`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Heyy-Job-Signature": signature,
      },
      body: JSON.stringify({ jobId }),
      cache: "no-store",
    }).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      // Plain `npm run dev` does not run Netlify Functions. Keep local testing
      // working by processing the same durable job inline.
      accepted = true;
      await processTextToImageJob(jobId);
    } else {
      throw new Error(
        `Background generation could not start (${backgroundResponse?.status || "unavailable"}).`,
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      status: "processing",
      creditsReserved: reservation.amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation could not start.";

    // A reference file is safe to remove when no durable job exists, or when
    // this request successfully changed its still-queued job to failed below.
    // If the worker already claimed the job, it may still need the reference.
    let failedBeforeStart = !jobId;
    if (!accepted && admin && jobId) {
      const { data: failedQueuedJob, error: cleanupError } = await admin
        .from("generation_jobs")
        .update({ status: "failed", error: "Image generation could not start. Your credits were returned.", completed_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (cleanupError) {
        console.error("Text-to-image start cleanup failed:", cleanupError.message);
      } else if (failedQueuedJob) {
        failedBeforeStart = true;
        if (reservationId) await refundCredits(admin, reservationId, message);
      } else {
        const { data: activeJob } = await admin
          .from("generation_jobs")
          .select("status")
          .eq("id", jobId)
          .maybeSingle();

        if (activeJob && ["processing", "succeeded"].includes(String(activeJob.status))) {
          return NextResponse.json({
            success: true,
            jobId,
            status: activeJob.status === "succeeded" ? "succeeded" : "processing",
          });
        }
      }
    } else if (!accepted && admin && reservationId) {
      failedBeforeStart = true;
      await refundCredits(admin, reservationId, message);
    }
    if (!accepted && admin && referencePath && failedBeforeStart) {
      await admin.storage.from("project-assets").remove([referencePath]);
    }

    console.error("Text-to-image start error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function readRequestInput(request: Request): Promise<RequestInput> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const rawSize = String(form.get("size") || "1024x1024");
    const referenceValue = form.get("referenceImage");

    return {
      prompt: String(form.get("prompt") || "").trim(),
      styleNotes: String(form.get("styleNotes") || "").trim(),
      quality: form.get("quality") === "high" ? "high" : "preview",
      size: isImageSize(rawSize) ? rawSize : "1024x1024",
      projectId: String(form.get("projectId") || "").trim() || null,
      referenceImage: referenceValue instanceof File && referenceValue.size > 0 ? referenceValue : null,
    };
  }

  const body = await request.json();
  const rawSize = String(body?.size || "1024x1024");
  return {
    prompt: String(body?.prompt || "").trim(),
    styleNotes: String(body?.styleNotes || "").trim(),
    quality: body?.quality === "high" ? "high" : "preview",
    size: isImageSize(rawSize) ? rawSize : "1024x1024",
    projectId: String(body?.projectId || "").trim() || null,
    referenceImage: null,
  };
}

function isImageSize(value: string): value is ImageSize {
  return (ALLOWED_SIZES as readonly string[]).includes(value);
}
