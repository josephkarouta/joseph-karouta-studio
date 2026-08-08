import "server-only";
import { NextResponse } from "next/server";
import { toFile } from "openai";
import sharp from "sharp";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, withCreditReservation } from "@/lib/credits/server";
import { CREDIT_COSTS } from "@/lib/credits/config";
import { getOpenAI } from "@/lib/ai/openai-server";
import { storeGeneratedAsset } from "@/lib/assets-server";
import {
  ADAPTATION_FAMILY_LABELS,
  type AdaptationFamily,
  type DigitalAdaptationFormat,
  uniqueFamilies,
  validateAdaptationFormat,
} from "@/lib/tools/digital-adaptations";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_FORMATS = 24;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function openAIOutputSize(family: AdaptationFamily): "1024x1024" | "1024x1536" | "1536x1024" {
  if (family === "square") return "1024x1024";
  if (family === "portrait" || family === "story") return "1024x1536";
  return "1536x1024";
}

function cleanFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "digital-adaptation";
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function normalizeSource(buffer: Buffer) {
  const image = sharp(buffer, { failOn: "error" }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("The uploaded file is not a valid image.");
  if (metadata.width < 400 || metadata.height < 400) {
    throw new Error("Upload a key visual that is at least 400 × 400 pixels.");
  }
  return image.png().toBuffer();
}

async function createAiFamilyMaster(source: Buffer, family: AdaptationFamily, notes: string) {
  const prompt = `
Adapt the supplied finished key visual into a ${ADAPTATION_FAMILY_LABELS[family]} for a professional digital campaign.

Non-negotiable rules:
- Preserve the existing brand identity, logo, colours, typography, product/person likeness and visual style.
- Preserve all existing wording exactly. Do not rewrite, paraphrase, invent or add text.
- Recompose and extend the environment/background where needed instead of simply stretching the design.
- Keep the logo, headline, call-to-action and mandatory elements inside generous safe areas.
- Maintain clear hierarchy and production-quality spacing.
- Do not add mockup devices, watermarks, borders, extra logos or decorative copy.
- Return a clean flat artwork adaptation, not a presentation mockup.

Additional art-direction notes: ${notes || "Keep the original campaign intent and make the adaptation feel designed for the new aspect ratio."}
`.trim();

  const response = await getOpenAI().images.edit({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    image: await toFile(source, "main-key-visual.png", { type: "image/png" }),
    prompt,
    size: openAIOutputSize(family),
    quality: "medium",
    output_format: "png",
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error(`The image provider returned no ${family} adaptation.`);
  return Buffer.from(base64, "base64");
}

async function resizeAiMaster(master: Buffer, format: DigitalAdaptationFormat) {
  return sharp(master)
    .resize(format.width, format.height, { fit: "cover", position: "attention" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const form = await request.formData();
    const sourceFile = form.get("source");
    const notes = String(form.get("notes") || "").trim().slice(0, 1200);
    const projectId = String(form.get("projectId") || "").trim() || null;
    const projectName = String(form.get("projectName") || "Digital campaign").trim().slice(0, 100);

    if (!(sourceFile instanceof File)) {
      return NextResponse.json({ error: "Upload the main key visual first." }, { status: 400 });
    }
    if (!ACCEPTED_TYPES.has(sourceFile.type)) {
      return NextResponse.json({ error: "Use a PNG, JPG or WebP key visual." }, { status: 400 });
    }
    if (sourceFile.size <= 0 || sourceFile.size > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "The key visual must be smaller than 20 MB." }, { status: 400 });
    }

    let rawFormats: unknown[] = [];
    try {
      const parsedFormats = JSON.parse(String(form.get("formats") || "[]"));
      rawFormats = Array.isArray(parsedFormats) ? parsedFormats : [];
    } catch {
      return NextResponse.json({ error: "The selected format list is invalid." }, { status: 400 });
    }

    const formats = rawFormats
      .map(validateAdaptationFormat)
      .filter((item): item is DigitalAdaptationFormat => Boolean(item))
      .slice(0, MAX_FORMATS);

    if (!formats.length) {
      return NextResponse.json({ error: "Select at least one digital size." }, { status: 400 });
    }

    const source = await normalizeSource(Buffer.from(await sourceFile.arrayBuffer()));
    const families = uniqueFamilies(formats);
    const creditAmount = families.length * CREDIT_COSTS.digitalAdaptationFamily;

    const metadata = {
      tool: "digital_adaptations",
      adaptation_method: "ai_recompose",
      project_id: projectId,
      format_count: formats.length,
      aspect_families: families,
    };

    const { result, reservation } = await withCreditReservation({
      admin: auth.admin,
      userId: auth.user.id,
      action: "digitalAdaptationFamily",
      amountOverride: creditAmount,
      metadata,
      work: async (creditReservation) => {
        const masters = new Map<AdaptationFamily, Buffer>();
        const generatedMasters = await mapWithConcurrency(families, 2, async (family) => ({
          family,
          buffer: await createAiFamilyMaster(source, family, notes),
        }));
        generatedMasters.forEach(({ family, buffer }) => masters.set(family, buffer));

        const outputs = await mapWithConcurrency(formats, 3, async (format) => {
          const outputBuffer = await resizeAiMaster(masters.get(format.family)!, format);

          const title = `${projectName} · ${format.label}`;
          const asset = await storeGeneratedAsset({
            admin: auth.admin,
            userId: auth.user.id,
            projectId,
            studio: "ai_tools",
            assetType: "digital_adaptation",
            title,
            buffer: outputBuffer,
            extension: "png",
            contentType: "image/png",
            payload: {
              adaptation_method: "ai_recompose",
              format,
              notes,
              source_name: sourceFile.name,
            },
            metadata: {
              tool: "digital_adaptations",
              family: format.family,
              width: format.width,
              height: format.height,
              credit_reservation_id: creditReservation.id,
              model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
            },
          });

          return {
            id: format.id,
            label: format.label,
            platform: format.platform,
            width: format.width,
            height: format.height,
            family: format.family,
            fileName: `${cleanFileName(projectName)}-${cleanFileName(format.label)}-${format.width}x${format.height}.png`,
            imageUrl: asset.file_url,
            asset,
          };
        });

        return { outputs, families };
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
      creditsUsed: reservation.amount,
      reviewNote: "AI recomposition can affect small typography, logos or mandatory elements. Review every output before publishing.",
    });
  } catch (error) {
    console.error("Digital adaptations error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Digital adaptations failed." }, { status: 500 });
  }
}
