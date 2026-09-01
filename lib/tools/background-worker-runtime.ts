import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Worker-safe server helpers for standalone Netlify background functions.
 *
 * IMPORTANT: keep this module independent of Next.js and do not add
 * `import "server-only"`. Netlify background functions are bundled and run
 * outside Next's React Server Component module conditions.
 */

let openaiClient: OpenAI | null = null;

export function getOpenAI() {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Image generation is not configured.");

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export type CreditReservation = {
  id: string;
  amount: number;
  action: string;
};

export class CreditError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "CREDIT_OPERATION_FAILED", status = 400) {
    super(message);
    this.name = "CreditError";
    this.code = code;
    this.status = status;
  }
}

export async function commitCredits(
  admin: SupabaseClient,
  reservationId: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await admin.rpc("heyy_commit_credits", {
    p_reservation_id: reservationId,
    p_metadata: metadata,
  });

  if (error) {
    throw new CreditError(
      error.message || "Credits could not be committed.",
      "CREDIT_OPERATION_FAILED",
      500,
    );
  }
}

export async function refundCredits(
  admin: SupabaseClient,
  reservationId: string,
  reason: string,
) {
  const { error } = await admin.rpc("heyy_refund_credits", {
    p_reservation_id: reservationId,
    p_reason: reason.slice(0, 500),
  });

  if (error) {
    console.error("Background credit refund failed:", error);
  }
}

function safeSegment(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "asset";
}

export async function storeGeneratedAsset({
  admin,
  userId,
  projectId,
  studio,
  assetType,
  title,
  buffer,
  extension,
  contentType,
  payload = {},
  metadata = {},
}: {
  admin: SupabaseClient;
  userId: string;
  projectId?: string | null;
  studio?: string | null;
  assetType: string;
  title: string;
  buffer: Buffer;
  extension: string;
  contentType: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const path = `${userId}/${projectId || "tools"}/${assetType}/${safeSegment(title)}-${Date.now()}-${randomUUID()}.${extension}`;

  const { error: uploadError } = await admin.storage
    .from("project-assets")
    .upload(path, buffer, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Asset upload failed: ${uploadError.message}`);
  }

  const { data: publicData } = admin.storage.from("project-assets").getPublicUrl(path);
  const fileUrl = publicData.publicUrl || null;

  const { data: asset, error: assetError } = await admin
    .from("project_assets")
    .insert({
      user_id: userId,
      project_id: projectId || null,
      studio: studio || null,
      asset_type: assetType,
      title,
      payload,
      file_url: fileUrl,
      thumbnail_url: contentType.startsWith("image/") ? fileUrl : null,
      metadata: {
        ...(contentType.startsWith("image/")
          ? {
              provider:
                typeof metadata.provider === "string" ? metadata.provider : "openai",
              model:
                typeof metadata.model === "string"
                  ? metadata.model
                  : process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
            }
          : {}),
        ...metadata,
        storage_path: path,
        content_type: contentType,
      },
    })
    .select()
    .single();

  if (assetError || !asset) {
    await admin.storage.from("project-assets").remove([path]);
    throw new Error(`Asset record failed: ${assetError?.message || "Unknown error"}`);
  }

  return asset;
}
