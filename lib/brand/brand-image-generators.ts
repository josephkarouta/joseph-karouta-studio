import sharp from "sharp";
import OpenAI, { toFile } from "openai";
import {
  storeGeneratedBrandImage,
  type BrandImageStorageContext,
} from "./brand-image-storage";


let openaiClient: OpenAI | null = null;

function getBackgroundOpenAI() {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing from the server environment.");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

type ImageTier = "preview" | "final";

function imageQuality(tier: ImageTier) {
  const configured = tier === "final"
    ? process.env.OPENAI_FINAL_IMAGE_QUALITY
    : process.env.OPENAI_PREVIEW_IMAGE_QUALITY;
  return configured === "low" || configured === "medium" || configured === "high"
    ? configured
    : tier === "final"
      ? "high"
      : "medium";
}

async function loadReference(url?: string | null, filename = "brand-reference") {
  if (!url) return null;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const type = response.headers.get("content-type") || "image/webp";
  return toFile(Buffer.from(await response.arrayBuffer()), filename, { type });
}

export async function generateBrandLogo(
  storageContext: BrandImageStorageContext,
  body: any,
) {
  const project = body?.project || {};
  const brand = body?.brand || {};
  const logoDirection = body?.logoDirection || {};
  const tier: ImageTier = body?.tier === "final" ? "final" : "preview";
  const journey = brand?.projectJourney || {};

  if (!project?.id || !project?.project_name || !logoDirection?.title) {
    throw new Error("Project, project ID and logo direction are required.");
  }

  const existingLogoUrl = body?.existingLogoUrl || journey?.existingLogoUrl || null;
  const reference = journey?.logoAction === "refine"
    ? await loadReference(existingLogoUrl, "existing-logo-reference")
    : null;
  const openai = getBackgroundOpenAI();
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
    ? await openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        image: [reference],
        prompt,
        size: "1024x1024",
        quality: imageQuality(tier),
        output_format: "png",
      })
    : await openai.images.generate({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt,
        size: "1024x1024",
        quality: imageQuality(tier),
        output_format: "png",
      });

  const base64 = generated.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no logo image data.");
  const webp = await sharp(Buffer.from(base64, "base64"))
    .resize({ width: tier === "final" ? 1400 : 900, withoutEnlargement: true })
    .webp({ quality: tier === "final" ? 90 : 76, effort: 5 })
    .toBuffer();
  const stored = await storeGeneratedBrandImage(storageContext, {
    buffer: webp,
    kind: `logo-${logoDirection.title}`,
    tier,
  });

  return {
    logos: [{ ...stored, title: logoDirection.title, tier }],
    usage: generated.usage || null,
  };
}

export async function generateBrandLogoVariation(
  storageContext: BrandImageStorageContext,
  body: any,
) {
  const project = body?.project || {};
  const brand = body?.brand || {};
  const selectedLogo = body?.selectedLogo || {};
  if (!project?.id) throw new Error("A Brand project ID is required.");

  const reference = await loadReference(selectedLogo?.imageUrl, "selected-logo");
  if (!reference) throw new Error("Selected logo image is unavailable.");
  const openai = getBackgroundOpenAI();
  const generated = await openai.images.edit({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    image: [reference],
    prompt: `Refine the supplied logo concept while preserving the same core idea and recognizable visual family. Improve proportion, balance, negative space, simplicity, scalability and presentation cleanliness. Do not redesign it into a different symbol. Do not add mockups, packaging, devices or environmental scenes. Do not imitate existing brands or add watermarks. Brand context: ${JSON.stringify(brand?.foundation || {})}. Logo direction: ${JSON.stringify(body?.logoDirection || {})}. The result is a concept preview; expert vector construction is still required.`,
    size: "1024x1024",
    quality: "medium",
    output_format: "png",
  });
  const base64 = generated.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no logo variation image data.");
  const webp = await sharp(Buffer.from(base64, "base64"))
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 76, effort: 5 })
    .toBuffer();
  const stored = await storeGeneratedBrandImage(storageContext, {
    buffer: webp,
    kind: `logo-variation-${body?.logoDirection?.title || "direction"}`,
    tier: "variation",
  });
  return { variations: [{ ...stored }], usage: generated.usage || null };
}

export async function generateBrandMoodboard(
  storageContext: BrandImageStorageContext,
  body: any,
) {
  const project = body?.project || {};
  const brand = body?.brand || {};
  const direction = body?.direction || {};
  const tier: ImageTier = body?.tier === "final" ? "final" : "preview";
  if (!project?.id || !project?.project_name || !direction?.title) {
    throw new Error("Project, project ID and creative direction are required.");
  }

  const openai = getBackgroundOpenAI();
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
  const generated = await openai.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    prompt,
    size: "1024x1024",
    quality: imageQuality(tier),
    output_format: "png",
  });
  const base64 = generated.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no creative-direction image data.");
  const webp = await sharp(Buffer.from(base64, "base64"))
    .resize({ width: tier === "final" ? 1400 : 900, withoutEnlargement: true })
    .webp({ quality: tier === "final" ? 88 : 74, effort: 5 })
    .toBuffer();
  const stored = await storeGeneratedBrandImage(storageContext, {
    buffer: webp,
    kind: `creative-direction-${direction.title}`,
    tier,
  });
  return {
    ...stored,
    tier,
    quality: imageQuality(tier),
    usage: generated.usage || null,
  };
}

export async function generateBrandMoodboardVariation(
  storageContext: BrandImageStorageContext,
  body: any,
) {
  const project = body?.project || {};
  const brand = body?.brand || {};
  const direction = body?.direction || {};
  if (!project?.id) throw new Error("A Brand project ID is required.");

  const currentImageUrl = body?.currentImageUrl || direction?.imageUrl || null;
  const reference = await loadReference(currentImageUrl, "direction-reference");
  const openai = getBackgroundOpenAI();
  const prompt = `Create one refined variation of the supplied brand creative-direction board. Preserve the same central concept, strategic role, visual family, color hierarchy and art direction. Improve the composition, curation and premium presentation without changing into a different direction. No logo, fake brand name, long readable text, watermarks or unrelated visual styles. Brand: ${project.project_name || "Brand Project"}. Direction: ${JSON.stringify(direction)}. Brand foundation: ${JSON.stringify(brand?.foundation || {})}`;
  const generated = reference
    ? await openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        image: [reference],
        prompt,
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
      })
    : await openai.images.generate({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt,
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
      });
  const base64 = generated.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no direction variation image.");
  const webp = await sharp(Buffer.from(base64, "base64"))
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 74, effort: 5 })
    .toBuffer();
  const stored = await storeGeneratedBrandImage(storageContext, {
    buffer: webp,
    kind: `creative-direction-variation-${direction?.title || "direction"}`,
    tier: "variation",
  });
  return { variations: [{ ...stored }], usage: generated.usage || null };
}
