import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { loadAssetLibrary } from "@/lib/assets/library";
import { getWorkspaceStorageEntitlement } from "@/lib/workspace-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POWERPOINT_PREVIEW = "/images/powerpoint-asset-preview.png";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const entitlement = await getWorkspaceStorageEntitlement(admin, user.id);
    if (!entitlement.canBrowse) {
      return NextResponse.json({
        success: true,
        items: [],
        projects: [],
        setupRequired: false,
        versionHistoryReady: true,
        storage: entitlement,
      });
    }

    const library = await loadAssetLibrary(admin, user.id);
    const items = Array.isArray(library.items)
      ? library.items
          .filter((item) => !isSupportOnlyMaterialItem(item))
          .map((item) => addPresentationPreview(item))
      : [];

    return NextResponse.json({ success: true, ...library, items, storage: entitlement });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Assets library load error:", error);
    return NextResponse.json(
      { success: false, error: "Could not load the Assets Library." },
      { status: 500 },
    );
  }
}

function isSupportOnlyMaterialItem(value: unknown) {
  const item = asRecord(value);
  const haystack = normalized(safeJson(item));

  return [
    "source-custom-material",
    "source custom material",
    "custom-material",
    "custom material",
    "material-file",
    "material file",
    "color-swatch",
    "color swatch",
    "colour-swatch",
    "colour swatch",
    "paint-swatch",
    "paint swatch",
  ].some((token) => haystack.includes(token));
}

function addPresentationPreview<T>(value: T): T {
  const item = asRecord(value);
  if (!isPowerPoint(item) || hasRealPreview(item)) return value;

  return {
    ...item,
    thumbnailUrl: POWERPOINT_PREVIEW,
    thumbnail_url: POWERPOINT_PREVIEW,
    previewUrl: POWERPOINT_PREVIEW,
    preview_url: POWERPOINT_PREVIEW,
  } as T;
}

function isPowerPoint(item: Record<string, unknown>) {
  const haystack = normalized([
    firstValue(item, ["assetType", "asset_type", "type", "assetTypeLabel", "asset_type_label"]),
    firstValue(item, ["mimeType", "mime_type", "contentType", "content_type"]),
    firstValue(item, ["fileUrl", "file_url", "url", "filename", "title"]),
  ].filter(Boolean).join(" "));

  return haystack.includes("powerpoint") || haystack.includes("presentation") || haystack.includes("pptx");
}

function hasRealPreview(item: Record<string, unknown>) {
  const preview = firstValue(item, ["thumbnailUrl", "thumbnail_url", "previewUrl", "preview_url"]);
  return Boolean(preview && !preview.startsWith("data:"));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function firstValue(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

function normalized(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "";
  }
}
