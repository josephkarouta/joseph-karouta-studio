import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { resolveLibrarySource } from "@/lib/assets/library";
import { getWorkspaceStorageEntitlement, storageAccessError } from "@/lib/workspace-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetStudio = "brand" | "architecture" | "interior" | "marketing";

function safePathSegment(value: unknown) {
  return String(value || "asset").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "asset";
}

function dbStudio(studio: TargetStudio) {
  return `${studio}_studio`;
}

async function ensureTargetProject(admin: any, userId: string, studio: TargetStudio, projectId: string) {
  if (studio === "brand") {
    const { data } = await admin.from("brand_projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
    return Boolean(data);
  }
  if (studio === "architecture") {
    const { data } = await admin.from("architecture_projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
    return Boolean(data);
  }
  const { data } = await admin.from("studio_projects").select("id,studio").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (!data) return false;
  return String(data.studio || "").toLowerCase().includes(studio);
}

async function upsertOverride(admin: any, userId: string, sourceKey: string, patch: Record<string, unknown>) {
  const { data: existing, error: readError } = await admin
    .from("asset_library_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (readError) throw readError;
  const payload = {
    ...(existing || {}),
    user_id: userId,
    source_key: sourceKey,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("asset_library_overrides").upsert(payload, { onConflict: "user_id,source_key" });
  if (error) throw error;
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const entitlement = await getWorkspaceStorageEntitlement(admin, user.id);
    if (!entitlement.canManage) {
      return NextResponse.json({ success: false, error: storageAccessError(entitlement) }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    const sourceKey = String(body.sourceKey || "").trim();
    if (!sourceKey) return NextResponse.json({ success: false, error: "Asset is required." }, { status: 400 });

    if (action === "rename") {
      const title = String(body.title || "").trim().slice(0, 160);
      if (!title) return NextResponse.json({ success: false, error: "Enter an asset name." }, { status: 400 });
      await upsertOverride(admin, user.id, sourceKey, { display_title: title });
      return NextResponse.json({ success: true });
    }

    if (action === "archive" || action === "unarchive") {
      await upsertOverride(admin, user.id, sourceKey, { archived_at: action === "archive" ? new Date().toISOString() : null });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      // Library deletion is intentionally non-destructive. The source project and its production history remain intact.
      await upsertOverride(admin, user.id, sourceKey, { hidden_at: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }

    if (action === "reuse") {
      const targetStudio = String(body.targetStudio || "") as TargetStudio;
      const targetProjectId = String(body.targetProjectId || "").trim();
      if (!(["brand", "architecture", "interior", "marketing"] as string[]).includes(targetStudio) || !targetProjectId) {
        return NextResponse.json({ success: false, error: "Choose a destination project." }, { status: 400 });
      }
      if (!(await ensureTargetProject(admin, user.id, targetStudio, targetProjectId))) {
        return NextResponse.json({ success: false, error: "Destination project not found." }, { status: 404 });
      }

      const source = await resolveLibrarySource(admin, user.id, sourceKey);
      if (!source || source.kind === "production_deliverable") {
        return NextResponse.json({ success: false, error: "This asset cannot be reused in another Studio." }, { status: 400 });
      }

      let sourceUrl = source.url;
      if (source.storageBucket && source.storagePath) {
        const { data, error } = await admin.storage.from(source.storageBucket).createSignedUrl(source.storagePath, 60 * 5);
        if (error || !data?.signedUrl) throw error || new Error("Could not prepare the source asset.");
        sourceUrl = data.signedUrl;
      }
      if (!sourceUrl) return NextResponse.json({ success: false, error: "This asset does not have a reusable file." }, { status: 400 });

      const response = await fetch(sourceUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not retrieve the source asset.");
      const bytes = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : contentType.includes("pdf") ? "pdf" : "bin";
      const storagePath = `${user.id}/${targetProjectId}/library-imports/${Date.now()}-${safePathSegment(source.title)}.${ext}`;
      const { error: uploadError } = await admin.storage.from("project-assets").upload(storagePath, bytes, { contentType, cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = admin.storage.from("project-assets").getPublicUrl(storagePath);

      const { data: imported, error: insertError } = await admin.from("project_assets").insert({
        user_id: user.id,
        project_id: targetProjectId,
        studio: dbStudio(targetStudio),
        asset_type: "library_reference",
        title: source.title,
        file_url: publicData.publicUrl,
        thumbnail_url: contentType.startsWith("image/") ? publicData.publicUrl : null,
        version: 1,
        metadata: {
          source: "assets_library",
          source_key: sourceKey,
          source_kind: source.kind,
          imported_at: new Date().toISOString(),
          production_ready: false,
        },
      }).select("id").single();
      if (insertError) {
        await admin.storage.from("project-assets").remove([storagePath]);
        throw insertError;
      }

      const href = targetStudio === "brand" ? `/dashboard/brand/${targetProjectId}?libraryAsset=${imported.id}`
        : targetStudio === "architecture" ? `/dashboard/architecture/${targetProjectId}?libraryAsset=${imported.id}`
          : `/${targetStudio}-studio?project=${encodeURIComponent(targetProjectId)}&libraryAsset=${imported.id}`;
      return NextResponse.json({ success: true, importedAssetId: imported.id, href });
    }

    return NextResponse.json({ success: false, error: "Unsupported Assets Library action." }, { status: 400 });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Assets library action error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not update the asset." }, { status: 500 });
  }
}
