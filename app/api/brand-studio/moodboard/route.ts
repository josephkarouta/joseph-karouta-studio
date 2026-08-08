import "server-only";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { getOpenAI } from "@/lib/ai/openai-server";
import { requireBrandImageProject, storeGeneratedBrandImage } from "@/lib/brand/generated-image-storage";
import { CreditError, withCreditReservation } from "@/lib/credits/server";

export const runtime = "nodejs";
export const maxDuration = 180;
type ImageTier = "preview" | "final";

function imageQuality(tier: ImageTier) {
  const configured = tier === "final" ? process.env.OPENAI_FINAL_IMAGE_QUALITY : process.env.OPENAI_PREVIEW_IMAGE_QUALITY;
  return configured === "low" || configured === "high" || configured === "medium" ? configured : tier === "final" ? "high" : "medium";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const brand = body?.brand || {};
    const direction = body?.direction || {};
    const tier: ImageTier = body?.tier === "final" ? "final" : "preview";
    if (!project?.id || !project?.project_name || !direction?.title) {
      return NextResponse.json({ error: "Project, project ID and creative direction are required." }, { status: 400 });
    }

    const storageContext = await requireBrandImageProject(project.id);
    const action = tier === "final" ? "brandProfessionalFinal" : "brandMoodboard";
    const { result, reservation } = await withCreditReservation({
      admin: storageContext.admin,
      userId: storageContext.userId,
      action,
      metadata: { project_id: storageContext.projectId, studio: "brand_studio", tool: "moodboard", tier },
      work: async () => {
        const openai = getOpenAI();
        const prompt = `
Create one premium square creative-direction board for a real brand-design presentation.
Brand: ${project.project_name}
Industry: ${project.industry || "Not provided"}
Audience: ${project.audience || "Not provided"}
Preferred style: ${project.style || "Not provided"}
Selected project journey: ${JSON.stringify(brand?.projectJourney || {})}
Creative direction: ${JSON.stringify(direction)}
Brand foundation: ${JSON.stringify(brand?.foundation || {})}

The board must visually communicate the selected direction through one coherent hero imagery style, curated image fragments, relevant tactile materials, color behavior, graphic devices, atmosphere and a premium agency composition.
Do not create a logo, fake brand name, long readable paragraphs, generic UI dashboards, unrelated styles, copied identities or watermarks.
The result is a concept preview, not production-ready artwork.
Direction-specific image prompt: ${direction.imagePrompt || direction.visualWorld || direction.conceptIdea}
`;
        const generated = await openai.images.generate({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", prompt, size: "1024x1024", quality: imageQuality(tier), output_format: "png" });
        const base64 = generated.data?.[0]?.b64_json;
        if (!base64) throw new Error("OpenAI returned no creative-direction image data.");
        const webp = await sharp(Buffer.from(base64, "base64"))
          .resize({ width: tier === "final" ? 1400 : 900, withoutEnlargement: true })
          .webp({ quality: tier === "final" ? 88 : 74, effort: 5 })
          .toBuffer();
        const stored = await storeGeneratedBrandImage(storageContext, { buffer: webp, kind: `creative-direction-${direction.title}`, tier });
        return { ...stored, tier, quality: imageQuality(tier), usage: generated.usage || null };
      },
    });
    return NextResponse.json({ ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Creative-direction image error:", error);
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate the creative-direction image." }, { status: 500 });
  }
}
