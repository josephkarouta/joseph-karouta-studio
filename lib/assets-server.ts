import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  const { error: uploadError } = await admin.storage.from("project-assets").upload(path, buffer, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) throw new Error(`Asset upload failed: ${uploadError.message}`);
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
        ...(contentType.startsWith("image/") ? {
          provider: typeof metadata.provider === "string" ? metadata.provider : "openai",
          model: typeof metadata.model === "string" ? metadata.model : (process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"),
        } : {}),
        ...metadata,
        storage_path: path,
        content_type: contentType,
      },
    })
    .select()
    .single();
  if (assetError) {
    await admin.storage.from("project-assets").remove([path]);
    throw new Error(`Asset record failed: ${assetError.message}`);
  }
  return asset;
}
