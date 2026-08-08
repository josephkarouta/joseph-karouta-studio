import "server-only";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { toFile } from "openai";
import { getOpenAI } from "@/lib/ai/openai-server";
import { requireBrandImageProject, storeGeneratedBrandImage } from "@/lib/brand/generated-image-storage";
import { CreditError, withCreditReservation } from "@/lib/credits/server";

export const runtime = "nodejs";
export const maxDuration = 180;

async function fetchImage(url?: string | null) {
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "image/webp";
  return toFile(Buffer.from(await response.arrayBuffer()), "direction-reference", { type: contentType });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const brand = body?.brand || {};
    const direction = body?.direction || {};
    if (!project?.id) return NextResponse.json({ error: "A Brand project ID is required." }, { status: 400 });

    const storageContext = await requireBrandImageProject(project.id);
    const { result, reservation } = await withCreditReservation({
      admin: storageContext.admin,
      userId: storageContext.userId,
      action: "brandVariation",
      metadata: { project_id: storageContext.projectId, studio: "brand_studio", tool: "moodboard_variation" },
      work: async () => {
        const currentImageUrl = body?.currentImageUrl || direction?.imageUrl || null;
        const reference = await fetchImage(currentImageUrl);
        const openai = getOpenAI();
        const prompt = `Create one refined variation of the supplied brand creative-direction board. Preserve the same central concept, strategic role, visual family, color hierarchy and art direction. Improve the composition, curation and premium presentation without changing into a different direction. No logo, fake brand name, long readable text, watermarks or unrelated visual styles. Brand: ${project.project_name || "Brand Project"}. Direction: ${JSON.stringify(direction)}. Brand foundation: ${JSON.stringify(brand?.foundation || {})}`;
        const generated = reference
          ? await openai.images.edit({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", image: [reference], prompt, size: "1024x1024", quality: "medium", output_format: "png" })
          : await openai.images.generate({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", prompt, size: "1024x1024", quality: "medium", output_format: "png" });
        const base64 = generated.data?.[0]?.b64_json;
        if (!base64) throw new Error("OpenAI returned no direction variation image.");
        const webp = await sharp(Buffer.from(base64, "base64")).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 74, effort: 5 }).toBuffer();
        const stored = await storeGeneratedBrandImage(storageContext, { buffer: webp, kind: `creative-direction-variation-${direction?.title || "direction"}`, tier: "variation" });
        return { variations: [{ ...stored }], usage: generated.usage || null };
      },
    });
    return NextResponse.json({ ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Creative-direction variation error:", error);
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate the direction variation." }, { status: 500 });
  }
}
