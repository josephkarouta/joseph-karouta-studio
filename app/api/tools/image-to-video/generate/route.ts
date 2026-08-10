import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, reserveCredits, refundCredits } from "@/lib/credits/server";

export const runtime = "nodejs";
export const maxDuration = 180;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

type VideoMode = "preview" | "high";
type AspectRatio = "16:9" | "9:16";

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;

    const body = await request.json();
    const imageBase64 = String(body?.imageBase64 || "").trim();
    const mimeType = ["image/png", "image/jpeg", "image/webp"].includes(body?.mimeType)
      ? body.mimeType
      : "image/jpeg";
    const prompt = String(body?.prompt || "").trim();
    const mode: VideoMode = body?.mode === "high" ? "high" : "preview";
    const aspect: AspectRatio = body?.aspect === "9:16" ? "9:16" : "16:9";
    const projectId = String(body?.projectId || "").trim() || null;

    if (!imageBase64 || !prompt) {
      return NextResponse.json({ error: "Image and motion direction are required." }, { status: 400 });
    }
    if (prompt.length < 8) {
      return NextResponse.json({ error: "Describe the motion, camera and timing in more detail." }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 503 });
    }

    const imageBytes = Buffer.from(imageBase64, "base64");
    if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "The source image must be 20 MB or smaller." }, { status: 400 });
    }

    const reservation = await reserveCredits({
      admin,
      userId: auth.user.id,
      action: mode === "high" ? "imageToVideoHigh" : "imageToVideoPreview",
      metadata: { tool: "image_to_video", mode, aspect, project_id: projectId },
    });
    reservationId = reservation.id;

    const started = mode === "high"
      ? await startVeoVideo({ imageBase64, mimeType, prompt, aspect })
      : await startOmniVideo({ imageBase64, mimeType, prompt, aspect });

    const { data: job, error: jobError } = await admin
      .from("generation_jobs")
      .insert({
        user_id: auth.user.id,
        project_id: projectId,
        tool: "image_to_video",
        provider: started.provider,
        provider_job_id: started.providerJobId,
        credit_reservation_id: reservation.id,
        status: "processing",
        input: {
          prompt,
          aspect,
          mode,
          mimeType,
          projectId,
          model: started.model,
          resolution: started.resolution,
          duration_seconds: started.durationSeconds,
        },
        output: started.output,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message || "The generation job could not be saved.");
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "processing",
      engine: started.model,
      resolution: started.resolution,
      creditsReserved: reservation.amount,
    });
  } catch (error) {
    if (reservationId && admin) {
      await refundCredits(admin, reservationId, error instanceof Error ? error.message : "Video start failed");
    }
    console.error("Image-to-video start error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CreditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video generation could not start." },
      { status: 500 },
    );
  }
}

async function startOmniVideo({
  imageBase64,
  mimeType,
  prompt,
  aspect,
}: {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  aspect: AspectRatio;
}) {
  const model = process.env.GEMINI_VIDEO_PREVIEW_MODEL || "gemini-omni-flash-preview";
  const providerResponse = await fetch(`${GEMINI_BASE}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      model,
      input: [
        { type: "image", data: imageBase64, mime_type: mimeType },
        {
          type: "text",
          text: `${prompt}\n\nCreate a concise, coherent motion preview. Preserve subject identity, geometry, product design, logos and scene structure. Use natural camera and environmental motion.`,
        },
      ],
      response_format: { type: "video", delivery: "uri", aspect_ratio: aspect },
      generation_config: { video_config: { task: "image_to_video" } },
    }),
  });

  const providerData = await readJson(providerResponse);
  if (!providerResponse.ok) {
    throw new Error(providerData?.error?.message || "Gemini Omni could not start video generation.");
  }

  const videoUri = String(providerData?.output_video?.uri || findVideoUri(providerData) || "");
  const fileId = extractFileId(videoUri);
  if (!videoUri || !fileId) {
    throw new Error("Gemini Omni returned no processable video file URI.");
  }

  return {
    provider: "google_gemini_omni",
    providerJobId: fileId,
    model,
    resolution: "720p",
    durationSeconds: null,
    output: { video_uri: videoUri, interaction_id: providerData?.id || null, model },
  };
}

async function startVeoVideo({
  imageBase64,
  mimeType,
  prompt,
  aspect,
}: {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  aspect: AspectRatio;
}) {
  const model = process.env.GEMINI_VIDEO_HIGH_MODEL || "veo-3.1-generate-preview";
  const providerResponse = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:predictLongRunning`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      instances: [
        {
          prompt: `${prompt}\n\nProfessional cinematic render. Preserve the supplied image as the opening frame and keep identity, architecture, products, typography and key geometry stable. Prioritize believable physics, polished camera motion, natural environmental movement and coherent detail.`,
          image: { inlineData: { mimeType, data: imageBase64 } },
        },
      ],
      parameters: {
        numberOfVideos: 1,
        aspectRatio: aspect,
        durationSeconds: "8",
        resolution: "1080p",
      },
    }),
  });

  const providerData = await readJson(providerResponse);
  if (!providerResponse.ok) {
    throw new Error(providerData?.error?.message || "Veo 3.1 could not start video generation.");
  }

  const operationName = String(providerData?.name || "").trim();
  if (!operationName) throw new Error("Veo 3.1 returned no operation ID.");

  return {
    provider: "google_veo_3_1",
    providerJobId: operationName,
    model,
    resolution: "1080p",
    durationSeconds: 8,
    output: { operation_name: operationName, model },
  };
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

function extractFileId(uri: string) {
  const match = uri.match(/(?:^|\/)files\/([^/:?]+)/);
  return match?.[1] || "";
}

function findVideoUri(value: unknown): string | null {
  if (!value) return null;
  if (
    typeof value === "string" &&
    ((/^https?:\/\//.test(value) && /video|files|download|googleapis/i.test(value)) || /(?:^|\/)files\//.test(value))
  ) return value;
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
