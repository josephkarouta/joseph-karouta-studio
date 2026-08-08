import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";

const PLAN_TYPES = new Set([
  "ground_floor",
  "upper_floor",
  "site_plan",
  "front_elevation",
  "rear_elevation",
  "left_elevation",
  "right_elevation",
  "section",
  "other",
]);

function requiredEnvironment(name: string) {
  const value = process.env[name];
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
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Cookie writes are optional after the response is committed.
          }
        },
      },
    },
  );
}

function clamp(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "source-plan";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const documentId = String(body?.documentId || "").trim();
    const planType = String(body?.planType || "").trim();
    const label = String(body?.label || "").trim() || planType.replace(/_/g, " ");
    const crop = body?.crop || {};

    if (!projectId || !documentId || !PLAN_TYPES.has(planType)) {
      return NextResponse.json(
        { success: false, error: "Project, source drawing and plan type are required." },
        { status: 400 },
      );
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { data: project } = await supabase
      .from("architecture_projects")
      .select("id,user_id,workflow_mode")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();
    if (!project || project.workflow_mode !== "plan_to_render") {
      return NextResponse.json(
        { success: false, error: "Source-plan organisation is available for Existing Design projects." },
        { status: 400 },
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("architecture_documents")
      .select("id,project_id,user_id,category,filename,storage_path,mime_type")
      .eq("id", documentId)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .single();
    if (documentError || !document) {
      return NextResponse.json(
        { success: false, error: documentError?.message || "Source drawing not found." },
        { status: 404 },
      );
    }
    if (!String(document.mime_type || "").startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Crop organisation currently supports image drawings. PDF/DWG page extraction is a later step." },
        { status: 400 },
      );
    }

    const admin = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: sourceBlob, error: sourceError } = await admin.storage
      .from("architecture-files")
      .download(document.storage_path);
    if (sourceError || !sourceBlob) throw sourceError || new Error("Source drawing could not be loaded.");

    const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());
    const metadata = await sharp(sourceBuffer).rotate().metadata();
    const sourceWidth = metadata.width || 0;
    const sourceHeight = metadata.height || 0;
    if (!sourceWidth || !sourceHeight) throw new Error("Source drawing dimensions could not be read.");

    let x = clamp(crop.x, 0);
    let y = clamp(crop.y, 0);
    let width = clamp(crop.width, 1);
    let height = clamp(crop.height, 1);
    if (x + width > 1) width = 1 - x;
    if (y + height > 1) height = 1 - y;
    if (width < 0.03 || height < 0.03) {
      return NextResponse.json(
        { success: false, error: "Select a larger drawing area before saving." },
        { status: 400 },
      );
    }

    const left = Math.max(0, Math.floor(x * sourceWidth));
    const top = Math.max(0, Math.floor(y * sourceHeight));
    const pixelWidth = Math.max(1, Math.min(sourceWidth - left, Math.round(width * sourceWidth)));
    const pixelHeight = Math.max(1, Math.min(sourceHeight - top, Math.round(height * sourceHeight)));

    const cropped = await sharp(sourceBuffer)
      .rotate()
      .extract({ left, top, width: pixelWidth, height: pixelHeight })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const storagePath = `${user.id}/${projectId}/source-plans/${planType}-${Date.now()}-${safeFilename(label)}.png`;
    const { error: uploadError } = await admin.storage
      .from("architecture-files")
      .upload(storagePath, cropped, { contentType: "image/png", upsert: false });
    if (uploadError) throw uploadError;

    const { data: created, error: insertError } = await admin
      .from("architecture_documents")
      .insert({
        project_id: projectId,
        user_id: user.id,
        category: `source-plan-${planType}`,
        filename: `${label}.png`,
        storage_path: storagePath,
        mime_type: "image/png",
        file_size: cropped.length,
      })
      .select("*")
      .single();
    if (insertError || !created) {
      await admin.storage.from("architecture-files").remove([storagePath]);
      throw insertError || new Error("Source plan could not be saved.");
    }

    const sourceChangedAt = new Date().toISOString();
    const { data: visualRows } = await admin
      .from("architecture_visuals")
      .select("id,metadata")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    for (const row of visualRows || []) {
      const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {};
      await admin
        .from("architecture_visuals")
        .update({
          is_approved: false,
          metadata: {
            ...metadata,
            source_geometry_stale: true,
            source_geometry_changed_at: sourceChangedAt,
          },
        })
        .eq("id", row.id);
    }

    const { data: directionRows } = await admin
      .from("architecture_directions")
      .select("id,generation_json")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    for (const row of directionRows || []) {
      const generationJson = row.generation_json && typeof row.generation_json === "object" && !Array.isArray(row.generation_json)
        ? row.generation_json as Record<string, unknown>
        : {};
      await admin
        .from("architecture_directions")
        .update({
          generation_json: {
            ...generationJson,
            source_geometry_stale: true,
            source_geometry_changed_at: sourceChangedAt,
          },
        })
        .eq("id", row.id);
    }

    const { data: conceptRows } = await admin
      .from("architecture_concepts")
      .select("id,generation_json")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    for (const row of conceptRows || []) {
      const generationJson = row.generation_json && typeof row.generation_json === "object" && !Array.isArray(row.generation_json)
        ? row.generation_json as Record<string, unknown>
        : {};
      await admin
        .from("architecture_concepts")
        .update({
          generation_json: {
            ...generationJson,
            source_geometry_stale: true,
            source_geometry_changed_at: sourceChangedAt,
          },
        })
        .eq("id", row.id);
    }

    const { data: planRows } = await admin
      .from("architecture_plan_sets")
      .select("id,generation_json")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    for (const row of planRows || []) {
      const generationJson = row.generation_json && typeof row.generation_json === "object" && !Array.isArray(row.generation_json)
        ? row.generation_json as Record<string, unknown>
        : {};
      await admin
        .from("architecture_plan_sets")
        .update({
          generation_json: {
            ...generationJson,
            source_geometry_stale: true,
            source_geometry_changed_at: sourceChangedAt,
          },
        })
        .eq("id", row.id);
    }

    const { data: signed } = await admin.storage
      .from("architecture-files")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    return NextResponse.json({
      success: true,
      document: { ...created, preview_url: signed?.signedUrl || null },
      invalidatedVisuals: (visualRows || []).length,
    });
  } catch (error) {
    console.error("Architecture source-plan crop error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Source plan could not be prepared." },
      { status: 500 },
    );
  }
}
