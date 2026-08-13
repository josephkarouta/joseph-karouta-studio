"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import ProductionPanel from "@/components/studio/production/ProductionPanel";
import HeyySelect from "@/components/ui/heyy-select";
import StudioModeToggle from "@/components/ui/StudioModeToggle";
import StudioLoader from "@/components/ui/StudioLoader";
import { AlertTriangle, Check, ChevronDown, ChevronUp, DraftingCompass, FileText } from "lucide-react";
import ArchitecturePresentationExport from "@/components/studio/architecture/ArchitecturePresentationExport";
import {
  ARCHITECTURE_MATERIAL_CATEGORIES,
  ARCHITECTURE_MATERIAL_LIBRARY as materialLibrary,
  type ArchitectureMaterialLibraryItem as MaterialLibraryItem,
} from "@/lib/architecture/material-library";
import { ARCHITECTURE_CREDIT_COSTS } from "@/lib/ai/credit-costs";
import {
  ARCHITECTURE_PROJECT_TYPES,
  getArchitectureProjectTemplate,
  getArchitectureSpaceDefault,
  getArchitectureMaterialKeywords,
  getArchitecturePaintApplications,
} from "@/lib/architecture/project-templates";

type SourceBrief = {
  workflow_mode?: string | null;
  source_type?: string | null;
  source_status?: string | null;
  desired_floors?: number | null;
  preserve_elements?: string | null;
  requested_changes?: string | null;
  interpretation_level?: string | null;
  render_target?: string | null;
  geometry_rule?: string | null;
  time_of_day?: string | null;
  materials?: string | null;
  landscape_style?: string | null;
  surrounding_context?: string | null;
  render_mood?: string | null;
  camera_views?: string[];
  main_source_files?: string[];
  reference_files?: string[];
};

type Project = {
  id: string;
  user_id: string;
  project_name: string;
  workflow_mode: string;
  project_type: string | null;
  scope: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  architectural_style: string | null;
  selected_spaces: string[] | null;
  notes: string | null;
  source_notes: string | null;
  source_brief: SourceBrief | null;
  working_mode: "guided" | "professional";
  professional_brief: Record<string, unknown> | null;
  status: string;
  completion: number;
  selected_direction_id: string | null;
  created_at: string;
  updated_at: string;
};

type Site = {
  id?: string;
  project_id: string;
  user_id: string;
  land_start: "owned" | "looking" | "exploring";
  address: string | null;
  plot_area: number | null;
  width: number | null;
  depth: number | null;
  desired_floors: number | null;
  terrain: string | null;
  corner_lot: string | null;
  orientation: string | null;
  climate_notes: string | null;
  site_notes: string | null;
};

type Planning = {
  id?: string;
  project_id: string;
  user_id: string;
  zoning: string | null;
  permitted_use: string | null;
  site_coverage_percent: number | null;
  floor_area_ratio: number | null;
  max_height_m: number | null;
  max_floors: number | null;
  front_setback_m: number | null;
  rear_setback_m: number | null;
  side_setback_m: number | null;
  parking_requirement: string | null;
  open_space_requirement: string | null;
  overlays: string | null;
  restrictions: string | null;
  authority_name: string | null;
  source_reference: string | null;
  source_checked_at: string | null;
  verification_status: string;
  confidence: string;
  notes: string | null;
};

type DocumentRow = {
  id: string;
  project_id: string;
  user_id: string;
  category: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  preview_url?: string | null;
};

type SourcePlanType =
  | "ground_floor"
  | "upper_floor"
  | "site_plan"
  | "front_elevation"
  | "rear_elevation"
  | "left_elevation"
  | "right_elevation"
  | "section"
  | "other";

const SOURCE_PLAN_TYPES: Array<{ value: SourcePlanType; label: string }> = [
  { value: "ground_floor", label: "Ground Floor" },
  { value: "upper_floor", label: "Upper / First Floor" },
  { value: "site_plan", label: "Site Plan" },
  { value: "front_elevation", label: "Front Elevation" },
  { value: "rear_elevation", label: "Rear Elevation" },
  { value: "left_elevation", label: "Left Elevation" },
  { value: "right_elevation", label: "Right Elevation" },
  { value: "section", label: "Section" },
  { value: "other", label: "Other Drawing" },
];

function sourcePlanTypeFromCategory(category: string): SourcePlanType | null {
  const prefix = "source-plan-";
  if (!category.startsWith(prefix)) return null;
  const value = category.slice(prefix.length) as SourcePlanType;
  return SOURCE_PLAN_TYPES.some((item) => item.value === value) ? value : null;
}

function sourcePlanLabel(type: SourcePlanType) {
  return SOURCE_PLAN_TYPES.find((item) => item.value === type)?.label || "Source Drawing";
}

type SpaceProgramItem = {
  id?: string;
  project_id: string;
  user_id: string;
  space_name: string;
  zone: string;
  level: string;
  quantity: number;
  area_each_m2: number;
  total_area_m2: number;
  priority: string;
  notes: string | null;
  is_ai_suggested: boolean;
  sort_order: number;
};

type ArchitectureMaterial = {
  id: string;
  project_id: string;
  user_id: string;
  category: string;
  material_key: string;
  name: string;
  image_url: string | null;
  finish: string | null;
  color: string | null;
  application: string | null;
  cost_level: string | null;
  maintenance_level: string | null;
  climate_suitability: string | null;
  sustainability_note: string | null;
  is_selected: boolean;
  is_extracted: boolean;
  source_document_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
};

type CustomMaterialInput = {
  file: File;
  name: string;
  category: string;
  finish: string;
  color: string;
  application: string;
  cost_level: string;
  maintenance_level: string;
  climate_suitability: string;
  sustainability_note: string;
  notes: string;
};

type MaterialPatch = Partial<Pick<
  ArchitectureMaterial,
  "name" | "category" | "finish" | "color" | "application" | "cost_level" |
  "maintenance_level" | "climate_suitability" | "sustainability_note" | "is_selected"
>> & { notes?: string | null };


type DirectionMaterial = {
  name: string;
  role: string;
  description: string;
};

type Direction = {
  id: string;
  project_id: string;
  user_id: string;
  direction_number: number;
  title: string;
  philosophy: string | null;
  site_response: string | null;
  form_strategy: string | null;
  spatial_strategy: string | null;
  facade_strategy: string | null;
  materials: DirectionMaterial[];
  roof_strategy: string | null;
  landscape_strategy: string | null;
  sustainability: string | null;
  natural_light_strategy: string | null;
  privacy_strategy: string | null;
  cost_level: string | null;
  image_prompt: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  is_selected: boolean;
  generation_status: string;
  generation_error: string | null;
  generation_json: Record<string, unknown>;
  generated_at: string | null;
  text_model: string | null;
  image_model: string | null;
  created_at: string;
  updated_at: string;
};



type ArchitectureConcept = {
  id: string;
  project_id: string;
  user_id: string;
  direction_id: string;
  title: string;
  summary: string | null;
  site_response: string | null;
  functional_zoning: string | null;
  circulation: string | null;
  entry_sequence: string | null;
  public_private_zones: string | null;
  indoor_outdoor_relationship: string | null;
  natural_light: string | null;
  ventilation: string | null;
  privacy: string | null;
  material_language: string | null;
  landscape_integration: string | null;
  sustainability: string | null;
  image_url: string | null;
  generation_mode: string;
  generation_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type AreaScheduleItem = {
  space: string;
  level: string;
  approx_area_m2: number;
};

type RelationshipItem = {
  from: string;
  to: string;
  relationship: string;
};

type DimensionItem = {
  label: string;
  value: string;
};

type ArchitecturePlanSet = {
  id: string;
  project_id: string;
  user_id: string;
  direction_id: string;
  title: string;
  planning_assumptions: string[];
  area_schedule: AreaScheduleItem[];
  room_relationships: RelationshipItem[];
  conceptual_dimensions: DimensionItem[];
  total_estimated_area: number | null;
  generation_mode: string;
  generation_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ArchitectureVisual = {
  id: string;
  project_id: string;
  user_id: string;
  direction_id: string | null;
  visual_type: string;
  title: string | null;
  prompt: string | null;
  image_url: string | null;
  storage_path: string | null;
  is_approved: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ArchitectureDesignPack = {
  id: string;
  project_id: string;
  user_id: string;
  direction_id: string;
  title: string;
  version: number;
  status: string;
  included_sections: string[];
  generated_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DemoStage = "concept" | "plans" | "visuals" | "design-pack" | "all";
type ImageGenerationTier = "preview" | "final";
type PlanGenerationMode = "technical" | "rendered";

type EstimateItem = {
  id: string;
  item: string;
  category: string;
  application: string;
  specification: string;
  quantity: number;
  wastePercent: number;
  purchaseQuantity: number;
  unit: string;
  unitPriceLowUsd: number;
  unitPriceHighUsd: number;
  supplierSuggestion: string;
};

type ProjectEstimate = {
  generatedAt: string;
  currency: "USD";
  items: EstimateItem[];
  lowTotalUsd: number;
  highTotalUsd: number;
  assumptions: string[];
};

type TabId =
  | "overview"
  | "brief"
  | "source"
  | "site"
  | "planning"
  | "program"
  | "materials"
  | "directions"
  | "concept"
  | "plans"
  | "visuals"
  | "design-pack"
  | "estimate"
  | "production";

const tabs: Array<{ id: TabId; label: string; phase?: string }> = [
  { id: "overview", label: "Overview" },
  { id: "brief", label: "Project Brief" },
  { id: "source", label: "Source Input" },
  { id: "site", label: "Land & Site" },
  { id: "planning", label: "Planning Guide" },
  { id: "program", label: "Space Program" },
  { id: "materials", label: "Materials" },
  { id: "directions", label: "Directions" },
  { id: "concept", label: "Concept" },
  { id: "plans", label: "Plans" },
  { id: "visuals", label: "Visuals" },
  { id: "design-pack", label: "Design Pack" },
  { id: "estimate", label: "Estimate" },
  { id: "production", label: "Production" },
];

const projectTypes = ARCHITECTURE_PROJECT_TYPES;

const styles = [
  "Contemporary",
  "Minimal",
  "Mediterranean",
  "Modern Arabic",
  "Japanese",
  "Organic",
  "Scandinavian",
  "Industrial",
  "Luxury",
  "Traditional",
  "Other / Custom",
];

const materialCategories = ARCHITECTURE_MATERIAL_CATEGORIES;

const paintPresets = [
  { name: "Warm Off-White", hex: "#F4F0E8", finish: "Low sheen", application: "Main interior walls" },
  { name: "Soft Sand", hex: "#D8C6A8", finish: "Matte", application: "Exterior render and feature walls" },
  { name: "Stone Beige", hex: "#B8A88F", finish: "Matte", application: "Exterior walls and joinery" },
  { name: "Muted Olive", hex: "#7C8062", finish: "Satin", application: "Feature joinery and selected walls" },
  { name: "Terracotta Clay", hex: "#A85F45", finish: "Matte", application: "Feature surfaces and hospitality accents" },
  { name: "Deep Charcoal", hex: "#303237", finish: "Low sheen", application: "Metalwork, frames and feature elements" },
  { name: "Warm Black", hex: "#171717", finish: "Satin", application: "Frames, trims and selected details" },
  { name: "Coastal Blue", hex: "#607B88", finish: "Matte", application: "Feature walls and joinery" },
] as const;

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function assetPreviewUrl(value: unknown): string | null {
  const record = recordValue(value);
  return typeof record.preview_url === "string" ? record.preview_url : null;
}

function assetThumbnailUrl(value: unknown): string | null {
  const record = recordValue(value);
  return typeof record.thumbnail_url === "string" ? record.thumbnail_url : null;
}

function assetStoragePathsFromMetadata(value: unknown): string[] {
  const metadata = recordValue(value);
  return Object.entries(metadata).flatMap(([key, raw]) => {
    if (!key.endsWith("_assets") && key !== "technical_assets") return [];
    const asset = recordValue(raw);
    return [asset.preview_storage_path, asset.master_storage_path, asset.thumbnail_storage_path]
      .filter((path): path is string => typeof path === "string" && Boolean(path));
  });
}

function hydrateAssetMetadata(
  value: Record<string, unknown>,
  signedByPath: Map<string, string>,
) {
  const next: Record<string, unknown> = { ...value };
  Object.entries(value).forEach(([key, raw]) => {
    if (!key.endsWith("_assets") && key !== "technical_assets") return;
    const asset = recordValue(raw);
    next[key] = {
      ...asset,
      preview_url:
        typeof asset.preview_storage_path === "string"
          ? signedByPath.get(asset.preview_storage_path) || asset.preview_url || null
          : asset.preview_url || null,
      master_url:
        typeof asset.master_storage_path === "string"
          ? signedByPath.get(asset.master_storage_path) || asset.master_url || null
          : asset.master_url || null,
      thumbnail_url:
        typeof asset.thumbnail_storage_path === "string"
          ? signedByPath.get(asset.thumbnail_storage_path) || asset.thumbnail_url || null
          : asset.thumbnail_url || null,
    };
  });
  return next;
}

export default function ArchitectureProjectWorkspace({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [projectDraft, setProjectDraft] = useState<Project | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [siteDraft, setSiteDraft] = useState<Site | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [planningDraft, setPlanningDraft] = useState<Planning | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [spaceProgram, setSpaceProgram] = useState<SpaceProgramItem[]>([]);
  const [materials, setMaterials] = useState<ArchitectureMaterial[]>([]);
  const [extractingMaterial, setExtractingMaterial] = useState<string | null>(null);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [concept, setConcept] = useState<ArchitectureConcept | null>(null);
  const [planSet, setPlanSet] = useState<ArchitecturePlanSet | null>(null);
  const [visuals, setVisuals] = useState<ArchitectureVisual[]>([]);
  const [designPack, setDesignPack] = useState<ArchitectureDesignPack | null>(null);
  const [generatingStage, setGeneratingStage] = useState<DemoStage | null>(null);
  const [regeneratingImage, setRegeneratingImage] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState("Preparing design references");
  const [approvingVisual, setApprovingVisual] = useState<string | null>(null);
  const [generatingDirection, setGeneratingDirection] = useState<"all" | number | null>(null);
  const [selectingDirection, setSelectingDirection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadCategory, setUploadCategory] = useState("site");
  const [uploading, setUploading] = useState(false);
  const [preparingEstimate, setPreparingEstimate] = useState(false);

  const requestedTab = searchParams.get("tab") as TabId | null;
  const requestedActiveTab = tabs.some((tab) => tab.id === requestedTab)
    ? (requestedTab as TabId)
    : "overview";
  const activeTab: TabId = requestedActiveTab === "planning" && (site?.land_start !== "owned" || project?.working_mode !== "professional")
    ? "site"
    : requestedActiveTab;

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;

    if (!currentUser) {
      window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
      return;
    }

    setUser(currentUser);

    const [
      projectResult,
      siteResult,
      planningResult,
      documentsResult,
      spaceProgramResult,
      materialsResult,
      directionsResult,
      conceptResult,
      planResult,
      visualsResult,
      designPackResult,
    ] = await Promise.all([
      supabase
        .from("architecture_projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", currentUser.id)
        .single(),
      supabase
        .from("architecture_sites")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .maybeSingle(),
      supabase
        .from("architecture_planning")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .maybeSingle(),
      supabase
        .from("architecture_documents")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("architecture_space_programs")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("architecture_materials")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("architecture_directions")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .order("direction_number", { ascending: true }),
      supabase
        .from("architecture_concepts")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .maybeSingle(),
      supabase
        .from("architecture_plan_sets")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .maybeSingle(),
      supabase
        .from("architecture_visuals")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("architecture_design_packs")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .maybeSingle(),
    ]);

    if (projectResult.error || !projectResult.data) {
      setError(projectResult.error?.message || "Architecture project not found.");
      setLoading(false);
      return;
    }

    const loadedProject = projectResult.data as Project;
    const loadedSite = (siteResult.data as Site | null) || createEmptySite(projectId, currentUser.id);
    const loadedPlanning =
      (planningResult.data as Planning | null) || createEmptyPlanning(projectId, currentUser.id);

    setProject(loadedProject);
    setProjectDraft(loadedProject);
    setSite(loadedSite);
    setSiteDraft(loadedSite);
    const loadedDirections = (directionsResult.data as Direction[] | null) || [];
    const loadedDocuments = (documentsResult.data as DocumentRow[] | null) || [];
    const loadedMaterials = (materialsResult.data as ArchitectureMaterial[] | null) || [];
    const loadedConcept = (conceptResult.data as ArchitectureConcept | null) || null;
    const loadedVisuals = (visualsResult.data as ArchitectureVisual[] | null) || [];

    // Render saved records immediately using their last stored URLs. Private
    // storage URLs are refreshed in one background batch below, so opening a
    // project is no longer blocked by one signing request per image.
    setPlanning(loadedPlanning);
    setPlanningDraft(loadedPlanning);
    setDocuments(loadedDocuments);
    setSpaceProgram((spaceProgramResult.data as SpaceProgramItem[] | null) || []);
    setMaterials(loadedMaterials);
    setDirections(loadedDirections);
    setConcept(loadedConcept);
    setPlanSet((planResult.data as ArchitecturePlanSet | null) || null);
    setVisuals(loadedVisuals);
    setDesignPack((designPackResult.data as ArchitectureDesignPack | null) || null);
    setLoading(false);

    void (async () => {
      const materialPaths = loadedMaterials
        .map((material) =>
          typeof material.metadata?.storage_path === "string"
            ? material.metadata.storage_path
            : null,
        )
        .filter((path): path is string => Boolean(path));
      const conceptStoragePath =
        loadedConcept &&
        typeof loadedConcept.generation_json?.image_storage_path === "string"
          ? loadedConcept.generation_json.image_storage_path
          : null;
      const documentPaths = loadedDocuments
        .filter((document) => document.mime_type?.startsWith("image/"))
        .map((document) => document.storage_path);
      const privatePaths = Array.from(
        new Set(
          [
            ...loadedDirections
              .map((direction) => direction.image_storage_path)
              .filter((path): path is string => Boolean(path)),
            ...loadedDirections.flatMap((direction) =>
              assetStoragePathsFromMetadata(direction.generation_json),
            ),
            ...documentPaths,
            ...materialPaths,
            ...(conceptStoragePath ? [conceptStoragePath] : []),
            ...(loadedConcept
              ? assetStoragePathsFromMetadata(loadedConcept.generation_json)
              : []),
            ...loadedVisuals
              .map((visual) => visual.storage_path)
              .filter((path): path is string => Boolean(path)),
            ...loadedVisuals.flatMap((visual) =>
              assetStoragePathsFromMetadata(visual.metadata),
            ),
          ],
        ),
      );

      if (!privatePaths.length) return;

      const { data: signedFiles, error: signedFilesError } = await supabase.storage
        .from("architecture-files")
        .createSignedUrls(privatePaths, 60 * 60 * 24 * 7);

      if (signedFilesError || !signedFiles) return;

      const signedByPath = new Map<string, string>();
      (
        signedFiles as Array<{
          path?: string | null;
          signedUrl?: string | null;
        }>
      ).forEach((item) => {
        if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
      });

      setDirections(
        loadedDirections.map((direction) => ({
          ...direction,
          image_url:
            direction.image_storage_path && signedByPath.has(direction.image_storage_path)
              ? signedByPath.get(direction.image_storage_path) || direction.image_url
              : direction.image_url,
          generation_json: hydrateAssetMetadata(
            direction.generation_json || {},
            signedByPath,
          ),
        })),
      );

      setDocuments(
        loadedDocuments.map((document) =>
          signedByPath.has(document.storage_path)
            ? {
                ...document,
                preview_url: signedByPath.get(document.storage_path) || document.preview_url,
              }
            : document,
        ),
      );

      setMaterials(
        loadedMaterials.map((material) => {
          const storagePath =
            typeof material.metadata?.storage_path === "string"
              ? material.metadata.storage_path
              : null;
          return storagePath && signedByPath.has(storagePath)
            ? {
                ...material,
                image_url: signedByPath.get(storagePath) || material.image_url,
              }
            : material;
        }),
      );

      if (loadedConcept && conceptStoragePath && signedByPath.has(conceptStoragePath)) {
        setConcept({
          ...loadedConcept,
          image_url: signedByPath.get(conceptStoragePath) || loadedConcept.image_url,
          generation_json: hydrateAssetMetadata(
            loadedConcept.generation_json || {},
            signedByPath,
          ),
        });
      }

      setVisuals(
        loadedVisuals.map((visual) => ({
          ...visual,
          image_url:
            visual.storage_path && signedByPath.has(visual.storage_path)
              ? signedByPath.get(visual.storage_path) || visual.image_url
              : visual.image_url,
          metadata: hydrateAssetMetadata(visual.metadata || {}, signedByPath),
        })),
      );
    })();
  }, [pathname, projectId, supabase]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  function switchTab(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function showMessage(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2800);
  }


  async function changeWorkingMode(nextMode: "guided" | "professional") {
    if (!projectDraft || !user || projectDraft.working_mode === nextMode) return;
    setSaving("working-mode");
    const { data, error: modeError } = await supabase
      .from("architecture_projects")
      .update({ working_mode: nextMode })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    setSaving("");
    if (modeError || !data) {
      setError(modeError?.message || "Working mode could not be updated.");
      return;
    }
    setProject(data as Project);
    setProjectDraft(data as Project);
    showMessage(nextMode === "professional" ? "Professional Mode enabled." : "Guided Mode enabled.");
  }

  function createSuggestedProgram() {
    if (!projectDraft || !user) return;
    if (spaceProgram.length > 0 && !window.confirm("Replace the current draft Space Program with smart suggestions?")) return;
    const template = getArchitectureProjectTemplate(projectDraft.project_type);
    const source = (projectDraft.selected_spaces || []).length
      ? (projectDraft.selected_spaces || [])
      : template.defaultSpaces;
    setSpaceProgram(source.map((spaceName, index) => {
      const item = getArchitectureSpaceDefault(spaceName);
      return {
        project_id: projectId,
        user_id: user.id,
        space_name: spaceName,
        zone: item.zone,
        level: item.level,
        quantity: item.quantity,
        area_each_m2: item.area,
        total_area_m2: item.quantity * item.area,
        priority: "Required",
        notes: null,
        is_ai_suggested: true,
        sort_order: index,
      };
    }));
    showMessage(`${template.label} Space Program suggestions prepared. Review every area before saving.`);
  }

  async function saveSpaceProgram(items: SpaceProgramItem[]) {
    if (!user) return;
    setSaving("program");
    setError("");
    const { error: deleteError } = await supabase.from("architecture_space_programs").delete().eq("project_id", projectId).eq("user_id", user.id);
    if (deleteError) { setSaving(""); setError(deleteError.message); return; }
    const cleaned = items.filter((item) => item.space_name.trim()).map((item, index) => ({
      project_id: projectId, user_id: user.id, space_name: item.space_name.trim(), zone: item.zone || "Flexible", level: item.level || "Ground",
      quantity: Math.max(1, Number(item.quantity) || 1), area_each_m2: Math.max(0, Number(item.area_each_m2) || 0),
      total_area_m2: Math.max(0, (Number(item.quantity) || 1) * (Number(item.area_each_m2) || 0)), priority: item.priority || "Required",
      notes: item.notes || null, is_ai_suggested: item.is_ai_suggested, sort_order: index,
    }));
    if (cleaned.length) {
      const { data, error: insertError } = await supabase.from("architecture_space_programs").insert(cleaned).select("*").order("sort_order", { ascending: true });
      if (insertError) { setSaving(""); setError(insertError.message); return; }
      setSpaceProgram((data as SpaceProgramItem[]) || []);
    } else setSpaceProgram([]);
    const { data: updatedProject } = await supabase.from("architecture_projects").update({ completion: Math.max(projectDraft?.completion || 0, 48), status: "Program Ready" }).eq("id", projectId).eq("user_id", user.id).select("*").single();
    if (updatedProject) { setProject(updatedProject as Project); setProjectDraft(updatedProject as Project); }
    setSaving(""); showMessage("Space Program saved.");
  }

  async function toggleMaterialSelection(item: MaterialLibraryItem) {
    if (!user) return;
    setSaving(`material-${item.key}`);
    setError("");
    const existing = materials.find((material) => material.material_key === item.key);
    if (existing) {
      const { data, error: updateError } = await supabase
        .from("architecture_materials")
        .update({ is_selected: !existing.is_selected })
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      setSaving("");
      if (updateError || !data) {
        setError(updateError?.message || "Material could not be updated.");
        return;
      }
      setMaterials((current) => current.map((material) => material.id === existing.id ? data as ArchitectureMaterial : material));
      return;
    }

    const { data, error: insertError } = await supabase
      .from("architecture_materials")
      .insert({
        project_id: projectId,
        user_id: user.id,
        category: item.category,
        material_key: item.key,
        name: item.name,
        image_url: item.image,
        finish: item.finish,
        application: item.application,
        cost_level: item.cost,
        maintenance_level: item.maintenance,
        climate_suitability: item.climate,
        sustainability_note: item.sustainability,
        is_selected: true,
        is_extracted: false,
        sort_order: materials.length,
        metadata: { source: "architecture-material-library", tags: item.tags },
      })
      .select("*")
      .single();
    setSaving("");
    if (insertError || !data) {
      setError(insertError?.message || "Material could not be added.");
      return;
    }
    setMaterials((current) => [...current, data as ArchitectureMaterial]);
  }

  async function toggleSavedMaterial(material: ArchitectureMaterial) {
    if (!user) return;
    setSaving(`saved-material-${material.id}`);
    setError("");
    const { data, error: updateError } = await supabase
      .from("architecture_materials")
      .update({ is_selected: !material.is_selected })
      .eq("id", material.id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    setSaving("");
    if (updateError || !data) {
      setError(updateError?.message || "Material selection could not be updated.");
      return;
    }
    setMaterials((current) => current.map((item) => item.id === material.id ? data as ArchitectureMaterial : item));
  }

  async function updateArchitectureMaterial(
    material: ArchitectureMaterial,
    patch: MaterialPatch,
  ): Promise<boolean> {
    if (!user) return false;
    setSaving(`edit-material-${material.id}`);
    setError("");
    const nextMetadata = patch.notes === undefined
      ? material.metadata || {}
      : { ...(material.metadata || {}), notes: patch.notes };
    const { notes: _notes, ...databasePatch } = patch;
    const { data, error: updateError } = await supabase
      .from("architecture_materials")
      .update({ ...databasePatch, metadata: nextMetadata })
      .eq("id", material.id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    setSaving("");
    if (updateError || !data) {
      setError(updateError?.message || "Material details could not be saved.");
      return false;
    }
    setMaterials((current) => current.map((item) => item.id === material.id ? { ...(data as ArchitectureMaterial), image_url: material.image_url } : item));
    showMessage(`${(data as ArchitectureMaterial).name} updated.`);
    return true;
  }

  async function createCustomMaterial(input: CustomMaterialInput): Promise<boolean> {
    if (!user) return false;
    if (!input.name.trim()) {
      setError("Add a material name before saving.");
      return false;
    }
    if (!input.application.trim()) {
      setError("Tell us where this material should be used before saving.");
      return false;
    }

    setSaving("custom-material");
    setError("");
    const safeName = input.file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-");
    const storagePath = `${user.id}/${projectId}/custom-material/${Date.now()}-${safeName}`;
    let documentId: string | null = null;

    try {
      const { error: uploadError } = await supabase.storage
        .from("architecture-files")
        .upload(storagePath, input.file, {
          contentType: input.file.type || undefined,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: document, error: documentError } = await supabase
        .from("architecture_documents")
        .insert({
          project_id: projectId,
          user_id: user.id,
          category: "custom-material",
          filename: input.file.name,
          storage_path: storagePath,
          mime_type: input.file.type || null,
          file_size: input.file.size,
        })
        .select("id")
        .single();
      if (documentError || !document) throw documentError || new Error("Custom material file could not be saved.");
      documentId = document.id;

      const { data: signed } = await supabase.storage
        .from("architecture-files")
        .createSignedUrl(storagePath, 60 * 60 * 6);

      const materialKey = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { data, error: materialError } = await supabase
        .from("architecture_materials")
        .insert({
          project_id: projectId,
          user_id: user.id,
          category: input.category || "Custom / Reference",
          material_key: materialKey,
          name: input.name.trim(),
          image_url: signed?.signedUrl || null,
          finish: input.finish.trim() || null,
          color: input.color.trim() || null,
          application: input.application.trim(),
          cost_level: input.cost_level || "To verify",
          maintenance_level: input.maintenance_level || "To verify",
          climate_suitability: input.climate_suitability.trim() || null,
          sustainability_note: input.sustainability_note.trim() || null,
          is_selected: true,
          is_extracted: false,
          source_document_id: documentId,
          sort_order: materials.length,
          metadata: {
            source: "architecture-workspace-custom-material",
            storage_path: storagePath,
            notes: input.notes.trim() || null,
          },
        })
        .select("*")
        .single();
      if (materialError || !data) throw materialError || new Error("Custom material could not be saved.");
      setMaterials((current) => [...current, data as ArchitectureMaterial]);
      setDocuments((current) => [
        {
          id: documentId as string,
          project_id: projectId,
          user_id: user.id,
          category: "custom-material",
          filename: input.file.name,
          storage_path: storagePath,
          mime_type: input.file.type || null,
          file_size: input.file.size,
          created_at: new Date().toISOString(),
          preview_url: signed?.signedUrl || null,
        },
        ...current,
      ]);
      showMessage(`${input.name.trim()} added to the project material schedule.`);
      return true;
    } catch (customError) {
      if (documentId) {
        await supabase.from("architecture_documents").delete().eq("id", documentId).eq("user_id", user.id);
      }
      await supabase.storage.from("architecture-files").remove([storagePath]);
      setError(customError instanceof Error ? customError.message : "Custom material could not be saved.");
      return false;
    } finally {
      setSaving("");
    }
  }

  async function deleteArchitectureMaterial(material: ArchitectureMaterial) {
    if (!user) return;
    if (!window.confirm(`Remove ${material.name} from this project?`)) return;
    setSaving(`delete-material-${material.id}`);
    setError("");

    const source = String(material.metadata?.source || "");
    const isCustom = source.includes("custom-material") || source.includes("custom");
    const storagePath = typeof material.metadata?.storage_path === "string"
      ? material.metadata.storage_path
      : null;

    const { error: deleteError } = await supabase
      .from("architecture_materials")
      .delete()
      .eq("id", material.id)
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (deleteError) {
      setSaving("");
      setError(deleteError.message);
      return;
    }

    if (isCustom && material.source_document_id) {
      await supabase
        .from("architecture_documents")
        .delete()
        .eq("id", material.source_document_id)
        .eq("user_id", user.id);
      setDocuments((current) => current.filter((document) => document.id !== material.source_document_id));
    }
    if (isCustom && storagePath) {
      await supabase.storage.from("architecture-files").remove([storagePath]);
    }

    setMaterials((current) => current.filter((item) => item.id !== material.id));
    setSaving("");
    showMessage(`${material.name} removed.`);
  }

  async function analyseMaterialReference(document: DocumentRow) {
    if (!user) return;
    setExtractingMaterial(document.id); setError("");
    try {
      const response = await fetch("/api/architecture/materials/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, documentId: document.id }) });
      const payload = await response.json() as { success?: boolean; error?: string; materials?: ArchitectureMaterial[] };
      if (!response.ok || !payload.success) throw new Error(payload.error || "Material suggestions could not be prepared.");
      setMaterials(payload.materials || []);
      showMessage("Suggested materials extracted. Confirm the cards you want to use.");
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Material suggestions could not be prepared.");
    } finally { setExtractingMaterial(null); }
  }

  async function saveBrief() {
    if (!projectDraft || !user) return;
    if (!projectDraft.project_name.trim()) {
      setError("Project name cannot be empty.");
      return;
    }

    setSaving("brief");
    setError("");

    const { data, error: saveError } = await supabase
      .from("architecture_projects")
      .update({
        project_name: projectDraft.project_name.trim(),
        project_type: projectDraft.project_type || null,
        scope: projectDraft.scope || null,
        country: projectDraft.country || null,
        region: projectDraft.region || null,
        city: projectDraft.city || null,
        architectural_style: projectDraft.architectural_style || null,
        selected_spaces: projectDraft.selected_spaces || [],
        notes: projectDraft.notes || null,
        working_mode: projectDraft.working_mode || "guided",
        professional_brief: projectDraft.professional_brief || {},
        completion: Math.max(projectDraft.completion || 0, 30),
      })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    setSaving("");

    if (saveError || !data) {
      setError(saveError?.message || "Project brief could not be saved.");
      return;
    }

    setProject(data as Project);
    setProjectDraft(data as Project);
    showMessage("Project brief saved.");
  }

  async function saveSourceBrief() {
    if (!projectDraft || !user) return;

    setSaving("source");
    setError("");

    const sourceBrief = projectDraft.source_brief || {};
    const sourceNotes = [
      sourceBrief.preserve_elements,
      sourceBrief.requested_changes,
      projectDraft.source_notes,
    ]
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
      .join("\n\n");

    const { data, error: saveError } = await supabase
      .from("architecture_projects")
      .update({
        source_brief: sourceBrief,
        source_notes: sourceNotes || null,
        status: "Source Ready",
        completion: Math.max(projectDraft.completion || 0, 38),
      })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    setSaving("");

    if (saveError || !data) {
      setError(saveError?.message || "Source information could not be saved.");
      return;
    }

    setProject(data as Project);
    setProjectDraft(data as Project);
    showMessage("Source information saved.");
  }

  async function saveSite() {
    if (!siteDraft || !projectDraft || !user) return;

    setSaving("site");
    setError("");

    const { data: savedSite, error: siteError } = await supabase
      .from("architecture_sites")
      .upsert(
        {
          ...siteDraft,
          project_id: projectId,
          user_id: user.id,
          plot_area: toNullableNumber(siteDraft.plot_area),
          width: toNullableNumber(siteDraft.width),
          depth: toNullableNumber(siteDraft.depth),
          desired_floors: toNullableInteger(siteDraft.desired_floors),
        },
        { onConflict: "project_id" },
      )
      .select("*")
      .single();

    if (siteError || !savedSite) {
      setSaving("");
      setError(siteError?.message || "Land and site information could not be saved.");
      return;
    }

    const { data: savedProject, error: projectError } = await supabase
      .from("architecture_projects")
      .update({
        country: projectDraft.country || null,
        region: projectDraft.region || null,
        city: projectDraft.city || null,
        completion: Math.max(projectDraft.completion || 0, 42),
      })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    setSaving("");

    if (projectError || !savedProject) {
      setError(projectError?.message || "Project location could not be saved.");
      return;
    }

    setSite(savedSite as Site);
    setSiteDraft(savedSite as Site);
    setProject(savedProject as Project);
    setProjectDraft(savedProject as Project);
    showMessage("Land and site information saved.");
  }

  async function savePlanning() {
    if (!planningDraft || !user) return;

    setSaving("planning");
    setError("");

    const payload = {
      ...planningDraft,
      project_id: projectId,
      user_id: user.id,
      site_coverage_percent: toNullableNumber(planningDraft.site_coverage_percent),
      floor_area_ratio: toNullableNumber(planningDraft.floor_area_ratio),
      max_height_m: toNullableNumber(planningDraft.max_height_m),
      max_floors: toNullableInteger(planningDraft.max_floors),
      front_setback_m: toNullableNumber(planningDraft.front_setback_m),
      rear_setback_m: toNullableNumber(planningDraft.rear_setback_m),
      side_setback_m: toNullableNumber(planningDraft.side_setback_m),
      source_checked_at:
        planningDraft.source_checked_at || planningDraft.source_reference
          ? planningDraft.source_checked_at || new Date().toISOString()
          : null,
    };

    const { data, error: saveError } = await supabase
      .from("architecture_planning")
      .upsert(payload, { onConflict: "project_id" })
      .select("*")
      .single();

    if (saveError || !data) {
      setSaving("");
      setError(saveError?.message || "Planning information could not be saved.");
      return;
    }

    if (projectDraft && user) {
      const nextCompletion = Math.max(projectDraft.completion || 0, 55);
      const { data: updatedProject } = await supabase
        .from("architecture_projects")
        .update({ completion: nextCompletion, status: "Planning" })
        .eq("id", projectId)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (updatedProject) {
        setProject(updatedProject as Project);
        setProjectDraft(updatedProject as Project);
      }
    }

    setSaving("");
    setPlanning(data as Planning);
    setPlanningDraft(data as Planning);
    showMessage("Planning guide saved.");
  }

  async function uploadDocuments(files: FileList | null, forcedCategory?: string) {
    if (!files?.length || !user) return;

    setUploading(true);
    setError("");

    const createdRows: DocumentRow[] = [];
    const targetCategory = forcedCategory || uploadCategory;

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const safeName = file.name
          .normalize("NFKD")
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/-+/g, "-");
        const path = `${user.id}/${projectId}/${targetCategory}/${Date.now()}-${index}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("architecture-files")
          .upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: document, error: documentError } = await supabase
          .from("architecture_documents")
          .insert({
            project_id: projectId,
            user_id: user.id,
            category: targetCategory,
            filename: file.name,
            storage_path: path,
            mime_type: file.type || null,
            file_size: file.size,
          })
          .select("*")
          .single();

        if (documentError || !document) {
          await supabase.storage.from("architecture-files").remove([path]);
          throw documentError || new Error("Document record could not be created.");
        }

        let createdDocument = document as DocumentRow;
        if (createdDocument.mime_type?.startsWith("image/")) {
          const { data: signedFile } = await supabase.storage
            .from("architecture-files")
            .createSignedUrl(createdDocument.storage_path, 60 * 60 * 6);
          createdDocument = { ...createdDocument, preview_url: signedFile?.signedUrl || null };
        }

        createdRows.push(createdDocument);
      }

      setDocuments((current) => [...createdRows, ...current]);
      showMessage(`${createdRows.length} file${createdRows.length === 1 ? "" : "s"} uploaded.`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Files could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function createSourcePlanCrop(args: {
    documentId: string;
    planType: SourcePlanType;
    label: string;
    crop: { x: number; y: number; width: number; height: number };
  }) {
    setError("");
    setSaving(`source-plan-${args.planType}`);
    try {
      const response = await fetch("/api/architecture/source-plans/crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...args }),
      });
      const payload = await response.json() as {
        success?: boolean;
        error?: string;
        document?: DocumentRow;
        invalidatedVisuals?: number;
      };
      if (!response.ok || !payload.success || !payload.document) {
        throw new Error(payload.error || "Source plan could not be saved.");
      }
      setDocuments((current) => [payload.document as DocumentRow, ...current]);
      showMessage(
        payload.invalidatedVisuals
          ? `${args.label} saved. Previous architecture visuals are now marked outdated — regenerate them from the organised source drawings.`
          : `${args.label} saved from the original drawing.`,
      );
      return true;
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Source plan could not be saved.");
      return false;
    } finally {
      setSaving("");
    }
  }

  async function downloadDocument(document: DocumentRow) {
    setError("");
    const { data, error: downloadError } = await supabase.storage
      .from("architecture-files")
      .download(document.storage_path);

    if (downloadError || !data) {
      setError(downloadError?.message || "The file could not be downloaded.");
      return;
    }

    const url = URL.createObjectURL(data);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = document.filename;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteDocument(document: DocumentRow) {
    if (!user) return;
    if (!window.confirm(`Delete ${document.filename}?`)) return;

    setError("");

    const { error: storageError } = await supabase.storage
      .from("architecture-files")
      .remove([document.storage_path]);

    if (storageError) {
      setError(storageError.message);
      return;
    }

    const { error: rowError } = await supabase
      .from("architecture_documents")
      .delete()
      .eq("id", document.id)
      .eq("user_id", user.id);

    if (rowError) {
      setError(rowError.message);
      return;
    }

    setDocuments((current) => current.filter((item) => item.id !== document.id));
    showMessage("File deleted.");
  }

  async function generateDirections(directionNumber?: number) {
    if (!user) return;

    const hasExistingDirections = directions.length > 0;
    const targetLabel = directionNumber
      ? `Direction ${String.fromCharCode(64 + directionNumber)}`
      : "all three Architecture Directions";

    if (
      hasExistingDirections &&
      !window.confirm(
        `Regenerate ${targetLabel}? Existing generated text and imagery for the selected direction${directionNumber ? "" : "s"} will be replaced.`,
      )
    ) {
      return;
    }

    setGeneratingDirection(directionNumber ?? "all");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/architecture/directions/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          directionNumber,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        directions?: Direction[];
        project?: Project | null;
        partialImageFailure?: boolean;
      };

      if (!response.ok || !payload.success || !payload.directions) {
        throw new Error(payload.error || "Architecture Directions could not be generated.");
      }

      setDirections(payload.directions);

      if (payload.project) {
        setProject(payload.project);
        setProjectDraft(payload.project);
      }

      showMessage(
        directionNumber
          ? `Direction ${String.fromCharCode(64 + directionNumber)} text regenerated. Select it before generating a visual.`
          : "Three text-first Architecture Directions generated. Select one, then generate only its visual.",
      );
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Architecture Directions could not be generated.",
      );
    } finally {
      setGeneratingDirection(null);
    }
  }

  async function selectDirection(direction: Direction) {
    if (!user) return;

    const changingDirection = Boolean(
      projectDraft?.selected_direction_id &&
      projectDraft.selected_direction_id !== direction.id,
    );

    if (
      changingDirection &&
      !window.confirm(
        "Changing the Master Architecture Reference will reset the current Concept, Plans, Visuals and Design Pack so the project cannot mix two different properties. Continue?",
      )
    ) {
      return;
    }

    setSelectingDirection(direction.id);
    setError("");

    const { data, error: selectionError } = await supabase.rpc(
      "select_architecture_direction",
      {
        p_project_id: projectId,
        p_direction_id: direction.id,
      },
    );

    if (selectionError || !data) {
      setSelectingDirection(null);
      setError(selectionError?.message || "The Architecture Direction could not be selected.");
      return;
    }

    if (changingDirection) {
      const conceptStoragePath =
        concept && typeof concept.generation_json?.image_storage_path === "string"
          ? concept.generation_json.image_storage_path
          : null;
      const downstreamStoragePaths = [
        conceptStoragePath,
        ...visuals.map((visual) => visual.storage_path),
      ].filter((path): path is string => Boolean(path));

      const [conceptDelete, planDelete, visualDelete, packDelete] = await Promise.all([
        supabase
          .from("architecture_concepts")
          .delete()
          .eq("project_id", projectId)
          .eq("user_id", user.id),
        supabase
          .from("architecture_plan_sets")
          .delete()
          .eq("project_id", projectId)
          .eq("user_id", user.id),
        supabase
          .from("architecture_visuals")
          .delete()
          .eq("project_id", projectId)
          .eq("user_id", user.id),
        supabase
          .from("architecture_design_packs")
          .delete()
          .eq("project_id", projectId)
          .eq("user_id", user.id),
      ]);

      const resetError =
        conceptDelete.error ||
        planDelete.error ||
        visualDelete.error ||
        packDelete.error;

      if (downstreamStoragePaths.length) {
        await supabase.storage.from("architecture-files").remove(downstreamStoragePaths);
      }

      setConcept(null);
      setPlanSet(null);
      setVisuals([]);
      setDesignPack(null);

      if (resetError) {
        setError(
          `The direction was selected, but some previous downstream content could not be reset: ${resetError.message}`,
        );
      }
    }

    setSelectingDirection(null);

    setDirections((current) =>
      current.map((item) => ({
        ...item,
        is_selected: item.id === direction.id,
      })),
    );

    setProjectDraft((current) =>
      current
        ? {
            ...current,
            selected_direction_id: direction.id,
            status: "Direction Selected",
            completion: Math.max(current.completion || 0, 68),
          }
        : current,
    );

    setProject((current) =>
      current
        ? {
            ...current,
            selected_direction_id: direction.id,
            status: "Direction Selected",
            completion: Math.max(current.completion || 0, 68),
          }
        : current,
    );

    showMessage(
      `${direction.title} is now the Master Architecture Reference. All later images and plans will inherit this identity.`,
    );
  }

  async function generateArchitectureStage(stage: DemoStage) {
    if (!user) return;

    if (!projectDraft?.selected_direction_id) {
      setError("Select an Architecture Direction before continuing.");
      switchTab("directions");
      return;
    }

    setGeneratingStage(stage);
    setError("");
    setMessage("");

    const useDemoRoute = process.env.NEXT_PUBLIC_MOCK_IMAGES === "true";
    const route = useDemoRoute
      ? "/api/architecture/demo/generate"
      : "/api/architecture/stages/generate";

    type ArchitectureStageResponse = {
      success?: boolean;
      status?: "processing" | "succeeded" | "failed";
      jobId?: string;
      error?: string;
      project?: Project;
      concept?: ArchitectureConcept | null;
      planSet?: ArchitecturePlanSet | null;
      visuals?: ArchitectureVisual[];
      designPack?: ArchitectureDesignPack | null;
    };

    async function readArchitectureStageResponse(
      response: Response,
      fallback: string,
    ): Promise<ArchitectureStageResponse> {
      const text = await response.text();
      if (!text) {
        if (!response.ok) throw new Error(fallback);
        return {};
      }
      try {
        return JSON.parse(text) as ArchitectureStageResponse;
      } catch {
        if (response.status === 504 || /inactivity timeout|<html|<!doctype/i.test(text)) {
          throw new Error("Architecture Studio could not start this generation request. Please try again.");
        }
        throw new Error(fallback);
      }
    }

    try {
      const response = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, stage }),
      });

      let payload = await readArchitectureStageResponse(
        response,
        "Architecture content could not be prepared.",
      );

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Architecture content could not be prepared.");
      }

      if (!useDemoRoute) {
        if (!payload.jobId) {
          throw new Error("Architecture generation did not return a job ID.");
        }

        let completed: ArchitectureStageResponse | null = null;
        for (let attempt = 0; attempt < 180; attempt += 1) {
          if (attempt > 0) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, 2500));
          }

          const statusResponse = await fetch(
            `/api/architecture/stages/status?job=${encodeURIComponent(payload.jobId)}`,
            { cache: "no-store" },
          );
          const statusPayload = await readArchitectureStageResponse(
            statusResponse,
            "Unable to check Architecture generation.",
          );

          if (!statusResponse.ok || statusPayload.success === false) {
            throw new Error(statusPayload.error || "Unable to check Architecture generation.");
          }
          if (statusPayload.status === "failed") {
            throw new Error(
              statusPayload.error || "Architecture content generation failed. Your credits were returned.",
            );
          }
          if (statusPayload.status === "succeeded") {
            completed = statusPayload;
            break;
          }
        }

        if (!completed) {
          throw new Error(
            "Your Architecture content is still being prepared safely in the background. Reopen the project shortly to see the saved result.",
          );
        }
        payload = completed;
      }

      if (payload.project) {
        setProject(payload.project);
        setProjectDraft(payload.project);
      }
      setConcept(payload.concept || null);
      setPlanSet(payload.planSet || null);
      setVisuals(payload.visuals || []);
      setDesignPack(payload.designPack || null);

      const liveLabels: Record<DemoStage, string> = {
        concept: "Concept strategy prepared. Its next image will use the selected Direction as the Master Architecture Reference.",
        plans: "One Canonical Plan Specification is ready. Every plan diagram will now use the same footprint, rooms, entry, pool and circulation.",
        visuals: "Coordinated gallery prompts are ready. Each view will use the Master Architecture Reference and approved project images.",
        "design-pack": "Architecture Design Pack prepared with the locked visual identity.",
        all: "The coordinated Architecture structure is ready. Generate images one by one from the same Master Reference and Canonical Plan.",
      };
      const demoLabels: Record<DemoStage, string> = {
        concept: "Architecture Concept prepared with demo content.",
        plans: "Concept Plans prepared with demo content.",
        visuals: "Architecture Visuals prepared with demo images.",
        "design-pack": "Architecture Design Pack prepared.",
        all: "The complete Architecture Studio demo content is ready.",
      };
      showMessage((useDemoRoute ? demoLabels : liveLabels)[stage]);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Architecture content could not be prepared.",
      );
    } finally {
      setGeneratingStage(null);
    }
  }

  async function regenerateArchitectureImage(
    targetType: "direction" | "concept" | "visual",
    targetId: string,
    options: {
      quality?: ImageGenerationTier;
      planMode?: PlanGenerationMode;
    } = {},
  ) {
    if (!user) return;
    const quality = options.quality || "preview";
    const planMode = options.planMode || "technical";
    const stateKey = `${targetType}-${targetId}`;
    setRegeneratingImage(stateKey);
    setGenerationStatus(
      planMode === "technical"
        ? "Generating the detailed connected concept plan"
        : quality === "final"
          ? "Generating the professional final image"
          : "Generating a lightweight preview",
    );
    setError("");
    setMessage("");

    const statusTimer = window.setTimeout(() => {
      setGenerationStatus(
        planMode === "rendered"
          ? "Applying the canonical plan, materials and room information"
          : "Adding walls, openings, doors, windows, fixtures and circulation",
      );
    }, 3500);

    try {
      type ArchitectureImageResponse = {
        success?: boolean;
        status?: "processing" | "succeeded" | "failed";
        jobId?: string;
        error?: string;
        direction?: Direction;
        concept?: ArchitectureConcept;
        visual?: ArchitectureVisual;
      };

      async function readArchitectureImageResponse(
        response: Response,
        fallback: string,
      ): Promise<ArchitectureImageResponse> {
        const text = await response.text();
        if (!text) {
          if (!response.ok) throw new Error(fallback);
          return {};
        }
        try {
          return JSON.parse(text) as ArchitectureImageResponse;
        } catch {
          if (response.status === 504 || /inactivity timeout|<html|<!doctype/i.test(text)) {
            throw new Error("Architecture Studio could not start this image request. Please try again.");
          }
          throw new Error(fallback);
        }
      }

      const response = await fetch("/api/architecture/images/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          targetType,
          targetId,
          quality,
          planMode,
        }),
      });
      const started = await readArchitectureImageResponse(
        response,
        "Architecture image generation could not be started.",
      );
      if (!response.ok || !started.success || !started.jobId) {
        throw new Error(started.error || "Architecture image generation could not be started.");
      }

      let payload: ArchitectureImageResponse | null = null;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        if (attempt > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 2500));
        }

        const statusResponse = await fetch(
          `/api/architecture/images/status?job=${encodeURIComponent(started.jobId)}`,
          { cache: "no-store" },
        );
        const statusPayload = await readArchitectureImageResponse(
          statusResponse,
          "Unable to check Architecture image generation.",
        );
        if (!statusResponse.ok || statusPayload.success === false) {
          throw new Error(statusPayload.error || "Unable to check Architecture image generation.");
        }
        if (statusPayload.status === "failed") {
          throw new Error(
            statusPayload.error || "Architecture image generation failed. Your credits were returned.",
          );
        }
        if (statusPayload.status === "succeeded") {
          payload = statusPayload;
          break;
        }
      }

      if (!payload) {
        throw new Error(
          "Your Architecture image is still being prepared safely in the background. Reopen the project shortly to see the saved result.",
        );
      }

      const updatedDirection = payload.direction;
      if (updatedDirection) {
        setDirections((current) =>
          current.map((item) => item.id === updatedDirection.id ? updatedDirection : item),
        );
      }
      if (payload.concept) setConcept(payload.concept);
      const updatedVisual = payload.visual;
      if (updatedVisual) {
        setVisuals((current) =>
          current.map((item) => item.id === updatedVisual.id ? updatedVisual : item),
        );
      }
      showMessage(
        planMode === "technical"
          ? "Detailed concept plan generated and saved. Review and approve it before generating previews or project visuals."
          : quality === "final"
            ? "Professional final generated and saved with Visual Continuity."
            : "Preview generated, optimised and saved with Visual Continuity.",
      );
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Architecture image could not be generated.");
    } finally {
      window.clearTimeout(statusTimer);
      setRegeneratingImage(null);
      setGenerationStatus("Preparing design references");
    }
  }

  async function approveVisual(visual: ArchitectureVisual) {
    if (!user) return;

    setApprovingVisual(visual.id);
    setError("");

    const { data, error: approvalError } = await supabase
      .from("architecture_visuals")
      .update({ is_approved: !visual.is_approved })
      .eq("id", visual.id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    setApprovingVisual(null);

    if (approvalError || !data) {
      setError(approvalError?.message || "The visual approval could not be updated.");
      return;
    }

    setVisuals((current) =>
      current.map((item) => (item.id === visual.id ? (data as ArchitectureVisual) : item)),
    );
    showMessage((data as ArchitectureVisual).is_approved ? "Visual approved." : "Visual approval removed.");
  }

  function estimateAreaScheduleFromProject() {
    if (!projectDraft) return [];
    const sourceBasedExistingPlanSet = projectDraft.workflow_mode !== "plan_to_render" || planSet?.generation_mode === "existing_source";
    if (sourceBasedExistingPlanSet && planSet?.area_schedule?.length) return planSet.area_schedule;
    return spaceProgram
      .filter((item) => Number(item.total_area_m2 || 0) > 0)
      .map((item) => ({
        space: item.space_name,
        level: item.level || "Existing design",
        approx_area_m2: Number(item.total_area_m2 || 0),
      }));
  }

  function estimateTotalArea() {
    if (!projectDraft) return null;
    const sourceBasedExistingPlanSet = projectDraft.workflow_mode !== "plan_to_render" || planSet?.generation_mode === "existing_source";
    if (planSet && sourceBasedExistingPlanSet) {
      const scheduledArea = (planSet.area_schedule || []).reduce(
        (sum, item) => sum + Number(item.approx_area_m2 || 0),
        0,
      );
      const planArea = Number(planSet.total_estimated_area || 0) || scheduledArea;
      if (planArea > 0) return planArea;
    }

    const programmedArea = spaceProgram.reduce(
      (sum, item) => sum + Number(item.total_area_m2 || 0),
      0,
    );
    if (programmedArea > 0) return programmedArea;

    const professionalTarget = numberOrNull(projectDraft?.professional_brief?.target_gross_area_m2);
    if (professionalTarget && professionalTarget > 0) return professionalTarget;

    return null;
  }

  function buildProjectEstimate(): ProjectEstimate | null {
    if (!projectDraft) return null;
    const totalAreaValue = estimateTotalArea();
    if (!totalAreaValue) return null;
    const totalArea = Math.max(1, totalAreaValue);
    const selected = materials.filter((material) => material.is_selected);

    const priceRange = (level: string | null): [number, number] => {
      const value = String(level || "").toLowerCase();
      if (value.includes("premium")) return [95, 180];
      if (value.includes("high")) return [65, 120];
      if (value.includes("medium")) return [38, 75];
      if (value.includes("controlled")) return [20, 48];
      return [30, 80];
    };

    const quantityRule = (material: ArchitectureMaterial) => {
      const text = `${material.category} ${material.application || ""}`.toLowerCase();
      if (/paint|coating|render|wall/.test(text)) {
        return { quantity: totalArea * 2.15, waste: 8, unit: "m²", size: "Supplier system and coverage rate" };
      }
      if (/floor|tile|paver|deck|terrazzo/.test(text)) {
        return { quantity: totalArea * 0.72, waste: 10, unit: "m²", size: "Confirm module and laying pattern" };
      }
      if (/window|glass|glazing|frame/.test(text)) {
        return { quantity: totalArea * 0.22, waste: 5, unit: "m²", size: "Coordinate with the opening schedule" };
      }
      if (/roof/.test(text)) {
        return { quantity: totalArea * 0.62, waste: 12, unit: "m²", size: "Confirm roof build-up and module" };
      }
      return { quantity: totalArea * 0.34, waste: 10, unit: "m²", size: "Confirm supplier module and thickness" };
    };

    const location = projectDraft?.city || projectDraft?.country || "the project location";
    const items = selected.map((material, index) => {
      const rule = quantityRule(material);
      const [low, high] = priceRange(material.cost_level);
      const purchaseQuantity = Math.ceil(rule.quantity * (1 + rule.waste / 100));

      return {
        id: material.id || `estimate-${index}`,
        item: material.name,
        category: material.category,
        application: material.application || "Application to confirm",
        specification: [rule.size, material.finish, material.color].filter(Boolean).join(" · "),
        quantity: Math.round(rule.quantity),
        wastePercent: rule.waste,
        purchaseQuantity,
        unit: rule.unit,
        unitPriceLowUsd: low,
        unitPriceHighUsd: high,
        supplierSuggestion: `Shortlist 2–3 verified ${material.category.toLowerCase()} suppliers near ${location}`,
      } satisfies EstimateItem;
    });

    const existingDesign = projectDraft.workflow_mode === "plan_to_render";
    return {
      generatedAt: new Date().toISOString(),
      currency: "USD",
      items,
      lowTotalUsd: Math.round(items.reduce((sum, item) => sum + item.purchaseQuantity * item.unitPriceLowUsd, 0)),
      highTotalUsd: Math.round(items.reduce((sum, item) => sum + item.purchaseQuantity * item.unitPriceHighUsd, 0)),
      assumptions: [
        existingDesign
          ? "Concept estimate only; quantities use the existing-design area information saved in the project together with the selected material schedule. Uploaded source drawings are treated as the design source and do not require AI-plan approval."
          : "Concept estimate only; quantities are derived from the approved concept plans, indicative area schedule and selected materials.",
        "Rates exclude taxes, freight, installation, contractor margin, site conditions, professional fees and design changes.",
        "Exact quantities, supplier products, dimensions and pricing must be verified locally before procurement or production.",
      ],
    };
  }

  async function prepareEstimate() {
    if (!user || !projectDraft) return;

    const estimate = buildProjectEstimate();
    if (!estimate) {
      setError("Add an approximate floor area or complete the Space Program before preparing the estimate.");
      return;
    }

    setPreparingEstimate(true);
    setError("");

    let targetPlanSet = planSet;
    if (projectDraft.workflow_mode === "plan_to_render" && targetPlanSet?.generation_mode !== "existing_source") {
      targetPlanSet = null;
    }
    if (!targetPlanSet && projectDraft.workflow_mode === "plan_to_render") {
      const organisedSourcePlans = documents.filter((document) => Boolean(sourcePlanTypeFromCategory(document.category)));
      if (!organisedSourcePlans.length) {
        setPreparingEstimate(false);
        setError("Organise at least one uploaded source plan before preparing the estimate.");
        return;
      }
      if (!projectDraft.selected_direction_id) {
        setPreparingEstimate(false);
        setError("Select an Architecture Direction before preparing the estimate.");
        return;
      }

      const areaSchedule = estimateAreaScheduleFromProject();
      const totalEstimatedArea = estimateTotalArea();
      const { data: sourcePlanSet, error: sourcePlanSetError } = await supabase
        .from("architecture_plan_sets")
        .upsert(
          {
            project_id: projectId,
            user_id: user.id,
            direction_id: projectDraft.selected_direction_id,
            title: `${projectDraft.project_name} · Existing Source Plans`,
            planning_assumptions: [
              "Existing uploaded drawings are the geometry source of truth.",
              "No AI-generated floor-plan approval is required for this Existing Design project.",
            ],
            area_schedule: areaSchedule,
            room_relationships: [],
            conceptual_dimensions: [],
            total_estimated_area: totalEstimatedArea,
            generation_mode: "existing_source",
            generation_json: {
              mode: "existing_source",
              source_plan_ids: organisedSourcePlans.map((document) => document.id),
              source_plan_categories: organisedSourcePlans.map((document) => document.category),
              estimate,
              prepared_at: new Date().toISOString(),
              disclaimer: "Estimate uses user-supplied existing drawings and project area information. Verify all quantities professionally before procurement or construction.",
            },
          },
          { onConflict: "project_id" },
        )
        .select("*")
        .single();

      if (sourcePlanSetError || !sourcePlanSet) {
        setPreparingEstimate(false);
        setError(sourcePlanSetError?.message || "The existing source-plan estimate record could not be prepared.");
        return;
      }
      targetPlanSet = sourcePlanSet as ArchitecturePlanSet;
      setPlanSet(targetPlanSet);
      setPreparingEstimate(false);
      showMessage("Pre-production estimate prepared from the existing source plans and saved project area information.");
      return;
    }

    if (!targetPlanSet) {
      setPreparingEstimate(false);
      setError("Prepare the project plan information before estimating.");
      return;
    }

    const generationJson = { ...(targetPlanSet.generation_json || {}), estimate };
    const { data, error: estimateError } = await supabase
      .from("architecture_plan_sets")
      .update({ generation_json: generationJson })
      .eq("id", targetPlanSet.id)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    setPreparingEstimate(false);

    if (estimateError || !data) {
      setError(estimateError?.message || "The project estimate could not be prepared.");
      return;
    }

    setPlanSet(data as ArchitecturePlanSet);
    showMessage("Pre-production quantity and cost estimate prepared.");
  }

  const calculations = useMemo(() => {
    const plotArea = numberOrNull(siteDraft?.plot_area);
    const coverage = numberOrNull(planningDraft?.site_coverage_percent);
    const far = numberOrNull(planningDraft?.floor_area_ratio);
    const floors =
      numberOrNull(planningDraft?.max_floors) ?? numberOrNull(siteDraft?.desired_floors);
    const width = numberOrNull(siteDraft?.width);
    const depth = numberOrNull(siteDraft?.depth);
    const front = numberOrNull(planningDraft?.front_setback_m) ?? 0;
    const rear = numberOrNull(planningDraft?.rear_setback_m) ?? 0;
    const side = numberOrNull(planningDraft?.side_setback_m) ?? 0;

    const coverageFootprint = plotArea !== null && coverage !== null
      ? plotArea * (coverage / 100)
      : null;
    const farArea = plotArea !== null && far !== null ? plotArea * far : null;
    const floorsArea = coverageFootprint !== null && floors !== null
      ? coverageFootprint * floors
      : null;
    const totalFloorArea =
      farArea !== null && floorsArea !== null
        ? Math.min(farArea, floorsArea)
        : farArea ?? floorsArea;
    const envelopeWidth = width !== null ? Math.max(0, width - side * 2) : null;
    const envelopeDepth = depth !== null ? Math.max(0, depth - front - rear) : null;
    const setbackEnvelope =
      envelopeWidth !== null && envelopeDepth !== null
        ? envelopeWidth * envelopeDepth
        : null;
    const estimatedFootprint =
      coverageFootprint !== null && setbackEnvelope !== null
        ? Math.min(coverageFootprint, setbackEnvelope)
        : coverageFootprint ?? setbackEnvelope;

    return {
      estimatedFootprint,
      totalFloorArea,
      setbackEnvelope,
      outdoorArea:
        plotArea !== null && estimatedFootprint !== null
          ? Math.max(0, plotArea - estimatedFootprint)
          : null,
    };
  }, [planningDraft, siteDraft]);

  const selectedDirection = directions.find((direction) => direction.is_selected) || null;
  const selectedMaterials = materials.filter((material) => material.is_selected);

  if (loading) {
    return (
      <main className="architecture-workspace-loading">
        <style>{workspaceStyles}</style>
        <div className="workspace-loader-card">
          <span className="loader-mark"><ArchitectureIcon /></span>
          <div>
            <p className="eyebrow">Architecture Studio</p>
            <h1>Opening your project workspace</h1>
            <p>Loading the brief, site, planning guide and project files.</p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !projectDraft) {
    return (
      <main className="architecture-workspace-loading">
        <style>{workspaceStyles}</style>
        <div className="workspace-loader-card error-card">
          <h1>Project unavailable</h1>
          <p>{error}</p>
          <a href="/dashboard" className="primary-action">Return to Dashboard</a>
        </div>
      </main>
    );
  }

  if (!projectDraft || !siteDraft || !planningDraft) return null;

  const visibleTabs = tabs
    .filter((tab) => tab.id !== "source" || projectDraft.workflow_mode !== "build_from_scratch")
    .filter((tab) => tab.id !== "planning" || (projectDraft.working_mode === "professional" && siteDraft.land_start === "owned"))
    .map((tab) =>
      tab.id === "source"
        ? {
            ...tab,
            label: "Source Intelligence",
          }
        : tab,
    );

  const workflowHeroMessage = projectDraft.workflow_mode === "build_from_scratch"
    ? projectDraft.working_mode === "professional"
      ? "Complete the exact site, professional Space Program and Material System before developing the coordinated design."
      : "Add the approximate property size, choose the important spaces and let Heyy Studio prepare smart design assumptions."
    : "Review the uploaded source, material clues and development rules before generating coordinated directions.";

  const activeTabIndex = visibleTabs.findIndex((tab) => tab.id === activeTab);
  const previousTab = activeTabIndex > 0 ? visibleTabs[activeTabIndex - 1] : null;
  const nextTab = activeTabIndex >= 0 && activeTabIndex < visibleTabs.length - 1 ? visibleTabs[activeTabIndex + 1] : null;

  return (
    <main className="architecture-workspace-page">
      <style>{workspaceStyles}</style>

      <div className="architecture-workspace-wrap">
            <section className="workspace-hero">
              <div className="workspace-hero-copy">
                <div className="hero-mark"><ArchitectureIcon /></div>
                <div>
                  <div className="hero-badges">
                    <span>{workflowLabel(projectDraft.workflow_mode)}</span>
                    <span data-tone="status">{projectDraft.status || "Brief"}</span>
                  </div>
                  <h1>{projectDraft.project_name}</h1>
                  <p>
                    {[projectDraft.project_type, projectDraft.city, projectDraft.country]
                      .filter(Boolean)
                      .join(" · ") || "Architecture project"}
                  </p>
                </div>
              </div>

              <div className="hero-progress-card">
                <div className="flex items-center justify-between gap-4">
                  <span className="eyebrow">Project Progress</span>
                  <strong>{projectDraft.completion || 0}%</strong>
                </div>
                <div className="hero-progress-line">
                  <span style={{ width: `${projectDraft.completion || 0}%` }} />
                </div>
                <p>{workflowHeroMessage}</p>
                <StudioModeToggle
                  value={projectDraft.working_mode === "professional" ? "professional" : "guided"}
                  onChange={(mode) => void changeWorkingMode(mode)}
                  tone="architecture"
                  compact
                  saving={saving === "working-mode"}
                  className="mt-3"
                />
              </div>
            </section>

            <nav className="workspace-tabs" aria-label="Architecture project sections">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-active={activeTab === tab.id}
                  onClick={() => switchTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  {tab.phase && <small>{tab.phase}</small>}
                </button>
              ))}
            </nav>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="workspace-error">{error}</div>}

            {activeTab === "overview" && (
              <OverviewTab
                project={projectDraft}
                site={siteDraft}
                planning={planningDraft}
                documents={documents}
                directions={directions}
                calculations={calculations}
                sourceBrief={projectDraft.source_brief || {}}
                spaceProgram={spaceProgram}
                materials={selectedMaterials}
                onOpen={switchTab}
              />
            )}

            {activeTab === "brief" && (
              <BriefTab
                project={projectDraft}
                setProject={setProjectDraft}
                saving={saving === "brief"}
                onSave={saveBrief}
              />
            )}

            {activeTab === "source" && projectDraft.workflow_mode !== "build_from_scratch" && (
              <SourceInputTab
                project={projectDraft}
                setProject={setProjectDraft}
                documents={documents.filter((document) => document.category === "source" || document.category === "reference")}
                saving={saving === "source"}
                uploading={uploading}
                onSave={saveSourceBrief}
                onUpload={(files) => uploadDocuments(files, "source")}
                onDownload={downloadDocument}
                onDelete={deleteDocument}
              />
            )}

            {activeTab === "site" && (
              <SiteTab
                project={projectDraft}
                setProject={setProjectDraft}
                site={siteDraft}
                setSite={setSiteDraft}
                documents={documents}
                uploadCategory={uploadCategory}
                setUploadCategory={setUploadCategory}
                uploading={uploading}
                onUpload={uploadDocuments}
                onDownload={downloadDocument}
                onDelete={deleteDocument}
                saving={saving === "site"}
                onSave={saveSite}
              />
            )}

            {activeTab === "planning" && (
              <PlanningTab
                project={projectDraft}
                site={siteDraft}
                planning={planningDraft}
                setPlanning={setPlanningDraft}
                calculations={calculations}
                saving={saving === "planning"}
                onSave={savePlanning}
              />
            )}

            {activeTab === "program" && (
              <SpaceProgramTab
                project={projectDraft}
                items={spaceProgram}
                setItems={setSpaceProgram}
                calculations={calculations}
                saving={saving === "program"}
                onSuggest={createSuggestedProgram}
                onSave={saveSpaceProgram}
              />
            )}

            {activeTab === "materials" && (
              <MaterialsTab
                project={projectDraft}
                materials={materials}
                documents={documents}
                saving={saving}
                uploading={uploading}
                extractingDocumentId={extractingMaterial}
                onToggle={toggleMaterialSelection}
                onUpload={(files) => uploadDocuments(files, "material-reference")}
                onAnalyse={analyseMaterialReference}
                onDownload={downloadDocument}
                onDelete={deleteDocument}
                onToggleSaved={toggleSavedMaterial}
                onUpdate={updateArchitectureMaterial}
                onCreateCustom={createCustomMaterial}
                onDeleteMaterial={deleteArchitectureMaterial}
              />
            )}

            {activeTab === "directions" && (
              <DirectionsTab
                project={projectDraft}
                site={siteDraft}
                planning={planningDraft}
                directions={directions}
                selectedMaterials={selectedMaterials}
                generatingDirection={generatingDirection}
                selectingDirection={selectingDirection}
                onGenerate={generateDirections}
                onSelect={selectDirection}
                regeneratingImage={regeneratingImage}
                generationStatus={generationStatus}
                onRegenerateImage={(directionId, quality) =>
                  regenerateArchitectureImage("direction", directionId, { quality })
                }
              />
            )}

            {activeTab === "concept" && (
              <ConceptTab
                project={projectDraft}
                direction={selectedDirection}
                concept={concept}
                generating={generatingStage === "concept" || generatingStage === "all"}
                onGenerate={() => generateArchitectureStage("concept")}
                onOpenDirections={() => switchTab("directions")}
                regeneratingImage={regeneratingImage}
                generationStatus={generationStatus}
                onRegenerateImage={(conceptId, quality) =>
                  regenerateArchitectureImage("concept", conceptId, { quality })
                }
              />
            )}

            {activeTab === "plans" && (
              <PlansTab
                project={projectDraft}
                direction={selectedDirection}
                planSet={planSet}
                visuals={visuals}
                documents={documents}
                generating={generatingStage === "plans" || generatingStage === "all"}
                onGenerate={() => generateArchitectureStage("plans")}
                onOpenDirections={() => switchTab("directions")}
                regeneratingImage={regeneratingImage}
                generationStatus={generationStatus}
                onRegenerateImage={(visualId, planMode, quality) =>
                  regenerateArchitectureImage("visual", visualId, { planMode, quality })
                }
                approvingVisual={approvingVisual}
                onApprove={approveVisual}
                onCreateSourcePlan={createSourcePlanCrop}
                onDownloadDocument={downloadDocument}
                onDeleteDocument={deleteDocument}
              />
            )}

            {activeTab === "visuals" && (
              <VisualsTab
                project={projectDraft}
                direction={selectedDirection}
                visuals={visuals}
                documents={documents}
                generating={generatingStage === "visuals" || generatingStage === "all"}
                approvingVisual={approvingVisual}
                onGenerate={() => generateArchitectureStage("visuals")}
                onApprove={approveVisual}
                onOpenDirections={() => switchTab("directions")}
                onOpenPlans={() => switchTab("plans")}
                regeneratingImage={regeneratingImage}
                generationStatus={generationStatus}
                onRegenerateImage={(visualId, quality) =>
                  regenerateArchitectureImage("visual", visualId, { quality })
                }
              />
            )}

            {activeTab === "design-pack" && (
              <DesignPackTab
                project={projectDraft}
                site={siteDraft}
                planning={planningDraft}
                direction={selectedDirection}
                concept={concept}
                planSet={planSet}
                visuals={visuals}
                designPack={designPack}
                materials={selectedMaterials}
                spaceProgram={spaceProgram}
                generating={generatingStage === "design-pack" || generatingStage === "all"}
                onPrepare={() => generateArchitectureStage("design-pack")}
                onGenerateAll={() => generateArchitectureStage("all")}
                onOpenDirections={() => switchTab("directions")}
              />
            )}

            {activeTab === "estimate" && (
              <EstimateTab
                project={projectDraft}
                planSet={planSet}
                visuals={visuals}
                documents={documents}
                spaceProgram={spaceProgram}
                materials={selectedMaterials}
                preparing={preparingEstimate}
                onPrepare={prepareEstimate}
                onOpenPlans={() => switchTab("plans")}
                onOpenSpaceProgram={() => switchTab("program")}
                onOpenMaterials={() => switchTab("materials")}
              />
            )}

            {activeTab === "production" && (
              <ArchitectureProductionTab
                project={projectDraft}
                site={siteDraft}
                planning={planningDraft}
                direction={selectedDirection}
                concept={concept}
                planSet={planSet}
                visuals={visuals}
                designPack={designPack}
                documents={documents}
                materials={selectedMaterials}
                spaceProgram={spaceProgram}
                onOpenDirections={() => switchTab("directions")}
              />
            )}

            <SectionNavigation
              previous={previousTab}
              next={nextTab}
              onNavigate={switchTab}
            />
      </div>
    </main>
  );
}

function SectionNavigation({
  previous,
  next,
  onNavigate,
}: {
  previous: { id: TabId; label: string } | null;
  next: { id: TabId; label: string } | null;
  onNavigate: (tab: TabId) => void;
}) {
  return (
    <nav className="section-navigation surface-card" aria-label="Architecture section navigation">
      <div>
        <span>Project Journey</span>
        <strong>Continue through the workspace one section at a time.</strong>
      </div>
      <div className="section-navigation-actions">
        {previous ? <button type="button" className="secondary-action" onClick={() => onNavigate(previous.id)}>← Back · {previous.label}</button> : <span />}
        {next ? <button type="button" className="primary-action" onClick={() => onNavigate(next.id)}>Next · {next.label} →</button> : <a className="primary-action" href="/dashboard">Finish · Dashboard →</a>}
      </div>
    </nav>
  );
}

function OverviewTab({
  project,
  site,
  planning,
  documents,
  directions,
  calculations,
  sourceBrief,
  spaceProgram,
  materials,
  onOpen,
}: {
  project: Project;
  site: Site;
  planning: Planning;
  documents: DocumentRow[];
  directions: Direction[];
  calculations: CalculationResult;
  sourceBrief: SourceBrief;
  spaceProgram: SpaceProgramItem[];
  materials: ArchitectureMaterial[];
  onOpen: (tab: TabId) => void;
}) {
  const selectedDirection = directions.find((direction) => direction.is_selected);

  const sourceWorkflow = project.workflow_mode !== "build_from_scratch";
  const sourceDocuments = documents.filter((document) => document.category === "source");

  const checklist = [
    {
      label: "Project brief",
      complete: Boolean(project.project_name && project.project_type && project.architectural_style),
      tab: "brief" as TabId,
    },
    ...(sourceWorkflow
      ? [
          {
            label: project.workflow_mode === "sketch_to_real" ? "Sketch source" : "Plan source",
            complete: Boolean(sourceDocuments.length && sourceBrief.source_type),
            tab: "source" as TabId,
          },
        ]
      : []),
    {
      label: "Land and site",
      complete: sourceWorkflow ? Boolean(project.country || site.desired_floors) : site.land_start !== "owned" || Boolean(project.country && site.plot_area),
      tab: "site" as TabId,
    },
    ...(project.working_mode === "professional" && site.land_start === "owned"
      ? [{
          label: "Planning guide",
          complete: Boolean(planning.zoning || planning.site_coverage_percent || planning.floor_area_ratio),
          tab: "planning" as TabId,
        }]
      : []),
    { label: "Space Program", complete: spaceProgram.length > 0, tab: "program" as TabId },
    { label: "Materials, colours & paint", complete: materials.length > 0, tab: "materials" as TabId, optional: true },
    { label: "Project files", complete: documents.length > 0, tab: "site" as TabId },
  ];

  return (
    <div className="workspace-content-grid">
      <section className="workspace-main-column">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project Overview</p>
            <h2>Your architecture project at a glance</h2>
            <p>Review the current project context and complete the foundation before generating design directions.</p>
          </div>
        </div>

        <div className="metric-grid">
          <MetricCard label="Plot Area" value={formatMeasurement(site.plot_area, "m²")} />
          <MetricCard label="Estimated Footprint" value={formatMeasurement(calculations.estimatedFootprint, "m²")} />
          <MetricCard label="Estimated Floor Area" value={formatMeasurement(calculations.totalFloorArea, "m²")} />
          <MetricCard label="Program Area" value={`${Math.round(spaceProgram.reduce((sum, item) => sum + Number(item.total_area_m2 || 0), 0))} m²`} />
          <MetricCard label="Materials" value={String(materials.length)} />
        </div>

        <div className="surface-card next-stage-card">
          <div>
            <p className="eyebrow">Next Major Stage</p>
            <h3>{sourceWorkflow ? "Develop three source-based Architecture Directions" : "Generate three Architecture Directions"}</h3>
            <p>
              {sourceWorkflow
                ? "The saved source file and interpretation brief will guide three different concept routes."
                : "Directions use the brief, site context and Space Program to create three different concept routes."}
            </p>
          </div>
          <button type="button" onClick={() => onOpen("directions")} className="primary-action">
            Preview Directions →
          </button>
        </div>

        <div className="surface-card">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Project Foundation</p>
              <h3>Complete the essential information</h3>
            </div>
          </div>

          <div className="checklist">
            {checklist.map((item) => (
              <button key={item.label} type="button" onClick={() => onOpen(item.tab)} className="check-row">
                <span data-complete={item.complete}>{item.complete && <Check size={12} strokeWidth={2.6} />}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.complete ? "Ready" : "optional" in item && item.optional ? "Optional before Directions" : "Needs information"}</p>
                </div>
                <b>→</b>
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="workspace-side-column">
        <div className="surface-card sticky-card">
          <p className="eyebrow">Current Direction</p>
          <h3>{selectedDirection?.title || project.architectural_style || "Not selected"}</h3>
          <SummaryLine
            label="Selected route"
            value={
              selectedDirection
                ? `Direction ${String.fromCharCode(64 + selectedDirection.direction_number)}`
                : "Not selected"
            }
          />
          <SummaryLine label="Workflow" value={workflowLabel(project.workflow_mode)} />
          <SummaryLine label="Working mode" value={project.working_mode === "professional" ? "Professional" : "Guided"} />
          <SummaryLine label="Program spaces" value={String(spaceProgram.length)} />
          <SummaryLine label="Selected materials" value={String(materials.length)} />
          <SummaryLine label="Project" value={project.project_type || "Not added"} />
          <SummaryLine label="Scope" value={project.scope || "Not added"} />
          <SummaryLine label="Location" value={[project.city, project.country].filter(Boolean).join(", ") || "Not added"} />
          {project.working_mode === "professional" && (
            <>
              <SummaryLine label="Planning" value={site.land_start === "owned" ? planning.verification_status || "Needs verification" : "Available after land is added"} />
              <div className="planning-notice">
                Concept guidance only. Local professionals and authorities must verify all planning and compliance information.
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function BriefTab({
  project,
  setProject,
  saving,
  onSave,
}: {
  project: Project;
  setProject: (project: Project) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const template = getArchitectureProjectTemplate(project.project_type);
  function update<K extends keyof Project>(key: K, value: Project[K]) {
    setProject({ ...project, [key]: value });
  }
  function changeType(value: string) {
    const next = getArchitectureProjectTemplate(value);
    setProject({ ...project, project_type: value || null, selected_spaces: next.defaultSpaces });
  }
  function toggleSpace(space: string) {
    const current = project.selected_spaces || [];
    update("selected_spaces", current.includes(space) ? current.filter((item) => item !== space) : [...current, space]);
  }
  const isCustomStyle = project.architectural_style === "Other / Custom" || Boolean(project.architectural_style && !styles.includes(project.architectural_style));
  return (
    <section className="surface-card form-section">
      <div className="section-heading">
        <div><p className="eyebrow">Project Brief</p><h2>Edit the architectural brief</h2><p>The building type controls the suggested spaces, design priorities and future visual gallery.</p></div>
        <button type="button" onClick={onSave} disabled={saving} className="primary-action">{saving ? "Saving..." : "Save Project Brief"}</button>
      </div>
      <div className="form-grid two">
        <InputField label="Project Name" value={project.project_name} onChange={(value) => update("project_name", value)} />
        <SelectField label="Project Type" value={project.project_type || ""} options={["", ...projectTypes]} onChange={changeType} />
        <SelectField label="Scope" value={project.scope || ""} options={["", "New Build", "Renovation", "Extension", "Feasibility Study", "Concept Only"]} onChange={(value) => update("scope", value || null)} />
        <SelectField label="Architectural Style" value={isCustomStyle ? "Other / Custom" : project.architectural_style || ""} options={["", ...styles]} onChange={(value) => update("architectural_style", value || null)} />
      </div>
      {isCustomStyle && <InputField label="Custom Architectural Style" value={project.architectural_style === "Other / Custom" ? "" : project.architectural_style || ""} onChange={(value) => update("architectural_style", value || "Other / Custom")} placeholder="Describe the exact style in your own words" />}
      <div className="field-block">
        <label>{template.label} Spaces & Features</label>
        <div className="chip-list">{template.spaces.map((space) => <button key={space} type="button" data-active={(project.selected_spaces || []).includes(space)} onClick={() => toggleSpace(space)}>{space}</button>)}</div>
      </div>
      <TextareaField label="Project Requirements" value={project.notes || ""} onChange={(value) => update("notes", value || null)} placeholder={`Describe users, operations, atmosphere, accessibility, sustainability and priorities for this ${template.label.toLowerCase()} project.`} />
    </section>
  );
}

function SourceInputTab({
  project,
  setProject,
  documents,
  saving,
  uploading,
  onSave,
  onUpload,
  onDownload,
  onDelete,
}: {
  project: Project;
  setProject: (project: Project) => void;
  documents: DocumentRow[];
  saving: boolean;
  uploading: boolean;
  onSave: () => void;
  onUpload: (files: FileList | null) => void;
  onDownload: (document: DocumentRow) => void;
  onDelete: (document: DocumentRow) => void;
}) {
  const isSketch = project.workflow_mode === "sketch_to_real";
  const sourceBrief = project.source_brief || {};
  const sourceDocuments = documents.filter((document) => document.category === "source");
  const referenceDocuments = documents.filter((document) => document.category === "reference");
  const mainPreview = sourceDocuments.find((document) => document.preview_url);

  function updateSource<K extends keyof SourceBrief>(key: K, value: SourceBrief[K]) {
    setProject({
      ...project,
      source_brief: {
        ...(project.source_brief || {}),
        [key]: value,
      },
    });
  }

  function toggleCameraView(view: string) {
    const current = sourceBrief.camera_views || [];
    updateSource(
      "camera_views",
      current.includes(view)
        ? current.filter((item) => item !== view)
        : [...current, view],
    );
  }

  return (
    <div className="workspace-content-grid">
      <section className="workspace-main-column">
        <div className="surface-card form-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{isSketch ? "Sketch Source" : "Plan Source"}</p>
              <h2>{isSketch ? "Control how the sketch should be interpreted" : "Control how the plan should become architectural visuals"}</h2>
              <p>
                {isSketch
                  ? "The source drawing remains attached to every direction, concept, visual and expert production request."
                  : "The uploaded plan and render rules remain attached to every direction, visual and expert production request."}
              </p>
            </div>
            <button type="button" onClick={onSave} disabled={saving} className="primary-action">
              {saving ? "Saving..." : "Save Source Brief"}
            </button>
          </div>

          <div className="form-grid two">
            <InputField label={isSketch ? "Sketch Type" : "Plan Type"} value={sourceBrief.source_type || ""} onChange={(value) => updateSource("source_type", value || null)} />
            <InputField label="Source Status" value={sourceBrief.source_status || ""} onChange={(value) => updateSource("source_status", value || null)} />
            <NumberField label="Desired Floors" value={sourceBrief.desired_floors ?? null} integer onChange={(value) => updateSource("desired_floors", value)} />
            <InputField label="Preferred Materials" value={sourceBrief.materials || ""} onChange={(value) => updateSource("materials", value || null)} />
            <InputField label="Landscape Style" value={sourceBrief.landscape_style || ""} onChange={(value) => updateSource("landscape_style", value || null)} />
            <SelectField label="Time of Day" value={sourceBrief.time_of_day || "Day"} options={["Day", "Golden hour", "Sunset", "Night", "Day and night"]} onChange={(value) => updateSource("time_of_day", value)} />
          </div>

          {isSketch ? (
            <>
              <SelectField label="Interpretation Level" value={sourceBrief.interpretation_level || "Faithful interpretation"} options={["Faithful interpretation", "Refined evolution", "Bold reimagining"]} onChange={(value) => updateSource("interpretation_level", value)} />
              <TextareaField label="Elements to Preserve" value={sourceBrief.preserve_elements || ""} onChange={(value) => updateSource("preserve_elements", value || null)} placeholder="Describe the form, proportions, roof, openings or character that must remain faithful to the sketch." />
              <TextareaField label="Requested Changes" value={sourceBrief.requested_changes || ""} onChange={(value) => updateSource("requested_changes", value || null)} placeholder="Describe what should be refined, corrected or reimagined." />
            </>
          ) : (
            <>
              <SelectField label="Render Target" value={sourceBrief.render_target || ""} options={["", "Exterior façade study", "Full building massing", "Street presentation", "Aerial and landscape study", "Complete multi-view render set"]} onChange={(value) => updateSource("render_target", value || null)} />
              <SelectField label="Geometry Rule" value={sourceBrief.geometry_rule || "Keep the uploaded geometry"} options={["Keep the uploaded geometry", "Allow minor façade adjustments", "Allow massing development while respecting the plan"]} onChange={(value) => updateSource("geometry_rule", value)} />
              <div className="field-block">
                <label>Requested Camera Views</label>
                <div className="chip-list">
                  {["Front exterior", "Rear exterior", "Street view", "Aerial view", "Eye-level corner view", "Day view", "Night view"].map((view) => (
                    <button key={view} type="button" data-active={(sourceBrief.camera_views || []).includes(view)} onClick={() => toggleCameraView(view)}>
                      {view}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <TextareaField label="Surrounding Context" value={sourceBrief.surrounding_context || ""} onChange={(value) => updateSource("surrounding_context", value || null)} placeholder="Describe the street, neighbouring buildings, site, garden, pool, terrain or background context." />
        </div>

        <div className="surface-card form-section">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Source Documents</p>
              <h3>{isSketch ? "Sketches and supporting references" : "Plans, elevations and supporting references"}</h3>
            </div>
          </div>

          <label className="upload-button inline-flex w-fit">
            <input type="file" multiple className="sr-only" accept="application/pdf,image/*,.dwg" onChange={(event: ChangeEvent<HTMLInputElement>) => { onUpload(event.target.files); event.target.value = ""; }} />
            {uploading ? "Uploading..." : isSketch ? "Upload More Sketches" : "Upload More Plans"}
          </label>

          <div className="document-list mt-5">
            {[...sourceDocuments, ...referenceDocuments].map((document) => (
              <div key={document.id} className="document-row">
                <span className="document-icon"><FileIcon /></span>
                <div className="min-w-0 flex-1">
                  <strong>{document.filename}</strong>
                  <p>{document.category} · {formatBytes(document.file_size || 0)} · {formatDate(document.created_at)}</p>
                </div>
                <button type="button" onClick={() => onDownload(document)}>Download</button>
                <button type="button" data-danger="true" onClick={() => onDelete(document)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="workspace-side-column">
        <div className="surface-card sticky-card">
          <p className="eyebrow">Main Source</p>
          {mainPreview?.preview_url ? (
            <img src={mainPreview.preview_url} alt={mainPreview.filename} className="w-full rounded-2xl border border-slate-200 object-cover" />
          ) : (
            <div className="empty-files">Image preview is available for JPG, PNG and WebP source files. PDF and DWG files remain downloadable.</div>
          )}
          <h3 className="mt-4">{mainPreview?.filename || sourceDocuments[0]?.filename || "No source uploaded"}</h3>
          <SummaryLine label="Workflow" value={workflowLabel(project.workflow_mode)} />
          <SummaryLine label="Working mode" value={project.working_mode === "professional" ? "Professional" : "Guided"} />
          <SummaryLine label="Source type" value={sourceBrief.source_type || "Not added"} />
          <SummaryLine label="Source status" value={sourceBrief.source_status || "Not added"} />
          <SummaryLine label="Files" value={String(sourceDocuments.length)} />
          <SummaryLine label="References" value={String(referenceDocuments.length)} />
          <div className="planning-notice">
            Uploaded files remain safely stored in the project. The saved source type, preservation rules and requested changes guide every generated direction and visual.
          </div>
        </div>
      </aside>
    </div>
  );
}

function SiteTab({
  project,
  setProject,
  site,
  setSite,
  documents,
  uploadCategory,
  setUploadCategory,
  uploading,
  onUpload,
  onDownload,
  onDelete,
  saving,
  onSave,
}: {
  project: Project;
  setProject: (project: Project) => void;
  site: Site;
  setSite: (site: Site) => void;
  documents: DocumentRow[];
  uploadCategory: string;
  setUploadCategory: (value: string) => void;
  uploading: boolean;
  onUpload: (files: FileList | null) => void;
  onDownload: (document: DocumentRow) => void;
  onDelete: (document: DocumentRow) => void;
  saving: boolean;
  onSave: () => void;
}) {
  function updateSite<K extends keyof Site>(key: K, value: Site[K]) {
    setSite({ ...site, [key]: value });
  }

  function updateProject<K extends keyof Project>(key: K, value: Project[K]) {
    setProject({ ...project, [key]: value });
  }

  return (
    <div className="workspace-content-grid">
      <section className="workspace-main-column">
        <div className="surface-card form-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Land & Site</p>
              <h2>Define the project location and physical site</h2>
              <p>Save the plot, dimensions, terrain and site conditions used by the planning and design workflows.</p>
            </div>
            <button type="button" onClick={onSave} disabled={saving} className="primary-action">
              {saving ? "Saving..." : "Save Land & Site"}
            </button>
          </div>

          {project.working_mode === "professional" ? (
            <>
              <div className="mode-experience-note professional"><strong>Professional site controls</strong><span>Enter known survey, dimensions, orientation and technical site information. Planning Guide is available only in this mode when land is confirmed.</span></div>
              <div className="form-grid three">
                <SelectField label="Starting Point" value={site.land_start} options={["owned", "looking", "exploring"]} labels={{ owned: "I have land", looking: "Looking for land", exploring: "Just exploring" }} onChange={(value) => updateSite("land_start", value as Site["land_start"])} />
                <InputField label="Country" value={project.country || ""} onChange={(value) => updateProject("country", value || null)} />
                <InputField label="State / Region" value={project.region || ""} onChange={(value) => updateProject("region", value || null)} />
                <InputField label="City / Municipality" value={project.city || ""} onChange={(value) => updateProject("city", value || null)} />
                <InputField label="Address / Lot Number" value={site.address || ""} onChange={(value) => updateSite("address", value || null)} />
                <SelectField label="Terrain" value={site.terrain || "Unknown"} options={["Flat", "Gentle Slope", "Steep Slope", "Unknown"]} onChange={(value) => updateSite("terrain", value || null)} />
                <NumberField label="Plot Area m²" value={site.plot_area} onChange={(value) => updateSite("plot_area", value)} />
                <NumberField label="Width m" value={site.width} onChange={(value) => updateSite("width", value)} />
                <NumberField label="Depth m" value={site.depth} onChange={(value) => updateSite("depth", value)} />
                <NumberField label="Desired Floors" value={site.desired_floors} integer onChange={(value) => updateSite("desired_floors", value)} />
                <SelectField label="Corner Lot" value={site.corner_lot || "Unknown"} options={["No", "Yes", "Unknown"]} onChange={(value) => updateSite("corner_lot", value || null)} />
                <InputField label="Orientation" value={site.orientation || ""} onChange={(value) => updateSite("orientation", value || null)} placeholder="Example: North-facing rear garden" />
              </div>
              <TextareaField label="Climate Notes" value={site.climate_notes || ""} onChange={(value) => updateSite("climate_notes", value || null)} placeholder="Sun, prevailing wind, heat, rainfall, coastal exposure or other climate considerations." />
              <TextareaField label="Site Notes" value={site.site_notes || ""} onChange={(value) => updateSite("site_notes", value || null)} placeholder="Access, slope, neighbouring buildings, views, vegetation, utilities, easements or constraints." />
            </>
          ) : (
            <>
              <div className="mode-experience-note guided"><strong>Guided site setup</strong><span>Approximate information is enough. Leave anything unknown empty and Heyy Studio will state its assumptions clearly.</span></div>
              <div className="form-grid three">
                <SelectField label="Do you have land?" value={site.land_start} options={["owned", "looking", "exploring"]} labels={{ owned: "Yes, I have land", looking: "I am looking", exploring: "No, just exploring" }} onChange={(value) => updateSite("land_start", value as Site["land_start"])} />
                <InputField label="Country" value={project.country || ""} onChange={(value) => updateProject("country", value || null)} />
                <InputField label="City / Area" value={project.city || ""} onChange={(value) => updateProject("city", value || null)} />
                <NumberField label="Approximate property area m²" value={site.plot_area} onChange={(value) => updateSite("plot_area", value)} />
                <NumberField label="How many floors?" value={site.desired_floors} integer onChange={(value) => updateSite("desired_floors", value)} />
                <SelectField label="Site shape" value={site.terrain || "Unknown"} options={["Flat", "Gentle Slope", "Steep Slope", "Unknown"]} onChange={(value) => updateSite("terrain", value || null)} />
              </div>
              <TextareaField label="Anything important about the property?" value={site.site_notes || ""} onChange={(value) => updateSite("site_notes", value || null)} placeholder="Example: ocean view, narrow site, trees to keep, busy road, no site selected yet." />
            </>
          )}
        </div>

        {project.working_mode === "professional" && <div className="surface-card form-section">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Professional Site Documents</p>
              <h3>Surveys, plans, certificates and references</h3>
            </div>
          </div>

          <div className="upload-controls">
            <HeyySelect
              value={uploadCategory}
              tone="architecture"
              ariaLabel="Document category"
              options={[
                { value: "site", label: "Site / Survey" },
                { value: "planning", label: "Planning" },
                { value: "source", label: "Sketch / Plan" },
                { value: "reference", label: "Reference" },
              ]}
              onChange={setUploadCategory}
            />

            <label className="upload-button">
              <input type="file" multiple className="sr-only" accept="application/pdf,image/*,.dwg" onChange={(event: ChangeEvent<HTMLInputElement>) => { onUpload(event.target.files); event.target.value = ""; }} />
              {uploading ? "Uploading..." : "Upload Files"}
            </label>
          </div>

          {documents.length === 0 ? (
            <div className="empty-files">No documents have been uploaded to this project.</div>
          ) : (
            <div className="document-list">
              {documents.map((document) => (
                <div key={document.id} className="document-row">
                  <span className="document-icon"><FileIcon /></span>
                  <div className="min-w-0 flex-1">
                    <strong>{document.filename}</strong>
                    <p>{document.category} · {formatBytes(document.file_size || 0)} · {formatDate(document.created_at)}</p>
                  </div>
                  <button type="button" onClick={() => onDownload(document)}>Download</button>
                  <button type="button" data-danger="true" onClick={() => onDelete(document)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>}
      </section>

      <aside className="workspace-side-column">
        <div className="surface-card sticky-card">
          <p className="eyebrow">Site Summary</p>
          <h3>{site.address || project.city || "Site not confirmed"}</h3>
          <SummaryLine label="Land status" value={landStartLabel(site.land_start)} />
          <SummaryLine label="Plot" value={formatMeasurement(site.plot_area, "m²")} />
          <SummaryLine label="Dimensions" value={site.width && site.depth ? `${site.width} × ${site.depth} m` : "Not added"} />
          <SummaryLine label="Terrain" value={site.terrain || "Not added"} />
          <SummaryLine label="Desired floors" value={site.desired_floors ? String(site.desired_floors) : "Not added"} />
        </div>
      </aside>
    </div>
  );
}

function PlanningTab({
  project,
  site,
  planning,
  setPlanning,
  calculations,
  saving,
  onSave,
}: {
  project: Project;
  site: Site;
  planning: Planning;
  setPlanning: (planning: Planning) => void;
  calculations: CalculationResult;
  saving: boolean;
  onSave: () => void;
}) {
  function update<K extends keyof Planning>(key: K, value: Planning[K]) {
    setPlanning({ ...planning, [key]: value });
  }

  return (
    <div className="workspace-content-grid">
      <section className="workspace-main-column">
        <div className="surface-card form-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Planning Guide</p>
              <h2>Organise the rules that shape the buildable envelope</h2>
              <p>Enter confirmed information from official documents or authority sources. Unknown values can remain empty.</p>
            </div>
            <button type="button" onClick={onSave} disabled={saving} className="primary-action">
              {saving ? "Saving..." : "Save Planning Guide"}
            </button>
          </div>

          <div className="planning-warning">
            <strong>Conceptual guidance only.</strong> Heyy Studio does not issue planning approval or certify these values. Confirm every rule with the responsible authority and a locally licensed professional.
          </div>

          <div className="form-grid three">
            <InputField label="Zoning" value={planning.zoning || ""} onChange={(value) => update("zoning", value || null)} />
            <InputField label="Permitted Use" value={planning.permitted_use || ""} onChange={(value) => update("permitted_use", value || null)} />
            <InputField label="Planning Authority" value={planning.authority_name || ""} onChange={(value) => update("authority_name", value || null)} />
            <NumberField label="Site Coverage %" value={planning.site_coverage_percent} onChange={(value) => update("site_coverage_percent", value)} />
            <NumberField label="FAR / FSR" value={planning.floor_area_ratio} onChange={(value) => update("floor_area_ratio", value)} />
            <NumberField label="Maximum Height m" value={planning.max_height_m} onChange={(value) => update("max_height_m", value)} />
            <NumberField label="Maximum Floors" value={planning.max_floors} integer onChange={(value) => update("max_floors", value)} />
            <NumberField label="Front Setback m" value={planning.front_setback_m} onChange={(value) => update("front_setback_m", value)} />
            <NumberField label="Rear Setback m" value={planning.rear_setback_m} onChange={(value) => update("rear_setback_m", value)} />
            <NumberField label="Side Setback m" value={planning.side_setback_m} onChange={(value) => update("side_setback_m", value)} />
            <InputField label="Parking Requirement" value={planning.parking_requirement || ""} onChange={(value) => update("parking_requirement", value || null)} />
            <InputField label="Open Space Requirement" value={planning.open_space_requirement || ""} onChange={(value) => update("open_space_requirement", value || null)} />
          </div>

          <div className="form-grid two">
            <SelectField label="Verification Status" value={planning.verification_status || "Needs verification"} options={["Needs verification", "User supplied", "Document reviewed", "Professional verification required", "Verified externally"]} onChange={(value) => update("verification_status", value)} />
            <SelectField label="Confidence" value={planning.confidence || "Unverified"} options={["Unverified", "Low", "Medium", "High"]} onChange={(value) => update("confidence", value)} />
          </div>

          <InputField label="Official Source / Reference" value={planning.source_reference || ""} onChange={(value) => update("source_reference", value || null)} placeholder="Document title, authority page or planning certificate reference" />
          <TextareaField label="Overlays" value={planning.overlays || ""} onChange={(value) => update("overlays", value || null)} placeholder="Heritage, flood, bushfire, environmental, airport, coastal or other overlays." />
          <TextareaField label="Restrictions" value={planning.restrictions || ""} onChange={(value) => update("restrictions", value || null)} placeholder="Easements, covenants, access restrictions or other constraints." />
          <TextareaField label="Planning Notes" value={planning.notes || ""} onChange={(value) => update("notes", value || null)} />
        </div>
      </section>

      <aside className="workspace-side-column">
        <div className="surface-card sticky-card calculation-card">
          <p className="eyebrow">Buildable Area Estimate</p>
          <h3>{project.project_name}</h3>
          <CalculationRow label="Plot area" value={formatMeasurement(site.plot_area, "m²")} />
          <CalculationRow label="Setback envelope" value={formatMeasurement(calculations.setbackEnvelope, "m²")} />
          <CalculationRow label="Estimated footprint" value={formatMeasurement(calculations.estimatedFootprint, "m²")} highlight />
          <CalculationRow label="Estimated total floor area" value={formatMeasurement(calculations.totalFloorArea, "m²")} highlight />
          <CalculationRow label="Approx. remaining outdoor area" value={formatMeasurement(calculations.outdoorArea, "m²")} />
          <div className="planning-notice">
            Calculations use only the values entered here and are not an approval, survey, code check or guaranteed development yield.
          </div>
        </div>
      </aside>
    </div>
  );
}


function guidedAreaBand(area: number) {
  if (area <= 12) return "small";
  if (area <= 28) return "medium";
  if (area <= 55) return "large";
  return "very-large";
}

function guidedAreaValue(value: string) {
  if (value === "small") return 10;
  if (value === "large") return 42;
  if (value === "very-large") return 75;
  return 22;
}

function SpaceProgramTab({ project, items, setItems, calculations, saving, onSuggest, onSave }: {
  project: Project; items: SpaceProgramItem[]; setItems: (value: SpaceProgramItem[]) => void; calculations: CalculationResult;
  saving: boolean; onSuggest: () => void; onSave: (items: SpaceProgramItem[]) => Promise<void>;
}) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0) * Number(item.area_each_m2 || 0)), 0);
  const target = numberOrNull(calculations.totalFloorArea) || (typeof project.professional_brief?.target_gross_area_m2 === "number" ? project.professional_brief.target_gross_area_m2 as number : null);
  const difference = target ? total - target : null;
  function update(index: number, field: keyof SpaceProgramItem, value: string | number) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value, total_area_m2: field === "quantity" || field === "area_each_m2" ? Number(field === "quantity" ? value : item.quantity) * Number(field === "area_each_m2" ? value : item.area_each_m2) : item.total_area_m2 } : item));
  }
  function addRow() { setItems([...items, { project_id: project.id, user_id: project.user_id, space_name: "New space", zone: "Flexible", level: "Ground", quantity: 1, area_each_m2: 16, total_area_m2: 16, priority: "Required", notes: null, is_ai_suggested: false, sort_order: items.length }]); }
  function removeRow(index: number) { setItems(items.filter((_, itemIndex) => itemIndex !== index)); }
  return <section className="smart-stage">
    <div className="stage-header surface-card"><div><p className="eyebrow">Smart Space Program</p><h2>Turn room wishes into an editable architectural schedule</h2><p>{project.working_mode === "professional" ? "Edit quantities, areas, levels, zones and priorities for a professional project program." : "Start with smart suggestions, then adjust the rooms and approximate sizes in simple language."}</p></div><div className="stage-actions"><button type="button" className="secondary-action" onClick={onSuggest}>Prepare Smart Suggestions</button><button type="button" className="primary-action" disabled={saving} onClick={() => onSave(items)}>{saving ? "Saving..." : "Save Space Program"}</button></div></div>
    <div className="program-intelligence-grid">
      <MetricCard label="Program Total" value={`${Math.round(total)} m²`} />
      <MetricCard label="Estimated Capacity" value={target ? `${Math.round(target)} m²` : "Add planning data"} />
      <MetricCard label="Difference" value={difference === null ? "Not calculated" : `${difference > 0 ? "+" : ""}${Math.round(difference)} m²`} />
      <MetricCard label="Spaces" value={String(items.length)} />
    </div>
    {difference !== null && Math.abs(difference) > Math.max(20, target! * .12) && <div className="smart-warning">{difference > 0 ? "The requested program is larger than the current estimated floor-area capacity. Consider increasing the footprint/floors or reducing areas." : "The current capacity is larger than the program. The remaining area can support circulation, storage, structure and future flexibility."}</div>}
    {project.working_mode === "professional" ? (
      <div className="program-table surface-card">
        <div className="program-head"><span>Space</span><span>Zone</span><span>Level</span><span>Qty</span><span>Area each</span><span>Total</span><span>Priority</span><span /></div>
        {items.map((item, index) => <div className="program-row" key={item.id || `${item.space_name}-${index}`}>
          <input value={item.space_name} onChange={(event) => update(index, "space_name", event.target.value)} />
          <HeyySelect value={item.zone} tone="architecture" ariaLabel={`${item.space_name} zone`} options={["Public", "Private", "Service", "Flexible", "Outdoor", "Wellness", "Entertainment", "Public / Service", "Private / Service"]} onChange={(value) => update(index, "zone", value)} triggerClassName="!min-h-[42px] !rounded-xl !px-3 !py-2" />
          <input value={item.level} onChange={(event) => update(index, "level", event.target.value)} />
          <input type="number" min="1" value={item.quantity} onChange={(event) => update(index, "quantity", Number(event.target.value))} />
          <input type="number" min="0" step="0.5" value={item.area_each_m2} onChange={(event) => update(index, "area_each_m2", Number(event.target.value))} />
          <strong>{Math.round(Number(item.quantity) * Number(item.area_each_m2))} m²</strong>
          <HeyySelect value={item.priority} tone="architecture" ariaLabel={`${item.space_name} priority`} options={["Required", "Preferred", "Optional"]} onChange={(value) => update(index, "priority", value)} triggerClassName="!min-h-[42px] !rounded-xl !px-3 !py-2" />
          <button type="button" onClick={() => removeRow(index)}>×</button>
        </div>)}
        {items.length === 0 && <div className="program-empty">No spaces yet. Prepare smart suggestions or add the first row.</div>}
        <button type="button" className="program-add" onClick={addRow}>+ Add Space</button>
      </div>
    ) : (
      <div className="guided-program-grid">
        {items.map((item, index) => <article className="guided-program-card surface-card" key={item.id || `${item.space_name}-${index}`}>
          <div className="guided-program-title"><input value={item.space_name} onChange={(event) => update(index, "space_name", event.target.value)} /><button type="button" onClick={() => removeRow(index)}>Remove</button></div>
          <div className="guided-program-fields">
            <label><span>How many?</span><input type="number" min="1" value={item.quantity} onChange={(event) => update(index, "quantity", Number(event.target.value))} /></label>
            <label><span>Approximate size each</span><HeyySelect value={guidedAreaBand(item.area_each_m2)} tone="architecture" ariaLabel={`${item.space_name} approximate size`} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }, { value: "very-large", label: "Very large" }]} onChange={(value) => update(index, "area_each_m2", guidedAreaValue(value))} /></label>
            <label><span>Importance</span><HeyySelect value={item.priority} tone="architecture" ariaLabel={`${item.space_name} importance`} options={["Required", "Preferred", "Optional"]} onChange={(value) => update(index, "priority", value)} /></label>
          </div>
          <p>Heyy Studio estimate: approximately <strong>{Math.round(Number(item.quantity) * Number(item.area_each_m2))} m²</strong>. Switch to Professional Mode for exact zones, levels and dimensions.</p>
        </article>)}
        {items.length === 0 && <div className="program-empty">No spaces yet. Prepare smart suggestions or add the first space.</div>}
        <button type="button" className="program-add" onClick={addRow}>+ Add Another Space</button>
      </div>
    )}
    <div className="concept-disclaimer">Area recommendations are conceptual. A qualified architect must verify circulation, structure, code, accessibility, services and local measurement rules.</div>
  </section>;
}

function MaterialsTab({
  project,
  materials,
  documents,
  saving,
  uploading,
  extractingDocumentId,
  onToggle,
  onUpload,
  onAnalyse,
  onDownload,
  onDelete,
  onToggleSaved,
  onUpdate,
  onCreateCustom,
  onDeleteMaterial,
}: {
  project: Project;
  materials: ArchitectureMaterial[];
  documents: DocumentRow[];
  saving: string;
  uploading: boolean;
  extractingDocumentId: string | null;
  onToggle: (item: MaterialLibraryItem) => Promise<void>;
  onUpload: (files: FileList | null) => void;
  onAnalyse: (document: DocumentRow) => Promise<void>;
  onDownload: (document: DocumentRow) => Promise<void>;
  onDelete: (document: DocumentRow) => Promise<void>;
  onToggleSaved: (material: ArchitectureMaterial) => Promise<void>;
  onUpdate: (material: ArchitectureMaterial, patch: MaterialPatch) => Promise<boolean>;
  onCreateCustom: (input: CustomMaterialInput) => Promise<boolean>;
  onDeleteMaterial: (material: ArchitectureMaterial) => Promise<void>;
}) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<MaterialPatch>({});
  const [customPreview, setCustomPreview] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState<Omit<CustomMaterialInput, "file">>({
    name: "",
    category: "Custom / Reference",
    finish: "",
    color: "",
    application: "",
    cost_level: "To verify",
    maintenance_level: "To verify",
    climate_suitability: "",
    sustainability_note: "",
    notes: "",
  });
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [paintSaving, setPaintSaving] = useState<string | null>(null);
  const [libraryMode, setLibraryMode] = useState<"recommended" | "all">("recommended");
  const [applyingRecommendations, setApplyingRecommendations] = useState(false);
  const paintApplications = getArchitecturePaintApplications(project.project_type);
  const materialKeywords = getArchitectureMaterialKeywords(project.project_type);
  const [paintApplication, setPaintApplication] = useState(paintApplications[0] || "Interior walls");
  const [customPaintName, setCustomPaintName] = useState("Custom Colour");
  const [customPaintHex, setCustomPaintHex] = useState("#2E7CF6");
  const [customPaintFinish, setCustomPaintFinish] = useState("Matte");

  useEffect(() => {
    setPaintApplication(getArchitecturePaintApplications(project.project_type)[0] || "Interior walls");
    setLibraryMode("recommended");
  }, [project.project_type]);

  const selected = materials.filter((material) => material.is_selected);
  const referenceImages = documents.filter(
    (document) => document.category === "material-reference" && document.mime_type?.startsWith("image/"),
  );
  const filtered = materialLibrary.filter((item) => {
    const categoryMatch = category === "All" || item.category === category;
    const haystack = [item.name, item.category, item.finish, item.application, ...item.tags]
      .join(" ")
      .toLowerCase();
    const searchMatch = haystack.includes(search.trim().toLowerCase());
    const industryMatch = libraryMode === "all" || materialKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    return categoryMatch && searchMatch && industryMatch;
  });

  function openEditor(material: ArchitectureMaterial) {
    setEditingId(material.id);
    setEditDraft({
      name: material.name,
      category: material.category,
      finish: material.finish || "",
      color: material.color || "",
      application: material.application || "",
      cost_level: material.cost_level || "To verify",
      maintenance_level: material.maintenance_level || "To verify",
      climate_suitability: material.climate_suitability || "",
      sustainability_note: material.sustainability_note || "",
      is_selected: material.is_selected,
      notes: typeof material.metadata?.notes === "string" ? material.metadata.notes : "",
    });
  }

  function selectCustomFile(file: File | null) {
    if (customPreview) URL.revokeObjectURL(customPreview);
    setCustomFile(file);
    setCustomPreview(file ? URL.createObjectURL(file) : null);
    if (file && !customDraft.name) {
      setCustomDraft((current) => ({
        ...current,
        name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      }));
    }
  }

  async function submitCustomMaterial() {
    if (!customFile) return;
    const saved = await onCreateCustom({ file: customFile, ...customDraft });
    if (!saved) return;
    if (customPreview) URL.revokeObjectURL(customPreview);
    setCustomFile(null);
    setCustomPreview(null);
    setCustomDraft({
      name: "",
      category: "Custom / Reference",
      finish: "",
      color: "",
      application: "",
      cost_level: "To verify",
      maintenance_level: "To verify",
      climate_suitability: "",
      sustainability_note: "",
      notes: "",
    });
  }

  async function addPaintColour(input: { name: string; hex: string; finish: string; application: string }) {
    setPaintSaving(input.name);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 420;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Paint preview could not be created.");
      context.fillStyle = input.hex; context.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", .9));
      if (!blob) throw new Error("Paint preview could not be created.");
      const file = new File([blob], `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`, { type: "image/png" });
      await onCreateCustom({
        file, name: input.name, category: "Colours & Paint", finish: input.finish, color: input.hex, application: input.application,
        cost_level: "To verify", maintenance_level: "Low to medium", climate_suitability: "Confirm the selected paint system for the local substrate and climate.",
        sustainability_note: "Prefer low-VOC products and verify supplier environmental credentials.", notes: "Preset colour. Edit the paint code, finish and application after adding."
      });
    } finally { setPaintSaving(null); }
  }

  async function addPaintPreset(preset: typeof paintPresets[number]) {
    await addPaintColour({ ...preset, application: paintApplication });
  }

  async function addCustomPaint() {
    await addPaintColour({ name: customPaintName.trim() || "Custom Colour", hex: customPaintHex, finish: customPaintFinish, application: paintApplication });
  }

  async function applyRecommendedPalette() {
    if (applyingRecommendations) return;
    setApplyingRecommendations(true);
    setLibraryMode("recommended");
    setCategory("All");

    try {
      const context = [
        project.project_type,
        project.scope,
        project.architectural_style,
        project.country,
        project.region,
        project.city,
        project.notes,
        ...(project.selected_spaces || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const contextTokens = Array.from(new Set(context.split(/[^a-z0-9]+/).filter((token) => token.length > 3)));
      const rankedMaterials = materialLibrary
        .map((item) => {
          const haystack = [item.name, item.category, item.finish, item.application, ...item.tags].join(" ").toLowerCase();
          const industryScore = materialKeywords.reduce((score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 4 : 0), 0);
          const briefScore = contextTokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
          return { item, score: industryScore + briefScore };
        })
        .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
        .map(({ item }) => item);

      const recommendedMaterials = rankedMaterials
        .filter((item) => !materials.some((material) => material.material_key === item.key && material.is_selected))
        .slice(0, 4);

      for (const item of recommendedMaterials) {
        await onToggle(item);
      }

      const styleContext = `${project.architectural_style || ""} ${project.project_type || ""} ${project.country || ""}`.toLowerCase();
      const recommendedPaintNames = /japan|zen|organic|minimal/.test(styleContext)
        ? ["Warm Off-White", "Muted Olive"]
        : /mediterranean|coastal|leban|warm|terracotta/.test(styleContext)
          ? ["Warm Off-White", "Soft Sand", "Terracotta Clay"]
          : /industrial|contemporary|modern/.test(styleContext)
            ? ["Warm Off-White", "Deep Charcoal"]
            : ["Warm Off-White", "Soft Sand"];

      for (const presetName of recommendedPaintNames.slice(0, 2)) {
        const preset = paintPresets.find((item) => item.name === presetName);
        if (!preset) continue;
        const alreadySelected = materials.some(
          (material) => material.is_selected && material.category === "Colours & Paint" && String(material.color || "").toLowerCase() === preset.hex.toLowerCase(),
        );
        if (!alreadySelected) await addPaintColour(preset);
      }
    } finally {
      setApplyingRecommendations(false);
    }
  }

  return (
    <section className="smart-stage">
      <div className="stage-header surface-card">
        <div>
          <p className="eyebrow">Material Studio</p>
          <h2>Build an editable material system for the project</h2>
          <p>
            Choose from the expanded library, upload a custom material and define exactly where it should be used.
            Every saved material remains editable, selectable and removable after the workspace is created.
          </p>
        </div>
        <div className="material-stage-actions">
          <button
            type="button"
            className="secondary-action recommended-materials-action"
            disabled={applyingRecommendations || saving !== ""}
            onClick={() => void applyRecommendedPalette()}
          >
            {applyingRecommendations ? "Preparing Recommendations..." : "Use Recommended Colours & Materials"}
          </button>
          <div className="selected-material-count"><strong>{selected.length}</strong><span>selected materials</span></div>
        </div>
      </div>

      <div className="material-reference-panel surface-card">
        <div>
          <p className="eyebrow">Extract from a Reference Photo</p>
          <h3>Use one inspiration image to prepare editable material suggestions</h3>
          <p>
            The image can suggest visible finishes, but you still decide the name, category, application, cost,
            maintenance and climate notes before the material is used by the architecture workflow.
          </p>
        </div>
        <label className="material-upload-button">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              onUpload(event.target.files);
              event.target.value = "";
            }}
          />
          <span>{uploading ? "Uploading..." : "Upload Reference Photo"}</span>
        </label>
        {referenceImages.length > 0 && (
          <div className="material-reference-grid">
            {referenceImages.map((document) => (
              <article key={document.id}>
                <div>{document.preview_url ? <img src={document.preview_url} alt={document.filename} /> : <span>IMAGE</span>}</div>
                <strong>{document.filename}</strong>
                <div className="file-actions">
                  <button type="button" disabled={extractingDocumentId === document.id} onClick={() => onAnalyse(document)}>
                    {extractingDocumentId === document.id ? "Analysing..." : "Extract Materials"}
                  </button>
                  <button type="button" onClick={() => onDownload(document)}>Download</button>
                  <button type="button" onClick={() => onDelete(document)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="surface-card custom-material-builder">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Add Your Own Material</p>
            <h3>Upload the sample, then explain what it is and where it belongs</h3>
          </div>
        </div>
        <div className="custom-material-builder-grid">
          <label className="custom-material-dropzone">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                selectCustomFile(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
            {customPreview ? <img src={customPreview} alt="Custom material preview" /> : <span>Upload material image</span>}
          </label>
          <div className="custom-material-fields">
            <label><span>Material name *</span><input value={customDraft.name} onChange={(event) => setCustomDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Sand-coloured local stone" /></label>
            <label><span>Category</span><input value={customDraft.category} onChange={(event) => setCustomDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Stone, timber, metal..." /></label>
            <label><span>Finish</span><input value={customDraft.finish} onChange={(event) => setCustomDraft((current) => ({ ...current, finish: event.target.value }))} placeholder="Honed, brushed, matte..." /></label>
            <label><span>Colour / tone</span><input value={customDraft.color} onChange={(event) => setCustomDraft((current) => ({ ...current, color: event.target.value }))} placeholder="Warm beige, charcoal..." /></label>
            <label className="wide"><span>Where should this material be used? *</span><input value={customDraft.application} onChange={(event) => setCustomDraft((current) => ({ ...current, application: event.target.value }))} placeholder="Primary façade, entry wall, roof, screens, terrace flooring..." /></label>
            {project.working_mode === "professional" && (
              <>
                <label><span>Cost level</span><HeyySelect value={customDraft.cost_level} tone="architecture" ariaLabel="Material cost level" options={["To verify", "Controlled", "Medium", "High", "Premium"]} onChange={(value) => setCustomDraft((current) => ({ ...current, cost_level: value }))} /></label>
                <label><span>Maintenance</span><HeyySelect value={customDraft.maintenance_level} tone="architecture" ariaLabel="Material maintenance" options={["To verify", "Low", "Medium", "High"]} onChange={(value) => setCustomDraft((current) => ({ ...current, maintenance_level: value }))} /></label>
                <label className="wide"><span>Climate / performance note</span><input value={customDraft.climate_suitability} onChange={(event) => setCustomDraft((current) => ({ ...current, climate_suitability: event.target.value }))} placeholder="Coastal grade, shaded use only, requires sealing..." /></label>
                <label className="wide"><span>Sustainability / supplier note</span><input value={customDraft.sustainability_note} onChange={(event) => setCustomDraft((current) => ({ ...current, sustainability_note: event.target.value }))} placeholder="Local supplier, recycled content, certified timber..." /></label>
                <label className="wide"><span>Additional notes</span><textarea value={customDraft.notes} onChange={(event) => setCustomDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Anything the architect or AI should understand about this sample." /></label>
              </>
            )}
          </div>
        </div>
        <div className="custom-material-actions">
          <button
            type="button"
            className="primary-action"
            disabled={!customFile || !customDraft.name.trim() || !customDraft.application.trim() || saving === "custom-material"}
            onClick={submitCustomMaterial}
          >
            {saving === "custom-material" ? "Saving Material..." : "Add to Project Materials"}
          </button>
        </div>
      </div>

      <div className="surface-card custom-material-builder">
        <div className="section-heading compact"><div><p className="eyebrow">Colours & Paint</p><h3>Choose a colour, finish and exact project application</h3><p>Selected colours are stored as editable project materials and receive the same blue selected outline as every other material.</p></div></div>
        <div className="paint-application-panel">
          <label><span>Where does this colour belong?</span><HeyySelect value={paintApplication} tone="architecture" ariaLabel="Colour application" options={paintApplications} onChange={setPaintApplication} /></label>
        </div>
        <div className="paint-preset-grid">{paintPresets.map((preset) => {
          const selectedPaint = materials.some((material) => material.is_selected && material.category === "Colours & Paint" && String(material.color || "").toLowerCase() === preset.hex.toLowerCase() && material.application === paintApplication);
          return (
          <article key={preset.name} className="paint-preset-card" data-selected={selectedPaint}>
            <span className="paint-swatch" style={{ background: preset.hex }} />
            <div><strong>{preset.name}</strong><small>{preset.hex} · {preset.finish}</small><p>{paintApplication}</p></div>
            <button type="button" disabled={paintSaving !== null || selectedPaint} onClick={() => void addPaintPreset(preset)}>{selectedPaint ? "Selected ✓" : paintSaving === preset.name ? "Adding..." : "Select Colour"}</button>
          </article>
        );})}</div>
        <div className="custom-paint-builder">
          <div className="custom-paint-preview" style={{ background: customPaintHex }} />
          <label><span>Custom colour name</span><input value={customPaintName} onChange={(event) => setCustomPaintName(event.target.value)} /></label>
          <label><span>Pick a specific colour</span><div className="custom-color-control"><input type="color" value={customPaintHex} onChange={(event) => setCustomPaintHex(event.target.value.toUpperCase())} /><input value={customPaintHex} onChange={(event) => setCustomPaintHex(event.target.value)} placeholder="#2E7CF6" /></div></label>
          <label><span>Finish</span><HeyySelect value={customPaintFinish} tone="architecture" ariaLabel="Paint finish" options={["Flat", "Matte", "Eggshell", "Low sheen", "Satin", "Semi-gloss", "Gloss"]} onChange={setCustomPaintFinish} /></label>
          <button type="button" className="primary-action" disabled={paintSaving !== null || !/^#[0-9A-Fa-f]{6}$/.test(customPaintHex)} onClick={() => void addCustomPaint()}>{paintSaving === customPaintName ? "Adding Custom Colour..." : "Add Specific Colour"}</button>
        </div>
      </div>

      <div className="surface-card material-library-panel">
        <div className="section-heading compact">
          <div><p className="eyebrow">Industry-Aware Material Library</p><h3>{libraryMode === "recommended" ? `Recommended for ${project.project_type || "this project"}` : "All architecture materials"}</h3><p>The recommended view changes automatically with the project industry. Switch to All Materials whenever you need the complete library.</p></div>
          <input className="material-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stone, acoustic, commercial kitchen, timber..." />
        </div>
        <div className="material-industry-toggle"><button type="button" data-active={libraryMode === "recommended"} onClick={() => setLibraryMode("recommended")}>Recommended for {project.project_type || "Project"}</button><button type="button" data-active={libraryMode === "all"} onClick={() => setLibraryMode("all")}>All Materials</button></div>
        <div className="material-category-filter">
          {materialCategories.map((item) => <button type="button" key={item} data-active={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <div className="material-library-grid">
          {filtered.map((item) => {
            const saved = materials.find((material) => material.material_key === item.key);
            const isSelected = Boolean(saved?.is_selected);
            return (
              <article className="material-card" data-selected={isSelected} key={item.key}>
                <img src={item.image} alt={item.name} />
                <div className="material-card-body">
                  <div className="material-card-title">
                    <div><small>{item.category}</small><h3>{item.name}</h3></div>
                    <button type="button" disabled={saving === `material-${item.key}`} onClick={() => onToggle(item)}>{isSelected ? "Selected ✓" : "Select"}</button>
                  </div>
                  <div className="material-meta"><span>Finish · {item.finish}</span><span>Cost · {item.cost}</span><span>Maintenance · {item.maintenance}</span></div>
                  <p><strong>Application:</strong> {item.application}</p>
                  {project.working_mode === "professional" && <><p><strong>Climate:</strong> {item.climate}</p><p><strong>Sustainability:</strong> {item.sustainability}</p></>}
                </div>
              </article>
            );
          })}
        </div>
        {filtered.length === 0 && <div className="program-empty">No materials match this search and category.</div>}
      </div>

      <div className="selected-material-schedule surface-card">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Editable Project Material Schedule</p>
            <h3>{materials.length ? `${materials.length} saved materials · ${selected.length} feeding generation` : "No project materials saved yet"}</h3>
          </div>
        </div>
        <div className="editable-material-list">
          {materials.map((material) => {
            const isEditing = editingId === material.id;
            const source = String(material.metadata?.source || "");
            const sourceLabel = material.is_extracted ? "Photo suggestion" : source.includes("custom") ? "Custom upload" : "Library";
            return (
              <article className="editable-material-card" data-selected={material.is_selected} key={material.id}>
                <div className="editable-material-summary">
                  <img src={material.image_url || "/architecture/materials/mineral-render.jpg"} alt={material.name} />
                  <div>
                    <small>{sourceLabel} · {material.category}</small>
                    <strong>{material.name}</strong>
                    <span>{material.application || "Application not defined"} · {material.finish || "Finish to define"}</span>
                  </div>
                  <div className="editable-material-actions">
                    <button type="button" onClick={() => onToggleSaved(material)} disabled={saving === `saved-material-${material.id}`}>{material.is_selected ? "Using ✓" : "Use Material"}</button>
                    <button type="button" onClick={() => isEditing ? setEditingId(null) : openEditor(material)}>{isEditing ? "Close" : "Edit"}</button>
                    <button type="button" className="danger-button" onClick={() => onDeleteMaterial(material)} disabled={saving === `delete-material-${material.id}`}>Remove</button>
                  </div>
                </div>
                {isEditing && (
                  <div className="material-edit-grid">
                    <label><span>Name</span><input value={String(editDraft.name || "")} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                    <label><span>Category</span><input value={String(editDraft.category || "")} onChange={(event) => setEditDraft((current) => ({ ...current, category: event.target.value }))} /></label>
                    <label><span>Finish</span><input value={String(editDraft.finish || "")} onChange={(event) => setEditDraft((current) => ({ ...current, finish: event.target.value }))} /></label>
                    <label><span>Colour</span><input value={String(editDraft.color || "")} onChange={(event) => setEditDraft((current) => ({ ...current, color: event.target.value }))} /></label>
                    <label className="wide"><span>Where should it be used?</span><input value={String(editDraft.application || "")} onChange={(event) => setEditDraft((current) => ({ ...current, application: event.target.value }))} /></label>
                    {project.working_mode === "professional" && (
                      <>
                        <label><span>Cost</span><input value={String(editDraft.cost_level || "")} onChange={(event) => setEditDraft((current) => ({ ...current, cost_level: event.target.value }))} /></label>
                        <label><span>Maintenance</span><input value={String(editDraft.maintenance_level || "")} onChange={(event) => setEditDraft((current) => ({ ...current, maintenance_level: event.target.value }))} /></label>
                        <label className="wide"><span>Climate / performance</span><input value={String(editDraft.climate_suitability || "")} onChange={(event) => setEditDraft((current) => ({ ...current, climate_suitability: event.target.value }))} /></label>
                        <label className="wide"><span>Sustainability / supplier note</span><input value={String(editDraft.sustainability_note || "")} onChange={(event) => setEditDraft((current) => ({ ...current, sustainability_note: event.target.value }))} /></label>
                        <label className="wide"><span>Additional notes</span><textarea value={String(editDraft.notes || "")} onChange={(event) => setEditDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
                      </>
                    )}
                    <div className="wide material-edit-actions">
                      <button type="button" className="primary-action" disabled={saving === `edit-material-${material.id}`} onClick={async () => { const saved = await onUpdate(material, editDraft); if (saved) setEditingId(null); }}>
                        {saving === `edit-material-${material.id}` ? "Saving..." : "Save Material Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {materials.length === 0 && <div className="program-empty">Select a library material or add a custom material above.</div>}
      </div>
    </section>
  );
}

function DirectionsTab({
  project,
  site,
  planning,
  directions,
  selectedMaterials,
  generatingDirection,
  selectingDirection,
  onGenerate,
  onSelect,
  regeneratingImage,
  generationStatus,
  onRegenerateImage,
}: {
  project: Project;
  site: Site;
  planning: Planning;
  directions: Direction[];
  selectedMaterials: ArchitectureMaterial[];
  generatingDirection: "all" | number | null;
  selectingDirection: string | null;
  onGenerate: (directionNumber?: number) => void;
  onSelect: (direction: Direction) => void;
  regeneratingImage: string | null;
  generationStatus: string;
  onRegenerateImage: (directionId: string, quality: ImageGenerationTier) => void;
}) {
  const sourceWorkflow = project.workflow_mode !== "build_from_scratch";
  const sourceBrief = project.source_brief || {};
  const materialReady = true;
  const briefReady = Boolean(
    project.project_name &&
      project.project_type &&
      project.architectural_style &&
      (sourceWorkflow
        ? sourceBrief.source_type && (sourceBrief.preserve_elements || sourceBrief.render_target)
        : project.notes || project.selected_spaces?.length),
  );
  const siteReady = Boolean(
    project.country &&
      (site.plot_area || project.workflow_mode !== "build_from_scratch"),
  );
  const planningRequired = project.working_mode === "professional" && site.land_start === "owned";
  const planningAdded = !planningRequired || Boolean(
    planning.zoning ||
      planning.site_coverage_percent ||
      planning.floor_area_ratio ||
      planning.max_height_m ||
      planning.notes,
  );
  const selectedDirection = directions.find((direction) => direction.is_selected);
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [expandedDirections, setExpandedDirections] = useState<string[]>([]);

  function toggleDirectionDetails(directionId: string) {
    setExpandedDirections((current) =>
      current.includes(directionId)
        ? current.filter((id) => id !== directionId)
        : [...current, directionId],
    );
  }

  return (
    <section className="directions-section">
      <div className="directions-intro surface-card">
        <div>
          <p className="eyebrow">Architecture Directions</p>
          <h2>
            {project.workflow_mode === "sketch_to_real"
              ? "Three ways to turn the sketch into architecture"
              : project.workflow_mode === "plan_to_render"
                ? "Three style and material directions for the existing design"
                : "Three genuinely different architectural strategies"}
          </h2>
          <p>
            {project.workflow_mode === "sketch_to_real"
              ? "The saved sketch, preservation rules and requested changes guide three routes: faithful interpretation, refined evolution and bold reimagining."
              : project.workflow_mode === "plan_to_render"
                ? "Your uploaded drawings remain the fixed building geometry. These directions explore materials, façade character, landscape, light and atmosphere without redesigning the plan or massing."
                : "Heyy Studio combines the saved brief, land, planning assumptions and architectural preferences to create three concept-stage routes."}
            {" "}These are not permit, engineering or construction documents.
          </p>
        </div>

        <div className="directions-action-stack">
          <div className="directions-material-note">Materials are optional at this stage. Add or refine them later in Material Studio before final image generation.</div>
        <button
          type="button"
          className="primary-action directions-generate-all"
          disabled={generatingDirection !== null}
          onClick={() => onGenerate()}
        >
          {generatingDirection === "all"
            ? "Writing three directions..."
            : directions.length > 0
              ? `Regenerate Three Text Directions · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`
              : `Generate Three Text Directions · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`}
        </button>
        </div>
      </div>

      {generatingDirection !== null && (
        <StageGenerationLoading title="Generating Architecture Directions" detail={generatingDirection === "all" ? `Writing three project-type-specific strategies. ${ARCHITECTURE_CREDIT_COSTS.textGeneration} text-generation credits are reserved.` : `Rewriting the selected strategy and preparing its future image prompt. ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits are reserved.`} />
      )}

      <div className="direction-readiness-grid">
        <DirectionReadinessItem
          label={sourceWorkflow ? (project.workflow_mode === "sketch_to_real" ? "Sketch interpretation brief" : "Plan rendering brief") : "Project brief"}
          complete={briefReady}
          detail={briefReady ? "Ready for generation" : sourceWorkflow ? "Complete the source type, style and workflow rules" : "Add type, style, spaces and requirements"}
        />
        <DirectionReadinessItem
          label="Land & site"
          complete={siteReady}
          detail={
            siteReady
              ? `${formatMeasurement(site.plot_area, "m²")} · ${site.terrain || "Terrain not set"}`
              : "Add the country and available site information"
          }
        />
        <DirectionReadinessItem
          label="Planning context"
          complete={planningAdded}
          detail={
            !planningRequired
              ? "Not required until confirmed land is added"
              : planningAdded
                ? `${planning.verification_status || "Needs verification"} · ${planning.confidence || "Unverified"}`
                : "Generation can continue, but planning assumptions will be limited"
          }
        />
      </div>

      {selectedDirection && (
        <div className="selected-direction-banner">
          <span>Selected Direction</span>
          <strong>
            Direction {String.fromCharCode(64 + selectedDirection.direction_number)} ·{" "}
            {selectedDirection.title}
          </strong>
          <p>
            {project.workflow_mode === "plan_to_render"
              ? "This direction controls style, materials and atmosphere. Your organised source drawings remain the geometry source for Concepts and Visuals."
              : "This direction is now the source for the Architecture Concept, Plans, Visuals and Design Pack."}
          </p>
        </div>
      )}

      {directions.length === 0 ? (
        <div className="directions-empty">
          <span className="coming-mark"><ArchitectureIcon /></span>
          <h3>Your three directions will appear here</h3>
          <p>
            Direction A will be calm and context-led. Direction B will be layered and
            experience-led. Direction C will be bold and identity-led. Every strategy
            will adapt to this exact building type, its users and its operational needs.
          </p>
          <small>
            Each route is generated as text first. Select the strategy you prefer, then spend credits only on the selected visual.
          </small>
        </div>
      ) : (
        <div className="direction-card-grid">
          {directions.map((direction) => {
            const directionLetter = String.fromCharCode(
              64 + direction.direction_number,
            );
            const isGenerating =
              generatingDirection === direction.direction_number;
            const isSelecting = selectingDirection === direction.id;
            const materials = Array.isArray(direction.materials)
              ? direction.materials
              : [];
            const imageFailed =
              direction.generation_status === "image_failed" ||
              Boolean(direction.generation_error && !direction.image_url);
            const expanded = expandedDirections.includes(direction.id);

            return (
              <article
                key={direction.id}
                className="direction-card"
                data-selected={direction.is_selected ? "true" : "false"}
              >
                <div className="direction-card-visual">
                  {direction.image_url ? (
                    <button type="button" className="image-zoom-trigger" onClick={() => setLightbox({ url: assetPreviewUrl(recordValue(direction.generation_json).preview_assets) || direction.image_url || "", title: direction.title })} aria-label={`Enlarge ${direction.title}`}>
                      <img
                        src={
                          assetThumbnailUrl(recordValue(direction.generation_json).preview_assets) ||
                          direction.image_url
                        }
                        alt={`${direction.title} architecture concept`}
                        loading="lazy"
                        decoding="async"
                      />
                      <span>Click to enlarge</span>
                    </button>
                  ) : (
                    <div className="direction-image-placeholder">
                      <ArchitectureIcon />
                      <span>
                        {imageFailed
                          ? "Visual generation needs another attempt"
                          : "Select this direction, then generate its visual"}
                      </span>
                    </div>
                  )}

                  {regeneratingImage === `direction-${direction.id}` && (
                    <ImageGenerationOverlay title="Generating architecture image" detail={generationStatus} />
                  )}
                  <span className="direction-letter">Direction {directionLetter}</span>
                  {direction.is_selected && (
                    <span className="direction-selected-pill">Selected</span>
                  )}
                </div>

                <div className="direction-card-body">
                  <div className="direction-title-row">
                    <div>
                      <p className="eyebrow">Strategic Route</p>
                      <h3>{direction.title}</h3>
                    </div>
                    <span className="direction-cost">
                      {direction.cost_level || "Cost level pending"}
                    </span>
                  </div>

                  <div className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <p className="line-clamp-3 text-xs font-semibold leading-6 text-slate-600 dark:text-slate-300">
                      {direction.philosophy || direction.site_response || "Open the full direction to review the complete architectural strategy."}
                    </p>
                    {materials.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {materials.slice(0, 4).map((material, index) => (
                          <span key={`${direction.id}-summary-${material.name}-${index}`} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[9px] font-black text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                            {material.name}
                          </span>
                        ))}
                        {materials.length > 4 && <span className="px-2 py-1 text-[9px] font-black text-slate-400">+{materials.length - 4} more</span>}
                      </div>
                    )}
                    <button
                      type="button"
                      aria-expanded={expanded}
                      className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:shadow-none dark:hover:border-blue-400/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
                      onClick={() => toggleDirectionDetails(direction.id)}
                    >
                      <span>{expanded ? "Hide details" : "View details"}</span>
                      {expanded ? <ChevronUp size={13} strokeWidth={2.4} /> : <ChevronDown size={13} strokeWidth={2.4} />}
                    </button>
                  </div>

                  {expanded && (
                    <div className="grid gap-4">
                      <DirectionDetail label="Architectural philosophy" value={direction.philosophy} />
                      <DirectionDetail label="Site response" value={direction.site_response} />
                      <DirectionDetail label="Form & massing" value={direction.form_strategy} />
                      <DirectionDetail label="Spatial strategy" value={direction.spatial_strategy} />
                      <DirectionDetail label="Façade strategy" value={direction.facade_strategy} />

                      <div className="direction-material-block">
                        <span>Material palette</span>
                        <div className="direction-material-list">
                          {materials.map((material, index) => (
                            <div key={`${direction.id}-${material.name}-${index}`} className="direction-material">
                              <strong>{material.name}</strong>
                              <small>{material.role}</small>
                              <p>{material.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="direction-detail-grid">
                        <DirectionDetail label="Roof strategy" value={direction.roof_strategy} compact />
                        <DirectionDetail label="Landscape" value={direction.landscape_strategy} compact />
                        <DirectionDetail label="Sustainability" value={direction.sustainability} compact />
                        <DirectionDetail label="Natural light" value={direction.natural_light_strategy} compact />
                        <DirectionDetail label="Privacy" value={direction.privacy_strategy} compact />
                      </div>
                    </div>
                  )}

                  {direction.generation_error && (
                    <div className="direction-generation-warning">
                      <strong>Visual generation notice</strong>
                      <p>{direction.generation_error}</p>
                    </div>
                  )}

                  <div className="direction-actions">
                    <button
                      type="button"
                      className="direction-secondary-action"
                      disabled={generatingDirection !== null}
                      onClick={() => onGenerate(direction.direction_number)}
                    >
                      {isGenerating
                        ? "Regenerating Direction..."
                        : `Regenerate Direction ${directionLetter} Text · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`}
                    </button>

                    <button
                      type="button"
                      className="direction-secondary-action"
                      disabled={generatingDirection !== null || regeneratingImage !== null || !direction.is_selected}
                      onClick={() => onRegenerateImage(direction.id, "preview")}
                    >
                      {regeneratingImage === `direction-${direction.id}`
                        ? "Generating Preview..."
                        : direction.is_selected ? `${direction.image_url ? "Regenerate" : "Generate"} Selected Visual · ${ARCHITECTURE_CREDIT_COSTS.directionPreview} credits` : "Select Direction First"}
                    </button>

                    <button
                      type="button"
                      className="direction-secondary-action professional-final-action"
                      disabled={generatingDirection !== null || regeneratingImage !== null || !direction.is_selected}
                      onClick={() => onRegenerateImage(direction.id, "final")}
                    >
                      Professional Final · {ARCHITECTURE_CREDIT_COSTS.professionalFinal} credits
                    </button>

                    <button
                      type="button"
                      className="direction-select-action"
                      data-selected={direction.is_selected ? "true" : "false"}
                      disabled={
                        isSelecting ||
                        generatingDirection !== null ||
                        regeneratingImage !== null ||
                        direction.generation_status === "generating_image"
                      }
                      onClick={() => onSelect(direction)}
                    >
                      {isSelecting
                        ? "Selecting..."
                        : direction.is_selected
                          ? "Selected Direction"
                          : "Select Direction"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="direction-disclaimer">
        <strong>Concept-stage architecture only.</strong>
        <span>
          Local architects, planning authorities, engineers, surveyors and other
          qualified consultants must verify all dimensions, site constraints,
          planning assumptions, buildability, cost and compliance before use.
        </span>
      </div>
      {lightbox && <ImageLightbox url={lightbox.url} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </section>
  );
}

function DirectionReadinessItem({
  label,
  complete,
  detail,
}: {
  label: string;
  complete: boolean;
  detail: string;
}) {
  return (
    <div className="direction-readiness-item" data-complete={complete ? "true" : "false"}>
      <span>{complete ? <Check size={13} strokeWidth={2.6} /> : <AlertTriangle size={13} strokeWidth={2.3} />}</span>
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function DirectionDetail({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | null;
  compact?: boolean;
}) {
  return (
    <div className="direction-detail" data-compact={compact ? "true" : "false"}>
      <span>{label}</span>
      <p>{value || "Not generated yet."}</p>
    </div>
  );
}


function StageLocked({
  title,
  body,
  onOpenDirections,
  eyebrow = "Direction Required",
  actionLabel = "Open Architecture Directions →",
}: {
  title: string;
  body: string;
  onOpenDirections: () => void;
  eyebrow?: string;
  actionLabel?: string;
}) {
  return (
    <section className="stage-locked surface-card">
      <span className="coming-mark"><ArchitectureIcon /></span>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <button type="button" className="primary-action" onClick={onOpenDirections}>
        {actionLabel}
      </button>
    </section>
  );
}

function ConceptTab({
  project,
  direction,
  concept,
  generating,
  onGenerate,
  onOpenDirections,
  regeneratingImage,
  generationStatus,
  onRegenerateImage,
}: {
  project: Project;
  direction: Direction | null;
  concept: ArchitectureConcept | null;
  generating: boolean;
  onGenerate: () => void;
  onOpenDirections: () => void;
  regeneratingImage: string | null;
  generationStatus: string;
  onRegenerateImage: (conceptId: string, quality: ImageGenerationTier) => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!direction) {
    return (
      <StageLocked
        title="Select a direction before developing the concept"
        body="The Architecture Concept expands one selected direction into a coordinated strategy."
        onOpenDirections={onOpenDirections}
      />
    );
  }

  if (!concept) {
    return (
      <section className="stage-empty surface-card">
        <div className="stage-empty-copy">
          <p className="eyebrow">Architecture Concept</p>
          <h2>Develop {direction.title}</h2>
          <p>
            This stage turns the selected route into site response, zoning, circulation,
            entry, light, ventilation, privacy, materials, landscape and sustainability.
          </p>
          <div className="demo-explanation">
            <strong>Text and image are controlled separately.</strong>
            <span>
              First prepare the full concept strategy. Then generate or regenerate only the concept image without changing the saved strategy.
            </span>
          </div>
        </div>
        <button type="button" className="primary-action" disabled={generating} onClick={onGenerate}>
          {generating ? "Preparing Concept..." : `Prepare Architecture Concept · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`}
        </button>
        {generating && <StageGenerationLoading title="Preparing Concept Strategy" detail="Building the concept narrative, zoning, circulation and concept-board prompt from the selected direction." />}
      </section>
    );
  }

  const strategies = [
    ["Site response", concept.site_response],
    ["Functional zoning", concept.functional_zoning],
    ["Circulation", concept.circulation],
    ["Entry sequence", concept.entry_sequence],
    ["Public & private zones", concept.public_private_zones],
    ["Indoor-outdoor relationship", concept.indoor_outdoor_relationship],
    ["Natural light", concept.natural_light],
    ["Ventilation", concept.ventilation],
    ["Privacy", concept.privacy],
    ["Material language", concept.material_language],
    ["Landscape integration", concept.landscape_integration],
    ["Sustainability", concept.sustainability],
  ] as const;

  return (
    <section className="concept-stage">
      <div className="stage-header surface-card">
        <div>
          <p className="eyebrow">Architecture Concept</p>
          <h2>{concept.title}</h2>
          <p>{concept.summary}</p>
          <span className="stage-source-chip">{concept.generation_mode === "live" ? "AI prepared" : "Demo prepared"} · Saved in Supabase</span>
        </div>
        <button type="button" className="secondary-action" disabled={generating} onClick={onGenerate}>
          {generating ? "Refreshing..." : `Refresh Concept Strategy · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`}
        </button>
      </div>

      {generating && <StageGenerationLoading title="Refreshing Concept Strategy" detail="Updating the coordinated concept content without generating an image." />}
      <div className="concept-hero surface-card generation-image-card">
        {concept.image_url ? (
          <button type="button" className="plan-image-zoom" onClick={() => setLightbox(concept.image_url)} aria-label="Enlarge concept board"><img src={concept.image_url} alt={`${project.project_name} concept strategy board`} loading="eager" decoding="async" fetchPriority="high" /><span>Click to enlarge</span></button>
        ) : (
          <div className="generation-image-placeholder"><ArchitectureIcon /><strong>Concept image not generated yet</strong><span>The strategy is saved. Generate this image when ready.</span></div>
        )}
        {regeneratingImage === `concept-${concept.id}` && (
          <ImageGenerationOverlay title="Generating concept image" detail={generationStatus} />
        )}
        <div className="floating-generation-actions">
          <button
            type="button"
            className="image-regenerate-button"
            disabled={regeneratingImage !== null}
            onClick={() => onRegenerateImage(concept.id, "preview")}
          >
            {regeneratingImage === `concept-${concept.id}`
              ? "Generating Preview..."
              : `${concept.image_url ? "Regenerate" : "Generate"} Preview · ${ARCHITECTURE_CREDIT_COSTS.conceptPreview} credits`}
          </button>
          <button
            type="button"
            className="image-regenerate-button professional-final-action"
            disabled={regeneratingImage !== null}
            onClick={() => onRegenerateImage(concept.id, "final")}
          >
            Professional Final · {ARCHITECTURE_CREDIT_COSTS.professionalFinal} credits
          </button>
        </div>
      </div>

      <div className="strategy-grid">
        {strategies.map(([label, value], index) => (
          <article key={label} className="strategy-card">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{label}</h3>
              <p>{value || "Concept information is not available yet."}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="direction-disclaimer">
        <strong>Concept-stage strategy only.</strong>
        <span>
          A registered local architect and qualified consultants must verify planning,
          structure, services, dimensions, compliance and buildability.
        </span>
      </div>
      {lightbox && <ImageLightbox url={lightbox} title={`${project.project_name} Concept Board`} onClose={() => setLightbox(null)} />}
    </section>
  );
}

function PlansTab({
  project,
  direction,
  planSet,
  visuals,
  documents,
  generating,
  onGenerate,
  onOpenDirections,
  regeneratingImage,
  generationStatus,
  onRegenerateImage,
  approvingVisual,
  onApprove,
  onCreateSourcePlan,
  onDownloadDocument,
  onDeleteDocument,
}: {
  project: Project;
  direction: Direction | null;
  planSet: ArchitecturePlanSet | null;
  visuals: ArchitectureVisual[];
  documents: DocumentRow[];
  generating: boolean;
  onGenerate: () => void;
  onOpenDirections: () => void;
  regeneratingImage: string | null;
  generationStatus: string;
  onRegenerateImage: (
    visualId: string,
    planMode: PlanGenerationMode,
    quality: ImageGenerationTier,
  ) => Promise<void>;
  approvingVisual: string | null;
  onApprove: (visual: ArchitectureVisual) => void;
  onCreateSourcePlan: (args: {
    documentId: string;
    planType: SourcePlanType;
    label: string;
    crop: { x: number; y: number; width: number; height: number };
  }) => Promise<boolean>;
  onDownloadDocument: (document: DocumentRow) => Promise<void>;
  onDeleteDocument: (document: DocumentRow) => Promise<void>;
}) {
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [batchRunning, setBatchRunning] = useState<"technical" | "rendered" | null>(null);
  const existingDesignProject = project.workflow_mode === "plan_to_render";
  const sourceImages = documents.filter(
    (document) => document.category === "source" && document.mime_type?.startsWith("image/"),
  );
  const organisedSourcePlans = documents.filter((document) =>
    Boolean(sourcePlanTypeFromCategory(document.category)),
  );

  if (existingDesignProject) {
    return (
      <ExistingSourcePlansPanel
        project={project}
        sourceImages={sourceImages}
        organisedPlans={organisedSourcePlans}
        onCreateSourcePlan={onCreateSourcePlan}
        onDownloadDocument={onDownloadDocument}
        onDeleteDocument={onDeleteDocument}
      />
    );
  }

  if (!direction) {
    return (
      <StageLocked
        title="Select a direction before preparing plans"
        body="Concept Plans must follow the chosen architecture strategy."
        onOpenDirections={onOpenDirections}
      />
    );
  }

  const existingDesignSource = false;

  const planVisualTypes = [
    "functional_zoning", "ground_floor", "upper_floor", "site_plan", "circulation",
    "north_elevation", "south_elevation", "east_elevation", "west_elevation",
    "section_longitudinal", "section_transverse",
    "perspective_front", "perspective_rear", "perspective_aerial",
  ];
  const planVisuals = visuals.filter(
    (visual) => visual.metadata?.group === "plans" || planVisualTypes.includes(visual.visual_type),
  );
  const canonicalPlan = recordValue(recordValue(planSet?.generation_json).canonical_plan);
  const canonicalLevels = Array.isArray(canonicalPlan.levels) ? canonicalPlan.levels : [];
  const requiredFloorPlanTypes = [
    "ground_floor",
    ...(canonicalLevels.length > 1 ? ["upper_floor"] : []),
  ];
  const requiredFloorPlansReady = existingDesignSource || requiredFloorPlanTypes.every((type) => {
    const visual = planVisuals.find((item) => item.visual_type === type);
    return Boolean(visual?.is_approved && assetPreviewUrl(visual.metadata?.technical_assets));
  });

  function togglePlanSelection(visualId: string) {
    setSelectedPlanIds((current) => current.includes(visualId) ? current.filter((id) => id !== visualId) : [...current, visualId]);
  }

  async function runPlanBatch(mode: "technical" | "rendered") {
    const queue = planVisuals.filter((visual) => selectedPlanIds.includes(visual.id));
    if (!queue.length) return;
    setBatchRunning(mode);
    try {
      for (const visual of queue) {
        if (mode === "technical" && /^perspective_/.test(visual.visual_type)) continue;
        await onRegenerateImage(visual.id, mode, "preview");
      }
    } finally {
      setBatchRunning(null);
      setSelectedPlanIds([]);
    }
  }

  if (!planSet) {
    return (
      <section className="stage-empty surface-card">
        <div className="stage-empty-copy">
          <p className="eyebrow">Concept Plans</p>
          <h2>Prepare the conceptual plan set</h2>
          <p>
            {existingDesignSource
              ? "Your uploaded drawings remain the source of truth. This stage can organise them into the project, prepare optional faithful redraws and coordinate additional documentation without inventing a different plan."
              : "The documentation stage prepares floor plans, zoning, circulation, site plan, four elevations, two perpendicular sections and coordinated perspective views."}
          </p>
          <div className="demo-explanation">
            <strong>{existingDesignSource ? "Existing geometry stays locked." : "These are not permit drawings."}</strong>
            <span>{existingDesignSource
              ? "If you already have the plans you need, you can go directly to Visuals. Generate a detailed plan here only when you want a cleaned or presentation-ready redraw of the uploaded source."
              : "The stage prepares the area schedule, relationships and separate prompts. Each plan image can then be generated or regenerated independently."}</span>
          </div>
        </div>
        <button type="button" className="primary-action" disabled={generating} onClick={onGenerate}>
          {generating ? "Preparing Plans..." : `Prepare Concept Plans · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`}
        </button>
        {generating && <StageGenerationLoading title="Preparing Coordinated Plans" detail="Creating one canonical Space Program, room relationship set and linked plan specification." />}
      </section>
    );
  }

  return (
    <section className="plans-stage">
      <div className="stage-header surface-card">
        <div>
          <p className="eyebrow">Concept Plans</p>
          <h2>{planSet.title}</h2>
          <p>
            Indicative total floor area: <strong>{formatMeasurement(planSet.total_estimated_area, "m²")}</strong>.
            All dimensions and areas remain conceptual.
          </p>
        </div>
        <button type="button" className="secondary-action" disabled={generating} onClick={onGenerate}>
          {generating ? "Refreshing..." : `Refresh Plan Content & Prompts · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`}
        </button>
      </div>

      {generating && <StageGenerationLoading title="Refreshing Coordinated Plans" detail="Updating the canonical plan specification and all linked technical and rendered plan prompts." />}
      <div className="plan-workflow-card surface-card" data-ready={requiredFloorPlansReady ? "true" : "false"}>
        <div>
          <strong>{existingDesignSource
            ? "Uploaded plans are the geometry source of truth"
            : requiredFloorPlansReady
              ? "Approved floor plans are connected"
              : "Generate and approve the floor plans first"}</strong>
          <span>{existingDesignSource
            ? "Visuals and optional redraws use the uploaded source drawings first. Heyy Studio must preserve the existing footprint, layout, stairs, openings and level relationships."
            : requiredFloorPlansReady
              ? "Previews, professional finals, elevations, sections and project visuals can now use the approved floor-plan geometry."
              : `Workflow: detailed plan → approval → preview → professional final. Required floor plans: ${requiredFloorPlanTypes.map((item) => item.replace(/_/g, " ")).join(" and ")}.`}</span>
        </div>
        <div className="credit-legend">
          <span>Detailed plan · {ARCHITECTURE_CREDIT_COSTS.technicalPlan} credits</span>
          <span>Preview · {ARCHITECTURE_CREDIT_COSTS.renderedPlanPreview} credits</span>
          <b>{existingDesignSource ? "Source geometry locked" : requiredFloorPlansReady ? "Plans approved" : "Approval required"}</b>
        </div>
      </div>

      <div className="plan-batch-panel surface-card">
        <div><strong>Generate several views</strong><span>Select any cards below. Heyy Studio will place them in a safe queue and generate them one after another, so you do not need to wait and click each card manually.</span></div>
        <div className="plan-batch-actions">
          <button type="button" className="secondary-action" disabled={!selectedPlanIds.length || batchRunning !== null || regeneratingImage !== null} onClick={() => void runPlanBatch("technical")}>{batchRunning === "technical" ? "Generating Queue..." : `Generate Selected Detailed Plans · ${ARCHITECTURE_CREDIT_COSTS.technicalPlan} each`}</button>
          <button type="button" className="primary-action" disabled={!selectedPlanIds.length || batchRunning !== null || regeneratingImage !== null} onClick={() => void runPlanBatch("rendered")}>{batchRunning === "rendered" ? "Generating Queue..." : `Generate Selected Previews · ${ARCHITECTURE_CREDIT_COSTS.renderedPlanPreview} each`}</button>
        </div>
        {selectedPlanIds.length > 0 && <small>{selectedPlanIds.length} view{selectedPlanIds.length === 1 ? "" : "s"} selected · batch runs sequentially to protect consistency, rate limits and cost.</small>}
      </div>

      <div className="plan-view-group-legend"><span>Plans & diagrams</span><span>4 elevations</span><span>2 sections</span><span>3 perspectives</span></div>
      <div className="plan-visual-grid">
        {planVisuals.map((visual) => (
          <PlanVisualCard
            key={visual.id}
            visual={visual}
            loading={regeneratingImage === `visual-${visual.id}`}
            anyGenerating={regeneratingImage !== null}
            generationStatus={generationStatus}
            selected={selectedPlanIds.includes(visual.id)}
            onToggleSelected={() => togglePlanSelection(visual.id)}
            onGenerate={(planMode, quality) =>
              onRegenerateImage(visual.id, planMode, quality)
            }
            plansReady={requiredFloorPlansReady}
            sourceLocked={existingDesignSource}
            approving={approvingVisual === visual.id}
            onApprove={() => onApprove(visual)}
          />
        ))}
      </div>

      <div className="plans-data-grid">
        <section className="surface-card plan-data-card">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Area Schedule</p>
              <h3>Indicative room allocation</h3>
            </div>
          </div>
          <div className="area-schedule-table">
            <div className="area-schedule-head"><span>Space</span><span>Level</span><span>Approx.</span></div>
            {(planSet.area_schedule || []).map((item) => (
              <div key={`${item.space}-${item.level}`} className="area-schedule-row">
                <strong>{item.space}</strong><span>{item.level}</span><b>{item.approx_area_m2} m²</b>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card plan-data-card">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Conceptual Dimensions</p>
              <h3>Working design references</h3>
            </div>
          </div>
          <div className="dimension-list">
            {(planSet.conceptual_dimensions || []).map((item) => (
              <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
            ))}
          </div>
        </section>
      </div>

      <div className="plans-data-grid">
        <section className="surface-card plan-data-card">
          <p className="eyebrow">Room Relationships</p>
          <div className="relationship-list">
            {(planSet.room_relationships || []).map((item) => (
              <div key={`${item.from}-${item.to}`}>
                <strong>{item.from} → {item.to}</strong>
                <span>{item.relationship}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="surface-card plan-data-card">
          <p className="eyebrow">Planning Assumptions</p>
          <div className="assumption-list">
            {(planSet.planning_assumptions || []).map((item, index) => (
              <div key={`${index}-${item}`}><span>{index + 1}</span><p>{item}</p></div>
            ))}
          </div>
        </section>
      </div>

      <div className="direction-disclaimer">
        <strong>Not construction or permit drawings.</strong>
        <span>
          These diagrams are concept communication only. Do not use them for pricing,
          approval, construction, engineering or site work.
        </span>
      </div>
    </section>
  );
}

function ExistingSourcePlansPanel({
  project,
  sourceImages,
  organisedPlans,
  onCreateSourcePlan,
  onDownloadDocument,
  onDeleteDocument,
}: {
  project: Project;
  sourceImages: DocumentRow[];
  organisedPlans: DocumentRow[];
  onCreateSourcePlan: (args: {
    documentId: string;
    planType: SourcePlanType;
    label: string;
    crop: { x: number; y: number; width: number; height: number };
  }) => Promise<boolean>;
  onDownloadDocument: (document: DocumentRow) => Promise<void>;
  onDeleteDocument: (document: DocumentRow) => Promise<void>;
}) {
  const [organising, setOrganising] = useState<DocumentRow | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);

  return (
    <section className="grid gap-5">
      <div className="surface-card border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 dark:border-blue-900/60 dark:from-[#0c1a31] dark:via-[#101827] dark:to-[#0b2230]">
        <p className="eyebrow">Existing Design · Source Plans</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
          Your uploaded drawings are the plans.
        </h2>
        <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
          Heyy Studio will not regenerate or redesign these technical drawings. Organise the original source sheet into Ground Floor, Upper Floor, Elevations and Sections by cropping the exact drawing areas below. Cropping is deterministic and does not use AI credits.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em]">
          <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Geometry preserved</span>
          <span className="rounded-full bg-blue-100 px-3 py-2 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">No AI redraw</span>
          <span className="rounded-full bg-violet-100 px-3 py-2 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">Visuals use these sources</span>
        </div>
      </div>

      {organisedPlans.length > 0 && (
        <section className="surface-card p-5 sm:p-6">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Organised source drawings</p>
              <h3>Exact plans saved from the uploaded source</h3>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {organisedPlans.map((document) => {
              const type = sourcePlanTypeFromCategory(document.category) || "other";
              return (
                <article key={document.id} className="overflow-hidden rounded-[20px] border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.045]">
                  {document.preview_url ? (
                    <button
                      type="button"
                      className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-slate-50 p-3 dark:bg-black/20"
                      onClick={() => setLightbox({ url: document.preview_url as string, title: sourcePlanLabel(type) })}
                    >
                      <img src={document.preview_url} alt={sourcePlanLabel(type)} className="max-h-full max-w-full object-contain" />
                    </button>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-slate-400 dark:bg-black/20"><FileText /></div>
                  )}
                  <div className="p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600 dark:text-blue-300">Source of truth</p>
                    <h4 className="mt-1 text-base font-black text-slate-950 dark:text-white">{sourcePlanLabel(type)}</h4>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{document.filename}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" className="secondary-action" onClick={() => void onDownloadDocument(document)}>Download</button>
                      <button type="button" className="secondary-action" onClick={() => void onDeleteDocument(document)}>Remove</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="surface-card p-5 sm:p-6">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Source Plan Organizer</p>
            <h3>Split the original drawing sheet without changing it</h3>
            <p>Open an uploaded image, drag around one drawing, choose its type and save the exact crop.</p>
          </div>
        </div>

        {sourceImages.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sourceImages.map((document) => (
              <article key={document.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20">
                {document.preview_url ? (
                  <div className="aspect-[4/3] overflow-hidden rounded-[14px] bg-white p-2 dark:bg-white/[0.04]">
                    <img src={document.preview_url} alt={document.filename} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-[14px] bg-white text-slate-400 dark:bg-white/[0.04]"><FileText /></div>
                )}
                <p className="mt-3 truncate text-sm font-black text-slate-900 dark:text-white">{document.filename}</p>
                <button
                  type="button"
                  className="primary-action mt-3 w-full"
                  disabled={!document.preview_url}
                  onClick={() => setOrganising(document)}
                >
                  Organise drawings
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[18px] border border-dashed border-blue-300 bg-blue-50 p-6 text-sm font-semibold leading-6 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
            No image-based source drawing is available yet. Upload a JPG, PNG or WebP source drawing in Project Files. PDF and DWG extraction will be added separately.
          </div>
        )}
      </section>

      <div className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Next step</p>
          <h3>Already have all the plans?</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">You can skip plan generation entirely and continue to Direction, Materials and Visuals. The organised drawings remain the geometry references.</p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white dark:bg-violet-600">No plan generation required</span>
      </div>

      {organising && organising.preview_url && (
        <SourcePlanCropModal
          document={organising}
          onClose={() => setOrganising(null)}
          onSave={async (args) => {
            const saved = await onCreateSourcePlan({ documentId: organising.id, ...args });
            if (saved) setOrganising(null);
            return saved;
          }}
        />
      )}
      {lightbox && <ImageLightbox url={lightbox.url} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </section>
  );
}

function SourcePlanCropModal({
  document,
  onClose,
  onSave,
}: {
  document: DocumentRow;
  onClose: () => void;
  onSave: (args: {
    planType: SourcePlanType;
    label: string;
    crop: { x: number; y: number; width: number; height: number };
  }) => Promise<boolean>;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [planType, setPlanType] = useState<SourcePlanType>("ground_floor");
  const [label, setLabel] = useState("Ground Floor");
  const [selection, setSelection] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [savingCrop, setSavingCrop] = useState(false);

  function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function updateSelection(start: { x: number; y: number }, end: { x: number; y: number }) {
    setSelection({
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    });
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[94vh] w-full max-w-6xl overflow-auto rounded-[28px] border border-white/10 bg-white shadow-2xl dark:bg-[#14101f]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-white/10 sm:p-6">
          <div>
            <p className="eyebrow">Source Plan Organizer</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Crop the exact drawing — no AI redraw</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Drag a rectangle around one plan, elevation or section. The selected pixels are saved exactly as shown.</p>
          </div>
          <button type="button" className="secondary-action" onClick={onClose}>Close</button>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-[18px] border border-slate-200 bg-slate-100 p-3 dark:border-white/10 dark:bg-black/25">
            <div
              className="relative mx-auto w-fit max-w-full touch-none select-none overflow-hidden bg-white"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const point = pointFromEvent(event);
                setDragStart(point);
                setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
              }}
              onPointerMove={(event) => {
                if (!dragStart) return;
                updateSelection(dragStart, pointFromEvent(event));
              }}
              onPointerUp={(event) => {
                if (dragStart) updateSelection(dragStart, pointFromEvent(event));
                setDragStart(null);
              }}
            >
              <img ref={imageRef} src={document.preview_url || ""} alt={document.filename} className="block max-h-[68vh] max-w-full object-contain" draggable={false} />
              <div
                className="pointer-events-none absolute border-2 border-violet-500 bg-violet-500/10 shadow-[0_0_0_9999px_rgba(15,23,42,.32)]"
                style={{
                  left: `${selection.x * 100}%`,
                  top: `${selection.y * 100}%`,
                  width: `${selection.width * 100}%`,
                  height: `${selection.height * 100}%`,
                }}
              />
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <div>
              <label className="field-label">Drawing type</label>
              <HeyySelect
                value={planType}
                options={SOURCE_PLAN_TYPES.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(value) => {
                  const next = value as SourcePlanType;
                  setPlanType(next);
                  setLabel(sourcePlanLabel(next));
                }}
              />
            </div>
            <div>
              <label className="field-label">Drawing label</label>
              <input className="input" value={label} onChange={(event) => setLabel(event.target.value)} />
            </div>
            <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold leading-5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              The saved drawing will be a direct crop of the original upload. Walls, openings, dimensions and annotations are not regenerated.
            </div>
            <button type="button" className="secondary-action" onClick={() => setSelection({ x: 0, y: 0, width: 1, height: 1 })}>Use entire image</button>
            <button
              type="button"
              className="primary-action"
              disabled={savingCrop || selection.width < 0.03 || selection.height < 0.03 || !label.trim()}
              onClick={async () => {
                setSavingCrop(true);
                try {
                  await onSave({ planType, label: label.trim(), crop: selection });
                } finally {
                  setSavingCrop(false);
                }
              }}
            >
              {savingCrop ? "Saving exact crop..." : "Save source drawing"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PlanVisualCard({
  visual,
  loading,
  anyGenerating,
  generationStatus,
  selected,
  onToggleSelected,
  onGenerate,
  plansReady,
  sourceLocked,
  approving,
  onApprove,
}: {
  visual: ArchitectureVisual;
  loading: boolean;
  anyGenerating: boolean;
  generationStatus: string;
  selected: boolean;
  onToggleSelected: () => void;
  onGenerate: (planMode: PlanGenerationMode, quality: ImageGenerationTier) => Promise<void>;
  plansReady: boolean;
  sourceLocked: boolean;
  approving: boolean;
  onApprove: () => void;
}) {
  const metadata = recordValue(visual.metadata);
  const renderedOnly = /^perspective_/.test(visual.visual_type);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const technicalUrl = assetPreviewUrl(metadata.technical_assets);
  const renderedFinalUrl = assetPreviewUrl(metadata.rendered_final_assets);
  const renderedPreviewUrl = assetPreviewUrl(metadata.rendered_preview_assets);
  const renderedUrl = renderedFinalUrl || renderedPreviewUrl;
  const savedActiveMode: PlanGenerationMode = renderedOnly
    ? "rendered"
    : metadata.active_plan_view === "technical"
      ? "technical"
      : metadata.active_plan_view === "rendered"
        ? "rendered"
        : renderedUrl
          ? "rendered"
          : "technical";
  const [viewMode, setViewMode] = useState<PlanGenerationMode>(savedActiveMode);

  useEffect(() => {
    setViewMode(savedActiveMode);
  }, [savedActiveMode]);

  const displayUrl = viewMode === "rendered"
    ? renderedUrl || visual.image_url
    : technicalUrl || (!renderedUrl ? visual.image_url : null);

  return (
    <article className="plan-visual-card generation-image-card" data-selected={selected}>
      <div className="plan-card-toolbar">
        <div className="plan-view-tabs">
          {!renderedOnly && <button type="button" data-active={viewMode === "technical"} disabled={!technicalUrl} onClick={() => setViewMode("technical")}>{sourceLocked ? "Faithful redraw" : "Detailed plan"}</button>}
          <button type="button" data-active={viewMode === "rendered"} disabled={!renderedUrl} onClick={() => setViewMode("rendered")}>{renderedOnly ? "Preview" : "Preview"}</button>
        </div>
        <button type="button" className="plan-select-toggle" data-selected={selected} onClick={onToggleSelected}>{selected ? "Selected for batch ✓" : "Select for batch"}</button>
      </div>
      {displayUrl ? (
        <button type="button" className="plan-image-zoom" onClick={() => setLightbox(displayUrl)} aria-label={`Enlarge ${visual.title || visual.visual_type}`}><img src={displayUrl} alt={visual.title || visual.visual_type} loading="lazy" decoding="async" /><span>Click to enlarge</span></button>
      ) : (
        <div className="generation-image-placeholder compact"><ArchitectureIcon /><strong>Plan not generated</strong><span>{visual.prompt || "The coordinated plan data is ready."}</span></div>
      )}
      {loading && <ImageGenerationOverlay title={viewMode === "rendered" ? "Generating rendered plan" : "Generating detailed concept plan"} detail={generationStatus} />}
      <div className="plan-card-copy">
        <span>{viewMode === "rendered" ? "Rendered Preview" : sourceLocked ? "Source-faithful redraw" : "Detailed AI Concept Plan"}</span>
        <h3>{visual.title || visual.visual_type}</h3>
      </div>
      <div className="plan-card-actions">
        {!renderedOnly && <button type="button" className="image-regenerate-button" disabled={anyGenerating} onClick={() => { setViewMode("technical"); void onGenerate("technical", "preview"); }}>
          {sourceLocked
            ? technicalUrl ? "Regenerate Faithful Redraw" : "Create Faithful Redraw"
            : technicalUrl ? "Regenerate Detailed Plan" : "Generate Detailed Plan"} · {ARCHITECTURE_CREDIT_COSTS.technicalPlan} credits
        </button>}
        {!renderedOnly && technicalUrl && <button type="button" className="visual-approve-button" data-approved={visual.is_approved ? "true" : "false"} disabled={anyGenerating || approving} onClick={onApprove}>
          {approving ? "Saving..." : visual.is_approved ? (sourceLocked ? "Redraw approved ✓" : "Approved Plan ✓") : (sourceLocked ? "Approve Redraw" : "Approve Plan")}
        </button>}
        {renderedOnly && !plansReady && (
          <button type="button" className="image-regenerate-button plan-generation-locked" disabled>
            Approve Required Floor Plans to Unlock Preview
          </button>
        )}
        {(renderedOnly ? plansReady : Boolean(technicalUrl && visual.is_approved)) && (
          <button type="button" className="image-regenerate-button" disabled={anyGenerating} onClick={() => { setViewMode("rendered"); void onGenerate("rendered", "preview"); }}>
            {renderedPreviewUrl ? "Regenerate Preview" : "Generate Preview"} · {ARCHITECTURE_CREDIT_COSTS.renderedPlanPreview} credits
          </button>
        )}
        {renderedUrl && (
          <button type="button" className="image-regenerate-button professional-final-action" disabled={anyGenerating} onClick={() => { setViewMode("rendered"); void onGenerate("rendered", "final"); }}>
            Professional Final · {ARCHITECTURE_CREDIT_COSTS.professionalFinal} credits
          </button>
        )}
      </div>
      {lightbox && <ImageLightbox url={lightbox} title={visual.title || visual.visual_type} onClose={() => setLightbox(null)} />}
    </article>
  );
}

function VisualsTab({
  project,
  direction,
  visuals,
  documents,
  generating,
  approvingVisual,
  onGenerate,
  onApprove,
  onOpenDirections,
  onOpenPlans,
  regeneratingImage,
  generationStatus,
  onRegenerateImage,
}: {
  project: Project;
  direction: Direction | null;
  visuals: ArchitectureVisual[];
  documents: DocumentRow[];
  generating: boolean;
  approvingVisual: string | null;
  onGenerate: () => void;
  onApprove: (visual: ArchitectureVisual) => void;
  onOpenDirections: () => void;
  onOpenPlans: () => void;
  regeneratingImage: string | null;
  generationStatus: string;
  onRegenerateImage: (visualId: string, quality: ImageGenerationTier) => void;
}) {
  const [expandedVisualBriefs, setExpandedVisualBriefs] = useState<string[]>([]);

  function toggleVisualBrief(visualId: string) {
    setExpandedVisualBriefs((current) =>
      current.includes(visualId)
        ? current.filter((id) => id !== visualId)
        : [...current, visualId],
    );
  }

  if (!direction) {
    return (
      <StageLocked
        title="Select a direction before preparing visuals"
        body="The saved gallery should remain visually connected to the selected architecture route."
        onOpenDirections={onOpenDirections}
      />
    );
  }

  const planRows = visuals.filter(
    (visual) => visual.metadata?.group === "plans" || ["ground_floor", "upper_floor"].includes(visual.visual_type),
  );
  const requiredPlanTypes = [
    "ground_floor",
    ...(planRows.some((visual) => visual.visual_type === "upper_floor") ? ["upper_floor"] : []),
  ];
  const existingDesignSource = project.workflow_mode === "plan_to_render" && documents.some(
    (document) => document.category.startsWith("source") && document.mime_type?.startsWith("image/"),
  );
  const plansReady = existingDesignSource || requiredPlanTypes.every((requiredType) => {
    const plan = planRows.find((visual) => visual.visual_type === requiredType);
    return Boolean(plan?.is_approved && assetPreviewUrl(recordValue(plan.metadata).technical_assets));
  });
  if (!plansReady) {
    return (
      <StageLocked
        eyebrow="Approved Plans Required"
        title="Approve the connected floor plans before creating visuals"
        body={`Visuals must follow the approved ${requiredPlanTypes.map((item) => item.replace(/_/g, " ")).join(" and ")}. Generate, review and approve those plans first so the exterior and interior images are not random.`}
        onOpenDirections={onOpenPlans}
        actionLabel="Open Concept Plans →"
      />
    );
  }

  const galleryTypes = [
    "front_exterior",
    "rear_exterior",
    "street_view",
    "aerial_view",
    "day_view",
    "night_view",
    "facade_alternative_a",
    "facade_alternative_b",
  ];
  const gallery = visuals.filter(
    (visual) => visual.metadata?.group === "visuals" || galleryTypes.includes(visual.visual_type),
  );

  if (gallery.length === 0) {
    return (
      <section className="stage-empty surface-card">
        <div className="stage-empty-copy">
          <p className="eyebrow">Architecture Visuals</p>
          <h2>Build the selected project gallery</h2>
          <p>
            {existingDesignSource
              ? "Turn the uploaded existing plans into coordinated architectural visuals while keeping the source geometry fixed."
              : "Prepare coordinated image prompts for the requested front, rear, street, aerial, day, night or custom camera views."}
          </p>
          <div className="demo-explanation">
            <strong>{existingDesignSource ? "Existing plans stay fixed." : "Generate only the views you need."}</strong>
            <span>{existingDesignSource
              ? "The uploaded drawings are sent into visual generation as authoritative references; the selected direction controls materials, mood and presentation, not a new layout."
              : "Each view has its own button, so replacing one image never regenerates the complete gallery."}</span>
          </div>
        </div>
        <button type="button" className="primary-action" disabled={generating} onClick={onGenerate}>
          {generating ? "Preparing Visuals..." : `Prepare Architecture Visuals · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`}
        </button>
        {generating && <StageGenerationLoading title="Preparing Visual Gallery" detail="Creating project-type-specific exterior and interior views from the same Master Architecture Reference." />}
      </section>
    );
  }

  return (
    <section className="visuals-stage">
      <div className="stage-header surface-card">
        <div>
          <p className="eyebrow">Architecture Visuals</p>
          <h2>{direction.title} Gallery</h2>
          <p>{existingDesignSource
            ? "Source plans/elevations define the building. The selected direction controls style only. Regenerate any older view that was created before the source drawings were organised."
            : "Approve the views that should appear in the Architecture Design Pack."}</p>
        </div>
        <button type="button" className="secondary-action" disabled={generating} onClick={onGenerate}>
          {generating ? "Refreshing..." : `Refresh Gallery Prompts · ${ARCHITECTURE_CREDIT_COSTS.textGeneration} credits`}
        </button>
      </div>

      {generating && <StageGenerationLoading title="Refreshing Visual Gallery" detail="Updating the coordinated exterior and interior prompts without generating images." />}
      <div className="visual-gallery-grid">
        {gallery.map((visual) => {
          const visualMetadata = recordValue(visual.metadata);
          const sourceStale = existingDesignSource && (
            visualMetadata.source_geometry_locked !== true ||
            visualMetadata.source_geometry_stale === true
          );
          return (
            <article key={visual.id} className="visual-gallery-card" data-approved={visual.is_approved ? "true" : "false"}>
              <div className="visual-gallery-image">
                {visual.image_url ? (
                  <img src={visual.image_url} alt={visual.title || visual.visual_type} loading="lazy" decoding="async" />
                ) : (
                  <div className="generation-image-placeholder compact">
                    <ArchitectureIcon />
                    <strong>View not generated</strong>
                    <span>{existingDesignSource ? "Source drawings are locked as geometry. Generate this view using the selected direction for style, materials and atmosphere." : "The coordinated view brief is ready. Generate the image when you are ready."}</span>
                  </div>
                )}
                {regeneratingImage === `visual-${visual.id}` && (
                  <ImageGenerationOverlay title="Generating from source drawings" detail={generationStatus} />
                )}
                {sourceStale && visual.image_url && <span className="absolute left-4 top-4 z-10 rounded-full bg-amber-500 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-lg">Outdated · regenerate from source</span>}
                {visual.is_approved && !sourceStale && <span className="approved-visual-chip">Approved</span>}
              </div>
              <div className="visual-gallery-body">
                <div>
                  <span>{sourceStale ? "Source drawings changed" : "Saved Project View"}</span>
                  <h3>{visual.title || visual.visual_type}</h3>
                  {visual.prompt && (
                    <>
                      <button
                        type="button"
                        aria-expanded={expandedVisualBriefs.includes(visual.id)}
                        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:shadow-none dark:hover:border-blue-400/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
                        onClick={() => toggleVisualBrief(visual.id)}
                      >
                        <span>{expandedVisualBriefs.includes(visual.id) ? "Hide brief" : "View brief"}</span>
                        {expandedVisualBriefs.includes(visual.id) ? <ChevronUp size={13} strokeWidth={2.4} /> : <ChevronDown size={13} strokeWidth={2.4} />}
                      </button>
                      {expandedVisualBriefs.includes(visual.id) && (
                        <div className="mt-3 rounded-[14px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="mb-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Generation brief</p>
                          <p className="text-[10px] font-semibold leading-5 text-slate-500 dark:text-slate-300">{visual.prompt}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="visual-card-actions">
                  <button
                    type="button"
                    className="image-regenerate-button"
                    disabled={regeneratingImage !== null}
                    onClick={() => onRegenerateImage(visual.id, "preview")}
                  >
                    {regeneratingImage === `visual-${visual.id}`
                      ? "Generating Preview..."
                      : `${existingDesignSource ? (sourceStale ? "Generate from Source Plans" : "Regenerate from Source Plans") : (visual.image_url ? "Regenerate" : "Generate") + " Preview"} · ${ARCHITECTURE_CREDIT_COSTS.visualPreview} credits`}
                  </button>
                  <button
                    type="button"
                    className="image-regenerate-button professional-final-action"
                    disabled={regeneratingImage !== null}
                    onClick={() => onRegenerateImage(visual.id, "final")}
                  >
                    Professional Final · {ARCHITECTURE_CREDIT_COSTS.professionalFinal} credits
                  </button>
                  <button
                    type="button"
                    className="visual-approve-button"
                    data-approved={visual.is_approved && !sourceStale ? "true" : "false"}
                    disabled={sourceStale || approvingVisual === visual.id || !visual.image_url || regeneratingImage !== null}
                    onClick={() => onApprove(visual)}
                  >
                    {sourceStale ? "Regenerate first" : approvingVisual === visual.id ? "Saving..." : visual.is_approved ? "Remove Approval" : "Approve View"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="direction-disclaimer">
        <strong>AI-style concept imagery.</strong>
        <span>
          Visuals communicate mood and architectural intent. Final professional renders,
          documented materials and buildable design require expert production.
        </span>
      </div>
    </section>
  );
}

function DesignPackTab({
  project,
  site,
  planning,
  direction,
  concept,
  planSet,
  visuals,
  designPack,
  materials,
  spaceProgram,
  generating,
  onPrepare,
  onGenerateAll,
  onOpenDirections,
}: {
  project: Project;
  site: Site;
  planning: Planning;
  direction: Direction | null;
  concept: ArchitectureConcept | null;
  planSet: ArchitecturePlanSet | null;
  visuals: ArchitectureVisual[];
  designPack: ArchitectureDesignPack | null;
  materials: ArchitectureMaterial[];
  spaceProgram: SpaceProgramItem[];
  generating: boolean;
  onPrepare: () => void;
  onGenerateAll: () => void;
  onOpenDirections: () => void;
}) {
  if (!direction) {
    return (
      <StageLocked
        title="Select a direction before preparing the Design Pack"
        body="The pack compiles the full selected project route."
        onOpenDirections={onOpenDirections}
      />
    );
  }

  const gallery = visuals.filter((visual) => visual.metadata?.group === "visuals");
  const generatedGallery = gallery.filter((visual) => Boolean(visual.image_url));
  const approved = generatedGallery.filter((visual) => visual.is_approved);
  const packVisuals = approved.length > 0 ? approved : generatedGallery;
  const complete = Boolean(concept && planSet && generatedGallery.length > 0);

  if (!designPack) {
    return (
      <section className="stage-empty surface-card">
        <div className="stage-empty-copy">
          <p className="eyebrow">Architecture Design Pack</p>
          <h2>Compile the complete concept document</h2>
          <p>
            The pack combines the brief, land, planning summary, selected direction,
            concept strategy, plans, area schedule, visuals and disclaimers.
          </p>
          <div className="pack-readiness-mini">
            <span data-ready={concept ? "true" : "false"}>{concept ? <Check size={12} /> : <AlertTriangle size={12} />} Concept</span>
            <span data-ready={planSet ? "true" : "false"}>{planSet ? <Check size={12} /> : <AlertTriangle size={12} />} Plans</span>
            <span data-ready={generatedGallery.length ? "true" : "false"}>{generatedGallery.length ? <Check size={12} /> : <AlertTriangle size={12} />} Generated Visuals</span>
          </div>
        </div>
        <div className="stage-empty-actions">
          {!complete && (
            <button type="button" className="secondary-action" disabled={generating} onClick={onGenerateAll}>
              {generating ? "Preparing Full Studio..." : "Prepare Missing Content & Prompts"}
            </button>
          )}
          <button type="button" className="primary-action" disabled={generating || !complete} onClick={onPrepare}>
            {generating ? "Preparing Pack..." : "Prepare Design Pack"}
          </button>
        </div>
      </section>
    );
  }

  const location = [project.city, project.region, project.country].filter(Boolean).join(", ") || "Location not added";
  const materialNames = materials.length ? materials.map((material) => material.name) : (direction.materials || []).map((material) => material.name);

  return (
    <section className="design-pack-stage">
      <div className="stage-header surface-card no-print">
        <div>
          <p className="eyebrow">Architecture Design Pack</p>
          <h2>{designPack.title}</h2>
          <p>Version {designPack.version} · Prepared {formatDate(designPack.generated_at)}</p>
        </div>
        <div className="pack-actions">
          <button type="button" className="secondary-action" disabled={generating} onClick={onPrepare}>
            {generating ? "Updating..." : "Update Pack"}
          </button>
          <ArchitecturePresentationExport
              project={project}
              site={site}
              planning={planning}
              direction={direction}
              concept={concept}
              planSet={planSet}
              visuals={visuals}
              materials={materials}
              spaceProgram={spaceProgram}
            />
        </div>
      </div>

      <article className="design-pack-document" id="architecture-design-pack">
        <section className="pack-cover">
          <div className="pack-logo">HEYY<span>STUDIO</span></div>
          <div>
            <p>Architecture Studio · Concept Design Pack</p>
            <h1>{project.project_name}</h1>
            <h2>{direction.title}</h2>
            <span>{location}</span>
          </div>
          {direction.image_url && <img src={direction.image_url} alt={direction.title} loading="lazy" decoding="async" />}
          <small>Conceptual architecture only · Not for permit, construction or engineering use</small>
        </section>

        <section className="pack-page">
          <div className="pack-page-heading"><span>01</span><div><p>Project Foundation</p><h2>Brief, site and planning</h2></div></div>
          <div className="pack-summary-grid">
            <SummaryLine label="Project type" value={project.project_type || "Not added"} />
            <SummaryLine label="Scope" value={project.scope || "Not added"} />
            <SummaryLine label="Style" value={project.architectural_style || "Not added"} />
            <SummaryLine label="Plot area" value={formatMeasurement(site.plot_area, "m²")} />
            <SummaryLine label="Desired floors" value={site.desired_floors ? String(site.desired_floors) : "Not added"} />
            <SummaryLine label="Planning status" value={planning.verification_status || "Needs verification"} />
          </div>
          <div className="pack-copy-block"><h3>Project requirements</h3><p>{project.notes || "No additional requirements were added."}</p></div>
          <div className="pack-warning">Planning information is a user-supplied conceptual guide and requires verification by local authorities and qualified professionals.</div>
        </section>

        <section className="pack-page">
          <div className="pack-page-heading"><span>02</span><div><p>Selected Direction</p><h2>{direction.title}</h2></div></div>
          {direction.image_url && <img className="pack-wide-image" src={direction.image_url} alt={direction.title} loading="lazy" decoding="async" />}
          <div className="pack-copy-block"><h3>Architectural philosophy</h3><p>{direction.philosophy}</p></div>
          <div className="pack-two-column">
            <div className="pack-copy-block"><h3>Form & massing</h3><p>{direction.form_strategy}</p></div>
            <div className="pack-copy-block"><h3>Spatial strategy</h3><p>{direction.spatial_strategy}</p></div>
          </div>
          <div className="pack-material-chips">{materialNames.map((name) => <span key={name}>{name}</span>)}</div>
        </section>

        {concept && (
          <section className="pack-page">
            <div className="pack-page-heading"><span>03</span><div><p>Architecture Strategy</p><h2>{concept.title}</h2></div></div>
            {concept.image_url && <img className="pack-wide-image" src={concept.image_url} alt={concept.title} loading="lazy" decoding="async" />}
            <p className="pack-lead">{concept.summary}</p>
            <div className="pack-two-column">
              <div className="pack-copy-block"><h3>Site response</h3><p>{concept.site_response}</p></div>
              <div className="pack-copy-block"><h3>Functional zoning</h3><p>{concept.functional_zoning}</p></div>
              <div className="pack-copy-block"><h3>Natural light</h3><p>{concept.natural_light}</p></div>
              <div className="pack-copy-block"><h3>Privacy</h3><p>{concept.privacy}</p></div>
            </div>
          </section>
        )}

        {planSet && (
          <section className="pack-page">
            <div className="pack-page-heading"><span>04</span><div><p>Concept Plans</p><h2>Plans and area schedule</h2></div></div>
            <div className="pack-plan-grid">
              {visuals.filter((visual) => visual.metadata?.group === "plans" || ["functional_zoning", "ground_floor", "upper_floor", "site_plan", "circulation", "north_elevation", "south_elevation", "east_elevation", "west_elevation", "section_longitudinal", "section_transverse", "perspective_front", "perspective_rear", "perspective_aerial"].includes(visual.visual_type)).map((visual) => (
                <figure key={visual.id}>{visual.image_url && <img src={visual.image_url} alt={visual.title || visual.visual_type} loading="lazy" decoding="async" />}<figcaption>{visual.title}</figcaption></figure>
              ))}
            </div>
            <div className="area-schedule-table pack-table">
              <div className="area-schedule-head"><span>Space</span><span>Level</span><span>Approx.</span></div>
              {(planSet.area_schedule || []).map((item) => (
                <div key={`${item.space}-${item.level}`} className="area-schedule-row"><strong>{item.space}</strong><span>{item.level}</span><b>{item.approx_area_m2} m²</b></div>
              ))}
            </div>
          </section>
        )}

        {materials.length > 0 && (
          <section className="pack-page">
            <div className="pack-page-heading"><span>05</span><div><p>Material System</p><h2>Selected concept palette</h2></div></div>
            <div className="pack-material-grid">{materials.map((material) => <article key={material.id}>{material.image_url && <img src={material.image_url} alt={material.name} />}<div><strong>{material.name}</strong><span>{material.category}</span><p>{material.finish || "Finish to verify"} · {material.application || "Application to define"}</p></div></article>)}</div>
            {spaceProgram.length > 0 && <div className="pack-copy-block"><h3>Program summary</h3><p>{spaceProgram.length} spaces · approximately {Math.round(spaceProgram.reduce((sum, item) => sum + Number(item.total_area_m2 || 0), 0))} m² programmed before circulation, structure and services are professionally verified.</p></div>}
          </section>
        )}

        {packVisuals.length > 0 && (
          <section className="pack-page">
            <div className="pack-page-heading"><span>06</span><div><p>Architectural Visuals</p><h2>Selected project gallery</h2></div></div>
            <div className="pack-gallery-grid">
              {packVisuals.map((visual) => (
                <figure key={visual.id}>{visual.image_url && <img src={visual.image_url} alt={visual.title || visual.visual_type} loading="lazy" decoding="async" />}<figcaption>{visual.title}</figcaption></figure>
              ))}
            </div>
          </section>
        )}

        <section className="pack-page pack-final-page">
          <div className="pack-page-heading"><span>07</span><div><p>Important Notice</p><h2>Concept design disclaimer</h2></div></div>
          <p>
            This Architecture Design Pack communicates an early design direction only. It is not a planning application,
            permit set, engineering package, construction document, quantity survey, supplier specification or professional certification.
          </p>
          <p>
            Before any design, pricing, approval or construction decision, the project must be reviewed and developed by appropriately
            registered local architects, planners, engineers, surveyors and other required consultants.
          </p>
          <div className="pack-logo final">HEYY<span>STUDIO</span></div>
        </section>
      </article>
    </section>
  );
}


function EstimateTab({
  project,
  planSet,
  visuals,
  documents,
  spaceProgram,
  materials,
  preparing,
  onPrepare,
  onOpenPlans,
  onOpenSpaceProgram,
  onOpenMaterials,
}: {
  project: Project;
  planSet: ArchitecturePlanSet | null;
  visuals: ArchitectureVisual[];
  documents: DocumentRow[];
  spaceProgram: SpaceProgramItem[];
  materials: ArchitectureMaterial[];
  preparing: boolean;
  onPrepare: () => Promise<void>;
  onOpenPlans: () => void;
  onOpenSpaceProgram: () => void;
  onOpenMaterials: () => void;
}) {
  const existingDesign = project.workflow_mode === "plan_to_render";
  const organisedSourcePlans = documents.filter((document) =>
    Boolean(sourcePlanTypeFromCategory(document.category)),
  );
  const sourcePlansReady = existingDesign && organisedSourcePlans.length > 0;

  if (existingDesign && !sourcePlansReady) {
    return (
      <StageLocked
        eyebrow="Source Drawings Required"
        title="Organise the existing drawings before estimating"
        body="Existing Design projects do not need AI-generated plan approval. Organise at least one uploaded floor plan, elevation or section so the source drawings are confirmed as the project geometry."
        onOpenDirections={onOpenPlans}
        actionLabel="Open Source Plans →"
      />
    );
  }

  if (!existingDesign && !planSet) {
    return (
      <StageLocked
        eyebrow="Plans Required"
        title="Prepare and approve the connected floor plans first"
        body="New Design estimates use the approved plan area, room schedule and selected project materials."
        onOpenDirections={onOpenPlans}
        actionLabel="Open Plans →"
      />
    );
  }

  if (!existingDesign && planSet) {
    const planRows = visuals.filter(
      (visual) => recordValue(visual.metadata).group === "plans" || ["ground_floor", "upper_floor"].includes(visual.visual_type),
    );
    const canonicalPlan = recordValue(recordValue(planSet.generation_json).canonical_plan);
    const levels = Array.isArray(canonicalPlan.levels) ? canonicalPlan.levels : [];
    const requiredPlanTypes = ["ground_floor", ...(levels.length > 1 ? ["upper_floor"] : [])];
    const plansReady = requiredPlanTypes.every((requiredType) => {
      const plan = planRows.find((visual) => visual.visual_type === requiredType);
      const metadata = recordValue(plan?.metadata);
      return Boolean(
        plan?.is_approved &&
        (assetPreviewUrl(metadata.technical_assets) || plan.image_url),
      );
    });

    if (!plansReady) {
      return (
        <StageLocked
          eyebrow="Approved Plans Required"
          title="Approve the required floor plans before estimating"
          body="Approve the ground floor and, when applicable, the upper floor so quantities are calculated from the current connected design."
          onOpenDirections={onOpenPlans}
          actionLabel="Review Plans →"
        />
      );
    }
  }

  const estimatePlanSet = existingDesign && planSet?.generation_mode !== "existing_source" ? null : planSet;
  const savedEstimate = estimatePlanSet ? recordValue(estimatePlanSet.generation_json).estimate : null;
  const estimate = savedEstimate && typeof savedEstimate === "object" && !Array.isArray(savedEstimate)
    ? savedEstimate as ProjectEstimate
    : null;
  const programmedArea = spaceProgram.reduce(
    (sum, item) => sum + Number(item.total_area_m2 || 0),
    0,
  );
  const planArea = estimatePlanSet
    ? Number(estimatePlanSet.total_estimated_area || 0) || (estimatePlanSet.area_schedule || []).reduce((sum, item) => sum + Number(item.approx_area_m2 || 0), 0)
    : 0;
  const professionalTarget = numberOrNull(project.professional_brief?.target_gross_area_m2) || 0;
  const hasAreaBasis = planArea > 0 || programmedArea > 0 || professionalTarget > 0;
  const sourcingMarket = [project.city, project.region, project.country].filter(Boolean).join(", ");

  if (!hasAreaBasis) {
    return (
      <section className="stage-empty surface-card">
        <div className="stage-empty-copy">
          <p className="eyebrow">Existing plans ready</p>
          <h2>Add an approximate floor area before estimating</h2>
          <p>
            Your uploaded plans are already accepted as the geometry source and do not need approval. The estimate only needs an area basis for provisional quantities. Complete the Space Program or add the target gross area in Professional Mode.
          </p>
        </div>
        <button type="button" className="primary-action" onClick={onOpenSpaceProgram}>Open Space Program</button>
      </section>
    );
  }

  if (!materials.length) {
    return (
      <section className="stage-empty surface-card">
        <div className="stage-empty-copy">
          <p className="eyebrow">Pre-production estimate</p>
          <h2>Select the project materials first</h2>
          <p>Choose the materials feeding generation before calculating quantities, waste and provisional price ranges.</p>
        </div>
        <button type="button" className="primary-action" onClick={onOpenMaterials}>Open Materials</button>
      </section>
    );
  }

  return (
    <section className="estimate-stage">
      <div className="stage-header surface-card">
        <div>
          <p className="eyebrow">Pre-production estimate</p>
          <h2>Quantities, price ranges and supplier planning</h2>
          <p>
            {existingDesign
              ? `Prepared from the organised existing source drawings, saved project area information and selected materials for ${project.city || project.country || "the project location"}. No AI-plan approval is required.`
              : `Prepared from the approved connected plans and selected materials for ${project.city || project.country || "the project location"}. Refresh it whenever a plan or material changes.`}
          </p>
        </div>
        <button type="button" className="primary-action" disabled={preparing} onClick={() => void onPrepare()}>
          {preparing ? "Preparing Estimate..." : estimate ? "Refresh Estimate" : "Prepare Estimate"}
        </button>
      </div>

      {existingDesign && (
        <div className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Source geometry confirmed</p>
            <strong className="text-sm text-slate-950 dark:text-white">{organisedSourcePlans.length} organised source drawing{organisedSourcePlans.length === 1 ? "" : "s"}</strong>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">These drawings count as the approved geometry source for estimating and downstream visual work.</p>
          </div>
          <button type="button" className="secondary-action" onClick={onOpenPlans}>Review Source Plans</button>
        </div>
      )}

      {!estimate ? (
        <div className="estimate-empty surface-card">
          <strong>Ready to estimate</strong>
          <span>{existingDesign ? "Prepare the estimate from the existing source drawings, project area and material schedule." : "Prepare the estimate from the latest approved plans and material schedule."}</span>
        </div>
      ) : (
        <>
          <div className="estimate-summary-grid">
            <MetricCard label="Estimated low range" value={`US$${Math.round(estimate.lowTotalUsd).toLocaleString("en-US")}`} />
            <MetricCard label="Estimated high range" value={`US$${Math.round(estimate.highTotalUsd).toLocaleString("en-US")}`} />
            <MetricCard label="Material lines" value={String(estimate.items.length)} />
            <MetricCard label="Last prepared" value={new Date(estimate.generatedAt).toLocaleDateString("en-US")} />
          </div>

          <div className="estimate-table surface-card">
            <div className="estimate-table-head">
              <span>Item and use</span><span>Specification</span><span>Quantity</span><span>Price range</span><span>Supplier suggestion</span>
            </div>
            {estimate.items.map((item) => (
              <div className="estimate-table-row" key={item.id}>
                <div><strong>{item.item}</strong><small>{item.category} · {item.application}</small></div>
                <span>{item.specification || "Confirm product specification"}</span>
                <span>
                  {item.quantity.toLocaleString("en-US")} {item.unit} + {item.wastePercent}% waste<br />
                  <strong>{item.purchaseQuantity.toLocaleString("en-US")} {item.unit} purchase</strong>
                </span>
                <span>
                  US${item.unitPriceLowUsd}–{item.unitPriceHighUsd} / {item.unit}<br />
                  <strong>
                    US${Math.round(item.purchaseQuantity * item.unitPriceLowUsd).toLocaleString("en-US")}–
                    {Math.round(item.purchaseQuantity * item.unitPriceHighUsd).toLocaleString("en-US")}
                  </strong>
                </span>
                <div className="flex flex-col gap-2">
                  <span>{item.supplierSuggestion}</span>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={architectureProductSearchUrl(item, sourcingMarket)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-8 items-center rounded-full border border-blue-300 bg-blue-50 px-3 text-[10px] font-black text-blue-700 transition hover:border-blue-500 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                      Search exact spec
                    </a>
                    <a
                      href={architectureSupplierSearchUrl(item, sourcingMarket)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-[10px] font-black text-slate-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Local suppliers
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="direction-disclaimer">
            <strong>Concept estimate only.</strong>
            <span>{estimate.assumptions.join(" ")}</span>
          </div>
        </>
      )}
    </section>
  );
}

function architectureSourcingQuery(item: EstimateItem, market: string) {
  return [
    item.item ? `"${item.item}"` : "",
    item.specification,
    item.application,
    item.category,
    market,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 280);
}

function architectureProductSearchUrl(item: EstimateItem, market: string) {
  const query = architectureSourcingQuery(item, market);
  const params = new URLSearchParams({ tbm: "shop", q: query, hl: "en" });
  return `https://www.google.com/search?${params.toString()}`;
}

function architectureSupplierSearchUrl(item: EstimateItem, market: string) {
  const query = [architectureSourcingQuery(item, market), "supplier showroom", market]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function ArchitectureProductionTab({
  project,
  site,
  planning,
  direction,
  concept,
  planSet,
  visuals,
  designPack,
  documents,
  materials,
  spaceProgram,
  onOpenDirections,
}: {
  project: Project;
  site: Site;
  planning: Planning;
  direction: Direction | null;
  concept: ArchitectureConcept | null;
  planSet: ArchitecturePlanSet | null;
  visuals: ArchitectureVisual[];
  designPack: ArchitectureDesignPack | null;
  documents: DocumentRow[];
  materials: ArchitectureMaterial[];
  spaceProgram: SpaceProgramItem[];
  onOpenDirections: () => void;
}) {
  if (!direction) {
    return (
      <StageLocked
        title="Select a direction before requesting expert production"
        body="The production request must carry the chosen architecture concept and project context."
        onOpenDirections={onOpenDirections}
      />
    );
  }

  const generatedOutputs = [
    {
      id: direction.id,
      group: "direction",
      visual_type: "selected_architecture_direction",
      title: direction.title,
      is_approved: true,
      image_url: direction.image_url,
      storage_path: direction.image_storage_path,
      summary: direction.philosophy || direction.site_response || null,
    },
    ...(concept
      ? [{
          id: concept.id,
          group: "concept",
          visual_type: "architecture_concept",
          title: concept.title,
          is_approved: true,
          image_url: concept.image_url,
          storage_path: null,
          summary: concept.summary,
        }]
      : []),
    ...visuals.filter((visual) => recordValue(visual.metadata).group !== "tour").map((visual) => {
      const metadata = recordValue(visual.metadata);
      return {
        id: visual.id,
        group: metadata.group || "visuals",
        visual_type: visual.visual_type,
        title: visual.title,
        is_approved: visual.is_approved,
        image_url: visual.image_url,
        storage_path: visual.storage_path,
        technical_assets: metadata.technical_assets || null,
        rendered_preview_assets: metadata.rendered_preview_assets || null,
        rendered_final_assets: metadata.rendered_final_assets || null,
        preview_assets: metadata.preview_assets || null,
        final_assets: metadata.final_assets || null,
      };
    }),
    ...(designPack
      ? [{
          id: designPack.id,
          group: "design-pack",
          visual_type: "architecture_design_pack",
          title: designPack.title,
          is_approved: designPack.status === "ready" || designPack.status === "approved",
          image_url: null,
          storage_path: null,
          version: designPack.version,
          included_sections: designPack.included_sections,
        }]
      : []),
  ];

  const productionContext = {
    project,
    site,
    planning,
    source_brief: project.source_brief || null,
    source_documents: documents
      .filter((document) => document.category === "source" || document.category === "reference")
      .map((document) => ({
        id: document.id,
        category: document.category,
        filename: document.filename,
        mime_type: document.mime_type,
        file_size: document.file_size,
        storage_path: document.storage_path,
      })),
    selected_direction: direction,
    space_program: spaceProgram,
    selected_materials: materials,
    architecture_concept: concept,
    concept_plan_set: planSet,
    approved_visuals: visuals.filter((visual) => visual.is_approved && recordValue(visual.metadata).group !== "tour"),
    all_generated_outputs: generatedOutputs,
    design_pack: designPack,
    pre_production_estimate: planSet ? recordValue(planSet.generation_json).estimate || null : null,
    disclaimer: "AI and demo outputs are conceptual. Expert production creates professional final deliverables.",
  };

  return (
    <section className="production-stage">
      <div className="stage-header surface-card">
        <div>
          <p className="eyebrow">Expert Production</p>
          <h2>Move from concept to professional architecture services</h2>
          <p>
            This uses the existing Heyy Studio request, quote, Stripe payment, production job,
            deliverables and revision system. No separate Architecture payment system is created.
          </p>
        </div>
      </div>

      <div className="expert-deliverable-grid">
        {[
          "CAD drawings",
          "BIM model",
          "Planning drawings",
          "Permit documentation",
          "Construction documentation",
          "Professional renders",
          "Interior design",
          "Structural coordination",
          "MEP coordination",
          "Landscape design",
          "Quantity schedules",
        ].map((item) => <span key={item}>{item}</span>)}
      </div>

      <div className="architecture-production-panel">
        <ProductionPanel
          project={project}
          brand={productionContext}
          service="Architecture Design Development"
          serviceId="architecture-design-development"
          studio="architecture_studio"
          previewImage={direction.image_url || undefined}
          description={`Professional development of the selected ${direction.title} ${project.workflow_mode === "sketch_to_real" ? "sketch interpretation" : project.workflow_mode === "plan_to_render" ? "plan-to-render direction" : "architecture concept"}.`}
          usage="Planning, design development, professional coordination and project-specific architecture deliverables as defined in the final quote."
          expertNote="The current Architecture Studio outputs are conceptual. A qualified expert must verify and develop the final scope, drawings, renders and documentation."
          buttonLabel="Request Architecture Production →"
        />
      </div>
    </section>
  );
}

function ComingTab({
  eyebrow,
  title,
  body,
  items,
}: {
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
}) {
  return (
    <section className="coming-card">
      <span className="coming-mark"><ArchitectureIcon /></span>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="coming-grid">
        {items.map((item, index) => (
          <div key={item}>
            <span>0{index + 1}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>
      <small>This section is already part of the project navigation and will be activated in the next build phase.</small>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CalculationRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="calculation-row" data-highlight={highlight}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field-block">
      <label>{label}</label>
      <input value={value} placeholder={placeholder} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  integer = false,
}: {
  label: string;
  value: number | string | null | undefined;
  onChange: (value: number | null) => void;
  integer?: boolean;
}) {
  return (
    <div className="field-block">
      <label>{label}</label>
      <input
        type="number"
        step={integer ? 1 : "any"}
        value={value ?? ""}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const next = event.target.value;
          if (next === "") {
            onChange(null);
            return;
          }
          const parsed = Number(next);
          onChange(Number.isFinite(parsed) ? (integer ? Math.round(parsed) : parsed) : null);
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-block">
      <label>{label}</label>
      <HeyySelect
        value={value}
        options={options.map((option) => ({
          value: option,
          label: (labels?.[option] ?? option) || "Select",
        }))}
        placeholder={labels?.[""] || "Select"}
        ariaLabel={label}
        tone="architecture"
        onChange={onChange}
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field-block">
      <label>{label}</label>
      <textarea value={value} placeholder={placeholder} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)} />
    </div>
  );
}

type CalculationResult = {
  estimatedFootprint: number | null;
  totalFloorArea: number | null;
  setbackEnvelope: number | null;
  outdoorArea: number | null;
};

function createEmptySite(projectId: string, userId: string): Site {
  return {
    project_id: projectId,
    user_id: userId,
    land_start: "exploring",
    address: null,
    plot_area: null,
    width: null,
    depth: null,
    desired_floors: null,
    terrain: "Unknown",
    corner_lot: "Unknown",
    orientation: null,
    climate_notes: null,
    site_notes: null,
  };
}

function createEmptyPlanning(projectId: string, userId: string): Planning {
  return {
    project_id: projectId,
    user_id: userId,
    zoning: null,
    permitted_use: null,
    site_coverage_percent: null,
    floor_area_ratio: null,
    max_height_m: null,
    max_floors: null,
    front_setback_m: null,
    rear_setback_m: null,
    side_setback_m: null,
    parking_requirement: null,
    open_space_requirement: null,
    overlays: null,
    restrictions: null,
    authority_name: null,
    source_reference: null,
    source_checked_at: null,
    verification_status: "Needs verification",
    confidence: "Unverified",
    notes: null,
  };
}

function workflowLabel(value: string) {
  if (value === "sketch_to_real" || value === "plan_to_render") return "Upload & Develop";
  return "Start a New Design";
}

function landStartLabel(value: Site["land_start"]) {
  if (value === "owned") return "Land selected";
  if (value === "looking") return "Looking for land";
  return "Exploring";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableNumber(value: unknown) {
  return numberOrNull(value);
}

function toNullableInteger(value: unknown) {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.round(parsed);
}

function formatMeasurement(value: unknown, unit: string) {
  const parsed = numberOrNull(value);
  return parsed === null ? "Not available" : `${Math.round(parsed * 10) / 10} ${unit}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const workspaceStyles = `
  .architecture-workspace-page,
  .architecture-workspace-page * { box-sizing: border-box; }
  .architecture-workspace-page,
  .architecture-workspace-loading {
    min-height: 100vh;
    background:
      radial-gradient(circle at 90% 4%, rgba(36,133,235,.13), transparent 25%),
      radial-gradient(circle at 18% 12%, rgba(46,124,246,.09), transparent 24%),
      #f5f8fc;
    color: #17151f;
  }
  .architecture-workspace-page { padding: 30px 24px 76px; }
  .architecture-workspace-wrap { display:grid; width: min(1460px, 100%); gap:20px; margin: 0 auto; }
  .workspace-hero {
    display: grid;
    gap: 22px;
    border: 1px solid #cbd9e8;
    border-radius: 28px;
    background:
      radial-gradient(circle at 88% 0%, rgba(64,127,236,.21), transparent 32%),
      linear-gradient(135deg,#fff,#edf6ff 58%,#e8f2ff);
    padding: 27px;
    box-shadow: 0 18px 45px rgba(39,74,112,.10);
  }
  .workspace-hero-copy { display: flex; min-width: 0; align-items: center; gap: 17px; }
  .hero-mark,
  .loader-mark,
  .coming-mark {
    display: flex;
    width: 58px;
    height: 58px;
    flex: 0 0 58px;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    background: linear-gradient(135deg,#1769d2,#1769d2);
    color: #fff;
    box-shadow: 0 14px 28px rgba(50,79,192,.23);
  }
  .hero-badges { display: flex; flex-wrap: wrap; gap: 8px; }
  .hero-badges span { border-radius: 999px; background: #e2efff; color: #1769d2; padding: 6px 10px; font-size: 8px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .hero-badges span[data-tone="status"] { background: #e2efff; color: #1769d2; }
  .workspace-hero h1 { margin: 8px 0 0; font-size: clamp(28px,4vw,46px); font-weight: 950; letter-spacing: -.05em; line-height: 1; }
  .workspace-hero-copy p { margin: 9px 0 0; color: #607083; font-size: 13px; font-weight: 700; }
  .hero-progress-card { border: 1px solid rgba(255,255,255,.95); border-radius: 20px; background: rgba(255,255,255,.79); padding: 17px; box-shadow: 0 12px 28px rgba(44,77,109,.08); backdrop-filter: blur(15px); }
  .hero-progress-card strong { color: #1769d2; font-size: 20px; }
  .hero-progress-line { height: 8px; overflow: hidden; margin-top: 11px; border-radius: 999px; background: #dfe7f1; }
  .hero-progress-line span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#1769d2,#1769d2); }
  .hero-progress-card p { margin: 10px 0 0; color: #677386; font-size: 11px; line-height: 1.6; }
  .section-navigation { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-top:0; padding:18px 20px; }
  .section-navigation > div:first-child { display:grid; gap:4px; }
  .section-navigation > div:first-child span { color:#1769d2; font-size:8px; font-weight:950; letter-spacing:.14em; text-transform:uppercase; }
  .section-navigation > div:first-child strong { color:#1f2937; font-size:12px; }
  .section-navigation-actions { display:flex; align-items:center; gap:10px; }
  .workspace-tabs { display: flex; gap: 8px; overflow-x: auto; margin-top: 0; border: 1px solid #d7e0eb; border-radius: 19px; background: rgba(255,255,255,.89); padding: 8px; box-shadow: 0 10px 25px rgba(45,68,94,.06); scrollbar-width: thin; }
  .workspace-tabs button { display: inline-flex; min-height: 42px; flex: 0 0 auto; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: 13px; background: transparent; color: #626d7d; padding: 0 14px; font-size: 11px; font-weight: 900; transition: all 180ms ease; }
  .workspace-tabs button:hover { border-color: #a7c5ef; background: #eff6ff; color: #1769d2; }
  .workspace-tabs button[data-active="true"] { border-color: #1769d2; background: linear-gradient(135deg,#1769d2,#1769d2); color: #fff; box-shadow: 0 8px 18px rgba(54,72,190,.20); }
  .workspace-tabs small { border-radius: 999px; background: #eceff4; color: #7c8490; padding: 3px 6px; font-size: 7px; text-transform: uppercase; }
  .workspace-tabs button[data-active="true"] small { background: rgba(255,255,255,.18); color: #fff; }
  .workspace-tabs button[data-active="true"], .workspace-tabs button[data-active="true"]:hover, .workspace-tabs button[data-active="true"] span { color:#fff !important; }
  .workspace-content-grid { display: grid; gap: 20px; margin-top: 0; }
  .workspace-main-column { display: grid; min-width: 0; gap: 20px; }
  .workspace-side-column { min-width: 0; }
  .surface-card {
    border: 1px solid #d8e0ea;
    border-radius: 24px;
    background: #fff;
    box-shadow: 0 12px 31px rgba(35,60,89,.055);
  }
  .form-section { padding: 24px; }
  .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
  .section-heading.compact { margin-bottom: 18px; }
  .eyebrow { margin: 0; color: #1769d2; font-size: 9px; font-weight: 950; letter-spacing: .19em; text-transform: uppercase; }
  .section-heading h2,
  .section-heading h3 { margin: 7px 0 0; color: #141923; font-weight: 950; letter-spacing: -.04em; }
  .section-heading h2 { font-size: 30px; }
  .section-heading h3 { font-size: 24px; }
  .section-heading p { max-width: 720px; margin: 9px 0 0; color: #697687; font-size: 13px; line-height: 1.7; }
  .primary-action { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; border: 1px solid #1769d2; border-radius: 999px; background: linear-gradient(135deg,#1769d2,#1769d2); color: #fff; padding: 0 18px; font-size: 11px; font-weight: 950; box-shadow: 0 10px 22px rgba(53,78,187,.19); transition: all 180ms ease; }
  .primary-action:hover { transform: translateY(-2px); filter: brightness(.94); }
  .primary-action:disabled { cursor: wait; opacity: .58; }
  .metric-grid { display: grid; gap: 12px; }
  .metric-card { border: 1px solid #dce4ee; border-radius: 19px; background: linear-gradient(135deg,#fff,#f4f8fd); padding: 18px; }
  .metric-card span { color: #788494; font-size: 8px; font-weight: 950; letter-spacing: .15em; text-transform: uppercase; }
  .metric-card strong { display: block; margin-top: 10px; color: #152033; font-size: 25px; font-weight: 950; letter-spacing: -.04em; }
  .next-stage-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 23px; background: radial-gradient(circle at 90% 0%, rgba(46,124,246,.12), transparent 34%), linear-gradient(135deg,#eef6ff,#fff,#edf5ff); }
  .next-stage-card h3 { margin: 7px 0 0; font-size: 25px; font-weight: 950; letter-spacing: -.04em; }
  .next-stage-card p { max-width: 700px; margin: 9px 0 0; color: #687587; font-size: 13px; line-height: 1.7; }
  .checklist { display: grid; gap: 10px; padding: 0 22px 22px; }
  .check-row { display: grid; grid-template-columns: 38px minmax(0,1fr) auto; align-items: center; gap: 12px; border: 1px solid #e0e6ee; border-radius: 17px; background: #fafcff; padding: 13px; text-align: left; transition: all 180ms ease; }
  .check-row:hover { transform: translateY(-2px); border-color: #83aef0; background: #eef6ff; }
  .check-row > span { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 11px; background: #edf0f4; color: #77818e; font-weight: 950; }
  .check-row > span[data-complete="true"] { background: #dff7e8; color: #087c43; }
  .check-row strong { color: #1a2230; font-size: 13px; }
  .check-row p { margin: 3px 0 0; color: #7b8695; font-size: 10px; }
  .check-row b { color: #1769d2; }
  .sticky-card { padding: 22px; }
  .sticky-card h3 { margin: 8px 0 18px; font-size: 24px; font-weight: 950; letter-spacing: -.04em; }
  .summary-line,
  .calculation-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; border-top: 1px solid #e6ebf1; padding: 13px 0; }
  .summary-line span,
  .calculation-row span { color: #7b8694; font-size: 10px; font-weight: 800; }
  .summary-line strong,
  .calculation-row strong { max-width: 58%; color: #1d2633; font-size: 11px; font-weight: 950; text-align: right; }
  .calculation-row[data-highlight="true"] strong { color: #1769d2; font-size: 16px; }
  .planning-notice,
  .planning-warning { border: 1px solid #e8ca72; border-radius: 15px; background: #fff7d5; color: #6e4b00; font-size: 10px; line-height: 1.7; }
  .planning-notice { margin-top: 16px; padding: 13px; }
  .planning-warning { margin-top: 20px; padding: 15px; }
  .form-grid { display: grid; gap: 15px; margin-top: 22px; }
  .field-block { margin-top: 18px; }
  .form-grid .field-block { margin-top: 0; }
  .field-block label { display: block; margin-bottom: 8px; color: #687486; font-size: 9px; font-weight: 950; letter-spacing: .15em; text-transform: uppercase; }
  .field-block input,
  .field-block select,
  .field-block textarea,
  .upload-controls select { width: 100%; border: 1px solid #d5dee9; border-radius: 14px; background: #fafcff; color: #171b24; padding: 13px 14px; font-size: 12px; outline: none; transition: all 180ms ease; }
  .field-block input:focus,
  .field-block select:focus,
  .field-block textarea:focus,
  .upload-controls select:focus { border-color: #1769d2; background: #fff; box-shadow: 0 0 0 4px rgba(23,105,210,.09); }
  .field-block textarea { min-height: 120px; resize: vertical; }
  .chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip-list button { min-height: 36px; border: 1px solid #d8e0e9; border-radius: 999px; background: #fff; color: #5f6877; padding: 0 13px; font-size: 10px; font-weight: 900; }
  .chip-list button:hover { border-color: #1769d2; background: #eaf3ff; color: #1769d2; }
  .chip-list button[data-active="true"] { border-color: #1769d2; background: #1769d2; color: #fff; }
  .upload-controls { display: grid; gap: 10px; }
  .upload-button { display: inline-flex; min-height: 44px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid #1769d2; border-radius: 14px; background: #1769d2; color: #fff; padding: 0 15px; font-size: 11px; font-weight: 950; }
  .document-list { display: grid; gap: 9px; margin-top: 16px; }
  .document-row { display: flex; align-items: center; gap: 11px; border: 1px solid #e0e6ee; border-radius: 16px; background: #fafcff; padding: 12px; }
  .document-icon { display: flex; width: 38px; height: 38px; flex: 0 0 38px; align-items: center; justify-content: center; border-radius: 12px; background: #e4f0ff; color: #1769d2; }
  .document-row strong { display: block; overflow: hidden; color: #1b2533; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
  .document-row p { margin: 4px 0 0; color: #7b8796; font-size: 9px; text-transform: capitalize; }
  .document-row button { flex: 0 0 auto; border: 1px solid #d5dfeb; border-radius: 999px; background: #fff; color: #1769d2; padding: 7px 10px; font-size: 9px; font-weight: 950; }
  .document-row button[data-danger="true"] { color: #b42350; }
  .empty-files { margin-top: 16px; border: 1px dashed #adbed0; border-radius: 16px; background: #f8fbff; padding: 24px; color: #718093; font-size: 12px; text-align: center; }
  .success-message,
  .workspace-error { margin-top: 16px; border-radius: 15px; padding: 12px 14px; font-size: 11px; font-weight: 900; }
  .success-message { border: 1px solid #9bd6b4; background: #eaf9f0; color: #087944; }
  .workspace-error { border: 1px solid #eea7b9; background: #fff0f4; color: #a2143c; }
  .directions-section { display: grid; gap: 18px; margin-top: 0; }
  .directions-intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 25px; background: radial-gradient(circle at 92% 0%,rgba(46,124,246,.13),transparent 32%),linear-gradient(135deg,#fff,#eef7ff 58%,#edf5ff); }
  .directions-intro h2 { margin: 8px 0 0; color: #141923; font-size: clamp(29px,4vw,44px); font-weight: 950; letter-spacing: -.055em; line-height: 1.02; }
  .directions-intro p:not(.eyebrow) { max-width: 790px; margin: 12px 0 0; color: #667487; font-size: 13px; line-height: 1.75; }
  .directions-generate-all { flex: 0 0 auto; min-width: 225px; }
  .direction-readiness-grid { display: grid; gap: 11px; }
  .direction-readiness-item { display: grid; grid-template-columns: 38px minmax(0,1fr); align-items: center; gap: 12px; border: 1px solid #ead49d; border-radius: 17px; background: #fffae9; padding: 14px; }
  .direction-readiness-item[data-complete="true"] { border-color: #b6ddc7; background: #effaf4; }
  .direction-readiness-item > span { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 11px; background: #fff0bd; color: #805400; font-size: 14px; font-weight: 950; }
  .direction-readiness-item[data-complete="true"] > span { background: #d8f3e4; color: #087944; }
  .direction-readiness-item strong { color: #1d2633; font-size: 12px; }
  .direction-readiness-item p { margin: 4px 0 0; color: #778393; font-size: 10px; line-height: 1.5; }
  .selected-direction-banner { border: 1px solid #b78cff; border-radius: 20px; background: radial-gradient(circle at 92% 0%,rgba(46,124,246,.16),transparent 32%),linear-gradient(135deg,#fbf8ff,#f0e8ff); padding: 18px 20px; }
  .selected-direction-banner span { color: #1769d2; font-size: 8px; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
  .selected-direction-banner strong { display: block; margin-top: 7px; color: #25143d; font-size: 18px; font-weight: 950; letter-spacing: -.025em; }
  .selected-direction-banner p { margin: 6px 0 0; color: #6e6180; font-size: 11px; }
  .directions-empty { display: grid; justify-items: center; border: 1px dashed #aebfd2; border-radius: 25px; background: linear-gradient(135deg,#fafdff,#f4f0ff); padding: 46px 24px; text-align: center; }
  .directions-empty h3 { margin: 16px 0 0; color: #192332; font-size: 25px; font-weight: 950; letter-spacing: -.04em; }
  .directions-empty p { max-width: 720px; margin: 11px 0 0; color: #687689; font-size: 13px; line-height: 1.75; }
  .directions-empty small { margin-top: 13px; color: #7b8795; font-size: 10px; }
  .direction-card-grid { display: grid; gap: 18px; }
  .direction-card { overflow: hidden; border: 1px solid #d6e0eb; border-radius: 25px; background: #fff; box-shadow: 0 15px 35px rgba(37,59,88,.08); transition: transform 180ms ease,border-color 180ms ease,box-shadow 180ms ease; }
  .direction-card:hover { transform: translateY(-3px); border-color: #a8c2eb; box-shadow: 0 22px 45px rgba(37,59,88,.13); }
  .direction-card[data-selected="true"] { border: 2px solid #1769d2; box-shadow: 0 24px 50px rgba(46,124,246,.17); }
  .direction-card-visual { position: relative; overflow: hidden; aspect-ratio: 3/2; background: linear-gradient(135deg,#e8f3ff,#e8f2ff); }
  .image-zoom-trigger { position:relative; display:block; width:100%; height:100%; border:0; background:transparent; padding:0; cursor:zoom-in; }
  .image-zoom-trigger > span { position:absolute; right:12px; bottom:12px; z-index:3; border-radius:999px; background:rgba(15,23,42,.78); color:#fff; padding:7px 10px; font-size:8px; font-weight:900; opacity:0; transform:translateY(4px); transition:all 180ms ease; }
  .image-zoom-trigger:hover > span { opacity:1; transform:none; }
  .image-lightbox { position:fixed; inset:0; z-index:120; display:grid; place-items:center; background:rgba(2,6,23,.88); padding:24px; backdrop-filter:blur(14px); }
  .image-lightbox-inner { position:relative; display:grid; max-width:min(1400px,96vw); max-height:94vh; gap:10px; }
  .image-lightbox-inner img { display:block; max-width:100%; max-height:86vh; border-radius:18px; object-fit:contain; box-shadow:0 35px 90px rgba(0,0,0,.5); }
  .image-lightbox-inner > button { position:absolute; top:12px; right:12px; z-index:2; display:grid; width:42px; height:42px; place-items:center; border:1px solid rgba(255,255,255,.35); border-radius:999px; background:rgba(15,23,42,.72); color:#fff; font-size:25px; cursor:pointer; }
  .image-lightbox-inner > strong { color:#fff; font-size:13px; text-align:center; }
  .direction-card-visual img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .direction-card-visual::after { position: absolute; inset: auto 0 0; height: 42%; content: ""; background: linear-gradient(180deg,transparent,rgba(13,17,25,.55)); pointer-events: none; }
  .direction-image-placeholder { display: grid; width: 100%; height: 100%; place-items: center; align-content: center; gap: 12px; color: #1769d2; text-align: center; }
  .direction-image-placeholder span { max-width: 260px; color: #64748a; font-size: 11px; line-height: 1.5; }
  .direction-letter,
  .direction-selected-pill { position: absolute; z-index: 2; top: 14px; border-radius: 999px; padding: 8px 11px; font-size: 8px; font-weight: 950; letter-spacing: .13em; text-transform: uppercase; backdrop-filter: blur(10px); }
  .direction-letter { left: 14px; background: rgba(255,255,255,.88); color: #1769d2; }
  .direction-selected-pill { right: 14px; background: rgba(46,124,246,.92); color: #fff; }
  .direction-card-body { padding: 20px; }
  .direction-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .direction-title-row h3 { margin: 7px 0 0; color: #182231; font-size: 25px; font-weight: 950; letter-spacing: -.045em; line-height: 1.05; }
  .direction-cost { flex: 0 0 auto; border: 1px solid #d9c8f4; border-radius: 999px; background: #f6f0ff; color: #6300dc; padding: 7px 10px; font-size: 8px; font-weight: 950; text-transform: uppercase; }
  .direction-detail { margin-top: 16px; border-top: 1px solid #e8edf2; padding-top: 14px; }
  .direction-detail > span,
  .direction-material-block > span { color: #1769d2; font-size: 8px; font-weight: 950; letter-spacing: .15em; text-transform: uppercase; }
  .direction-detail p { margin: 7px 0 0; color: #576578; font-size: 11px; line-height: 1.7; }
  .direction-detail[data-compact="true"] { margin-top: 0; border: 1px solid #e2e8ef; border-radius: 15px; background: #fafcff; padding: 13px; }
  .direction-detail[data-compact="true"] p { font-size: 10px; }
  .direction-material-block { margin-top: 17px; border-top: 1px solid #e8edf2; padding-top: 14px; }
  .direction-material-list { display: grid; gap: 8px; margin-top: 10px; }
  .direction-material { border: 1px solid #e0e7ef; border-radius: 14px; background: linear-gradient(135deg,#fbfdff,#f7f3ff); padding: 11px; }
  .direction-material strong { color: #202a38; font-size: 11px; }
  .direction-material small { display: block; margin-top: 3px; color: #1769d2; font-size: 8px; font-weight: 900; text-transform: uppercase; }
  .direction-material p { margin: 5px 0 0; color: #6f7b8a; font-size: 9px; line-height: 1.55; }
  .direction-detail-grid { display: grid; gap: 9px; margin-top: 16px; }
  .direction-generation-warning { margin-top: 16px; border: 1px solid #efc066; border-radius: 14px; background: #fff7dc; padding: 12px; }
  .direction-generation-warning strong { color: #765000; font-size: 10px; }
  .direction-generation-warning p { margin: 5px 0 0; color: #7a5d1d; font-size: 9px; line-height: 1.55; overflow-wrap: anywhere; }
  .direction-actions { display: grid; gap: 9px; margin-top: 18px; }
  .direction-secondary-action,
  .direction-select-action { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; border-radius: 999px; padding: 0 15px; font-size: 9px; font-weight: 950; transition: all 180ms ease; }
  .direction-secondary-action { border: 1px solid #cfd9e5; background: #fff; color: #1769d2; }
  .direction-secondary-action:hover:not(:disabled) { border-color: #1769d2; background: #eaf3ff; color: #1769d2; transform: translateY(-1px); }
  .direction-select-action { border: 1px solid #1769d2; background: linear-gradient(135deg,#1769d2,#1769d2); color: #fff; box-shadow: 0 10px 22px rgba(23,105,210,.2); }
  .direction-select-action:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(.94); }
  .direction-select-action[data-selected="true"] { border-color: #9bd6b4; background: #e8f8ef; color: #087944; box-shadow: none; }
  .direction-secondary-action:disabled,
  .direction-select-action:disabled { cursor: wait; opacity: .58; }
  .direction-disclaimer { display: flex; align-items: flex-start; gap: 10px; border: 1px solid #e8ca72; border-radius: 16px; background: #fff8dc; padding: 14px 16px; color: #6e4b00; }
  .direction-disclaimer strong { flex: 0 0 auto; font-size: 10px; }
  .direction-disclaimer span { font-size: 10px; line-height: 1.6; }
  .coming-card { margin-top: 20px; border: 1px solid #d1dcec; border-radius: 27px; background: radial-gradient(circle at 90% 0%, rgba(46,124,246,.14), transparent 28%), linear-gradient(135deg,#fff,#edf6ff 60%,#eaf3ff); padding: 34px; box-shadow: 0 15px 36px rgba(42,69,102,.08); }
  .coming-mark { width: 54px; height: 54px; margin-bottom: 24px; }
  .coming-card h2 { max-width: 850px; margin: 9px 0 0; font-size: clamp(32px,5vw,54px); font-weight: 950; letter-spacing: -.055em; line-height: 1; }
  .coming-card > p:not(.eyebrow) { max-width: 780px; margin: 16px 0 0; color: #667487; font-size: 14px; line-height: 1.8; }
  .coming-grid { display: grid; gap: 12px; margin-top: 28px; }
  .coming-grid div { border: 1px solid rgba(204,216,231,.9); border-radius: 18px; background: rgba(255,255,255,.74); padding: 17px; }
  .coming-grid span { display: block; color: #1769d2; font-size: 9px; font-weight: 950; letter-spacing: .15em; }
  .coming-grid strong { display: block; margin-top: 8px; color: #1b2431; font-size: 15px; }
  .coming-card small { display: block; margin-top: 22px; color: #7b8795; font-size: 10px; }
  .architecture-workspace-loading { display: grid; place-items: center; padding: 40px 24px; }
  .workspace-loader-card { display: flex; width: min(680px,100%); align-items: center; gap: 18px; border: 1px solid #d4deea; border-radius: 27px; background: rgba(255,255,255,.91); padding: 26px; box-shadow: 0 20px 55px rgba(37,62,91,.12); }
  .workspace-loader-card h1 { margin: 6px 0 0; font-size: 26px; font-weight: 950; letter-spacing: -.04em; }
  .workspace-loader-card p:not(.eyebrow) { margin: 7px 0 0; color: #6d7989; font-size: 12px; }
  .error-card { display: block; text-align: center; }
  .error-card .primary-action { margin-top: 18px; }
  .demo-mode-banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 0; border: 1px solid #b9d5fb; border-radius: 17px; background: linear-gradient(135deg,#f3f8ff,#eef6ff); padding: 13px 15px; }
  .demo-mode-banner div { display: grid; gap: 4px; }
  .demo-mode-banner strong { color: #1769d2; font-size: 11px; font-weight: 950; }
  .demo-mode-banner span:not(.demo-mode-chip) { color: #667487; font-size: 10px; line-height: 1.5; }
  .demo-mode-chip { display: inline-flex; min-height: 28px; flex: 0 0 auto; align-items: center; border-radius: 999px; background: #1769d2; color: #fff; padding: 0 11px; font-size: 8px; font-weight: 950; letter-spacing: .09em; text-transform: uppercase; }
  .stage-locked, .stage-empty { display: flex; align-items: center; justify-content: space-between; gap: 26px; margin-top: 0; padding: 30px; }
  .stage-locked { min-height: 340px; flex-direction: column; justify-content: center; text-align: center; }
  .stage-locked h2, .stage-empty h2, .stage-header h2 { margin: 7px 0 0; color: #172130; font-size: clamp(28px,4vw,44px); font-weight: 950; letter-spacing: -.05em; line-height: 1.03; }
  .stage-locked > p:not(.eyebrow), .stage-empty-copy > p, .stage-header > div > p:not(.eyebrow) { max-width: 780px; margin: 12px 0 0; color: #667487; font-size: 12px; line-height: 1.75; }
  .stage-empty-copy { min-width: 0; }
  .stage-empty-actions, .pack-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .demo-explanation { display: grid; gap: 5px; max-width: 720px; margin-top: 18px; border: 1px solid #d8c7ff; border-radius: 15px; background: #f8f3ff; padding: 13px 14px; }
  .demo-explanation strong { color: #5b00cf; font-size: 10px; }
  .demo-explanation span { color: #6d6480; font-size: 10px; line-height: 1.55; }
  .secondary-action { display: inline-flex; min-height: 44px; flex: 0 0 auto; align-items: center; justify-content: center; border: 1px solid #c9d5e4; border-radius: 999px; background: #fff; color: #1769d2; padding: 0 17px; font-size: 9px; font-weight: 950; transition: all 180ms ease; }
  .secondary-action:hover:not(:disabled) { border-color: #1769d2; background: #eaf3ff; color: #1769d2; transform: translateY(-1px); }
  .secondary-action:disabled { cursor: wait; opacity: .55; }
  .stage-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 22px; margin-top: 0; padding: 25px; }
  .stage-actions, .material-stage-actions { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:12px; }
  .material-stage-actions { min-width:min(100%,440px); }
  .recommended-materials-action { min-height:44px; border-color:var(--arch-accent-border); background:var(--arch-accent-soft); color:var(--blue); }
  .recommended-materials-action:hover:not(:disabled) { border-color:var(--arch-accent-strong); background:#e4f0ff; color:var(--arch-accent-strong); }
  .stage-source-chip { display: inline-flex; min-height: 28px; align-items: center; margin-top: 14px; border-radius: 999px; background: #eaf8f0; color: #0b7b47; padding: 0 11px; font-size: 8px; font-weight: 950; text-transform: uppercase; letter-spacing: .09em; }
  .concept-stage, .plans-stage, .visuals-stage, .design-pack-stage, .production-stage { display: grid; gap: 16px; }
  .concept-hero { overflow: hidden; padding: 0; }
  .concept-hero img { display: block; width: 100%; aspect-ratio: 1.5; object-fit: cover; }
  .strategy-grid { display: grid; gap: 12px; }
  .strategy-card { display: grid; grid-template-columns: 38px minmax(0,1fr); gap: 13px; border: 1px solid #d6e0eb; border-radius: 19px; background: rgba(255,255,255,.88); padding: 17px; box-shadow: 0 10px 25px rgba(44,70,100,.06); }
  .strategy-card > span { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 11px; background: linear-gradient(135deg,#1769d2,#1769d2); color: #fff; font-size: 9px; font-weight: 950; }
  .strategy-card h3 { margin: 0; color: #1b2431; font-size: 13px; font-weight: 950; }
  .strategy-card p { margin: 7px 0 0; color: #687587; font-size: 10px; line-height: 1.7; }
  .plan-visual-grid { display: grid; gap: 14px; }
  .plan-visual-card { overflow: hidden; border: 1px solid #d3dfeb; border-radius: 21px; background: #fff; box-shadow: 0 13px 28px rgba(37,64,97,.08); }
  .plan-visual-card img { display:block; width:100%; height:auto; max-height:none; object-fit:contain; background:#f8fbff; }
  .plan-visual-card span { color: #1769d2; font-size: 8px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .plan-visual-card h3 { margin: 6px 0 0; color: #1c2633; font-size: 14px; font-weight: 950; }
  .plans-data-grid { display: grid; gap: 14px; }
  .plan-data-card { padding: 21px; }
  .area-schedule-table { display: grid; margin-top: 14px; border: 1px solid #dbe4ee; border-radius: 14px; overflow: hidden; }
  .area-schedule-head, .area-schedule-row { display: grid; grid-template-columns: minmax(0,1.4fr) minmax(80px,.8fr) 72px; gap: 10px; align-items: center; padding: 10px 12px; }
  .area-schedule-head { background: #edf4fb; color: #5f6f81; font-size: 8px; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
  .area-schedule-row { border-top: 1px solid #e5ecf3; color: #5f6d7d; font-size: 9px; }
  .area-schedule-row strong { color: #202a37; font-size: 10px; }
  .area-schedule-row b { color: #5f00db; text-align: right; }
  .dimension-list, .relationship-list, .assumption-list { display: grid; gap: 9px; margin-top: 14px; }
  .dimension-list > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e6edf3; padding: 10px 0; }
  .dimension-list span { color: #728093; font-size: 9px; }
  .dimension-list strong { color: #1e2835; font-size: 10px; }
  .relationship-list > div { display: grid; gap: 4px; border: 1px solid #e0e8f0; border-radius: 13px; background: #f9fbfd; padding: 11px 12px; }
  .relationship-list strong { color: #1d2734; font-size: 10px; }
  .relationship-list span { color: #687688; font-size: 9px; line-height: 1.5; }
  .assumption-list > div { display: grid; grid-template-columns: 25px minmax(0,1fr); gap: 9px; align-items: flex-start; }
  .assumption-list span { display: grid; width: 23px; height: 23px; place-items: center; border-radius: 8px; background: #efe7ff; color: #5f00d8; font-size: 8px; font-weight: 950; }
  .assumption-list p { margin: 2px 0 0; color: #687688; font-size: 9px; line-height: 1.55; }
  .visual-gallery-grid { display: grid; gap: 15px; }
  .visual-gallery-card { overflow: hidden; border: 1px solid #d2ddea; border-radius: 21px; background: #fff; box-shadow: 0 13px 30px rgba(37,64,97,.08); transition: all 180ms ease; }
  .visual-gallery-card[data-approved="true"] { border-color: #7ad5a4; box-shadow: 0 14px 34px rgba(26,151,91,.13); }
  .visual-gallery-image { position: relative; }
  .visual-gallery-image img { display: block; width: 100%; aspect-ratio: 1.5; object-fit: cover; }
  .approved-visual-chip { position: absolute; top: 12px; right: 12px; display: inline-flex; min-height: 27px; align-items: center; border-radius: 999px; background: #0b9b59; color: #fff; padding: 0 10px; font-size: 8px; font-weight: 950; text-transform: uppercase; letter-spacing: .09em; }
  .visual-gallery-body { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 15px 16px; }
  .visual-gallery-body span { color: #1769d2; font-size: 8px; font-weight: 950; text-transform: uppercase; letter-spacing: .1em; }
  .visual-gallery-body h3 { margin: 5px 0 0; color: #1d2734; font-size: 14px; font-weight: 950; }
  .visual-approve-button { display: inline-flex; min-height: 36px; flex: 0 0 auto; align-items: center; border: 1px solid #1769d2; border-radius: 999px; background: #fff; color: #1769d2; padding: 0 12px; font-size: 8px; font-weight: 950; }
  .visual-approve-button[data-approved="true"] { border-color: #9bd8b7; background: #e9f9f0; color: #087846; }
  .pack-readiness-mini { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .pack-readiness-mini span { display: inline-flex; min-height: 30px; align-items: center; border-radius: 999px; background: #fff3df; color: #9a5d00; padding: 0 11px; font-size: 9px; font-weight: 900; }
  .pack-readiness-mini span[data-ready="true"] { background: #e9f8ef; color: #087947; }
  .design-pack-document { display: grid; gap: 18px; }
  .pack-cover, .pack-page { overflow: hidden; border: 1px solid #d5dfea; border-radius: 24px; background: #fff; padding: 30px; box-shadow: 0 14px 35px rgba(42,68,99,.08); }
  .pack-cover { position: relative; min-height: 650px; display: grid; align-content: space-between; background: radial-gradient(circle at 82% 12%,rgba(46,124,246,.2),transparent 28%),linear-gradient(145deg,#10131a,#20283a 58%,#4a1686); color: #fff; }
  .pack-cover > div:not(.pack-logo) { position: relative; z-index: 2; max-width: 760px; align-self: end; }
  .pack-cover p { margin: 0; color: #cdb8ff; font-size: 10px; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
  .pack-cover h1 { margin: 12px 0 0; font-size: clamp(42px,7vw,82px); font-weight: 950; letter-spacing: -.065em; line-height: .92; }
  .pack-cover h2 { margin: 13px 0 0; color: #d8c8ff; font-size: clamp(24px,4vw,42px); font-weight: 800; letter-spacing: -.04em; }
  .pack-cover > div > span { display: block; margin-top: 13px; color: #d7deea; font-size: 12px; }
  .pack-cover > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .27; mix-blend-mode: luminosity; }
  .pack-cover small { position: relative; z-index: 2; color: #d9d9e0; font-size: 9px; }
  .pack-logo { position: relative; z-index: 2; display: inline-flex; align-items: baseline; gap: 5px; color: #fff; font-size: 18px; font-weight: 950; letter-spacing: -.04em; }
  .pack-logo span { color: #bca1ff; font-size: 8px; letter-spacing: .18em; }
  .pack-page-heading { display: flex; align-items: flex-start; gap: 14px; border-bottom: 1px solid #e3e9ef; padding-bottom: 17px; }
  .pack-page-heading > span { color: #1769d2; font-size: 30px; font-weight: 950; letter-spacing: -.05em; }
  .pack-page-heading p { margin: 2px 0 0; color: #1769d2; font-size: 8px; font-weight: 950; letter-spacing: .13em; text-transform: uppercase; }
  .pack-page-heading h2 { margin: 5px 0 0; color: #192431; font-size: 25px; font-weight: 950; letter-spacing: -.045em; }
  .pack-summary-grid { display: grid; gap: 10px; margin-top: 20px; }
  .pack-copy-block { margin-top: 20px; }
  .pack-copy-block h3 { margin: 0; color: #1e2835; font-size: 12px; font-weight: 950; }
  .pack-copy-block p, .pack-lead, .pack-final-page > p { margin: 8px 0 0; color: #667486; font-size: 10px; line-height: 1.75; }
  .pack-warning { margin-top: 20px; border: 1px solid #efd28a; border-radius: 14px; background: #fff8df; color: #7b5709; padding: 13px; font-size: 9px; line-height: 1.6; }
  .pack-wide-image { display: block; width: 100%; margin-top: 20px; border-radius: 17px; aspect-ratio: 1.7; object-fit: cover; }
  .pack-two-column { display: grid; gap: 14px; }
  .pack-material-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .pack-material-chips span { display: inline-flex; min-height: 30px; align-items: center; border-radius: 999px; background: #f0e9ff; color: #5c00d1; padding: 0 11px; font-size: 9px; font-weight: 900; }
  .pack-plan-grid, .pack-gallery-grid { display: grid; gap: 12px; margin-top: 20px; }
  .pack-plan-grid figure, .pack-gallery-grid figure { overflow: hidden; margin: 0; border: 1px solid #dbe4ed; border-radius: 15px; background: #f8fafc; }
  .pack-plan-grid img, .pack-gallery-grid img { display: block; width: 100%; aspect-ratio: 1.5; object-fit: cover; }
  .pack-plan-grid figcaption, .pack-gallery-grid figcaption { padding: 9px 11px; color: #334152; font-size: 9px; font-weight: 900; }
  .pack-table { margin-top: 20px; }
  .pack-final-page { min-height: 500px; display: flex; flex-direction: column; }
  .pack-logo.final { margin-top: auto; color: #1b2430; padding-top: 60px; }
  .expert-deliverable-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .expert-deliverable-grid span { display: inline-flex; min-height: 34px; align-items: center; border: 1px solid #d8e1eb; border-radius: 999px; background: #fff; color: #536173; padding: 0 12px; font-size: 9px; font-weight: 850; }
  

  .stage-generation-loading .generation-status-copy { min-width:0; flex:1; }
  .generation-status-progress { width:100%; height:5px; margin-top:10px; overflow:hidden; border-radius:999px; background:#dbeafe; }
  .generation-status-progress i { display:block; width:36%; height:100%; border-radius:inherit; background:linear-gradient(90deg,#2563eb,#2e7cf6); animation:architecture-progress 1.35s ease-in-out infinite; }
  .stage-generation-loading { display:flex; align-items:center; gap:14px; margin:16px 0; border:1px solid #a7c5ef; border-radius:18px; background:linear-gradient(135deg,#eff6ff,#eff6ff); padding:16px 18px; box-shadow:0 12px 28px rgba(23,105,210,.08); }
  .stage-generation-loading strong { display:block; color:#1e3a8a; font-size:13px; }
  .stage-generation-loading p { margin:4px 0 0; color:#64748b; font-size:12px; line-height:1.6; }
  .stage-generation-spinner { width:28px; height:28px; flex:0 0 auto; border:3px solid #dbeafe; border-top-color:#1769d2; border-radius:999px; animation:architecture-image-spin .8s linear infinite; }
  .paint-preset-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:16px; }
  .paint-preset-card { display:grid; grid-template-columns:56px minmax(0,1fr) auto; gap:12px; align-items:center; border:1px solid #dbe2ea; border-radius:16px; background:#fff; padding:12px; }
  .paint-swatch { width:56px; height:56px; border-radius:14px; border:1px solid rgba(15,23,42,.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,.35); }
  .paint-preset-card strong,.paint-preset-card small { display:block; }
  .paint-preset-card small { margin-top:3px; color:#64748b; font-size:10px; }
  .paint-preset-card p { margin:5px 0 0; color:#64748b; font-size:11px; }
  .paint-preset-card button { border:1px solid #a7c5ef; border-radius:12px; background:#eff6ff; color:#1769d2; padding:9px 11px; font-size:11px; font-weight:900; }
  .mode-experience-note { display:grid; gap:5px; margin:16px 0 18px; border:1px solid #d8e1eb; border-radius:15px; padding:13px 14px; }
  .mode-experience-note strong { color:#1f2937; font-size:11px; }
  .mode-experience-note span { color:#64748b; font-size:10px; line-height:1.55; }
  .mode-experience-note.guided { border-color:#bfdbfe; background:#eff6ff; }
  .mode-experience-note.professional { border-color:#a7c5ef; background:#eff6ff; }
  .guided-program-grid { display:grid; gap:12px; }
  .guided-program-card { padding:16px; }
  .guided-program-title { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .guided-program-title input { width:100%; border:0; background:transparent; color:#111827; font-size:16px; font-weight:900; }
  .guided-program-title button { border:0; background:transparent; color:#b42350; font-size:9px; font-weight:900; }
  .guided-program-fields { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:14px; }
  .guided-program-fields label { display:grid; gap:5px; }
  .guided-program-fields span { color:#64748b; font-size:9px; font-weight:900; }
  .guided-program-fields input,.guided-program-fields select { min-height:40px; border:1px solid #dbe3ec; border-radius:11px; background:#f8fafc; padding:0 10px; font-size:11px; }
  .guided-program-card > p { margin:12px 0 0; color:#64748b; font-size:10px; line-height:1.55; }
  .directions-material-note { max-width:280px; border:1px solid #bfdbfe; border-radius:13px; background:#eff6ff; color:#475569; padding:10px 12px; font-size:9px; line-height:1.5; }
  .paint-application-panel { display:flex; margin-top:16px; }
  .paint-application-panel label,.custom-paint-builder label { display:grid; gap:6px; min-width:240px; }
  .paint-application-panel span,.custom-paint-builder label > span { color:#475569; font-size:9px; font-weight:900; }
  .paint-application-panel select,.custom-paint-builder input,.custom-paint-builder select { min-height:42px; border:1px solid #d7e0ea; border-radius:12px; background:#fff; padding:0 11px; font-size:11px; }
  .paint-preset-card[data-selected="true"] { border:2px solid #1769d2; box-shadow:0 12px 28px rgba(46,124,246,.14); }
  .paint-preset-card[data-selected="true"] button { border-color:#1769d2; background:#1769d2; color:#fff; }
  .custom-paint-builder { display:grid; grid-template-columns:70px minmax(150px,1fr) minmax(190px,1.2fr) minmax(130px,.8fr) auto; gap:12px; align-items:end; margin-top:18px; border-top:1px solid #e5e7eb; padding-top:18px; }
  .custom-paint-preview { width:70px; height:70px; border:2px solid #fff; border-radius:17px; box-shadow:0 0 0 1px #cbd5e1,0 10px 22px rgba(15,23,42,.12); }
  .custom-color-control { display:grid; grid-template-columns:44px minmax(0,1fr); gap:7px; }
  .custom-color-control input[type="color"] { width:44px; padding:3px; }
  .material-industry-toggle { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0; }
  .material-industry-toggle button { min-height:36px; border:1px solid #d7e0ea; border-radius:999px; background:#fff; color:#64748b; padding:0 13px; font-size:9px; font-weight:900; }
  .material-industry-toggle button[data-active="true"] { border-color:#1769d2; background:#1769d2; color:#fff; box-shadow:0 8px 18px rgba(46,124,246,.18); }
  .plan-batch-panel { display:grid; gap:12px; padding:18px; }
  .plan-batch-panel > div:first-child { display:grid; gap:5px; }
  .plan-batch-panel strong { color:#1f2937; font-size:13px; }
  .plan-batch-panel span,.plan-batch-panel small { color:#64748b; font-size:10px; line-height:1.55; }
  .plan-batch-actions { display:flex; flex-wrap:wrap; gap:9px; }
  .plan-view-group-legend { display:flex; flex-wrap:wrap; gap:8px; }
  .plan-view-group-legend span { display:inline-flex; min-height:30px; align-items:center; border-radius:999px; background:#eaf3ff; color:#1769d2; padding:0 11px; font-size:8px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
  .plan-visual-card { position:relative; }
  .plan-visual-card[data-selected="true"] { border:2px solid #1769d2; box-shadow:0 16px 36px rgba(46,124,246,.15); }
  .plan-card-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border); background:var(--surface); padding:12px 14px; }
  .plan-select-toggle { position:static; z-index:auto; flex:0 0 auto; border:1px solid #a7c5ef; border-radius:999px; background:var(--surface-strong); color:#1769d2; padding:8px 11px; font-size:8px; font-weight:900; box-shadow:none; }
  .plan-select-toggle[data-selected="true"] { border-color:#1769d2; background:#1769d2; color:#fff; }
  .plan-image-zoom { position:relative; display:grid; width:100%; min-height:260px; place-items:center; border:0; background:#f8fbff; padding:14px; cursor:zoom-in; }
  .plan-image-zoom > span { position:absolute; right:12px; bottom:12px; border-radius:999px; background:rgba(15,23,42,.78); color:#fff; padding:7px 10px; opacity:0; font-size:8px; font-weight:900; transition:all 180ms ease; }
  .plan-image-zoom:hover > span { opacity:1; }
  @media (max-width: 980px) { .program-intelligence-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .material-library-grid, .material-reference-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  @media (max-width: 640px) { .program-intelligence-grid, .material-library-grid, .material-reference-grid, .pack-material-grid, .paint-preset-grid { grid-template-columns: minmax(0,1fr); } .selected-material-row { grid-template-columns: 46px minmax(0,1fr); } .selected-material-row b { grid-column: 2; } .guided-program-fields,.custom-paint-builder { grid-template-columns:1fr; } .custom-paint-preview { width:100%; height:90px; } .section-navigation,.section-navigation-actions { align-items:stretch; flex-direction:column; } .section-navigation-actions button,.section-navigation-actions a { width:100%; } }
  .architecture-presentation-export { display: flex; align-items: flex-start; }
  .architecture-presentation-export .heyy-presentation-export-message { max-width: 360px; }


  .estimate-stage { display:grid; gap:18px; }
  .estimate-summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .estimate-empty { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:24px; }
  .estimate-empty span { color:var(--text-secondary); }
  .estimate-table { overflow:hidden; }
  .estimate-table-head,.estimate-table-row { display:grid; grid-template-columns:1.1fr 1fr .72fr .85fr 1.15fr; gap:14px; padding:14px 16px; align-items:start; }
  .estimate-table-head { background:var(--arch-accent-soft); color:var(--text-muted); font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.1em; }
  .estimate-table-row { border-top:1px solid var(--border); color:var(--text-primary); font-size:12px; line-height:1.55; }
  .estimate-table-row div { display:grid; gap:4px; }
  .estimate-table-row small,.estimate-table-row span { color:var(--text-secondary); }
  .estimate-table-row strong { color:var(--text-primary); }
  @media (max-width:1050px) {
    .estimate-summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .estimate-table-head { display:none; }
    .estimate-table-row { grid-template-columns:1fr 1fr; }
  }
  @media (max-width:640px) {
    .estimate-summary-grid,.estimate-table-row { grid-template-columns:1fr; }
    .estimate-empty { align-items:flex-start; flex-direction:column; }
  }

@media print {
    body * { visibility: hidden !important; }
    #architecture-design-pack, #architecture-design-pack * { visibility: visible !important; }
    #architecture-design-pack { position: absolute; inset: 0; width: 100%; display: block; background: #fff; }
    .design-pack-document { gap: 0; }
    .pack-cover, .pack-page { min-height: 100vh; break-after: page; border: 0; border-radius: 0; box-shadow: none; page-break-after: always; }
    .pack-cover:last-child, .pack-page:last-child { break-after: auto; page-break-after: auto; }
    .no-print { display: none !important; }
  }
  @media (min-width: 720px) {
    .workspace-hero { grid-template-columns: minmax(0,1fr) 330px; align-items: center; }
    .metric-grid { grid-template-columns: repeat(4,minmax(0,1fr)); }
    .form-grid.two { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .form-grid.three { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .upload-controls { grid-template-columns: 220px auto; align-items: center; }
    .coming-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .direction-readiness-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .direction-material-list { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .direction-detail-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .direction-actions { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .strategy-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .plan-visual-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .plans-data-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .visual-gallery-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .pack-summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .pack-two-column { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .pack-plan-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .pack-gallery-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  }
  @media (min-width: 1080px) {
    .workspace-content-grid { grid-template-columns: minmax(0,1fr) 330px; align-items: start; }
    .sticky-card { position: sticky; top: 104px; }
    .direction-card-grid { grid-template-columns: repeat(3,minmax(0,1fr)); align-items: start; }
    .direction-card-body { padding: 18px; }
    .direction-title-row { display: block; }
    .direction-cost { display: inline-flex; margin-top: 10px; }
    .direction-material-list,
    .direction-detail-grid,
    .direction-actions { grid-template-columns: 1fr; }
    .strategy-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .visual-gallery-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .pack-summary-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .pack-gallery-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  }

  .workspace-mode-toggle { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; margin-top: 14px; border: 1px solid #dbeafe; border-radius: 13px; background: rgba(255,255,255,.7); padding: 5px; }
  .workspace-mode-toggle button { border: 0; border-radius: 9px; background: transparent; color: #64748b; padding: 8px; font-size: 10px; font-weight: 900; }
  .workspace-mode-toggle button[data-active="true"] { background: #1769d2; color: #fff; box-shadow: 0 8px 18px rgba(46,124,246,.18); }
  .smart-stage { display: grid; gap: 18px; }
  .program-intelligence-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; }
  .smart-warning { border: 1px solid #f3c86a; border-radius: 16px; background: #fff8dc; color: #755000; padding: 14px 16px; font-size: 12px; font-weight: 800; line-height: 1.6; }
  .program-table { overflow: auto; padding: 16px; }
  .program-head, .program-row { display: grid; grid-template-columns: minmax(150px,1.4fr) minmax(125px,1fr) minmax(120px,1fr) 70px 90px 85px 105px 38px; gap: 8px; align-items: center; min-width: 930px; }
  .program-head { padding: 0 8px 10px; color: #64748b; font-size: 9px; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
  .program-row { border-top: 1px solid #e2e8f0; padding: 10px 8px; }
  .program-row input, .program-row select { min-width: 0; border: 1px solid #d7deea; border-radius: 10px; background: #fbfcfe; padding: 9px; color: #17151f; font-size: 11px; }
  .program-row strong { font-size: 11px; }
  .program-row button { border: 1px solid #fecdd3; border-radius: 9px; background: #fff1f2; color: #be123c; padding: 7px; font-weight: 900; }
  .program-add { margin-top: 12px; border: 1px dashed #67a0ff; border-radius: 12px; background: #eff6ff; color: #1769d2; padding: 11px 14px; font-size: 11px; font-weight: 900; }
  .program-empty { padding: 30px; text-align: center; color: #64748b; }
  .material-reference-panel { display: grid; gap: 16px; padding: 22px; background: linear-gradient(135deg,#eef6ff,#f6faff); }
  .material-upload-button { display: inline-flex; width: fit-content; min-height: 42px; cursor: pointer; align-items: center; border-radius: 999px; background: #1769d2; color: #fff; padding: 0 17px; font-size: 11px; font-weight: 900; }
  .material-reference-grid, .material-library-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
  .material-reference-grid article { overflow: hidden; border: 1px solid #d8e2ef; border-radius: 16px; background: #fff; padding: 10px; }
  .material-reference-grid article > div:first-child { height: 135px; overflow: hidden; border-radius: 11px; background: #e2e8f0; }
  .material-reference-grid img { width: 100%; height: 100%; object-fit: cover; }
  .material-reference-grid strong { display: block; margin-top: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .file-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .file-actions button { border: 1px solid #d8e2ef; border-radius: 999px; background: #fff; padding: 7px 9px; font-size: 9px; font-weight: 900; }
  .material-category-filter { display: flex; flex-wrap: wrap; gap: 8px; }
  .material-category-filter button { border: 1px solid #d7deea; border-radius: 999px; background: #fff; color: #64748b; padding: 9px 13px; font-size: 10px; font-weight: 900; }
  .material-category-filter button[data-active="true"] { border-color: #1769d2; background: #1769d2; color: #fff; }
  .material-card { overflow: hidden; border: 1px solid #d7deea; border-radius: 20px; background: #fff; box-shadow: 0 10px 25px rgba(30,41,59,.05); }
  .material-card[data-selected="true"] { border: 2px solid #1769d2; box-shadow: 0 14px 30px rgba(46,124,246,.12); }
  .material-card > img { width: 100%; height: 170px; object-fit: cover; }
  .material-card-body { display: grid; gap: 10px; padding: 16px; }
  .material-card-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .material-card-title small, .material-card-body > small { color: #64748b; font-size: 9px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .material-card-title h3, .material-card-body h3 { margin-top: 4px; font-size: 17px; font-weight: 900; }
  .material-card-title button { border: 1px solid #1769d2; border-radius: 999px; background: #eff6ff; color: #1769d2; padding: 8px 10px; font-size: 9px; font-weight: 900; }
  .material-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .material-meta span { border-radius: 999px; background: #f1f5f9; color: #475569; padding: 6px 8px; font-size: 9px; font-weight: 800; }
  .material-card-body p { color: #64748b; font-size: 11px; line-height: 1.6; }
  .selected-material-count { display: grid; justify-items: center; border-radius: 18px; background: #1769d2; color: #fff; padding: 14px 20px; }
  .selected-material-count strong { font-size: 28px; }
  .selected-material-count span { font-size: 9px; font-weight: 900; text-transform: uppercase; }
  .selected-material-schedule, .extracted-materials { padding: 20px; }
  .selected-material-row { display: grid; grid-template-columns: 52px minmax(0,1fr) auto; gap: 12px; align-items: center; border-top: 1px solid #e2e8f0; padding: 11px 0; }
  .selected-material-row img { width: 52px; height: 52px; border-radius: 12px; object-fit: cover; }
  .selected-material-row div { display: grid; gap: 4px; }
  .selected-material-row span { color: #64748b; font-size: 10px; }
  .selected-material-row b { color: #1769d2; font-size: 9px; }
  .pack-material-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
  .pack-material-grid article { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; }
  .pack-material-grid img { width: 100%; height: 135px; object-fit: cover; }
  .pack-material-grid article div { display: grid; gap: 4px; padding: 12px; }
  .pack-material-grid span, .pack-material-grid p { color: #64748b; font-size: 10px; }
  .demo-mode-banner[data-live="true"] { border-color: rgba(34,197,94,.28); background: linear-gradient(135deg,#f0fdf4,#eff6ff); }
  .demo-mode-banner[data-live="true"] .demo-mode-chip { background: #15803d; color: #fff; }
  .custom-material-builder, .material-library-panel { padding: 22px; }
  .custom-material-builder-grid { display: grid; grid-template-columns: minmax(210px,.65fr) minmax(0,1.6fr); gap: 20px; align-items: start; }
  .custom-material-dropzone { display: grid; min-height: 280px; cursor: pointer; place-items: center; overflow: hidden; border: 1px dashed #67a0ff; border-radius: 20px; background: linear-gradient(145deg,#eff6ff,#eef6ff); color: #1769d2; font-size: 12px; font-weight: 900; }
  .custom-material-dropzone img { width: 100%; height: 100%; min-height: 280px; object-fit: cover; }
  .custom-material-fields, .material-edit-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
  .custom-material-fields label, .material-edit-grid label { display: grid; gap: 7px; }
  .custom-material-fields label.wide, .material-edit-grid label.wide, .material-edit-grid .wide { grid-column: 1 / -1; }
  .custom-material-fields label span, .material-edit-grid label span { color: #475569; font-size: 9px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
  .custom-material-fields input, .custom-material-fields select, .custom-material-fields textarea, .material-edit-grid input, .material-edit-grid textarea { width: 100%; border: 1px solid #d7deea; border-radius: 12px; background: #fbfcfe; color: #17151f; padding: 11px 12px; font-size: 11px; outline: none; }
  .custom-material-fields textarea, .material-edit-grid textarea { min-height: 90px; resize: vertical; }
  .custom-material-fields input:focus, .custom-material-fields select:focus, .custom-material-fields textarea:focus, .material-edit-grid input:focus, .material-edit-grid textarea:focus { border-color: #67a0ff; box-shadow: 0 0 0 3px rgba(46,124,246,.1); }
  .custom-material-actions, .material-edit-actions { display: flex; justify-content: flex-end; margin-top: 15px; }
  .material-search-input { min-width: 260px; border: 1px solid #d7deea; border-radius: 999px; background: #fff; padding: 10px 14px; color: #17151f; font-size: 11px; }
  .editable-material-list { display: grid; gap: 12px; }
  .editable-material-card { overflow: hidden; border: 1px solid #d7deea; border-radius: 17px; background: #fff; }
  .editable-material-card[data-selected="true"] { border-color: #67a0ff; box-shadow: 0 8px 22px rgba(46,124,246,.08); }
  .editable-material-summary { display: grid; grid-template-columns: 66px minmax(0,1fr) auto; gap: 13px; align-items: center; padding: 12px; }
  .editable-material-summary img { width: 66px; height: 66px; border-radius: 13px; object-fit: cover; background: #e2e8f0; }
  .editable-material-summary > div:nth-child(2) { display: grid; gap: 4px; }
  .editable-material-summary small { color: #2e7cf6; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
  .editable-material-summary strong { font-size: 14px; }
  .editable-material-summary span { color: #64748b; font-size: 10px; line-height: 1.5; }
  .editable-material-actions, .visual-card-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
  .editable-material-actions button, .image-regenerate-button { border: 1px solid #67a0ff; border-radius: 999px; background: #eff6ff; color: #1769d2; padding: 8px 11px; font-size: 9px; font-weight: 900; }
  .editable-material-actions .danger-button { border-color: #fecdd3; background: #fff1f2; color: #be123c; }
  .material-edit-grid { border-top: 1px solid #e2e8f0; background: #fafbff; padding: 16px; }
  .generation-image-card { position: relative; overflow: hidden; }
  .generation-image-placeholder { display: grid; min-height: 340px; place-items: center; align-content: center; gap: 9px; background: linear-gradient(145deg,#eef2ff,#f8fafc); color: #1769d2; padding: 26px; text-align: center; }
  .generation-image-placeholder.compact { min-height: 230px; }
  .generation-image-placeholder strong { color: #1e3a8a; font-size: 14px; }
  .generation-image-placeholder span { max-width: 520px; color: #64748b; font-size: 10px; line-height: 1.55; }
  .generation-image-card > .image-regenerate-button { position: absolute; right: 14px; bottom: 14px; z-index: 2; border-color: rgba(255,255,255,.5); background: rgba(20,12,35,.86); color: #fff; backdrop-filter: blur(10px); }
  .plan-visual-card.generation-image-card { padding-bottom: 54px; }
  .visual-gallery-image .generation-image-placeholder { height: 100%; min-height: 260px; }
  .visual-card-actions .image-regenerate-button { background: #eff6ff; }
  .direction-actions { flex-wrap: wrap; }
  .direction-actions > button { flex: 1 1 160px; }

  .image-generation-overlay { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; align-content: center; gap: 10px; padding: 24px; background: linear-gradient(135deg,rgba(15,23,42,.86),rgba(23,105,210,.8)); color: #fff; text-align: center; backdrop-filter: blur(10px); }
  .image-generation-overlay strong { font-size: 15px; font-weight: 900; }
  .image-generation-overlay > span:not(.image-generation-spinner) { max-width: 360px; color: rgba(255,255,255,.82); font-size: 11px; line-height: 1.55; }
  .image-generation-spinner { width: 34px; height: 34px; border: 3px solid rgba(255,255,255,.25); border-top-color: #fff; border-radius: 999px; animation: architecture-spin .8s linear infinite; }
  .image-generation-progress { width: min(280px,70%); height: 5px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.2); }
  .image-generation-progress i { display: block; width: 42%; height: 100%; border-radius: inherit; background: #fff; animation: architecture-progress 1.35s ease-in-out infinite; }
  @keyframes architecture-spin { to { transform: rotate(360deg); } }
  @keyframes architecture-progress { 0% { transform: translateX(-110%); } 100% { transform: translateX(340%); } }
  .floating-generation-actions { position: absolute; right: 14px; bottom: 14px; z-index: 9; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  .generation-image-card > .floating-generation-actions .image-regenerate-button { position: static; }
  .professional-final-action { border-color: #111827 !important; background: #111827 !important; color: #fff !important; }
  .plan-workflow-card { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:18px 20px; border-color:var(--arch-accent-border); background:linear-gradient(135deg,var(--surface-strong),var(--arch-accent-soft)); }
  .plan-workflow-card > div:first-child { display:grid; gap:5px; }
  .plan-workflow-card strong { color:var(--text-primary); font-size:14px; }
  .plan-workflow-card span { color:var(--text-secondary); font-size:10px; line-height:1.55; }
  .plan-workflow-card .credit-legend { align-items:center; }
  .plan-workflow-card .credit-legend b { border-radius:999px; background:rgba(240,180,41,.14); color:#a96e00; padding:8px 11px; font-size:8px; letter-spacing:.08em; text-transform:uppercase; }
  .plan-workflow-card[data-ready="true"] .credit-legend b { background:rgba(20,166,115,.12); color:var(--green); }
  .credit-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
  .credit-legend span { border-radius: 999px; background: #eff6ff; color: #1769d2; padding: 8px 11px; font-size: 9px; font-weight: 900; }
  .plan-view-tabs { position:static; z-index:auto; display:flex; gap:5px; border-radius:999px; background:var(--surface-hover); padding:4px; box-shadow:none; backdrop-filter:none; }
  .plan-view-tabs button { border: 0; border-radius: 999px; background: transparent; color: #64748b; padding: 7px 10px; font-size: 8px; font-weight: 900; }
  .plan-view-tabs button[data-active="true"] { background: #1769d2; color: #fff; }
  .plan-view-tabs button:disabled { opacity: .38; }
  .plan-card-copy { display: grid; gap: 4px; padding: 15px 15px 7px; }
  .plan-card-copy span { color: #2563eb; font-size: 8px; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }
  .plan-card-copy h3 { font-size: 15px; }
  .plan-card-actions { display:flex; flex-wrap:wrap; align-items:stretch; gap:12px; padding:10px 15px 16px; }
  .plan-card-actions .image-regenerate-button, .plan-card-actions .visual-approve-button { position:static !important; flex:1 1 190px; min-height:44px; justify-content:center; }
  .plan-card-actions .plan-generation-locked { border-style:dashed; background:var(--surface); color:var(--text-muted); cursor:not-allowed; opacity:1; }
  .plan-visual-card.generation-image-card { padding-bottom: 0; }
  .direction-card-visual { position: relative; }


  /* Architecture workspace follows the global theme and uses the blue Studio identity. */
  .architecture-workspace-page,
  .architecture-workspace-loading {
    --arch-accent:#2e7cf6;
    --arch-accent-strong:#1769d2;
    --arch-accent-soft:rgba(46,124,246,.12);
    --arch-accent-border:rgba(46,124,246,.34);
    background:
      radial-gradient(circle at 90% 4%, rgba(46,124,246,.14), transparent 26%),
      radial-gradient(circle at 18% 12%, rgba(46,124,246,.07), transparent 25%),
      var(--background);
    color:var(--text-primary);
  }
  .workspace-hero,
  .directions-intro,
  .coming-card,
  .next-stage-card {
    border-color:var(--arch-accent-border);
    background:linear-gradient(135deg,var(--surface-strong),var(--arch-accent-soft));
    box-shadow:var(--shadow-card);
  }
  .surface-card,
  .hero-progress-card,
  .workspace-tabs,
  .metric-card,
  .direction-card,
  .plan-visual-card,
  .visual-gallery-card,
  .pack-page,
  .paint-preset-card,
  .editable-material-card,
  .material-card,
  .material-reference-grid article,
  .pack-material-grid article,
  .expert-deliverable-grid span {
    border-color:var(--border);
    background:var(--surface-strong);
    color:var(--text-primary);
    box-shadow:var(--shadow-card);
  }
  .workspace-tabs button,
  .chip-list button,
  .secondary-action,
  .direction-secondary-action,
  .visual-approve-button,
  .material-industry-toggle button,
  .material-category-filter button,
  .file-actions button,
  .document-row button,
  .plan-view-tabs button,
  .plan-select-toggle {
    border-color:var(--border);
    background:var(--surface);
    color:var(--text-secondary);
  }
  .workspace-tabs button:hover,
  .chip-list button:hover,
  .secondary-action:hover,
  .direction-secondary-action:hover,
  .material-category-filter button:hover {
    border-color:var(--arch-accent-border);
    background:var(--arch-accent-soft);
    color:var(--blue);
  }
  .workspace-tabs button[data-active="true"],
  .workspace-mode-toggle button[data-active="true"],
  .chip-list button[data-active="true"],
  .material-industry-toggle button[data-active="true"],
  .material-category-filter button[data-active="true"],
  .plan-view-tabs button[data-active="true"],
  .plan-select-toggle[data-selected="true"],
  .primary-action,
  .direction-select-action,
  .upload-button,
  .material-upload-button,
  .selected-material-count,
  .hero-mark,
  .loader-mark,
  .coming-mark,
  .strategy-card > span {
    border-color:var(--arch-accent-strong);
    background:linear-gradient(135deg,var(--arch-accent-strong),var(--arch-accent));
    color:#fff;
  }
  .eyebrow,
  .hero-progress-card strong,
  .plan-card-copy span,
  .visual-gallery-body span,
  .workspace-tabs button:hover,
  .direction-card-body > span,
  .section-navigation > div:first-child span {
    color:var(--blue);
  }
  .hero-badges span { background:var(--arch-accent-soft); color:var(--blue); }
  .hero-badges span[data-tone="status"] { background:var(--arch-accent-soft); color:var(--blue); }
  .hero-progress-line,
  .workspace-generation-status,
  .stage-generation-loading { background:var(--surface-hover); }
  .hero-progress-line span { background:linear-gradient(90deg,var(--arch-accent-strong),var(--arch-accent)); }
  .workspace-hero-copy p,
  .hero-progress-card p,
  .section-heading p,
  .next-stage-card p,
  .plan-experience-note span,
  .direction-card-body p,
  .visual-gallery-body p,
  .stage-header p,
  .stage-empty p { color:var(--text-secondary); }
  .workspace-hero h1,
  .section-heading h2,
  .section-heading h3,
  .metric-card strong,
  .check-row strong,
  .visual-gallery-body h3,
  .plan-card-copy h3 { color:var(--text-primary); }
  .check-row,
  .area-schedule-row,
  .relationship-list > div,
  .assumption-list > div,
  .direction-detail,
  .document-row,
  .program-row,
  .custom-material-builder,
  .material-edit-grid,
  .paint-application-panel,
  .upload-controls input,
  .upload-controls select,
  .upload-controls textarea,
  .custom-paint-builder input,
  .custom-paint-builder select,
  .material-search-input,
  .editable-material-card input,
  .editable-material-card select,
  .editable-material-card textarea {
    border-color:var(--border);
    background:var(--surface);
    color:var(--text-primary);
  }
  .credit-legend span { background:var(--arch-accent-soft); color:var(--blue); }
  [data-theme="dark"] .architecture-workspace-page,
  [data-theme="dark"] .architecture-workspace-loading {
    --arch-accent:#67a0ff;
    --arch-accent-strong:#2e7cf6;
    --arch-accent-soft:rgba(46,124,246,.16);
    --arch-accent-border:rgba(103,160,255,.38);
  }
  .architecture-custom-select { position:relative; width:100%; }
  .architecture-custom-select-trigger {
    display:flex;
    width:100%;
    min-height:48px;
    align-items:center;
    justify-content:space-between;
    gap:14px;
    border:1px solid var(--border-strong);
    border-radius:14px;
    background:var(--surface-strong);
    color:var(--text-primary);
    padding:0 14px;
    font-size:12px;
    text-align:left;
    outline:none;
    transition:border-color 180ms ease,box-shadow 180ms ease,background 180ms ease;
  }
  .architecture-custom-select-trigger:hover,
  .architecture-custom-select[data-open="true"] .architecture-custom-select-trigger {
    border-color:var(--arch-accent-strong);
    background:var(--surface);
    box-shadow:0 0 0 4px rgba(46,124,246,.12);
  }
  .architecture-custom-select-trigger span[data-placeholder="true"] { color:var(--text-muted); }
  .architecture-custom-select-trigger svg { flex:0 0 auto; color:var(--blue); transition:transform 180ms ease; }
  .architecture-custom-select[data-open="true"] .architecture-custom-select-trigger svg { transform:rotate(180deg); }
  .architecture-custom-select-menu {
    position:absolute;
    z-index:90;
    top:calc(100% + 8px);
    left:0;
    right:0;
    display:grid;
    max-height:280px;
    overflow:auto;
    gap:4px;
    border:1px solid var(--arch-accent-border);
    border-radius:16px;
    background:var(--surface-strong);
    padding:7px;
    box-shadow:0 22px 55px rgba(10,20,38,.22);
    backdrop-filter:blur(22px);
  }
  .architecture-custom-select-menu button {
    display:flex;
    min-height:40px;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    border:0;
    border-radius:11px;
    background:transparent;
    color:var(--text-secondary);
    padding:0 11px;
    font-size:11px;
    font-weight:800;
    text-align:left;
  }
  .architecture-custom-select-menu button:hover { background:var(--arch-accent-soft); color:var(--blue); }
  .architecture-custom-select-menu button[data-selected="true"] { background:linear-gradient(135deg,var(--arch-accent-strong),var(--arch-accent)); color:#fff; }

  .architecture-production-panel .heyy-production-panel {
    border-color:var(--arch-accent-border) !important;
    background:
      radial-gradient(circle at 16% 15%,rgba(255,255,255,.12),transparent 25%),
      linear-gradient(135deg,#0f4da8 0%,#1769d2 52%,#2e7cf6 100%) !important;
    box-shadow:0 20px 44px rgba(23,105,210,.24) !important;
  }
  .architecture-production-panel .heyy-production-card { border-color:var(--border) !important; }
  .architecture-production-panel .heyy-production-panel button[class*="violet"],
  .architecture-production-panel .heyy-production-panel [class*="text-violet"],
  .architecture-production-panel .heyy-production-panel [class*="border-violet"] { color:var(--blue) !important; border-color:var(--arch-accent-border) !important; }

  [data-theme="dark"] .architecture-workspace-page :is(
    .section-navigation > div:first-child strong,
    .sticky-card h3,
    .summary-line strong,
    .calculation-row strong,
    .directions-intro h2,
    .direction-readiness-item strong,
    .selected-direction-banner strong,
    .directions-empty h3,
    .direction-title-row h3,
    .direction-material strong,
    .coming-card h2,
    .coming-grid strong,
    .stage-locked h2,
    .stage-empty h2,
    .stage-header h2,
    .strategy-card h3,
    .plan-visual-card h3,
    .area-schedule-row strong,
    .dimension-list strong,
    .relationship-list strong,
    .visual-gallery-body h3,
    .pack-page-heading h2,
    .pack-copy-block h3,
    .pack-logo.final,
    .mode-experience-note strong,
    .plan-batch-panel strong,
    .guided-program-title input,
    .material-card-title h3,
    .material-card-body h3,
    .editable-material-summary strong,
    .selected-material-row strong
  ) { color:var(--text-primary) !important; }

  [data-theme="dark"] .architecture-workspace-page :is(
    .section-navigation > div:first-child strong,
    .section-navigation > div:first-child p,
    .summary-line span,
    .calculation-row span,
    .sticky-card p,
    .program-head,
    .guided-program-card > p,
    .directions-material-note,
    .plan-batch-panel span,
    .plan-batch-panel small
  ) { color:var(--text-secondary) !important; }

  [data-theme="dark"] .architecture-workspace-page :is(
    input:not([type="color"]):not([type="file"]),
    textarea,
    select,
    .field-block input,
    .field-block textarea,
    .upload-controls input,
    .upload-controls textarea,
    .program-row input,
    .program-row select,
    .guided-program-fields input,
    .guided-program-fields select,
    .custom-material-fields input,
    .custom-material-fields select,
    .custom-material-fields textarea,
    .material-edit-grid input,
    .material-edit-grid select,
    .material-edit-grid textarea,
    .custom-paint-builder input,
    .custom-paint-builder select,
    .paint-application-panel select,
    .material-search-input,
    .editable-material-card input,
    .editable-material-card select,
    .editable-material-card textarea
  ) {
    border-color:var(--border-strong) !important;
    background:#17141f !important;
    color:var(--text-primary) !important;
    color-scheme:dark;
  }
  [data-theme="dark"] .architecture-workspace-page :is(input,textarea)::placeholder { color:var(--text-muted) !important; opacity:1; }
  [data-theme="dark"] .architecture-workspace-page select option { background:#17141f; color:var(--text-primary); }

  [data-theme="dark"] .architecture-workspace-page :is(
    .workspace-mode-toggle,
    .demo-mode-banner,
    .demo-explanation,
    .empty-files,
    .direction-detail[data-compact="true"],
    .selected-direction-banner,
    .material-reference-panel,
    .material-edit-grid,
    .generation-image-placeholder,
    .paint-preset-card,
    .program-table,
    .custom-material-dropzone,
    .plan-batch-panel,
    .plan-workflow-card,
    .stage-generation-loading,
    .next-stage-card,
    .section-navigation
  ) {
    border-color:var(--border) !important;
    background:var(--surface-strong) !important;
    color:var(--text-primary) !important;
  }
  [data-theme="dark"] .architecture-workspace-page .demo-mode-banner { background:linear-gradient(135deg,rgba(20,166,115,.13),var(--surface-strong)) !important; }
  [data-theme="dark"] .architecture-workspace-page .selected-direction-banner { background:linear-gradient(135deg,var(--surface-strong),var(--arch-accent-soft)) !important; }
  [data-theme="dark"] .architecture-workspace-page .generation-image-placeholder { background:linear-gradient(145deg,#151923,#191724) !important; }
  [data-theme="dark"] .architecture-workspace-page .generation-image-placeholder strong { color:var(--text-primary) !important; }
  [data-theme="dark"] .architecture-workspace-page .generation-image-placeholder span { color:var(--text-secondary) !important; }
  [data-theme="dark"] .architecture-workspace-page .custom-material-dropzone { background:linear-gradient(145deg,rgba(46,124,246,.15),var(--surface-strong)) !important; }
  [data-theme="dark"] .architecture-workspace-page .direction-letter { background:rgba(18,20,29,.9) !important; color:var(--blue) !important; }
  [data-theme="dark"] .architecture-workspace-page .direction-readiness-item { border-color:rgba(240,180,41,.28); background:rgba(240,180,41,.10); }
  [data-theme="dark"] .architecture-workspace-page .direction-readiness-item > span { background:rgba(240,180,41,.15); color:var(--yellow); }
  [data-theme="dark"] .architecture-workspace-page .plan-image-zoom { background:#f7f9fc; }

  [data-theme="dark"] .architecture-workspace-page :is(
    .text-slate-950,.text-slate-900,.text-slate-800,
    .text-gray-950,.text-gray-900,.text-zinc-950,.text-zinc-900,
    .text-neutral-950,.text-neutral-900
  ) { color:var(--text-primary) !important; }
  [data-theme="dark"] .architecture-workspace-page :is(
    .text-slate-700,.text-slate-600,.text-slate-500,
    .text-gray-700,.text-gray-600,.text-gray-500,
    .text-zinc-700,.text-zinc-600,.text-zinc-500
  ) { color:var(--text-secondary) !important; }
  [data-theme="dark"] .architecture-workspace-page :is(.bg-white,.bg-slate-50,.bg-gray-50,.bg-zinc-50) { background:var(--surface-strong) !important; }

  [data-theme="dark"] .architecture-production-panel .heyy-production-card {
    border-color:var(--border) !important;
    background:var(--surface-strong) !important;
    color:var(--text-primary) !important;
    box-shadow:var(--shadow-card) !important;
  }
  [data-theme="dark"] .architecture-production-panel .heyy-production-card :is(h1,h2,h3,h4,strong,p,label,span) { color:inherit; }
  [data-theme="dark"] .architecture-production-panel .heyy-current-status { border-color:var(--border) !important; background:var(--surface) !important; }
  [data-theme="dark"] .architecture-production-panel textarea { border-color:var(--border-strong) !important; background:#17141f !important; color:var(--text-primary) !important; }
  [data-theme="dark"] .professional-final-action { border-color:#67a0ff !important; background:#1f4f9d !important; color:#fff !important; }
  [data-theme="dark"] .planning-warning,
  [data-theme="dark"] .direction-generation-warning,
  [data-theme="dark"] .direction-disclaimer,
  [data-theme="dark"] .pack-warning,
  [data-theme="dark"] .smart-warning { background:rgba(240,180,41,.12); color:var(--yellow); border-color:rgba(240,180,41,.3); }
  @media (max-width: 719px) {
    .architecture-workspace-page { padding: 22px 13px 55px; }
    .workspace-hero { padding: 20px 16px; }
    .workspace-hero-copy { align-items: flex-start; }
    .hero-mark { width: 48px; height: 48px; flex-basis: 48px; }
    .form-section { padding: 19px 15px; }
    .section-heading .primary-action { width: 100%; }
    .next-stage-card { align-items: flex-start; flex-direction: column; }
    .next-stage-card .primary-action { width: 100%; }
    .directions-intro { align-items: flex-start; flex-direction: column; }
    .directions-generate-all { width: 100%; min-width: 0; }
    .direction-title-row { display: block; }
    .direction-cost { display: inline-flex; margin-top: 10px; }
    .direction-disclaimer { flex-direction: column; }
    .document-row { align-items: flex-start; flex-wrap: wrap; }
    .document-row .min-w-0 { min-width: calc(100% - 52px); }
    .coming-card { padding: 25px 19px; }
    .workspace-loader-card { align-items: flex-start; }
    .demo-mode-banner, .stage-empty, .stage-header, .visual-gallery-body { align-items: flex-start; flex-direction: column; }
    .demo-mode-chip, .stage-empty .primary-action, .stage-empty-actions, .stage-empty-actions button, .stage-header .secondary-action, .pack-actions, .pack-actions button, .visual-approve-button { width: 100%; }
    .stage-empty-actions, .pack-actions { display: grid; }
    .area-schedule-head, .area-schedule-row { grid-template-columns: minmax(0,1fr) 65px 58px; padding: 9px; }
    .pack-cover, .pack-page { padding: 22px 17px; }
    .custom-material-builder-grid { grid-template-columns: 1fr; }
    .custom-material-fields, .material-edit-grid { grid-template-columns: 1fr; }
    .custom-material-fields label.wide, .material-edit-grid label.wide, .material-edit-grid .wide { grid-column: auto; }
    .editable-material-summary { grid-template-columns: 58px minmax(0,1fr); }
    .editable-material-summary img { width: 58px; height: 58px; }
    .editable-material-actions { grid-column: 1 / -1; justify-content: stretch; }
    .editable-material-actions button { flex: 1; }
    .material-search-input { width: 100%; min-width: 0; }
    .stage-actions, .material-stage-actions, .plan-card-toolbar, .plan-workflow-card { width:100%; align-items:stretch; flex-direction:column; }
    .stage-actions button, .material-stage-actions > *, .plan-card-toolbar > *, .plan-workflow-card .credit-legend { width:100%; }
    .plan-view-tabs { justify-content:stretch; }
    .plan-view-tabs button { flex:1; }
  }
`;

function ImageLightbox({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="image-lightbox-inner" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close enlarged image">×</button>
        <img src={url} alt={title} />
        <strong>{title}</strong>
      </div>
    </div>
  );
}

function StageGenerationLoading({ title, detail }: { title: string; detail: string }) {
  return <StudioLoader tone="architecture" title={title} detail={detail} variant="inline" />;
}

function ImageGenerationOverlay({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="image-generation-overlay" role="status" aria-live="polite">
      <span className="image-generation-spinner" aria-hidden="true" />
      <strong>{title}</strong>
      <span>{detail}</span>
      <div className="image-generation-progress"><i /></div>
    </div>
  );
}

function ArchitectureIcon() { return <DraftingCompass size={26} strokeWidth={1.9} />; }

function FileIcon() { return <FileText size={19} strokeWidth={1.9} />; }
