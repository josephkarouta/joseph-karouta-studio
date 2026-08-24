import "server-only";
import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError } from "@/lib/credits/server";
import { processTextToImageJob } from "@/lib/tools/text-to-image-job";
import {
  cleanupGenerationStart,
  isActiveGenerationStatus,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";

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
  let jobId: string | null = null;
  let startedJob: GenerationJobStart | null = null;
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

    let referenceBuffer: Buffer | null = null;
    let referenceHash: string | null = null;
    if (referenceImage) {
      if (!REFERENCE_TYPES.includes(referenceImage.type)) {
        return NextResponse.json({ error: "Reference image must be PNG, JPEG or WebP." }, { status: 400 });
      }
      if (referenceImage.size > MAX_REFERENCE_BYTES) {
        return NextResponse.json({ error: "Reference image must be 4 MB or smaller." }, { status: 400 });
      }

      const extension = referenceImage.type === "image/png" ? "png" : referenceImage.type === "image/webp" ? "webp" : "jpg";
      referenceBuffer = Buffer.from(await referenceImage.arrayBuffer());
      referenceHash = createHash("sha256")
        .update(referenceBuffer)
        .update(JSON.stringify({ prompt, styleNotes, quality, size, projectId }))
        .digest("hex");
      referencePath = `${auth.user.id}/tools/text-to-image-references/${referenceHash}.${extension}`;
    }

    const action = quality === "high" ? "textToImageHigh" : "textToImagePreview";
    const referenceInstruction = referenceImage
      ? "\nA reference image is attached. Use it as a genuine visual reference for the subject, identity, composition, materials, colors, styling, or design language wherever relevant to the user's request. Follow the written prompt as the primary instruction. Do not add text, logos, or details from the reference unless the prompt asks for them."
      : "";
    const fullPrompt = `${prompt}\n\nArt direction and restrictions: ${styleNotes || "Use premium composition, coherent lighting, realistic material detail and no unnecessary readable text."}${referenceInstruction}\nNo watermark. Avoid fake logos and unreadable decorative paragraphs.`;
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

    startedJob = await startGenerationJob({
      admin: auth.admin,
      userId: auth.user.id,
      request,
      scope: "text-to-image",
      dedupe: { prompt, styleNotes, quality, size, projectId, referenceHash },
      action,
      projectId,
      tool: "text_to_image",
      provider: "openai",
      input: {
        prompt,
        fullPrompt,
        styleNotes,
        quality,
        size,
        projectId,
        model,
        referencePath,
        referenceName: referenceImage?.name || null,
        referenceType: referenceImage?.type || null,
      },
      metadata: {
        tool: "text_to_image",
        project_id: projectId,
        size,
        quality,
        reference_image: Boolean(referenceImage),
      },
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

    if (referencePath && referenceImage && referenceBuffer) {
      const { error: uploadError } = await auth.admin.storage
        .from("project-assets")
        .upload(referencePath, referenceBuffer, {
          contentType: referenceImage.type,
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) throw new Error(`Reference upload failed: ${uploadError.message}`);
    }

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
      creditsReserved: startedJob.creditsReserved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation could not start.";

    if (!accepted && admin && startedJob) {
      const status = await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Image generation could not start. Your credits were returned.",
      });
      if (startedJob.created && status === "failed" && referencePath) {
        await admin.storage.from("project-assets").remove([referencePath]);
      }
      if (!startedJob.created || isActiveGenerationStatus(status) || status === "succeeded") {
        return NextResponse.json({
          success: true,
          jobId: startedJob.jobId,
          status: status === "finalizing" || status === "queued" ? "processing" : status,
          creditsReserved: startedJob.creditsReserved,
        });
      }
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
