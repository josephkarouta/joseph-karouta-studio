import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type VersionStatus = "draft" | "approved" | "rejected" | "final" | "source";

export type VersionHistoryItem = {
  id: string;
  studio: string;
  studioLabel: string;
  projectId: string | null;
  projectName: string;
  projectHref: string | null;
  familyKey: string;
  sourceKind: string;
  sourceId: string;
  versionNumber: number;
  title: string;
  assetType: string;
  assetTypeLabel: string;
  status: VersionStatus;
  creditCost: number | null;
  changeSummary: string | null;
  userNote: string | null;
  isCurrent: boolean;
  restoredFromVersionId: string | null;
  createdAt: string;
  previewUrl: string | null;
  mimeType: string | null;
  canRestore: boolean;
};

export type VersionFamily = {
  familyKey: string;
  studio: string;
  studioLabel: string;
  projectId: string | null;
  projectName: string;
  projectHref: string | null;
  title: string;
  assetType: string;
  assetTypeLabel: string;
  currentVersion: number;
  status: VersionStatus;
  previewUrl: string | null;
  updatedAt: string;
  versions: VersionHistoryItem[];
};

function objectValue(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, any>;
}

function stringValue(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function humanize(value: unknown) {
  return String(value || "Asset")
    .replace(/^marketing_visual_/, "")
    .replace(/^interior_(plan|visual)_/, "")
    .replace(/^architecture_/, "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function normalizedStudio(value: unknown) {
  const studio = String(value || "").toLowerCase();
  if (studio.includes("brand")) return "brand";
  if (studio.includes("architect")) return "architecture";
  if (studio.includes("interior")) return "interior";
  if (studio.includes("marketing")) return "marketing";
  if (studio.includes("production")) return "production";
  if (studio.includes("tool")) return "tools";
  return studio || "other";
}

function studioLabel(studio: string) {
  return studio === "brand" ? "Brand Studio"
    : studio === "architecture" ? "Architecture Studio"
      : studio === "interior" ? "Interior Studio"
        : studio === "marketing" ? "Marketing Studio"
          : studio === "production" ? "Production"
            : studio === "tools" ? "AI Tools"
              : "Workspace";
}

function projectHref(studio: string, projectId: string | null) {
  if (!projectId) return null;
  if (studio === "brand") return `/dashboard/brand/${projectId}`;
  if (studio === "architecture") return `/dashboard/architecture/${projectId}`;
  if (studio === "interior") return `/interior-studio?project=${encodeURIComponent(projectId)}`;
  if (studio === "marketing") return `/marketing-studio?project=${encodeURIComponent(projectId)}`;
  return null;
}

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i;
const POWERPOINT_PREVIEW = "/images/powerpoint-asset-preview.png";
const VIDEO_PREVIEW = "/images/video-asset-preview.png";
const GUIDELINES_PREVIEW = "/images/guidelines-asset-preview.png";

function isSupportOnlyVersion(row: any) {
  const snapshot = objectValue(row?.snapshot);
  const metadata = objectValue(snapshot.metadata);
  const haystack = [
    row?.source_kind,
    row?.asset_type,
    row?.title,
    row?.family_key,
    snapshot.category,
    snapshot.asset_type,
    snapshot.assetType,
    snapshot.title,
    snapshot.filename,
    metadata.source,
    metadata.category,
    metadata.kind,
  ]
    .map((value) => String(value || "").toLowerCase().replaceAll("-", "_").replace(/\s+/g, "_"))
    .join(" ");

  return (
    haystack.includes("custom_material") ||
    haystack.includes("source_custom_material") ||
    haystack.includes("material_swatch") ||
    haystack.includes("color_swatch") ||
    haystack.includes("colour_swatch") ||
    haystack.includes("paint_swatch") ||
    haystack.includes("palette_swatch")
  );
}

function fallbackPreviewForProjectAsset(
  assetType: string,
  url: string | null,
  metadata: Record<string, any>,
) {
  if (url && IMAGE_EXTENSION.test(url)) {
    return { url, mime: stringValue(metadata.content_type, metadata.mime_type) || "image/*" };
  }

  const type = assetType.toLowerCase().replaceAll("-", "_");
  const contentType = stringValue(metadata.content_type, metadata.mime_type).toLowerCase();

  if (
    type.includes("powerpoint") ||
    type.includes("presentation") ||
    contentType.includes("presentationml.presentation") ||
    contentType.includes("ms-powerpoint")
  ) {
    return { url: POWERPOINT_PREVIEW, mime: "image/png" };
  }

  if (type.includes("video") || contentType.startsWith("video/")) {
    return { url: VIDEO_PREVIEW, mime: "image/png" };
  }

  if (type.includes("guideline")) {
    return { url: GUIDELINES_PREVIEW, mime: "image/png" };
  }

  return { url, mime: stringValue(metadata.content_type, metadata.mime_type) || null };
}

function previewForVersion(
  sourceKind: string,
  assetType: string,
  snapshot: Record<string, any>,
  architectureUrls: Map<string, string>,
  productionUrls: Map<string, string>,
) {
  const metadata = objectValue(snapshot.metadata);
  const payload = objectValue(snapshot.payload);
  if (sourceKind === "project_asset") {
    const url = stringValue(snapshot.thumbnail_url, snapshot.file_url, payload.imageUrl, payload.image_url, payload.url) || null;
    return fallbackPreviewForProjectAsset(assetType, url, metadata);
  }
  if (sourceKind === "architecture_visual") {
    const path = stringValue(snapshot.storage_path);
    return { url: path ? architectureUrls.get(path) || null : stringValue(snapshot.image_url) || null, mime: stringValue(metadata.mime_type) || "image/*" };
  }
  if (sourceKind === "architecture_direction") {
    const path = stringValue(snapshot.image_storage_path);
    return { url: path ? architectureUrls.get(path) || null : stringValue(snapshot.image_url) || null, mime: "image/*" };
  }
  if (sourceKind === "architecture_concept") return { url: stringValue(snapshot.image_url) || null, mime: "image/*" };
  if (sourceKind === "architecture_document") {
    const path = stringValue(snapshot.storage_path);
    return { url: path ? architectureUrls.get(path) || null : null, mime: stringValue(snapshot.mime_type) || null };
  }
  if (sourceKind === "production_deliverable") {
    const path = stringValue(snapshot.storage_path);
    return { url: path ? productionUrls.get(path) || null : null, mime: stringValue(snapshot.mime_type) || null };
  }
  return { url: null, mime: null };
}

export async function loadVersionHistory(admin: SupabaseClient, userId: string) {
  const [historyRes, brandRes, architectureRes, studioRes] = await Promise.all([
    admin.from("project_version_history").select("id,studio,project_id,family_key,source_kind,source_id,version_number,title,asset_type,status,credit_cost,change_summary,user_note,is_current,restored_from_version_id,created_at,snapshot").eq("user_id", userId).order("created_at", { ascending: false }).limit(4000),
    admin.from("brand_projects").select("id,project_name").eq("user_id", userId).limit(500),
    admin.from("architecture_projects").select("id,project_name").eq("user_id", userId).limit(500),
    admin.from("studio_projects").select("id,studio,project_name").eq("user_id", userId).limit(1000),
  ]);
  if (historyRes.error) throw historyRes.error;

  const projectNames = new Map<string, string>();
  for (const row of brandRes.data || []) projectNames.set(`brand:${row.id}`, stringValue(row.project_name) || "Brand project");
  for (const row of architectureRes.data || []) projectNames.set(`architecture:${row.id}`, stringValue(row.project_name) || "Architecture project");
  for (const row of studioRes.data || []) {
    const studio = normalizedStudio(row.studio);
    projectNames.set(`${studio}:${row.id}`, stringValue(row.project_name) || `${humanize(studio)} project`);
  }

  const historyRows = (historyRes.data || []).filter((row: any) => !isSupportOnlyVersion(row));
  const architecturePaths: string[] = [];
  const productionPaths: string[] = [];
  for (const row of historyRows) {
    const snapshot = objectValue(row.snapshot);
    const sourceKind = String(row.source_kind || "");
    if (sourceKind === "architecture_direction") {
      const path = stringValue(snapshot.image_storage_path);
      if (path) architecturePaths.push(path);
    } else if (["architecture_visual", "architecture_document"].includes(sourceKind)) {
      const path = stringValue(snapshot.storage_path);
      if (path) architecturePaths.push(path);
    } else if (sourceKind === "production_deliverable") {
      const path = stringValue(snapshot.storage_path);
      if (path) productionPaths.push(path);
    }
  }
  const [architectureUrls, productionUrls] = await Promise.all([
    signedUrlMap(admin, "architecture-files", architecturePaths),
    signedUrlMap(admin, "production-files", productionPaths),
  ]);

  const items: VersionHistoryItem[] = [];
  for (const row of historyRows) {
    const studio = normalizedStudio(row.studio);
    const projectId = row.project_id ? String(row.project_id) : null;
    const snapshot = objectValue(row.snapshot);
    const sourceKind = String(row.source_kind || "");
    const preview = previewForVersion(sourceKind, String(row.asset_type || "asset"), snapshot, architectureUrls, productionUrls);

    // Do not track an Architecture visual row that never produced a visual.
    if (sourceKind === "architecture_visual" && !preview.url) continue;

    items.push({
      id: String(row.id),
      studio,
      studioLabel: studioLabel(studio),
      projectId,
      projectName: projectId ? projectNames.get(`${studio}:${projectId}`) || stringValue(snapshot.project_name) || "Project" : "Global asset",
      projectHref: projectHref(studio, projectId),
      familyKey: String(row.family_key),
      sourceKind: String(row.source_kind),
      sourceId: String(row.source_id),
      versionNumber: Number(row.version_number || 1),
      title: String(row.title || humanize(row.asset_type)),
      assetType: String(row.asset_type || "asset"),
      assetTypeLabel: humanize(row.asset_type),
      status: String(row.status || "draft") as VersionStatus,
      creditCost: Number.isFinite(Number(row.credit_cost)) ? Number(row.credit_cost) : null,
      changeSummary: row.change_summary ? String(row.change_summary) : null,
      userNote: row.user_note ? String(row.user_note) : null,
      isCurrent: Boolean(row.is_current),
      restoredFromVersionId: row.restored_from_version_id ? String(row.restored_from_version_id) : null,
      createdAt: String(row.created_at),
      previewUrl: preview.url,
      mimeType: preview.mime,
      canRestore: String(row.source_kind) !== "production_deliverable" && String(row.status) !== "source",
    });
  }

  const grouped = new Map<string, VersionHistoryItem[]>();
  for (const item of items) grouped.set(item.familyKey, [...(grouped.get(item.familyKey) || []), item]);
  const families: VersionFamily[] = [...grouped.entries()].map(([familyKey, versions]) => {
    versions.sort((a, b) => b.versionNumber - a.versionNumber);
    const current = versions.find((version) => version.isCurrent) || versions[0];
    return {
      familyKey,
      studio: current.studio,
      studioLabel: current.studioLabel,
      projectId: current.projectId,
      projectName: current.projectName,
      projectHref: current.projectHref,
      title: current.title,
      assetType: current.assetType,
      assetTypeLabel: current.assetTypeLabel,
      currentVersion: current.versionNumber,
      status: current.status,
      previewUrl: current.previewUrl,
      updatedAt: current.createdAt,
      versions,
    };
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return { families, totalVersions: items.length };
}

async function signedUrlMap(
  admin: SupabaseClient,
  bucket: string,
  paths: string[],
) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const urls = new Map<string, string>();
  for (let index = 0; index < uniquePaths.length; index += 100) {
    const batch = uniquePaths.slice(index, index + 100);
    const { data, error } = await admin.storage.from(bucket).createSignedUrls(batch, 60 * 20);
    if (error) {
      console.error(`Version history could not sign a ${bucket} batch:`, error.message);
      continue;
    }
    for (const item of data || []) {
      if (item.path && item.signedUrl) urls.set(String(item.path), String(item.signedUrl));
    }
  }
  return urls;
}
