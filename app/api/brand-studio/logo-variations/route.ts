import "server-only";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { toFile } from "openai";
import { getOpenAI } from "@/lib/ai/openai-server";
import { requireBrandImageProject, storeGeneratedBrandImage } from "@/lib/brand/generated-image-storage";
import { CreditError, withCreditReservation } from "@/lib/credits/server";

export const runtime = "nodejs";
export const maxDuration = 180;

async function loadReference(url?: string | null) {
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const type = response.headers.get("content-type") || "image/webp";
  return toFile(Buffer.from(await response.arrayBuffer()), "selected-logo", { type });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const selectedLogo = body?.selectedLogo || {};
    if (!project?.id) return NextResponse.json({ error: "A Brand project ID is required." }, { status: 400 });

    const storageContext = await requireBrandImageProject(project.id);
    const { result, reservation } = await withCreditReservation({
      admin: storageContext.admin,
      userId: storageContext.userId,
      action: "brandVariation",
      metadata: { project_id: storageContext.projectId, studio: "brand_studio", tool: "logo_variation" },
      work: async () => {
        const reference = await loadReference(selectedLogo?.imageUrl);
        if (!reference) throw new Error("Selected logo image is unavailable.");
        const openai = getOpenAI();
        const generated = await openai.images.edit({
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          image: [reference],
          prompt: `Refine the supplied logo concept while preserving the same core idea and recognizable visual family. Improve proportion, balance, negative space, simplicity, scalability and presentation cleanliness. Do not redesign it into a different symbol. Do not add mockups, packaging, devices or environmental scenes. Do not imitate existing brands or add watermarks. Brand context: ${JSON.stringify(body?.brand?.foundation || {})}. Logo direction: ${JSON.stringify(body?.logoDirection || {})}. The result is a concept preview; expert vector construction is still required.`,
          size: "1024x1024",
          quality: "medium",
          output_format: "png",
        });
        const base64 = generated.data?.[0]?.b64_json;
        if (!base64) throw new Error("OpenAI returned no logo variation image data.");
        const webp = await sharp(Buffer.from(base64, "base64")).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
        const stored = await storeGeneratedBrandImage(storageContext, { buffer: webp, kind: `logo-variation-${body?.logoDirection?.title || "direction"}`, tier: "variation" });
        return { variations: [{ ...stored }], usage: generated.usage || null };
      },
    });
    return NextResponse.json({ ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Logo variation error:", error);
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate the logo variation." }, { status: 500 });
  }
}
