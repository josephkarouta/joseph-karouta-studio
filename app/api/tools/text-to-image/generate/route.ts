import "server-only";
import { NextResponse } from "next/server";
import { toFile } from "openai";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, withCreditReservation } from "@/lib/credits/server";
import { getOpenAI } from "@/lib/ai/openai-server";
import { storeGeneratedAsset } from "@/lib/assets-server";

export const runtime = "nodejs";
export const maxDuration = 180;

type ImageSize = "1024x1024" | "1536x1024" | "1024x1536" | "1792x1024" | "1024x1792";

type RequestInput = {
  prompt: string;
  styleNotes: string;
  quality: "preview" | "high";
  size: ImageSize;
  projectId: string | null;
  referenceImage: File | null;
};

const REFERENCE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_SIZES: ImageSize[] = ["1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"];

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
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
        return NextResponse.json({ error: "Reference image must be 10 MB or smaller." }, { status: 400 });
      }
    }

    const action = quality === "high" ? "textToImageHigh" : "textToImagePreview";
    const referenceInstruction = referenceImage
      ? "\nA reference image is attached. Use it as a genuine visual reference for the subject, identity, composition, materials, colors, styling, or design language wherever relevant to the user's request. Follow the written prompt as the primary instruction. Do not add text, logos, or details from the reference unless the prompt asks for them."
      : "";
    const fullPrompt = `${prompt}\n\nArt direction and restrictions: ${styleNotes || "Use premium composition, coherent lighting, realistic material detail and no unnecessary readable text."}${referenceInstruction}\nNo watermark. Avoid fake logos and unreadable decorative paragraphs.`;
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

    const { result, reservation } = await withCreditReservation({
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
      work: async (creditReservation) => {
        const client = getOpenAI();
        const response = referenceImage
          ? await client.images.edit({
              model,
              image: await toFile(
                Buffer.from(await referenceImage.arrayBuffer()),
                referenceImage.name || "reference-image",
                { type: referenceImage.type },
              ),
              prompt: fullPrompt,
              size,
              quality: quality === "high" ? "high" : "medium",
              output_format: "png",
            })
          : await client.images.generate({
              model,
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
          projectId,
          studio: "ai_tools",
          assetType: "generated_image",
          title: prompt.slice(0, 70),
          buffer,
          extension: "png",
          contentType: "image/png",
          payload: {
            prompt,
            styleNotes,
            size,
            quality,
            referenceImage: referenceImage
              ? { name: referenceImage.name, type: referenceImage.type, size: referenceImage.size }
              : null,
          },
          metadata: {
            model,
            credit_reservation_id: creditReservation.id,
            reference_image: Boolean(referenceImage),
          },
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

async function readRequestInput(request: Request): Promise<RequestInput> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const quality: "preview" | "high" = form.get("quality") === "high" ? "high" : "preview";
    const rawSize = String(form.get("size") || "1024x1024");
    const size: ImageSize = ALLOWED_SIZES.includes(rawSize as ImageSize)
      ? (rawSize as ImageSize)
      : "1024x1024";
    const referenceValue = form.get("referenceImage");

    return {
      prompt: String(form.get("prompt") || "").trim(),
      styleNotes: String(form.get("styleNotes") || "").trim(),
      quality,
      size,
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
    size: ALLOWED_SIZES.includes(rawSize as ImageSize) ? (rawSize as ImageSize) : "1024x1024",
    projectId: String(body?.projectId || "").trim() || null,
    referenceImage: null,
  };
}
