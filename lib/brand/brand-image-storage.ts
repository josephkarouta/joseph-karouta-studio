import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

function safeSegment(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "brand-image";
}

export type BrandImageStorageContext = {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
};

export async function storeGeneratedBrandImage(
  context: BrandImageStorageContext,
  args: {
    buffer: Buffer;
    kind: string;
    tier?: "preview" | "final" | "variation";
  },
) {
  const tier = args.tier || "preview";
  const stem = `${safeSegment(args.kind)}-${tier}-${Date.now()}-${randomUUID()}`;

  async function upload(
    buffer: Buffer,
    extension: "webp" | "png",
    contentType: "image/webp" | "image/png",
  ) {
    const storagePath = `${context.userId}/${context.projectId}/generated/${stem}.${extension}`;
    const { error } = await context.admin.storage
      .from("project-assets")
      .upload(storagePath, buffer, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
    return { error, storagePath };
  }

  let uploaded = await upload(args.buffer, "webp", "image/webp");
  if (uploaded.error && /mime|content.?type|not supported/i.test(uploaded.error.message || "")) {
    const pngBuffer = await sharp(args.buffer).png({ compressionLevel: 9 }).toBuffer();
    uploaded = await upload(pngBuffer, "png", "image/png");
  }
  if (uploaded.error) {
    throw new Error(`Brand image upload failed: ${uploaded.error.message}`);
  }

  const { data } = context.admin.storage.from("project-assets").getPublicUrl(uploaded.storagePath);
  if (!data.publicUrl) {
    await context.admin.storage.from("project-assets").remove([uploaded.storagePath]);
    throw new Error("The saved Brand image URL could not be created.");
  }

  return { imageUrl: data.publicUrl, storagePath: uploaded.storagePath };
}
