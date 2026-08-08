import "server-only";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { toFile } from "openai";
import { getOpenAI } from "@/lib/ai/openai-server";
import { requireBrandImageProject, storeGeneratedBrandImage } from "@/lib/brand/generated-image-storage";
import { CreditError, withCreditReservation } from "@/lib/credits/server";

export const runtime = "nodejs";
export const maxDuration = 180;
type ImageTier = "preview" | "final";

async function loadReference(url?: string | null) {
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const type = response.headers.get("content-type") || "image/png";
  return toFile(Buffer.from(await response.arrayBuffer()), "existing-logo-reference", { type });
}

function quality(tier: ImageTier) {
  const raw = tier === "final" ? process.env.OPENAI_FINAL_IMAGE_QUALITY : process.env.OPENAI_PREVIEW_IMAGE_QUALITY;
  return raw === "low" || raw === "medium" || raw === "high" ? raw : tier === "final" ? "high" : "medium";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const brand = body?.brand || {};
    const logoDirection = body?.logoDirection || {};
    const tier: ImageTier = body?.tier === "final" ? "final" : "preview";
    const journey = brand?.projectJourney || {};
    if (!project?.id || !project?.project_name || !logoDirection?.title) {
      return NextResponse.json({ error: "Project, project ID and logo direction are required." }, { status: 400 });
    }

    const storageContext = await requireBrandImageProject(project.id);
    const action = tier === "final" ? "brandProfessionalFinal" : "brandLogoConcept";
    const { result, reservation } = await withCreditReservation({
      admin: storageContext.admin,
      userId: storageContext.userId,
      action,
      metadata: { project_id: storageContext.projectId, studio: "brand_studio", tool: "logo", tier },
      work: async () => {
        const existingLogoUrl = body?.existingLogoUrl || journey?.existingLogoUrl || null;
        const reference = journey?.logoAction === "refine" ? await loadReference(existingLogoUrl) : null;
        const openai = getOpenAI();
        const prompt = `
Create one premium logo concept presentation for ${project.project_name}.
Project context: ${JSON.stringify({ industry: project.industry, audience: project.audience, style: project.style })}
Selected creative direction: ${JSON.stringify(body?.creativeDirection || {})}
Logo direction: ${JSON.stringify(logoDirection)}
Brand foundation: ${JSON.stringify(brand?.foundation || {})}
Project journey: ${JSON.stringify(journey)}

Requirements:
- Present one clear, simple and ownable logo concept centered on a clean neutral background.
- Use the recommended logo type, symbol logic, wordmark behavior and shape language.
- If an existing logo reference is supplied, preserve its recognizable equity and refine it rather than replacing it with an unrelated mark.
- Show a professional identity concept, not a wall, stationery, packaging or device mockup.
- Do not imitate existing logos or trademarked symbols.
- Avoid unreadable decorative text and fake paragraphs.
- The business name may appear only when the direction is a wordmark or combination mark; spell it exactly as: ${project.project_name}.
- No watermarks.
- Concept preview only; final vector construction and trademark review require expert production.
`;
        const generated = reference
          ? await openai.images.edit({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", image: [reference], prompt, size: "1024x1024", quality: quality(tier), output_format: "png" })
          : await openai.images.generate({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", prompt, size: "1024x1024", quality: quality(tier), output_format: "png" });
        const base64 = generated.data?.[0]?.b64_json;
        if (!base64) throw new Error("OpenAI returned no logo image data.");
        const webp = await sharp(Buffer.from(base64, "base64"))
          .resize({ width: tier === "final" ? 1400 : 900, withoutEnlargement: true })
          .webp({ quality: tier === "final" ? 90 : 76, effort: 5 })
          .toBuffer();
        const stored = await storeGeneratedBrandImage(storageContext, { buffer: webp, kind: `logo-${logoDirection.title}`, tier });
        return { logos: [{ ...stored, title: logoDirection.title, tier }], usage: generated.usage || null };
      },
    });
    return NextResponse.json({ ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Logo generation error:", error);
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate the logo concept." }, { status: 500 });
  }
}
