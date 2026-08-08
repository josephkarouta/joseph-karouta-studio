import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, reserveCredits, refundCredits } from "@/lib/credits/server";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;
  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const body = await request.json();
    const imageBase64 = String(body?.imageBase64 || "");
    const mimeType = ["image/png", "image/jpeg", "image/webp"].includes(body?.mimeType) ? body.mimeType : "image/jpeg";
    const prompt = String(body?.prompt || "").trim();
    const mode = body?.mode === "high" ? "high" : "preview";
    const aspect = ["16:9", "9:16"].includes(body?.aspect) ? body.aspect : "16:9";
    if (!imageBase64 || !prompt) return NextResponse.json({ error: "Image and motion direction are required." }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 503 });

    const reservation = await reserveCredits({
      admin,
      userId: auth.user.id,
      action: mode === "high" ? "imageToVideoHigh" : "imageToVideoPreview",
      metadata: { tool: "image_to_video", mode, aspect },
    });
    reservationId = reservation.id;

    const qualityInstruction = mode === "high"
      ? "Prioritize stable geometry, consistent subjects, natural motion and polished cinematic detail."
      : "Create a clean short concept preview with clear subject and camera motion.";
    const providerResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        model: process.env.GEMINI_VIDEO_MODEL || "gemini-omni-flash-preview",
        input: [
          { type: "image", data: imageBase64, mime_type: mimeType },
          { type: "text", text: `${prompt}\n\n${qualityInstruction}` },
        ],
        response_format: { type: "video", delivery: "uri", aspect_ratio: aspect },
        generation_config: { video_config: { task: "image_to_video" } },
      }),
    });
    const providerData = await providerResponse.json();
    if (!providerResponse.ok) throw new Error(providerData?.error?.message || "Gemini could not start the video generation.");

    const videoUri = String(providerData?.output_video?.uri || findVideoUri(providerData) || "");
    const fileId = extractFileId(videoUri);
    if (!videoUri || !fileId) throw new Error("Gemini returned no processable video file URI.");

    const { data: job, error: jobError } = await admin.from("generation_jobs").insert({
      user_id: auth.user.id,
      tool: "image_to_video",
      provider: "google_gemini_omni",
      provider_job_id: fileId,
      credit_reservation_id: reservation.id,
      status: "processing",
      input: { prompt, aspect, mode, mimeType },
      output: { video_uri: videoUri, interaction_id: providerData?.id || null },
    }).select().single();
    if (jobError || !job) throw new Error(jobError?.message || "The generation job could not be saved.");
    return NextResponse.json({ success: true, jobId: job.id, status: "processing", creditsReserved: reservation.amount });
  } catch (error) {
    if (reservationId && admin) await refundCredits(admin, reservationId, error instanceof Error ? error.message : "Video start failed");
    console.error("Image-to-video start error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video generation could not start." }, { status: 500 });
  }
}

function extractFileId(uri: string) {
  const match = uri.match(/\/files\/([^/:?]+)/);
  return match?.[1] || "";
}
function findVideoUri(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.includes("/files/")) return value;
  if (Array.isArray(value)) for (const item of value) { const found = findVideoUri(item); if (found) return found; }
  else if (typeof value === "object") for (const item of Object.values(value as Record<string, unknown>)) { const found = findVideoUri(item); if (found) return found; }
  return null;
}
