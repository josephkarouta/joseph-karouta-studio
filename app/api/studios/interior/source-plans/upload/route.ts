import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const SOURCE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const PREVIEW_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "source-plan";
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const form = await request.formData();
    const projectId = String(form.get("projectId") || "").trim();
    const file = form.get("file");
    const previews = form.getAll("preview").filter((item): item is File => item instanceof File).slice(0, 3);

    if (!projectId) return NextResponse.json({ success: false, error: "Interior project is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: "Choose a floor-plan file." }, { status: 400 });
    if (!SOURCE_TYPES.has(file.type)) return NextResponse.json({ success: false, error: "Use PNG, JPG, WebP or PDF floor plans." }, { status: 400 });
    if (!file.size || file.size > MAX_SOURCE_BYTES) return NextResponse.json({ success: false, error: "Each floor-plan file must be 4 MB or smaller." }, { status: 400 });

    const { data: project, error: projectError } = await auth.admin
      .from("studio_projects")
      .select("id,input")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "interior_studio")
      .single();
    if (projectError || !project) return NextResponse.json({ success: false, error: projectError?.message || "Interior project not found." }, { status: 404 });

    const stamp = `${Date.now()}-${randomUUID()}`;
    const documentPath = `${auth.user.id}/${projectId}/interior-source/${stamp}-${safeName(file.name)}`;
    const sourceBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await auth.admin.storage
      .from("project-files")
      .upload(documentPath, sourceBuffer, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw new Error(`Source-plan upload failed: ${uploadError.message}`);

    const { data: documentPublic } = auth.admin.storage.from("project-files").getPublicUrl(documentPath);
    const documentUrl = String(documentPublic.publicUrl || "");
    const originalIsImage = file.type.startsWith("image/");

    const { error: sourceAssetError } = await auth.admin.from("project_assets").insert({
      user_id: auth.user.id,
      project_id: projectId,
      studio: "interior_studio",
      asset_type: "interior_source_document",
      title: `Source plan — ${file.name}`,
      payload: { original_filename: file.name, mime_type: file.type, intake_mode: "existing_design" },
      file_url: documentUrl || null,
      thumbnail_url: originalIsImage ? documentUrl || null : null,
      metadata: {
        source: "interior_intake",
        storage_bucket: "project-files",
        storage_path: documentPath,
        content_type: file.type,
        approved: true,
        ai_reference: originalIsImage,
      },
    });
    if (sourceAssetError) {
      await auth.admin.storage.from("project-files").remove([documentPath]);
      throw new Error(`Source-plan record failed: ${sourceAssetError.message}`);
    }

    const aiReferenceUrls: string[] = originalIsImage && documentUrl ? [documentUrl] : [];

    for (const [index, preview] of previews.entries()) {
      if (!PREVIEW_TYPES.has(preview.type) || !preview.size) continue;
      const previewPath = `${auth.user.id}/${projectId}/interior-source-preview/${stamp}-${index + 1}-${safeName(preview.name || `page-${index + 1}.png`)}`;
      const previewBuffer = Buffer.from(await preview.arrayBuffer());
      const { error: previewUploadError } = await auth.admin.storage
        .from("project-assets")
        .upload(previewPath, previewBuffer, { contentType: preview.type, cacheControl: "31536000", upsert: false });
      if (previewUploadError) throw new Error(`PDF preview upload failed: ${previewUploadError.message}`);

      const { data: previewPublic } = auth.admin.storage.from("project-assets").getPublicUrl(previewPath);
      const previewUrl = String(previewPublic.publicUrl || "");
      const { error: previewAssetError } = await auth.admin.from("project_assets").insert({
        user_id: auth.user.id,
        project_id: projectId,
        studio: "interior_studio",
        asset_type: "interior_source_plan_preview",
        title: `${file.name} — page ${index + 1} AI reference`,
        payload: { source_document_url: documentUrl, source_filename: file.name, page: index + 1 },
        file_url: previewUrl || null,
        thumbnail_url: previewUrl || null,
        metadata: {
          source: "interior_intake_pdf_preview",
          storage_bucket: "project-assets",
          storage_path: previewPath,
          content_type: preview.type,
          approved: true,
          ai_reference: true,
          source_document_url: documentUrl,
          page: index + 1,
        },
      });
      if (previewAssetError) {
        await auth.admin.storage.from("project-assets").remove([previewPath]);
        throw new Error(`PDF preview record failed: ${previewAssetError.message}`);
      }
      if (previewUrl) aiReferenceUrls.push(previewUrl);
    }

    if (file.type === "application/pdf" && !aiReferenceUrls.length) {
      throw new Error("The PDF was saved, but no image preview could be prepared for AI reference.");
    }

    const currentInput = project.input && typeof project.input === "object"
      ? (project.input as Record<string, unknown>)
      : {};
    const currentAssetUrls = Array.isArray(currentInput.sourcePlanAssetUrls)
      ? currentInput.sourcePlanAssetUrls.map((value) => String(value || "")).filter(Boolean)
      : [];
    const currentImageUrls = Array.isArray(currentInput.sourcePlanImageUrls)
      ? currentInput.sourcePlanImageUrls.map((value) => String(value || "")).filter(Boolean)
      : [];
    const currentFileNames = Array.isArray(currentInput.sourcePlanFileNames)
      ? currentInput.sourcePlanFileNames.map((value) => String(value || "")).filter(Boolean)
      : [];

    const nextInput = {
      ...currentInput,
      projectStartMode: "existing",
      architectureSource: "Use uploaded floor plans",
      architectureProjectId: "",
      sourcePlanAssetUrls: Array.from(new Set([...currentAssetUrls, ...(documentUrl ? [documentUrl] : [])])),
      sourcePlanImageUrls: Array.from(new Set([...currentImageUrls, ...aiReferenceUrls])).slice(0, 6),
      sourcePlanFileNames: Array.from(new Set([...currentFileNames, file.name])),
    };

    const { error: projectUpdateError } = await auth.admin
      .from("studio_projects")
      .update({ input: nextInput })
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "interior_studio");
    if (projectUpdateError) {
      throw new Error(`Source-plan project link failed: ${projectUpdateError.message}`);
    }

    return NextResponse.json({ success: true, documentUrl, aiReferenceUrls, input: nextInput });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The source plan could not be uploaded.";
    console.error("Interior source-plan upload error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
