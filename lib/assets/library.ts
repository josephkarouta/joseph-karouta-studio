import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AssetLibraryStudio = "brand" | "architecture" | "interior" | "marketing" | "production" | "tools" | "other";
export type AssetLibraryStatus = "Draft" | "Approved" | "Final" | "Source";

export type AssetLibraryItem = {
  sourceKey: string;
  sourceKind: string;
  sourceId: string;
  studio: AssetLibraryStudio;
  projectId: string | null;
  projectName: string;
  projectHref: string | null;
  title: string;
  originalTitle: string;
  assetType: string;
  assetTypeLabel: string;
  status: AssetLibraryStatus;
  version: number;
  productionReady: boolean;
  archived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  previewUrl: string | null;
  mimeType: string | null;
  locked: boolean;
  reusable: boolean;
  metadata: Record<string, unknown>;
  versionFamilyKey?: string | null;
  versionCount?: number;
};

export type AssetLibraryProject = {
  id: string;
  name: string;
  studio: Exclude<AssetLibraryStudio, "production" | "tools" | "other">;
  href: string;
};

type ProjectMaps = {
  brand: Map<string, string>;
  architecture: Map<string, string>;
  generic: Map<string, { name: string; studio: "interior" | "marketing" }>;
};

type OverrideRow = {
  source_key: string;
  display_title: string | null;
  archived_at: string | null;
  hidden_at: string | null;
};

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i;
const PDF_EXTENSION = /\.pdf(\?|$)/i;

function asObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return typeof value === "object" ? value as Record<string, any> : {};
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberValue(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export function humanize(value: unknown) {
  return String(value || "asset")
    .replace(/^marketing_visual_/, "")
    .replace(/^interior_(plan|visual)_/, "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function normalizeStudio(value: unknown): AssetLibraryStudio {
  const studio = String(value || "").toLowerCase();
  if (studio.includes("brand")) return "brand";
  if (studio.includes("architect")) return "architecture";
  if (studio.includes("interior")) return "interior";
  if (studio.includes("marketing")) return "marketing";
  if (studio.includes("production")) return "production";
  if (studio.includes("tool")) return "tools";
  return "other";
}

function projectHref(studio: AssetLibraryStudio, projectId: string | null, production = false) {
  if (!projectId) return null;
  if (studio === "brand") return `/dashboard/brand/${projectId}${production ? "?tab=production" : ""}`;
  if (studio === "architecture") return `/dashboard/architecture/${projectId}${production ? "?tab=production" : ""}`;
  if (studio === "interior") return `/interior-studio?project=${encodeURIComponent(projectId)}${production ? "&tab=production" : ""}`;
  if (studio === "marketing") return `/marketing-studio?project=${encodeURIComponent(projectId)}${production ? "&tab=production" : ""}`;
  return null;
}

function inferStatus(assetType: string, metadata: Record<string, any>, explicitApproved = false, explicitFinal = false): AssetLibraryStatus {
  const type = assetType.toLowerCase();
  const stage = String(metadata.stage || metadata.generation_stage || "").toLowerCase();
  if (explicitFinal || stage === "final" || type.includes("final") || type.includes("deliverable")) return "Final";
  if (explicitApproved || metadata.approved === true || metadata.approved === "true" || type.includes("approval") || type.includes("selected")) return "Approved";
  if (type.includes("source") || type.includes("existing") || type.includes("document")) return "Source";
  return "Draft";
}

function inferPreviewFromPayload(row: any) {
  const payload = asObject(row.payload || row.output_payload);
  const candidates: unknown[] = [
    row.thumbnail_url,
    row.file_url,
    payload.imageUrl,
    payload.image_url,
    payload.url,
    payload.preview_url,
    payload.moodboards?.[0]?.imageUrl,
    payload.variations?.[0]?.imageUrl,
    payload.logos?.[0]?.imageUrl,
    payload.directions?.[0]?.imageUrl,
    payload.conceptsByDirection?.[0]?.imageUrl,
  ];
  return stringValue(...candidates) || null;
}

async function signedUrlMap(
  admin: SupabaseClient,
  bucket: string,
  paths: unknown[],
  seconds = 60 * 20,
) {
  const uniquePaths = Array.from(new Set(paths.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))));
  const result = new Map<string, string>();

  // Supabase can sign a batch in one request. The previous implementation
  // signed every file serially, which made larger libraries exceed Netlify's
  // request window before the page received any data.
  for (let index = 0; index < uniquePaths.length; index += 100) {
    const batch = uniquePaths.slice(index, index + 100);
    const { data, error } = await admin.storage.from(bucket).createSignedUrls(batch, seconds);
    if (error) {
      console.error(`Assets Library could not sign a ${bucket} batch:`, error.message);
      continue;
    }
    for (const item of data || []) {
      if (item.path && item.signedUrl) result.set(String(item.path), String(item.signedUrl));
    }
  }

  return result;
}

function mimeFromUrl(url: string | null, fallback?: unknown) {
  if (typeof fallback === "string" && fallback.trim()) return fallback;
  if (!url) return null;
  if (PDF_EXTENSION.test(url)) return "application/pdf";
  if (IMAGE_EXTENSIONS.test(url)) return "image/*";
  return null;
}

function applyOverride(item: AssetLibraryItem, override?: OverrideRow) {
  if (!override) return item;
  return {
    ...item,
    title: override.display_title?.trim() || item.title,
    archived: Boolean(override.archived_at),
    metadata: { ...item.metadata, libraryHidden: Boolean(override.hidden_at) },
  };
}

export async function loadAssetLibrary(admin: SupabaseClient, userId: string) {
  const [brandsRes, architectureProjectsRes, studioProjectsRes, assetsRes, architectureVisualsRes, architectureDirectionsRes, architectureConceptsRes, architectureDocumentsRes, jobsRes, overridesRes] = await Promise.all([
    admin.from("brand_projects").select("id,project_name,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
    admin.from("architecture_projects").select("id,project_name,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
    admin.from("studio_projects").select("id,studio,project_name,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
    admin.from("project_assets").select("id,project_id,studio,asset_type,title,payload,file_url,thumbnail_url,metadata,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    admin.from("architecture_visuals").select("id,project_id,visual_type,title,image_url,storage_path,is_approved,metadata,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    admin.from("architecture_directions").select("id,project_id,direction_number,title,image_url,image_storage_path,is_selected,generation_json,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(250),
    admin.from("architecture_concepts").select("id,project_id,title,image_url,generation_json,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(250),
    admin.from("architecture_documents").select("id,project_id,category,filename,storage_path,mime_type,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    admin.from("production_jobs").select("id,project_id,project_name,studio,service,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    admin.from("asset_library_overrides").select("source_key,display_title,archived_at,hidden_at").eq("user_id", userId).limit(2000),
  ]);

  const brands = brandsRes.data || [];
  const architectureProjects = architectureProjectsRes.data || [];
  const studioProjects = studioProjectsRes.data || [];
  const architectureSignedUrls = await signedUrlMap(admin, "architecture-files", [
    ...(architectureVisualsRes.data || []).map((row: any) => row.storage_path),
    ...(architectureDirectionsRes.data || []).map((row: any) => row.image_storage_path),
    ...(architectureDocumentsRes.data || []).map((row: any) => row.storage_path),
  ]);

  const maps: ProjectMaps = {
    brand: new Map(brands.map((row: any) => [String(row.id), stringValue(row.project_name) || "Brand project"])),
    architecture: new Map(architectureProjects.map((row: any) => [String(row.id), stringValue(row.project_name) || "Architecture project"])),
    generic: new Map(studioProjects.map((row: any) => {
      const studio = normalizeStudio(row.studio) === "marketing" ? "marketing" : "interior";
      return [String(row.id), { name: stringValue(row.project_name) || `${humanize(studio)} project`, studio }];
    })),
  };

  const projects: AssetLibraryProject[] = [
    ...brands.map((row: any) => ({ id: String(row.id), name: maps.brand.get(String(row.id)) || "Brand project", studio: "brand" as const, href: projectHref("brand", String(row.id))! })),
    ...architectureProjects.map((row: any) => ({ id: String(row.id), name: maps.architecture.get(String(row.id)) || "Architecture project", studio: "architecture" as const, href: projectHref("architecture", String(row.id))! })),
    ...studioProjects.map((row: any) => {
      const record = maps.generic.get(String(row.id))!;
      return { id: String(row.id), name: record.name, studio: record.studio, href: projectHref(record.studio, String(row.id))! };
    }),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const overrideMap = new Map<string, OverrideRow>((overridesRes.data || []).map((row: any) => [String(row.source_key), row]));
  const items: AssetLibraryItem[] = [];

  for (const row of assetsRes.data || []) {
    const studio = normalizeStudio(row.studio || row.metadata?.studio);
    const projectId = row.project_id ? String(row.project_id) : null;
    const genericProject = projectId ? maps.generic.get(projectId) : undefined;
    const resolvedStudio = studio === "other" && genericProject ? genericProject.studio : studio;
    const projectName = projectId
      ? resolvedStudio === "brand" ? maps.brand.get(projectId)
        : resolvedStudio === "architecture" ? maps.architecture.get(projectId)
          : maps.generic.get(projectId)?.name
      : null;
    const metadata = asObject(row.metadata);
    const assetType = String(row.asset_type || "asset");
    const sourceKey = `project_asset:${row.id}`;
    const previewUrl = inferPreviewFromPayload(row);
    const status = inferStatus(assetType, metadata);
    const item = applyOverride({
      sourceKey,
      sourceKind: "project_asset",
      sourceId: String(row.id),
      studio: resolvedStudio,
      projectId,
      projectName: projectName || (projectId ? "Project" : "Global asset"),
      projectHref: projectHref(resolvedStudio, projectId),
      title: stringValue(row.title) || humanize(assetType),
      originalTitle: stringValue(row.title) || humanize(assetType),
      assetType,
      assetTypeLabel: humanize(assetType),
      status,
      version: numberValue(metadata.version),
      productionReady: status === "Approved" || status === "Final" || metadata.production_ready === true,
      archived: false,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || row.created_at || null,
      previewUrl,
      mimeType: mimeFromUrl(previewUrl, metadata.mime_type),
      locked: false,
      reusable: Boolean(previewUrl),
      metadata,
    }, overrideMap.get(sourceKey));
    if (!item.metadata.libraryHidden) items.push(item);
  }

  for (const row of architectureVisualsRes.data || []) {
    const projectId = String(row.project_id || "");
    const storagePath = stringValue(row.storage_path);
    const previewUrl = storagePath ? architectureSignedUrls.get(storagePath) || stringValue(row.image_url) || null : stringValue(row.image_url) || null;
    const metadata = asObject(row.metadata);
    const assetType = `architecture_${String(row.visual_type || "visual")}`;
    const sourceKey = `architecture_visual:${row.id}`;
    const status = inferStatus(assetType, metadata, Boolean(row.is_approved), String(metadata.stage || "").toLowerCase() === "final");
    const item = applyOverride({
      sourceKey, sourceKind: "architecture_visual", sourceId: String(row.id), studio: "architecture", projectId,
      projectName: maps.architecture.get(projectId) || "Architecture project", projectHref: projectHref("architecture", projectId),
      title: stringValue(row.title) || humanize(row.visual_type || "Architecture visual"), originalTitle: stringValue(row.title) || humanize(row.visual_type || "Architecture visual"),
      assetType, assetTypeLabel: humanize(row.visual_type || "Architecture visual"), status,
      version: numberValue(metadata.version), productionReady: status === "Approved" || status === "Final", archived: false,
      createdAt: row.created_at || null, updatedAt: row.updated_at || row.created_at || null, previewUrl,
      mimeType: mimeFromUrl(previewUrl, metadata.mime_type), locked: false, reusable: Boolean(previewUrl), metadata,
    }, overrideMap.get(sourceKey));
    if (!item.metadata.libraryHidden) items.push(item);
  }

  for (const row of architectureDirectionsRes.data || []) {
    const projectId = String(row.project_id || "");
    const storagePath = stringValue(row.image_storage_path);
    const previewUrl = storagePath ? architectureSignedUrls.get(storagePath) || stringValue(row.image_url) || null : stringValue(row.image_url) || null;
    if (!previewUrl) continue;
    const sourceKey = `architecture_direction:${row.id}`;
    const status = row.is_selected ? "Approved" : "Draft";
    const item = applyOverride({
      sourceKey, sourceKind: "architecture_direction", sourceId: String(row.id), studio: "architecture", projectId,
      projectName: maps.architecture.get(projectId) || "Architecture project", projectHref: projectHref("architecture", projectId),
      title: stringValue(row.title) || `Direction ${row.direction_number || ""}`.trim(), originalTitle: stringValue(row.title) || `Direction ${row.direction_number || ""}`.trim(),
      assetType: "architecture_direction", assetTypeLabel: "Creative Direction", status,
      version: 1, productionReady: Boolean(row.is_selected), archived: false,
      createdAt: row.created_at || null, updatedAt: row.updated_at || row.created_at || null, previewUrl,
      mimeType: mimeFromUrl(previewUrl), locked: false, reusable: true, metadata: asObject(row.generation_json),
    }, overrideMap.get(sourceKey));
    if (!item.metadata.libraryHidden) items.push(item);
  }

  for (const row of architectureConceptsRes.data || []) {
    const projectId = String(row.project_id || "");
    const previewUrl = stringValue(row.image_url) || null;
    if (!previewUrl) continue;
    const sourceKey = `architecture_concept:${row.id}`;
    const item = applyOverride({
      sourceKey, sourceKind: "architecture_concept", sourceId: String(row.id), studio: "architecture", projectId,
      projectName: maps.architecture.get(projectId) || "Architecture project", projectHref: projectHref("architecture", projectId),
      title: stringValue(row.title) || "Architecture Concept", originalTitle: stringValue(row.title) || "Architecture Concept",
      assetType: "architecture_concept", assetTypeLabel: "Concept", status: "Draft", version: 1, productionReady: false, archived: false,
      createdAt: row.created_at || null, updatedAt: row.updated_at || row.created_at || null, previewUrl,
      mimeType: mimeFromUrl(previewUrl), locked: false, reusable: true, metadata: asObject(row.generation_json),
    }, overrideMap.get(sourceKey));
    if (!item.metadata.libraryHidden) items.push(item);
  }

  for (const row of architectureDocumentsRes.data || []) {
    const projectId = String(row.project_id || "");
    const path = stringValue(row.storage_path);
    if (!path) continue;
    const previewUrl = architectureSignedUrls.get(path) || null;
    const sourceKey = `architecture_document:${row.id}`;
    const item = applyOverride({
      sourceKey, sourceKind: "architecture_document", sourceId: String(row.id), studio: "architecture", projectId,
      projectName: maps.architecture.get(projectId) || "Architecture project", projectHref: projectHref("architecture", projectId),
      title: stringValue(row.filename) || humanize(row.category || "Source drawing"), originalTitle: stringValue(row.filename) || humanize(row.category || "Source drawing"),
      assetType: `architecture_source_${String(row.category || "document")}`, assetTypeLabel: humanize(row.category || "Source Drawing"), status: "Source",
      version: 1, productionReady: true, archived: false, createdAt: row.created_at || null, updatedAt: row.created_at || null,
      previewUrl, mimeType: stringValue(row.mime_type) || mimeFromUrl(previewUrl), locked: false, reusable: Boolean(previewUrl), metadata: { storagePath: path },
    }, overrideMap.get(sourceKey));
    if (!item.metadata.libraryHidden) items.push(item);
  }

  const jobs = jobsRes.data || [];
  const jobIds = jobs.map((job: any) => String(job.id));
  if (jobIds.length) {
    const { data: deliverables } = await admin.from("production_deliverables").select("id,production_job_id,storage_path,original_filename,filename,mime_type,version,published_at,uploaded_at,created_at").in("production_job_id", jobIds).eq("client_visible", true).order("uploaded_at", { ascending: false }).limit(1000);
    const jobMap = new Map(jobs.map((job: any) => [String(job.id), job]));
    const productionSignedUrls = await signedUrlMap(admin, "production-files", (deliverables || []).map((row: any) => row.storage_path));
    for (const row of deliverables || []) {
      const job: any = jobMap.get(String(row.production_job_id));
      if (!job) continue;
      const projectId = job.project_id ? String(job.project_id) : null;
      const studio = normalizeStudio(job.studio);
      const path = stringValue(row.storage_path);
      const previewUrl = path ? productionSignedUrls.get(path) || null : null;
      const sourceKey = `production_deliverable:${row.id}`;
      const projectName = stringValue(job.project_name)
        || (projectId ? (studio === "brand" ? maps.brand.get(projectId) : studio === "architecture" ? maps.architecture.get(projectId) : maps.generic.get(projectId)?.name) : "")
        || "Production project";
      const item = applyOverride({
        sourceKey, sourceKind: "production_deliverable", sourceId: String(row.id), studio: "production", projectId,
        projectName, projectHref: projectHref(studio, projectId, true),
        title: stringValue(row.original_filename, row.filename) || "Production Deliverable", originalTitle: stringValue(row.original_filename, row.filename) || "Production Deliverable",
        assetType: "production_deliverable", assetTypeLabel: "Production Final", status: "Final",
        version: numberValue(row.version), productionReady: true, archived: false,
        createdAt: row.published_at || row.uploaded_at || row.created_at || null, updatedAt: row.published_at || row.uploaded_at || row.created_at || null,
        previewUrl, mimeType: stringValue(row.mime_type) || mimeFromUrl(previewUrl), locked: true, reusable: false,
        metadata: { productionJobId: row.production_job_id, storagePath: path, service: job.service || null },
      }, overrideMap.get(sourceKey));
      if (!item.metadata.libraryHidden) items.push(item);
    }
  }

  // Phase 5: when version history is installed, show only the selected/current version
  // of each logical asset family in the Assets Library. Older generations remain
  // available from Version History instead of cluttering the main Library.
  let visibleItems = items;
  const { data: versionRows, error: versionError } = await admin
    .from("project_version_history")
    .select("family_key,source_kind,source_id,version_number,is_current")
    .eq("user_id", userId)
    .limit(5000);
  if (!versionError && versionRows?.length) {
    const bySource = new Map<string, any>();
    const familyCounts = new Map<string, number>();
    for (const row of versionRows) {
      bySource.set(`${row.source_kind}:${row.source_id}`, row);
      familyCounts.set(String(row.family_key), (familyCounts.get(String(row.family_key)) || 0) + 1);
    }
    visibleItems = items.filter((item) => {
      const version = bySource.get(item.sourceKey);
      if (!version) return true;
      item.version = Number(version.version_number || item.version || 1);
      item.versionFamilyKey = String(version.family_key);
      item.versionCount = familyCounts.get(String(version.family_key)) || 1;
      item.metadata = { ...item.metadata, versionFamilyKey: item.versionFamilyKey, versionCount: item.versionCount };
      return Boolean(version.is_current);
    });
  }

  visibleItems.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());

  return {
    items: visibleItems,
    projects,
    setupRequired: Boolean(overridesRes.error && String(overridesRes.error.message || "").includes("asset_library_overrides")),
    versionHistoryReady: !versionError,
  };
}

export async function resolveLibrarySource(admin: SupabaseClient, userId: string, sourceKey: string) {
  const [kind, id] = sourceKey.split(":", 2);
  if (!kind || !id) return null;
  if (kind === "project_asset") {
    const { data } = await admin.from("project_assets").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) return null;
    return { kind, row: data, title: stringValue(data.title) || "Saved asset", url: inferPreviewFromPayload(data), storageBucket: null, storagePath: null };
  }
  if (kind === "architecture_visual") {
    const { data } = await admin.from("architecture_visuals").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) return null;
    return { kind, row: data, title: stringValue(data.title) || humanize(data.visual_type), url: stringValue(data.image_url) || null, storageBucket: "architecture-files", storagePath: stringValue(data.storage_path) || null };
  }
  if (kind === "architecture_direction") {
    const { data } = await admin.from("architecture_directions").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) return null;
    return { kind, row: data, title: stringValue(data.title) || "Architecture direction", url: stringValue(data.image_url) || null, storageBucket: "architecture-files", storagePath: stringValue(data.image_storage_path) || null };
  }
  if (kind === "architecture_concept") {
    const { data } = await admin.from("architecture_concepts").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) return null;
    return { kind, row: data, title: stringValue(data.title) || "Architecture concept", url: stringValue(data.image_url) || null, storageBucket: null, storagePath: null };
  }
  if (kind === "architecture_document") {
    const { data } = await admin.from("architecture_documents").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) return null;
    return { kind, row: data, title: stringValue(data.filename) || "Architecture source", url: null, storageBucket: "architecture-files", storagePath: stringValue(data.storage_path) || null };
  }
  if (kind === "production_deliverable") {
    const { data } = await admin.from("production_deliverables").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const { data: job } = await admin.from("production_jobs").select("id,user_id").eq("id", data.production_job_id).eq("user_id", userId).maybeSingle();
    if (!job) return null;
    return { kind, row: data, title: stringValue(data.original_filename, data.filename) || "Production deliverable", url: null, storageBucket: "production-files", storagePath: stringValue(data.storage_path) || null };
  }
  return null;
}
