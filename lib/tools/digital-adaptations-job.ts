import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toFile } from "openai";
import sharp from "sharp";
import { getOpenAI } from "@/lib/ai/openai-server";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";
import { storeGeneratedAsset } from "@/lib/assets-server";
import {
  ADAPTATION_FAMILY_LABELS,
  type AdaptationFamily,
  type DigitalAdaptationFormat,
} from "@/lib/tools/digital-adaptations";

const SOURCE_BUCKET = "project-assets";

type DigitalAdaptationJobInput = {
  sourcePath?: string;
  sourceName?: string;
  notes?: string;
  projectId?: string | null;
  projectName?: string;
  formats?: DigitalAdaptationFormat[];
  families?: AdaptationFamily[];
  model?: string;
  credits?: number;
};

type StoredOutput = {
  id: string;
  storagePath: string | null;
};

export async function normalizeDigitalAdaptationSource(buffer: Buffer) {
  const image = sharp(buffer, { failOn: "error" }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("The uploaded file is not a valid image.");
  if (metadata.width < 400 || metadata.height < 400) {
    throw new Error("Upload a key visual that is at least 400 × 400 pixels.");
  }
  return image.png().toBuffer();
}

export async function processDigitalAdaptationsJob(jobId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !process.env.OPENAI_API_KEY) {
    throw new Error("Digital adaptations background generation is not configured.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing, error: jobError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tool", "digital_adaptations")
    .maybeSingle();

  if (jobError) throw new Error(jobError.message || "Digital adaptations job could not be loaded.");
  if (!existing) throw new Error("Digital adaptations job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existing.status || ""))) return;
  if (String(existing.status || "") !== "queued") return;

  const { data: claimed, error: claimError } = await admin
    .from("generation_jobs")
    .update({ status: "processing", error: null })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message || "Digital adaptations job could not be started.");
  if (!claimed) return;

  const input = (claimed.input || {}) as DigitalAdaptationJobInput;
  const sourcePath = cleanString(input.sourcePath);
  const formats = Array.isArray(input.formats) ? input.formats : [];
  const families = Array.isArray(input.families) ? input.families : [];
  const notes = cleanString(input.notes).slice(0, 1200);
  const projectName = cleanString(input.projectName).slice(0, 100) || "Digital campaign";
  const model = cleanString(input.model) || process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const stored: StoredOutput[] = [];
  let resultPersisted = false;

  try {
    if (!sourcePath || !formats.length || !families.length) {
      throw new Error("Digital adaptations job input is incomplete.");
    }

    const { data: sourceBlob, error: sourceError } = await admin.storage
      .from(SOURCE_BUCKET)
      .download(sourcePath);
    if (sourceError || !sourceBlob) {
      throw new Error(sourceError?.message || "The source artwork could not be loaded.");
    }
    const source = Buffer.from(await sourceBlob.arrayBuffer());

    const generatedMasters = await mapWithConcurrency(families, 2, async (family) => ({
      family,
      buffer: await createAiFamilyMaster(source, family, notes, model),
    }));
    const masters = new Map(generatedMasters.map(({ family, buffer }) => [family, buffer]));

    const outputs = await mapWithConcurrency(formats, 3, async (format) => {
      const master = masters.get(format.family);
      if (!master) throw new Error(`The ${format.family} adaptation was not generated.`);
      const outputBuffer = await sharp(master)
        .resize(format.width, format.height, { fit: "cover", position: "attention" })
        .png({ compressionLevel: 9 })
        .toBuffer();

      const title = `${projectName} · ${format.label}`;
      const asset = await storeGeneratedAsset({
        admin,
        userId: String(claimed.user_id),
        projectId: claimed.project_id ? String(claimed.project_id) : input.projectId || null,
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
          source_name: cleanString(input.sourceName) || "main-key-visual.png",
        },
        metadata: {
          tool: "digital_adaptations",
          family: format.family,
          width: format.width,
          height: format.height,
          credit_reservation_id: claimed.credit_reservation_id,
          model,
        },
      });
      stored.push({
        id: String(asset.id),
        storagePath: typeof asset.metadata?.storage_path === "string" ? asset.metadata.storage_path : null,
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

    const response = {
      outputs,
      families,
      reviewNote: "AI recomposition can affect small typography, logos or mandatory elements. Review every output before publishing.",
    };
    const durableOutput = {
      result_persisted: true,
      response,
      credits_used: Number(input.credits || 0),
    };
    const { data: finalizing, error: outputError } = await admin
      .from("generation_jobs")
      .update({ status: "finalizing", error: null, output: durableOutput })
      .eq("id", jobId)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();
    if (outputError || !finalizing) {
      const { data: verified } = await admin
        .from("generation_jobs")
        .select("status,output")
        .eq("id", jobId)
        .maybeSingle();
      if (verified?.status !== "finalizing" || verified.output?.result_persisted !== true) {
        throw new Error(outputError?.message || "Digital adaptation results could not be recorded.");
      }
    }
    resultPersisted = true;

    await completeGenerationJob(admin, jobId, durableOutput, {
      tool: "digital_adaptations",
      provider: "openai",
      model,
      project_id: claimed.project_id || input.projectId || null,
      result_persisted: true,
      asset_ids: stored.map((item) => item.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Digital adaptations failed.";
    if (!resultPersisted) {
      await removePartialOutputs(admin, stored);
      await failGenerationJob(admin, {
        jobId,
        expectedStatus: "processing",
        reason: message,
        publicError: "Digital adaptations could not be completed. Your credits were returned.",
      });
    }
    console.error("Digital adaptations background error:", message);
  } finally {
    if (sourcePath) {
      const { error: cleanupError } = await admin.storage.from(SOURCE_BUCKET).remove([sourcePath]);
      if (cleanupError) console.error("Digital adaptations source cleanup failed:", cleanupError.message);
    }
  }
}

async function createAiFamilyMaster(
  source: Buffer,
  family: AdaptationFamily,
  notes: string,
  model: string,
) {
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
    model,
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

async function removePartialOutputs(admin: SupabaseClient, outputs: StoredOutput[]) {
  if (!outputs.length) return;
  const ids = outputs.map((item) => item.id);
  const paths = outputs.map((item) => item.storagePath).filter((value): value is string => Boolean(value));
  const { error: recordError } = await admin.from("project_assets").delete().in("id", ids);
  if (recordError) console.error("Partial digital adaptation records could not be removed:", recordError.message);
  if (paths.length) {
    const { error: storageError } = await admin.storage.from(SOURCE_BUCKET).remove(paths);
    if (storageError) console.error("Partial digital adaptation files could not be removed:", storageError.message);
  }
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

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
