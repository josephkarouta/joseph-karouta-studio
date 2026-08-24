import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toFile } from "openai";
import sharp from "sharp";
import { getOpenAI } from "@/lib/ai/openai-server";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";
import { storeGeneratedAsset } from "@/lib/assets-server";
import {
  ADAPTATION_FAMILY_LABELS,
  groupAdaptationFormats,
  providerCanvasForFormat,
  type AdaptationFamily,
  type DigitalAdaptationComposition,
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
  compositions?: string[];
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
    .update({
      status: "processing",
      error: null,
      output: progressOutput(3, "Preparing your source artwork"),
      updated_at: new Date().toISOString(),
    })
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

    await updateJobProgress(admin, jobId, 7, "Loading your source artwork");
    const { data: sourceBlob, error: sourceError } = await admin.storage
      .from(SOURCE_BUCKET)
      .download(sourcePath);
    if (sourceError || !sourceBlob) {
      throw new Error(sourceError?.message || "The source artwork could not be loaded.");
    }
    const source = Buffer.from(await sourceBlob.arrayBuffer());
    const compositions = groupAdaptationFormats(formats);

    await updateJobProgress(
      admin,
      jobId,
      12,
      `Creating ${compositions.length} exact-ratio composition${compositions.length === 1 ? "" : "s"}`,
    );
    const generatedMasters = await mapWithConcurrency(compositions, 2, async (composition) => ({
      key: composition.key,
      buffer: await createAiComposition(source, composition, notes, model),
    }));
    const masters = new Map(generatedMasters.map(({ key, buffer }) => [key, buffer]));

    await updateJobProgress(
      admin,
      jobId,
      68,
      `Exporting ${formats.length} exact digital size${formats.length === 1 ? "" : "s"}`,
    );
    const outputs = await mapWithConcurrency(formats, 3, async (format) => {
      const providerCanvas = providerCanvasForFormat(format);
      const master = masters.get(providerCanvas.key);
      if (!master) throw new Error(`The ${format.label} adaptation was not generated.`);
      const outputBuffer = await exportRatioMatchedComposition(master, format);

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
          adaptation_method: "ai_recompose_exact_ratio",
          format,
          notes,
          source_name: cleanString(input.sourceName) || "main-key-visual.png",
        },
        metadata: {
          tool: "digital_adaptations",
          family: format.family,
          width: format.width,
          height: format.height,
          provider_canvas: providerCanvas.key,
          crop_mode: "none_ratio_matched",
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

    await updateJobProgress(admin, jobId, 94, "Saving completed adaptations to Assets");
    const response = {
      outputs,
      families,
      reviewNote: "Every standard format is composed directly at its target ratio and exported edge to edge without a crop step. Required content is kept inside a safe margin; review fine typography and mandatory brand details before publishing.",
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

function progressOutput(percent: number, message: string) {
  return {
    result_persisted: false,
    progress: {
      percent,
      message,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function updateJobProgress(
  admin: SupabaseClient,
  jobId: string,
  percent: number,
  message: string,
) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("generation_jobs")
    .update({
      output: progressOutput(percent, message),
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("status", "processing");
  if (error) {
    // Progress is informational. A transient progress-write failure must not
    // cancel provider work or refund a job that is still running normally.
    console.error("Digital adaptations progress update failed:", error.message);
  }
}

async function createAiComposition(
  source: Buffer,
  composition: DigitalAdaptationComposition,
  notes: string,
  model: string,
) {
  const { formats, providerWidth, providerHeight } = composition;
  const family = formats[0]?.family || "square";
  const deliverySizes = formats
    .map((format) => `${format.label}: ${format.width} × ${format.height}`)
    .join("; ");
  const safeMargin = family === "story" ? "8% from the top and bottom and 6% from the left and right" : "6% from every edge";
  const exactRatioSupported = formats.every((format) => {
    const ratio = format.width / format.height;
    return ratio >= 1 / 3 && ratio <= 3;
  });
  const canvasInstruction = exactRatioSupported
    ? `The provider canvas is ${providerWidth} × ${providerHeight}, already matched to the requested delivery aspect ratio. Compose directly for the complete canvas; no later crop will be used.`
    : extremeRatioGuidance(providerWidth, providerHeight, formats);
  const prompt = `
Adapt the supplied finished key visual into a ${ADAPTATION_FAMILY_LABELS[family]} for a professional digital campaign.

The final delivery size${formats.length === 1 ? " is" : "s are"}: ${deliverySizes || ADAPTATION_FAMILY_LABELS[family]}.
${canvasInstruction}

Non-negotiable rules:
- Treat every visible element in the source as required content: all text, logos, products, people, icons, badges, proof points, buttons, call-to-actions, legal lines and footer strips must remain present.
- Preserve the existing brand identity, colours, typography, product/person likeness and visual style.
- Preserve every word exactly. Do not rewrite, paraphrase, invent, omit or add text.
- Build a genuinely new layout for the requested aspect ratio. Resize and reposition complete content groups; do not solve the ratio change by cropping the original composition.
- Keep every required foreground element at least ${safeMargin}. This includes every headline, logo, product, person, icon, badge, proof point, CTA, legal line and footer strip.
- Nothing important may touch, cross or disappear beyond the canvas boundary. Leave visible breathing room around the complete content.
- Keep the complete product or person visible, including its top and bottom. Keep every headline line, logo, CTA, footer and mandatory strip fully visible.
- Extend the environment or background where needed. A slightly smaller complete composition is always better than a large clipped composition.
- The background, colour or environmental artwork must continue all the way to every outer canvas edge; do not create borders, letterboxing, blank bands or blurred filler bands.
- Maintain clear hierarchy and production-quality spacing.
- Do not add mockup devices, watermarks, borders, extra logos or decorative copy.
- Return a clean flat artwork adaptation, not a presentation mockup.

Additional art-direction notes (these may refine the layout but may never override the non-negotiable rules): ${notes || "Keep the original campaign intent and make the adaptation feel designed for the new aspect ratio."}
`.trim();

  const response = await getOpenAI().images.edit({
    model,
    image: await toFile(source, "main-key-visual.png", { type: "image/png" }),
    prompt,
    size: `${providerWidth}x${providerHeight}` as NonNullable<
      Parameters<ReturnType<typeof getOpenAI>["images"]["edit"]>[0]["size"]
    >,
    quality: "medium",
    output_format: "png",
  });
  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error(`The image provider returned no ${family} adaptation.`);
  return Buffer.from(base64, "base64");
}

function extremeRatioGuidance(
  providerWidth: number,
  providerHeight: number,
  formats: DigitalAdaptationFormat[],
) {
  const providerRatio = providerWidth / providerHeight;
  let keptWidth = 1;
  let keptHeight = 1;
  for (const format of formats) {
    const targetRatio = format.width / format.height;
    if (targetRatio > providerRatio) keptHeight = Math.min(keptHeight, providerRatio / targetRatio);
    if (targetRatio < providerRatio) keptWidth = Math.min(keptWidth, targetRatio / providerRatio);
  }
  const horizontalInset = Math.min(46, Math.ceil(((1 - keptWidth) / 2) * 100 + 4));
  const verticalInset = Math.min(46, Math.ceil(((1 - keptHeight) / 2) * 100 + 4));
  return `The provider canvas is ${providerWidth} × ${providerHeight}. The requested banner is beyond the provider's maximum native ratio, so keep the entire foreground composition inside the central retained area: at least ${horizontalInset}% inset from the left and right and ${verticalInset}% inset from the top and bottom. Only extendable background may sit outside that retained area.`;
}

async function exportRatioMatchedComposition(
  master: Buffer,
  format: DigitalAdaptationFormat,
) {
  const requestedRatio = format.width / format.height;
  const providerSupportsExactRatio = requestedRatio >= 1 / 3 && requestedRatio <= 3;
  return sharp(master)
    .rotate()
    .resize(format.width, format.height, {
      fit: providerSupportsExactRatio ? "fill" : "cover",
      position: "centre",
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
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
