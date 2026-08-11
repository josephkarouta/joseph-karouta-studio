import { randomUUID } from "node:crypto";
import OpenAI, { toFile } from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "project-assets";

type JobInput = {
  prompt?: string;
  fullPrompt?: string;
  styleNotes?: string;
  quality?: "preview" | "high";
  size?: string;
  projectId?: string | null;
  referencePath?: string | null;
  referenceName?: string | null;
  referenceType?: string | null;
  credits?: number;
  model?: string;
};

type StoredAsset = {
  id: string;
  file_url?: string | null;
  storagePath: string;
};

export async function processTextToImageJob(jobId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !serviceKey || !openaiKey) {
    throw new Error("Background image generation is not configured.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: jobError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tool", "text_to_image")
    .maybeSingle();

  if (jobError) throw new Error(jobError.message || "Generation job could not be loaded.");
  if (!existing) throw new Error("Generation job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existing.status || ""))) return;

  // Claim only a newly queued job. A duplicate invocation should not create a
  // second paid provider call.
  if (String(existing.status || "") !== "queued") return;

  const { data: claimed, error: claimError } = await admin
    .from("generation_jobs")
    .update({ status: "processing", error: null })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message || "Generation job could not be started.");
  if (!claimed) return;

  const input = (claimed.input || {}) as JobInput;
  const referencePath = cleanString(input.referencePath) || null;
  let asset: StoredAsset | null = null;

  try {
    const prompt = cleanString(input.prompt);
    const fullPrompt = cleanString(input.fullPrompt);
    const size = cleanString(input.size) || "1024x1024";
    const quality = input.quality === "high" ? "high" : "medium";
    const model = cleanString(input.model) || process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

    if (!prompt || !fullPrompt) throw new Error("Generation prompt is missing.");

    const openai = new OpenAI({ apiKey: openaiKey });
    let generated;

    if (referencePath) {
      const { data: referenceBlob, error: downloadError } = await admin.storage
        .from(BUCKET)
        .download(referencePath);

      if (downloadError || !referenceBlob) {
        throw new Error(downloadError?.message || "Reference image could not be loaded.");
      }

      const referenceBuffer = Buffer.from(await referenceBlob.arrayBuffer());
      generated = await openai.images.edit({
        model,
        image: await toFile(
          referenceBuffer,
          cleanString(input.referenceName) || "reference-image",
          { type: cleanString(input.referenceType) || "image/png" },
        ),
        prompt: fullPrompt,
        size: size as any,
        quality,
        output_format: "png",
      });
    } else {
      generated = await openai.images.generate({
        model,
        prompt: fullPrompt,
        size: size as any,
        quality,
        output_format: "png",
      });
    }

    const base64 = generated.data?.[0]?.b64_json;
    if (!base64) throw new Error("The image provider returned no image.");

    const buffer = Buffer.from(base64, "base64");
    asset = await storeAsset({
      admin,
      userId: String(claimed.user_id),
      projectId: claimed.project_id ? String(claimed.project_id) : null,
      title: prompt.slice(0, 70),
      buffer,
      payload: {
        prompt,
        styleNotes: cleanString(input.styleNotes),
        size,
        quality: input.quality === "high" ? "high" : "preview",
        referenceImage: referencePath
          ? {
              name: cleanString(input.referenceName) || null,
              type: cleanString(input.referenceType) || null,
            }
          : null,
      },
      metadata: {
        model,
        credit_reservation_id: claimed.credit_reservation_id,
        reference_image: Boolean(referencePath),
      },
    });

    if (claimed.credit_reservation_id) {
      const { error: commitError } = await admin.rpc("heyy_commit_credits", {
        p_reservation_id: claimed.credit_reservation_id,
        p_metadata: {
          tool: "text_to_image",
          model,
          asset_id: asset.id,
          size,
          quality: input.quality === "high" ? "high" : "preview",
        },
      });
      if (commitError) throw new Error(commitError.message || "Credits could not be committed.");
    }

    const { error: completeError } = await admin
      .from("generation_jobs")
      .update({
        status: "succeeded",
        error: null,
        output: {
          asset_url: asset.file_url || null,
          asset_id: asset.id,
          model,
          size,
          credits_used: Number(input.credits || 0),
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (completeError) throw new Error(completeError.message || "Generation job could not be completed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";

    if (asset) {
      await admin.from("project_assets").delete().eq("id", asset.id);
      await admin.storage.from(BUCKET).remove([asset.storagePath]);
      asset = null;
    }

    if (claimed.credit_reservation_id) {
      const { error: refundError } = await admin.rpc("heyy_refund_credits", {
        p_reservation_id: claimed.credit_reservation_id,
        p_reason: message.slice(0, 500),
      });
      if (refundError) console.error("Text-to-image background refund failed:", refundError);
    }

    await admin
      .from("generation_jobs")
      .update({
        status: "failed",
        error: publicGenerationError(message),
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.error("Text-to-image background error:", message);
  } finally {
    if (referencePath) {
      const { error: cleanupError } = await admin.storage.from(BUCKET).remove([referencePath]);
      if (cleanupError) console.error("Reference image cleanup failed:", cleanupError.message);
    }
  }
}

async function storeAsset({
  admin,
  userId,
  projectId,
  title,
  buffer,
  payload,
  metadata,
}: {
  admin: SupabaseClient;
  userId: string;
  projectId: string | null;
  title: string;
  buffer: Buffer;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<StoredAsset> {
  const storagePath = `${userId}/${projectId || "tools"}/generated_image/${safeSegment(title)}-${Date.now()}-${randomUUID()}.png`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) throw new Error(`Asset upload failed: ${uploadError.message}`);

  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  const fileUrl = publicData.publicUrl || null;

  const { data: asset, error: assetError } = await admin
    .from("project_assets")
    .insert({
      user_id: userId,
      project_id: projectId,
      studio: "ai_tools",
      asset_type: "generated_image",
      title,
      payload,
      file_url: fileUrl,
      thumbnail_url: fileUrl,
      metadata: {
        provider: "openai",
        ...metadata,
        storage_path: storagePath,
        content_type: "image/png",
      },
    })
    .select()
    .single();

  if (assetError || !asset) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`Asset record failed: ${assetError?.message || "Unknown error"}`);
  }

  return { ...asset, storagePath } as StoredAsset;
}

function safeSegment(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "asset";
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function publicGenerationError(message: string) {
  if (/content|safety|policy|moderation/i.test(message)) {
    return "This image request could not be completed. Try adjusting the prompt or reference image.";
  }
  return "Image generation could not be completed. Your credits were returned.";
}
