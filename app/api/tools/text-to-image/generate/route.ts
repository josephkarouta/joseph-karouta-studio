import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, withCreditReservation } from "@/lib/credits/server";
import { getOpenAI } from "@/lib/ai/openai-server";
import { storeGeneratedAsset } from "@/lib/assets-server";

export const runtime = "nodejs";
export const maxDuration = 180;

type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const prompt = String(body?.prompt || "").trim();
    const styleNotes = String(body?.styleNotes || "").trim();
    const quality = body?.quality === "high" ? "high" : "preview";
    const size: ImageSize = ["1024x1024","1536x1024","1024x1536"].includes(body?.size) ? body.size : "1024x1024";
    if (prompt.length < 8) return NextResponse.json({ error: "Describe the image in more detail." }, { status: 400 });
    const action = quality === "high" ? "textToImageHigh" : "textToImagePreview";
    const fullPrompt = `${prompt}\n\nArt direction and restrictions: ${styleNotes || "Use premium composition, coherent lighting, realistic material detail and no unnecessary readable text."}\nNo watermark. Avoid fake logos and unreadable decorative paragraphs.`;

    const { result, reservation } = await withCreditReservation({
      admin: auth.admin,
      userId: auth.user.id,
      action,
      metadata: { tool: "text_to_image", project_id: body?.projectId || null, size, quality },
      work: async (creditReservation) => {
        const response = await getOpenAI().images.generate({
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          prompt: fullPrompt,
          size,
          quality: quality === "high" ? "high" : "medium",
          output_format: "png",
        });
        const base64 = response.data?.[0]?.b64_json;
        if (!base64) throw new Error("The image provider returned no image.");
        const buffer = Buffer.from(base64, "base64");
        const asset = await storeGeneratedAsset({
          admin: auth.admin,
          userId: auth.user.id,
          projectId: body?.projectId || null,
          studio: "ai_tools",
          assetType: "generated_image",
          title: prompt.slice(0, 70),
          buffer,
          extension: "png",
          contentType: "image/png",
          payload: { prompt, styleNotes, size, quality },
          metadata: { model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", credit_reservation_id: creditReservation.id },
        });
        return { imageUrl: asset.file_url || `data:image/png;base64,${base64}`, asset };
      },
    });
    return NextResponse.json({ success: true, ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Text-to-image error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image generation failed." }, { status: 500 });
  }
}
