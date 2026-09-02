import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { loadVersionHistory } from "@/lib/versions/history";
import { getWorkspaceStorageEntitlement } from "@/lib/workspace-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POWERPOINT_PREVIEW = "/images/powerpoint-asset-preview.png";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const entitlement = await getWorkspaceStorageEntitlement(admin, user.id);
    if (!entitlement.canBrowse) {
      return NextResponse.json({ success: true, families: [], totalVersions: 0, storage: entitlement });
    }

    const history = await loadVersionHistory(admin, user.id);
    const families = Array.isArray(history.families)
      ? history.families
          .filter((family) => !isSupportOnlyMaterialFamily(family))
          .map((family) => addPresentationFamilyPreview(family))
      : [];

    const totalVersions = families.reduce((sum, family) => {
      const record = asRecord(family);
      return sum + (Array.isArray(record.versions) ? record.versions.length : 0);
    }, 0);

    return NextResponse.json({ success: true, ...history, families, totalVersions, storage: entitlement });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Version history load error:", error);
    return NextResponse.json({ success: false, error: "Could not load version history." }, { status: 500 });
  }
}

function isSupportOnlyMaterialFamily(value: unknown) {
  // The history loader can shape fields differently depending on the source.
  // Search the complete family + versions record instead of relying on one
  // sourceKind field. This catches the existing "SOURCE CUSTOM MATERIAL"
  // families seen in Architecture without hiding meaningful material-detail
  // renders such as "Materials & Lighting Detail — Preview".
  const haystack = normalized(safeJson(value));

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

function addPresentationFamilyPreview<T>(value: T): T {
  const family = asRecord(value);
  const versions = Array.isArray(family.versions) ? family.versions : [];
  const presentation = isPowerPoint(family) || versions.some((version) => isPowerPoint(asRecord(version)));
  if (!presentation) return value;

  const nextVersions = versions.map((version) => {
    const record = asRecord(version);
    if (hasRealPreview(record)) return version;
    return {
      ...record,
      previewUrl: POWERPOINT_PREVIEW,
      preview_url: POWERPOINT_PREVIEW,
      thumbnailUrl: POWERPOINT_PREVIEW,
      thumbnail_url: POWERPOINT_PREVIEW,
    };
  });

  const familyHasPreview = hasRealPreview(family);
  return {
    ...family,
    previewUrl: familyHasPreview ? firstValue(family, ["previewUrl", "preview_url", "thumbnailUrl", "thumbnail_url"]) : POWERPOINT_PREVIEW,
    preview_url: familyHasPreview ? firstValue(family, ["preview_url", "previewUrl", "thumbnail_url", "thumbnailUrl"]) : POWERPOINT_PREVIEW,
    thumbnailUrl: familyHasPreview ? firstValue(family, ["thumbnailUrl", "thumbnail_url", "previewUrl", "preview_url"]) : POWERPOINT_PREVIEW,
    thumbnail_url: familyHasPreview ? firstValue(family, ["thumbnail_url", "thumbnailUrl", "preview_url", "previewUrl"]) : POWERPOINT_PREVIEW,
    versions: nextVersions,
  } as T;
}

function isPowerPoint(item: Record<string, unknown>) {
  const haystack = normalized([
    firstValue(item, ["assetType", "asset_type", "assetTypeLabel", "asset_type_label", "type"]),
    firstValue(item, ["mimeType", "mime_type", "contentType", "content_type"]),
    firstValue(item, ["previewUrl", "preview_url", "fileUrl", "file_url", "url", "title"]),
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
