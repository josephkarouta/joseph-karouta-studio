import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing from the server environment.`);
  return value;
}

async function createAuthenticatedSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie writes may be unavailable after a response is committed.
          }
        },
      },
    },
  );
}

function safeSegment(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "brand-image";
}

export type AuthenticatedBrandImageContext = {
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>;
  admin: SupabaseClient;
  userId: string;
  projectId: string;
};

export async function requireBrandImageProject(
  projectIdValue: unknown,
): Promise<AuthenticatedBrandImageContext> {
  const projectId = typeof projectIdValue === "string" ? projectIdValue.trim() : "";
  if (!projectId) throw new Error("A valid Brand project ID is required.");

  const supabase = await createAuthenticatedSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    throw new Error("Authentication is required before generating Brand images.");
  }

  const { data: project, error: projectError } = await supabase
    .from("brand_projects")
    .select("id,user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message || "The Brand project could not be found.");
  }

  const serviceKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    supabase,
    admin,
    userId: user.id,
    projectId,
  };
}

export async function storeGeneratedBrandImage(
  context: AuthenticatedBrandImageContext,
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
    const { error } = await context.supabase.storage
      .from("project-assets")
      .upload(storagePath, buffer, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
    return { error, storagePath };
  }

  let uploaded = await upload(args.buffer, "webp", "image/webp");

  if (
    uploaded.error &&
    /mime|content.?type|not supported/i.test(uploaded.error.message || "")
  ) {
    const pngBuffer = await sharp(args.buffer).png({ compressionLevel: 9 }).toBuffer();
    uploaded = await upload(pngBuffer, "png", "image/png");
  }

  if (uploaded.error) {
    throw new Error(`Brand image upload failed: ${uploaded.error.message}`);
  }

  const { data } = context.supabase.storage
    .from("project-assets")
    .getPublicUrl(uploaded.storagePath);

  if (!data.publicUrl) {
    await context.supabase.storage.from("project-assets").remove([uploaded.storagePath]);
    throw new Error("The saved Brand image URL could not be created.");
  }

  return {
    imageUrl: data.publicUrl,
    storagePath: uploaded.storagePath,
  };
}
