import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  generateAndStoreArchitectureImage,
  generateAndStoreArchitectureDocumentImage,
  generateAndStoreRenderedPlanImage,
  type ArchitectureDna,
  type ArchitectureImageReference,
  type CanonicalPlanSpec,
} from "@/lib/ai/architecture";
import { getAiMode, getAiPlanConfig, type AiPlan, type ImageGenerationTier } from "@/lib/ai/config";

type ImageTarget = "direction" | "concept" | "visual";

type RegenerateRequest = {
  projectId?: string;
  targetType?: ImageTarget;
  targetId?: string;
  quality?: ImageGenerationTier;
  planMode?: "technical" | "rendered";
};

type GeneratedAsset = {
  imageUrl: string;
  storagePath: string;
  masterImageUrl: string;
  masterStoragePath: string;
  thumbnailImageUrl: string;
  thumbnailStoragePath: string;
  usage?: unknown;
  referenceCount?: number;
  generationMethod?: string;
  quality?: string;
  tier?: string;
};

type ProjectIdentity = {
  id: string;
  user_id: string;
  project_name: string;
  selected_direction_id: string | null;
  workflow_mode: string;
  source_brief: Record<string, unknown> | null;
};

const directionDemoImages: Record<number, string> = {
  1: "/architecture/demo/direction-a-courtyard.jpg",
  2: "/architecture/demo/direction-b-pavilion.jpg",
  3: "/architecture/demo/direction-c-sculptural.jpg",
};

const visualDemoImages: Record<string, string> = {
  concept_strategy: "/architecture/demo/concept-strategy-board.jpg",
  functional_zoning: "/architecture/demo/plan-functional-zoning.jpg",
  ground_floor: "/architecture/demo/plan-ground-floor.jpg",
  upper_floor: "/architecture/demo/plan-upper-floor.jpg",
  site_plan: "/architecture/demo/plan-ground-floor.jpg",
  circulation: "/architecture/demo/plan-circulation.jpg",
  front_exterior: "/architecture/demo/visual-front-exterior.jpg",
  rear_exterior: "/architecture/demo/visual-rear-exterior.jpg",
  street_view: "/architecture/demo/visual-street-view.jpg",
  aerial_view: "/architecture/demo/visual-aerial-view.jpg",
  day_view: "/architecture/demo/visual-day.jpg",
  night_view: "/architecture/demo/visual-night.jpg",
  facade_alternative_a: "/architecture/demo/visual-facade-alternative-a.jpg",
  facade_alternative_b: "/architecture/demo/visual-facade-alternative-b.jpg",
};

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function assetRecord(generated: GeneratedAsset) {
  return {
    preview_url: generated.imageUrl,
    preview_storage_path: generated.storagePath,
    master_url: generated.masterImageUrl,
    master_storage_path: generated.masterStoragePath,
    thumbnail_url: generated.thumbnailImageUrl,
    thumbnail_storage_path: generated.thumbnailStoragePath,
    quality: generated.quality || null,
    tier: generated.tier || null,
    generated_at: new Date().toISOString(),
  };
}

function assetPaths(value: unknown) {
  const record = metadataRecord(value);
  return [record.preview_storage_path, record.master_storage_path, record.thumbnail_storage_path]
    .filter((path): path is string => typeof path === "string" && Boolean(path));
}

function preferredMasterPath(metadata: Record<string, unknown>, fallback: unknown) {
  const finalAssets = metadataRecord(metadata.final_assets);
  const previewAssets = metadataRecord(metadata.preview_assets);
  const renderedFinal = metadataRecord(metadata.rendered_final_assets);
  const renderedPreview = metadataRecord(metadata.rendered_preview_assets);
  const activeTier = metadata.image_tier === "final" ? "final" : "preview";
  const candidates = activeTier === "final"
    ? [
        finalAssets.master_storage_path,
        previewAssets.master_storage_path,
        renderedFinal.master_storage_path,
        renderedPreview.master_storage_path,
        fallback,
      ]
    : [
        previewAssets.master_storage_path,
        finalAssets.master_storage_path,
        renderedPreview.master_storage_path,
        renderedFinal.master_storage_path,
        fallback,
      ];
  return candidates.find((value): value is string => typeof value === "string" && Boolean(value)) || null;
}

async function removeStoredAssets(
  supabase: SupabaseClient,
  value: unknown,
) {
  const paths = assetPaths(value);
  if (paths.length) await supabase.storage.from("architecture-files").remove(paths);
}

function architectureDnaFrom(value: unknown): ArchitectureDna | null {
  const record = metadataRecord(value);
  const dna = record.architecture_dna;
  return dna && typeof dna === "object" && !Array.isArray(dna)
    ? (dna as ArchitectureDna)
    : null;
}

function canonicalPlanFrom(value: unknown): CanonicalPlanSpec | null {
  const record = metadataRecord(value);
  const plan = record.canonical_plan;
  return plan && typeof plan === "object" && !Array.isArray(plan)
    ? (plan as CanonicalPlanSpec)
    : null;
}

function fallbackArchitectureDna(direction: Record<string, unknown>): ArchitectureDna {
  const materialRows = Array.isArray(direction.materials)
    ? direction.materials as Array<Record<string, unknown>>
    : [];
  const title = String(direction.title || "Selected Architecture Direction");
  const form = String(direction.form_strategy || direction.philosophy || "Coherent selected-direction massing");
  const facade = String(direction.facade_strategy || "Preserve the approved facade rhythm and openings");
  const roof = String(direction.roof_strategy || "Preserve the approved roof geometry");
  const landscape = String(direction.landscape_strategy || "Preserve the approved site and landscape relationship");

  return {
    identity_name: title,
    design_summary: String(direction.philosophy || form),
    storeys: 2,
    massing: form,
    roof_form: roof,
    facade_rhythm: facade,
    window_language: facade,
    entry_expression: String(direction.site_response || "Preserve the approved entry expression"),
    landscape_relationship: landscape,
    pool_relationship: "Preserve the pool and outdoor-living relationship visible in the Master Architecture Reference.",
    material_placement: materialRows.slice(0, 10).map((material) => ({
      material: String(material.name || "Selected material"),
      location: String(material.role || material.description || "Preserve its approved facade location"),
    })),
    signature_elements: [
      form,
      facade,
      roof,
    ],
    must_preserve: [
      "overall massing",
      "storey count",
      "roof geometry",
      "facade rhythm",
      "window proportions",
      "material placement",
      "entry expression",
      "pool and landscape relationship",
    ],
    prohibited_changes: [
      "do not redesign the property",
      "do not introduce a different roof type",
      "do not change the number of storeys",
      "do not replace the approved material language",
      "do not create unrelated facade geometry",
    ],
    visual_prompt_anchor: `${title}. ${form}. ${facade}. ${roof}. ${landscape}.`,
  };
}

function imageReference(args: {
  label: string;
  storagePath?: unknown;
  url?: unknown;
}): ArchitectureImageReference | null {
  const storagePath = typeof args.storagePath === "string" && args.storagePath.trim()
    ? args.storagePath
    : null;
  const url = typeof args.url === "string" && args.url.trim()
    ? args.url
    : null;
  return storagePath || url
    ? { label: args.label, storagePath, url }
    : null;
}

function uniqueReferences(values: Array<ArchitectureImageReference | null>) {
  const seen = new Set<string>();
  return values.filter((value): value is ArchitectureImageReference => {
    if (!value) return false;
    const key = value.storagePath || value.url || value.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

type SourceDocumentRecord = Record<string, unknown>;

function sourceReferenceFingerprint(documents: SourceDocumentRecord[]) {
  const stable = documents
    .map((document) => `${String(document.category || "source")}:${String(document.storage_path || "")}`)
    .filter(Boolean)
    .sort()
    .join("|");
  return stable ? createHash("sha256").update(stable).digest("hex").slice(0, 20) : null;
}

function canonicalFloorVisualType(index: number) {
  if (index <= 0) return "ground_floor";
  if (index === 1) return "upper_floor";
  return `level_${index}_floor`;
}

function canonicalFloorIndex(visualType: string) {
  if (visualType === "ground_floor") return 0;
  if (visualType === "upper_floor") return 1;
  const match = visualType.match(/^level_(\d+)_floor$/);
  return match ? Number(match[1]) : null;
}

function approvedPlanReference(
  row: Record<string, unknown> | undefined,
  label: string,
) {
  if (!row || row.is_approved !== true) return null;
  const rowMetadata = metadataRecord(row.metadata);
  const technicalAssets = metadataRecord(rowMetadata.technical_assets);
  return imageReference({
    label,
    storagePath: technicalAssets.master_storage_path,
    url: technicalAssets.preview_url || row.image_url,
  });
}

function sourcePlanPriority(category: string, visualType: string) {
  const type = category.replace(/^source-plan-/, "");
  const lowerVisual = visualType.toLowerCase();
  const isInterior = /interior|living|kitchen|bedroom|suite|lobby|dining|bar|workspace|room/.test(lowerVisual);
  const isAerial = /aerial|masterplan|site/.test(lowerVisual);
  const isRear = /rear|garden|outdoor/.test(lowerVisual);
  const isFront = /front|street|facade|façade|arrival|exterior|day|night|building/.test(lowerVisual);

  if (isAerial) {
    if (type === "site_plan") return 0;
    if (type === "ground_floor") return 1;
    if (type === "upper_floor") return 2;
    if (type.includes("elevation")) return 3;
    if (type === "section") return 4;
  }
  if (isInterior) {
    if (type === "ground_floor") return 0;
    if (type === "upper_floor") return 1;
    if (type === "section") return 2;
    if (type.includes("elevation")) return 3;
  }
  if (isRear) {
    if (type === "rear_elevation") return 0;
    if (type === "ground_floor") return 1;
    if (type === "upper_floor") return 2;
    if (type === "section") return 3;
    if (type === "front_elevation") return 4;
  }
  if (isFront) {
    if (type === "front_elevation") return 0;
    if (type === "ground_floor") return 1;
    if (type === "upper_floor") return 2;
    if (type === "section") return 3;
    if (type === "rear_elevation") return 4;
  }

  if (type === "ground_floor") return 1;
  if (type === "upper_floor") return 2;
  if (type === "front_elevation") return 3;
  if (type === "rear_elevation") return 4;
  if (type === "section") return 5;
  if (type === "site_plan") return 6;
  if (category.startsWith("source-plan-")) return 7;
  if (category.startsWith("source")) return 6;
  return 20;
}

function sourceReferencesForVisual(documents: SourceDocumentRecord[], visualType: string) {
  return [...documents]
    .sort((a, b) => {
      const categoryA = String(a.category || "");
      const categoryB = String(b.category || "");
      const rankA = sourcePlanPriority(categoryA, visualType);
      const rankB = sourcePlanPriority(categoryB, visualType);
      if (rankA !== rankB) return rankA - rankB;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    })
    .map((document, index) => imageReference({
      label: `${String(document.category || "").startsWith("source-plan-") ? "Organised source drawing" : "Uploaded source sheet"} ${index + 1}: ${String(document.filename || "architectural drawing")}. AUTHORITATIVE EXISTING GEOMETRY.`,
      storagePath: document.storage_path,
    }))
    .filter((reference): reference is ArchitectureImageReference => Boolean(reference));
}

function existingDesignStyleSummary(direction: Record<string, unknown>) {
  const materials = Array.isArray(direction.materials)
    ? (direction.materials as Array<Record<string, unknown>>)
        .slice(0, 6)
        .map((material) => `${String(material.name || "material")}: ${String(material.description || material.role || "")}`)
        .join("; ")
    : "";
  return [
    `Direction: ${String(direction.title || "Selected direction")}`,
    String(direction.philosophy || ""),
    materials ? `Material language: ${materials}` : "",
    String(direction.landscape_strategy || ""),
    String(direction.natural_light_strategy || ""),
    String(direction.privacy_strategy || ""),
  ].filter(Boolean).join(" ");
}

function existingDesignVisualPrompt(args: {
  visualType: string;
  title: string;
  direction: Record<string, unknown>;
  sourceBrief: Record<string, unknown> | null;
}) {
  const requestedChange = String(args.sourceBrief?.requested_changes || args.sourceBrief?.render_target || "").trim();
  return [
    `Create one professional ${args.title || args.visualType.replace(/_/g, " ")} architectural visual from the supplied EXISTING DESIGN source drawings.`,
    "The source drawings define the building. Reconstruct that same building in 3D; do not create a new design, new footprint, new room arrangement, new stair position, new opening pattern or new massing.",
    `Apply only this selected aesthetic direction: ${existingDesignStyleSummary(args.direction)}`,
    requestedChange ? `User visualisation goal: ${requestedChange}` : "",
    "Where the drawings do not reveal a detail, make the smallest conservative interpretation consistent with the shown plans/elevations/sections.",
    "The result must look like a visualization of the uploaded project, not like the previous AI direction render.",
  ].filter(Boolean).join("\n");
}

function existingDesignDirectionBoardPrompt(direction: Record<string, unknown>) {
  return [
    "Create a premium ARCHITECTURAL STYLE DIRECTION BOARD for an existing building design.",
    "Do NOT create a complete new house or a hero exterior render. The uploaded drawings already define the building geometry.",
    "Show material swatches, facade-detail closeups, colour relationships, landscape character, lighting mood and abstract architectural fragments only. Avoid presenting any invented full-building massing as the project.",
    existingDesignStyleSummary(direction),
    "No readable paragraph text, labels, logos or watermarks in the generated image.",
  ].filter(Boolean).join("\n");
}

function sourceGrounded(metadata: Record<string, unknown>, fingerprint: string | null) {
  return Boolean(
    fingerprint &&
    metadata.source_geometry_locked === true &&
    metadata.source_reference_fingerprint === fingerprint &&
    metadata.source_geometry_stale !== true
  );
}

async function removePreviousStorage(
  supabase: SupabaseClient,
  previousPath: string | null,
  nextPath: string | null,
) {
  if (!previousPath || previousPath === nextPath) return;
  await supabase.storage.from("architecture-files").remove([previousPath]);
}

async function loadSelectedDirection(
  supabase: SupabaseClient,
  project: ProjectIdentity,
  userId: string,
) {
  if (!project.selected_direction_id) {
    throw new Error("Select an Architecture Direction before generating coordinated images.");
  }
  const { data, error } = await supabase
    .from("architecture_directions")
    .select("*")
    .eq("id", project.selected_direction_id)
    .eq("project_id", project.id)
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    throw new Error(error?.message || "The selected Master Architecture Reference could not be loaded.");
  }
  return data as Record<string, unknown>;
}


export type ArchitectureImageJobInput = RegenerateRequest & { planName?: AiPlan };

export async function executeArchitectureImageGeneration(args: {
  admin: SupabaseClient;
  userId: string;
  input: ArchitectureImageJobInput;
}) {

  const body = args.input;
  const projectId = body.projectId?.trim();
  const targetId = body.targetId?.trim();
  const targetType = body.targetType;
  const quality: ImageGenerationTier = body.quality === "final" ? "final" : "preview";
  const planMode = body.planMode === "rendered" ? "rendered" : "technical";

  if (!projectId || !targetId || !targetType) {
    throw new Error("projectId, targetType and targetId are required.");
  }
  if (!["direction", "concept", "visual"].includes(targetType)) {
    throw new Error("Invalid image target.");
  }

  const supabase = args.admin;
  const authenticatedUserId = args.userId;

  const { data: projectData, error: projectError } = await supabase
    .from("architecture_projects")
    .select("id,user_id,project_name,selected_direction_id,workflow_mode,source_brief")
    .eq("id", projectId)
    .eq("user_id", authenticatedUserId)
    .single();
  if (projectError || !projectData) {
    throw new Error(projectError?.message || "Architecture project not found.");
  }
  const project = projectData as ProjectIdentity;

  const { data: sourceDocuments } = await supabase
    .from("architecture_documents")
    .select("storage_path,mime_type,filename,category,created_at")
    .eq("project_id", projectId)
    .eq("user_id", authenticatedUserId)
    .like("category", "source%")
    .order("created_at", { ascending: true });
  const orderedSourceDocuments = ((sourceDocuments || []) as Array<Record<string, unknown>>)
    .filter((document) => String(document.mime_type || "").startsWith("image/"))
    .sort((a, b) => {
      const aOrganised = String(a.category || "").startsWith("source-plan-") ? 0 : 1;
      const bOrganised = String(b.category || "").startsWith("source-plan-") ? 0 : 1;
      return aOrganised - bOrganised;
    });
  const sourceDrawingReferences = sourceReferencesForVisual(orderedSourceDocuments, "general");
  const sourceFingerprint = sourceReferenceFingerprint(orderedSourceDocuments);
  const sourceGeometryLocked =
    project.workflow_mode === "plan_to_render" && sourceDrawingReferences.length > 0;

  const mode = process.env.NEXT_PUBLIC_MOCK_IMAGES === "true" ? "demo" : getAiMode();
  const plan = getAiPlanConfig(body.planName || "free");
  async function paidGenerate<T>(
    _action: string,
    _metadata: Record<string, unknown>,
    work: () => Promise<T>,
  ) {
    return work();
  }

  if (targetType === "direction") {
    const { data: direction, error } = await supabase
      .from("architecture_directions")
      .select("*")
      .eq("id", targetId)
      .eq("project_id", projectId)
      .eq("user_id", authenticatedUserId)
      .single();
    if (error || !direction) throw new Error(error?.message || "Architecture Direction not found.");

    const previousPath = direction.image_storage_path as string | null;
    let imageUrl: string;
    let storagePath: string | null = null;
    let imageMetadata: Record<string, unknown> = {};

    if (mode === "demo") {
      imageUrl = directionDemoImages[Number(direction.direction_number)] || directionDemoImages[1];
    } else {
      const savedPrompt = String(direction.image_prompt || "").trim();
      if (!savedPrompt) {
        throw new Error("This direction has no saved image prompt. Regenerate the direction text first.");
      }
      const currentReference = imageReference({
        label: "Current Direction image. Preserve this direction identity while refining the visual.",
        storagePath: direction.image_storage_path,
        url: direction.image_url,
      });
      const generated = await paidGenerate(quality === "final" ? "architectureProfessionalFinal" : "architectureDirection", { target: "direction", quality }, () => generateAndStoreArchitectureImage({
        supabase,
        userId: authenticatedUserId,
        projectId,
        folder: "directions",
        filenamePrefix: `direction-${direction.direction_number}`,
        prompt: sourceGeometryLocked
          ? existingDesignDirectionBoardPrompt(direction as Record<string, unknown>)
          : savedPrompt,
        plan,
        architectureDna: sourceGeometryLocked ? null : fallbackArchitectureDna(direction as Record<string, unknown>),
        sourceGeometryReferences: sourceGeometryLocked ? sourceDrawingReferences : [],
        preserveSourceGeometry: sourceGeometryLocked,
        referenceImages: sourceGeometryLocked
          ? []
          : uniqueReferences([currentReference]),
        targetRole: sourceGeometryLocked
          ? "Create a STYLE / MATERIAL DIRECTION BOARD only. The source drawings define the actual building and this direction image must not establish replacement geometry."
          : "Refine this Architecture Direction without changing its core identity.",
        tier: quality,
      }));
      imageUrl = generated.imageUrl;
      storagePath = generated.storagePath;
      imageMetadata = {
        image_usage: generated.usage,
        image_reference_count: generated.referenceCount,
        image_generation_method: generated.generationMethod,
        image_tier: quality,
        image_quality: generated.quality,
        existing_design_style_board: sourceGeometryLocked,
        source_geometry_locked: sourceGeometryLocked,
        source_reference_fingerprint: sourceGeometryLocked ? sourceFingerprint : null,
        source_geometry_stale: false,
        [`${quality}_assets`]: assetRecord(generated),
      };
    }

    const generationJson = metadataRecord(direction.generation_json);
    const { data: updated, error: updateError } = await supabase
      .from("architecture_directions")
      .update({
        image_url: imageUrl,
        image_storage_path: storagePath,
        image_model: mode === "demo" ? "demo-image-v1" : plan.imageModel,
        generation_status: "complete",
        generation_error: null,
        generated_at: new Date().toISOString(),
        generation_json: {
          ...generationJson,
          ...imageMetadata,
          mode,
          visual_continuity_version: 2,
          image_variation: Number(generationJson.image_variation || 0) + 1,
          image_regenerated_at: new Date().toISOString(),
        },
      })
      .eq("id", targetId)
      .eq("project_id", projectId)
      .eq("user_id", authenticatedUserId)
      .select("*")
      .single();
    if (updateError || !updated) {
      await removeStoredAssets(supabase, imageMetadata[`${quality}_assets`]);
      throw new Error(updateError?.message || "Direction image could not be saved.");
    }
    await removeStoredAssets(supabase, generationJson[`${quality}_assets`]);
    if (!generationJson.preview_assets && !generationJson.final_assets) {
      await removePreviousStorage(supabase, previousPath, storagePath);
    }
    return { success: true, mode, targetType, quality, direction: updated };
  }

  const masterDirection = await loadSelectedDirection(supabase, project, authenticatedUserId);
  const masterDirectionJson = metadataRecord(masterDirection.generation_json);
  const masterReference = imageReference({
    label: "Master Architecture Reference. This exact property identity must be preserved.",
    storagePath: preferredMasterPath(masterDirectionJson, masterDirection.image_storage_path),
    url: masterDirection.image_url,
  });

  if (!masterReference && mode !== "demo" && !sourceGeometryLocked) {
    throw new Error("The selected direction has no generated Master Architecture Reference image.");
  }

  if (targetType === "concept") {
    const { data: concept, error } = await supabase
      .from("architecture_concepts")
      .select("*")
      .eq("id", targetId)
      .eq("project_id", projectId)
      .eq("user_id", authenticatedUserId)
      .single();
    if (error || !concept) throw new Error(error?.message || "Architecture Concept not found.");

    const generationJson = metadataRecord(concept.generation_json);
    const previousPath = typeof generationJson.image_storage_path === "string"
      ? generationJson.image_storage_path
      : null;
    const architectureDna =
      architectureDnaFrom(generationJson) ||
      fallbackArchitectureDna(masterDirection);
    let imageUrl: string;
    let storagePath: string | null = null;
    let imageMetadata: Record<string, unknown> = {};

    if (mode === "demo") {
      imageUrl = "/architecture/demo/concept-strategy-board.jpg";
    } else {
      const savedPrompt = String(generationJson.image_prompt || "").trim();
      if (!savedPrompt) {
        throw new Error("This concept has no saved image prompt. Refresh the Concept Strategy first.");
      }

      const currentConceptReference = imageReference({
        label: "Current Concept image. Improve only the requested presentation while preserving the building.",
        storagePath: preferredMasterPath(generationJson, generationJson.image_storage_path),
        url: concept.image_url,
      });
      const directionStyleReference = sourceGeometryLocked && sourceGrounded(masterDirectionJson, sourceFingerprint) && masterDirectionJson.existing_design_style_board === true
        ? masterReference
        : null;
      const conceptIsSourceGrounded = sourceGrounded(generationJson, sourceFingerprint);
      const generated = await paidGenerate(quality === "final" ? "architectureProfessionalFinal" : "architectureDirection", { target: "concept", quality }, () => generateAndStoreArchitectureImage({
        supabase,
        userId: authenticatedUserId,
        projectId,
        folder: "concept",
        filenamePrefix: "concept-strategy",
        prompt: sourceGeometryLocked
          ? [
              "Create a premium EXISTING DESIGN concept board from the supplied source drawings.",
              "Use the drawings themselves for plan/elevation/section analysis. Do not propose alternative massing, layouts, stairs, openings or building forms.",
              `Selected style direction: ${existingDesignStyleSummary(masterDirection)}.`,
              "Show restrained diagram overlays, material intent, site/landscape relationship, daylight and circulation analysis while keeping the original architecture recognisable.",
              "Do not return a new hero building render. Avoid AI-generated paragraph text; use clean graphic composition and diagrammatic studies.",
            ].join("\n")
          : savedPrompt,
        plan,
        architectureDna: sourceGeometryLocked ? null : architectureDna,
        sourceGeometryReferences: sourceGeometryLocked ? sourceReferencesForVisual(orderedSourceDocuments, "concept") : [],
        preserveSourceGeometry: sourceGeometryLocked,
        referenceImages: sourceGeometryLocked
          ? uniqueReferences([directionStyleReference, conceptIsSourceGrounded ? currentConceptReference : null])
          : uniqueReferences([masterReference, currentConceptReference]),
        targetRole: sourceGeometryLocked
          ? "Create a concept ANALYSIS BOARD for the existing uploaded design. Source drawings control geometry; style references control presentation only."
          : "Create a premium architectural concept presentation board derived from the exact Master Architecture Reference. Combine the approved building with visual studies for massing evolution, site response, zoning, circulation, sun orientation, material palette and indoor-outdoor relationships. Do not return another standalone facade render and do not create another property. Avoid AI-generated paragraph text; use diagrams and clean graphic composition.",
        tier: quality,
      }));
      imageUrl = generated.imageUrl;
      storagePath = generated.storagePath;
      imageMetadata = {
        image_usage: generated.usage,
        image_reference_count: generated.referenceCount,
        image_generation_method: generated.generationMethod,
        image_tier: quality,
        image_quality: generated.quality,
        source_geometry_locked: sourceGeometryLocked,
        source_reference_fingerprint: sourceGeometryLocked ? sourceFingerprint : null,
        source_geometry_stale: false,
        [`${quality}_assets`]: assetRecord(generated),
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from("architecture_concepts")
      .update({
        image_url: imageUrl,
        generation_mode: mode,
        generation_json: {
          ...generationJson,
          ...imageMetadata,
          mode,
          image_storage_path: storagePath,
          image_model: mode === "demo" ? "demo-image-v1" : plan.imageModel,
          architecture_dna: architectureDna,
          visual_continuity_version: 2,
          master_direction_id: project.selected_direction_id,
          master_direction_storage_path:
            typeof masterDirection.image_storage_path === "string"
              ? masterDirection.image_storage_path
              : null,
          image_variation: Number(generationJson.image_variation || 0) + 1,
          image_regenerated_at: new Date().toISOString(),
        },
      })
      .eq("id", targetId)
      .eq("project_id", projectId)
      .eq("user_id", authenticatedUserId)
      .select("*")
      .single();
    if (updateError || !updated) {
      await removeStoredAssets(supabase, imageMetadata[`${quality}_assets`]);
      throw new Error(updateError?.message || "Concept image could not be saved.");
    }
    await removeStoredAssets(supabase, generationJson[`${quality}_assets`]);
    if (!generationJson.preview_assets && !generationJson.final_assets) {
      await removePreviousStorage(supabase, previousPath, storagePath);
    }
    return { success: true, mode, targetType, quality, concept: updated };
  }

  const { data: visual, error } = await supabase
    .from("architecture_visuals")
    .select("*")
    .eq("id", targetId)
    .eq("project_id", projectId)
    .eq("user_id", authenticatedUserId)
    .single();
  if (error || !visual) throw new Error(error?.message || "Architecture visual not found.");

  const visualMetadata = metadataRecord(visual.metadata);
  const previousPath = visual.storage_path as string | null;
  const group = visualMetadata.group === "plans"
    ? "plans"
    : visualMetadata.group === "tour"
      ? "tour"
      : "visuals";
  let imageUrl: string;
  let storagePath: string | null = null;
  let imageModel = mode === "demo" ? "demo-image-v1" : plan.imageModel;
  let imageMetadata: Record<string, unknown> = {};
  let assetMetadataKey: string | null = null;
  let previousAssetMetadata: unknown = null;

  if (mode === "demo") {
    imageUrl = visualDemoImages[String(visual.visual_type)] || "/architecture/demo/visual-front-exterior.jpg";
  } else if (group === "plans") {
    if (sourceGeometryLocked) {
      throw new Error(
        "Existing Design source plans are preserved from the uploaded drawings and are not regenerated with AI. Use the Source Plan Organizer in the Plans section.",
      );
    }
    const { data: planSet, error: planError } = await supabase
      .from("architecture_plan_sets")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", authenticatedUserId)
      .single();
    if (planError || !planSet) {
      throw new Error(planError?.message || "Refresh the Plan Content before generating coordinated diagrams.");
    }

    const planJson = metadataRecord(planSet.generation_json);
    const canonicalPlan = canonicalPlanFrom(planJson);
    if (!canonicalPlan) {
      throw new Error("This project has no Canonical Plan Specification. Click Refresh Plan Content & Prompts first.");
    }
    const architectureDna =
      architectureDnaFrom(planJson) ||
      architectureDnaFrom(visualMetadata) ||
      fallbackArchitectureDna(masterDirection);

    const { data: siblingPlanRows } = await supabase
      .from("architecture_visuals")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", authenticatedUserId);
    const siblingPlans = ((siblingPlanRows || []) as Array<Record<string, unknown>>)
      .filter((row) => metadataRecord(row.metadata).group === "plans" || [
        "ground_floor", "upper_floor", "site_plan", "functional_zoning", "circulation",
        "north_elevation", "south_elevation", "east_elevation", "west_elevation",
        "section_longitudinal", "section_transverse",
      ].includes(String(row.visual_type || "")));
    const visualType = String(visual.visual_type || "ground_floor");
    const canonicalLevels = Array.isArray(canonicalPlan.levels) ? canonicalPlan.levels : [];
    const targetFloorIndex = canonicalFloorIndex(visualType);
    const approvedFloorReferences = canonicalLevels.map((_, floorIndex) => {
      const floorType = canonicalFloorVisualType(floorIndex);
      const floorRow = siblingPlans.find((row) => String(row.visual_type || "") === floorType);
      return approvedPlanReference(
        floorRow,
        `${floorType.replace(/_/g, " ")} of the same project. This is an approved connected floor plan and is a geometry anchor for the same building. Keep the footprint family, stair/core stack, wet-core logic, opening rhythm and circulation aligned with it.`,
      );
    }).filter((reference): reference is ArchitectureImageReference => Boolean(reference));
    const prerequisiteFloorReferences = targetFloorIndex === null
      ? approvedFloorReferences
      : approvedFloorReferences.slice(0, targetFloorIndex);
    if (targetFloorIndex !== null && targetFloorIndex > 0 && prerequisiteFloorReferences.length < targetFloorIndex) {
      const missingTypes = Array.from({ length: targetFloorIndex }, (_, index) => canonicalFloorVisualType(index))
        .filter((floorType, index) => !prerequisiteFloorReferences[index])
        .map((floorType) => floorType.replace(/_/g, " "));
      throw new Error(
        `Approve ${missingTypes.join(" and ")} before generating ${visualType.replace(/_/g, " ")}. Each floor plan must be generated from the selected direction and the already approved lower floor plans.`,
      );
    }
    const planWorkflowReferences = targetFloorIndex === null
      ? approvedFloorReferences
      : prerequisiteFloorReferences;

    if (planMode === "rendered") {
      const renderedAssetKey = `rendered_${quality}_assets`;
      assetMetadataKey = renderedAssetKey;
      previousAssetMetadata = visualMetadata[renderedAssetKey];
      const currentRendered = metadataRecord(previousAssetMetadata);
      const currentRenderedReference = imageReference({
        label: "Current rendered plan preview. Refine presentation only and preserve the canonical geometry.",
        storagePath: currentRendered.master_storage_path,
        url: currentRendered.preview_url,
      });
      const generated = await paidGenerate(quality === "final" ? "architectureProfessionalFinal" : "architectureVisual", { target: "rendered_plan", quality, plan_mode: "rendered" }, () => generateAndStoreRenderedPlanImage({
        supabase,
        userId: authenticatedUserId,
        projectId,
        filenamePrefix: String(visual.visual_type || "rendered-plan"),
        visualType: String(visual.visual_type || "ground_floor"),
        title: String(visual.title || "Rendered Concept Plan"),
        projectName: project.project_name,
        canonicalPlan,
        architectureDna,
        areaSchedule: Array.isArray(planSet.area_schedule) ? planSet.area_schedule : [],
        plan,
        tier: quality,
        referenceImages: uniqueReferences([masterReference, ...planWorkflowReferences, currentRenderedReference]),
        sourceGeometryReferences: sourceDrawingReferences,
        preserveSourceGeometry: sourceGeometryLocked,
      }));
      imageUrl = generated.imageUrl;
      storagePath = generated.storagePath;
      imageModel = generated.model;
      imageMetadata = {
        canonical_plan: canonicalPlan,
        architecture_dna: architectureDna,
        image_provider: generated.provider,
        image_model: generated.model,
        image_generation_method: generated.generationMethod,
        image_reference_count: generated.referenceCount,
        image_usage: generated.usage,
        image_tier: quality,
        image_quality: generated.quality,
        active_plan_view: "rendered",
        [renderedAssetKey]: assetRecord(generated),
      };
    } else {
      assetMetadataKey = "technical_assets";
      previousAssetMetadata = visualMetadata[assetMetadataKey];
      const currentTechnical = metadataRecord(previousAssetMetadata);
      const currentTechnicalReference = imageReference({
        label: "Current detailed concept plan. Preserve approved geometry while improving only missing architectural detail.",
        storagePath: currentTechnical.master_storage_path,
        url: currentTechnical.preview_url,
      });
      const generated = await paidGenerate(
        quality === "final" ? "architectureProfessionalFinal" : "architectureTechnicalPlan",
        { target: "detailed_concept_plan", quality, plan_mode: "technical", visual_type: visualType },
        () => generateAndStoreArchitectureDocumentImage({
          supabase,
          userId: authenticatedUserId,
          projectId,
          filenamePrefix: visualType,
          visualType,
          title: String(visual.title || "Detailed Concept Plan"),
          projectName: project.project_name,
          canonicalPlan,
          architectureDna,
          plan,
          tier: quality,
          referenceImages: uniqueReferences([
            masterReference,
            ...planWorkflowReferences,
            currentTechnicalReference,
          ]),
          sourceGeometryReferences: sourceDrawingReferences,
          preserveSourceGeometry: sourceGeometryLocked,
        }),
      );
      imageUrl = generated.imageUrl;
      storagePath = generated.storagePath;
      imageModel = generated.model;
      imageMetadata = {
        canonical_plan: canonicalPlan,
        architecture_dna: architectureDna,
        image_provider: generated.provider,
        image_model: generated.model,
        image_generation_method: generated.generationMethod,
        image_reference_count: generated.referenceCount,
        image_usage: generated.usage,
        image_tier: quality,
        image_quality: generated.quality,
        active_plan_view: "technical",
        technical_assets: assetRecord(generated),
      };
    }
  } else {
    const prompt = String(visual.prompt || "").trim();
    if (!prompt) {
      throw new Error("This visual has no saved image prompt. Refresh Gallery Prompts first.");
    }

    const [{ data: concept }, { data: relatedVisuals }, { data: planSet }] = await Promise.all([
      supabase
        .from("architecture_concepts")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", authenticatedUserId)
        .maybeSingle(),
      supabase
        .from("architecture_visuals")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", authenticatedUserId)
        .eq("direction_id", project.selected_direction_id),
      supabase
        .from("architecture_plan_sets")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", authenticatedUserId)
        .maybeSingle(),
    ]);

    const conceptJson = metadataRecord(concept?.generation_json);
    const planJson = metadataRecord(planSet?.generation_json);
    const architectureDna =
      architectureDnaFrom(visualMetadata) ||
      architectureDnaFrom(conceptJson) ||
      architectureDnaFrom(planJson) ||
      fallbackArchitectureDna(masterDirection);
    const canonicalPlan =
      canonicalPlanFrom(visualMetadata) ||
      canonicalPlanFrom(planJson);

    if (!canonicalPlan && !sourceGeometryLocked) {
      throw new Error("Prepare and approve the connected floor plans before generating architectural visuals.");
    }
    const requiredPlanTypes = [
      "ground_floor",
      ...(canonicalPlan?.levels?.length && canonicalPlan.levels.length > 1 ? ["upper_floor"] : []),
    ];
    const projectPlanRows = (relatedVisuals || []) as Array<Record<string, unknown>>;
    const missingApprovedPlans = sourceGeometryLocked
      ? []
      : requiredPlanTypes.filter((requiredType) => {
          const row = projectPlanRows.find((item) => String(item.visual_type || "") === requiredType);
          const rowMetadata = metadataRecord(row?.metadata);
          const technicalAssets = metadataRecord(rowMetadata.technical_assets);
          return !row || row.is_approved !== true || !(
            technicalAssets.master_storage_path || technicalAssets.preview_url || row.image_url
          );
        });
    if (missingApprovedPlans.length) {
      throw new Error(
        `Approve ${missingApprovedPlans.map((item) => item.replace(/_/g, " ")).join(" and ")} before generating visuals. Visuals must follow the approved floor plans.`,
      );
    }

    const visualAssetKey = `${quality}_assets`;
    assetMetadataKey = visualAssetKey;
    previousAssetMetadata = visualMetadata[visualAssetKey];
    const visualType = String(visual.visual_type || "");
    const currentTargetReference = imageReference({
      label: "Current target view. Use only for camera/material continuity; never override the source drawings.",
      storagePath: preferredMasterPath(visualMetadata, visual.storage_path),
      url: visual.image_url,
    });
    const conceptReference = imageReference({
      label: "Approved Concept reference for the same property.",
      storagePath: preferredMasterPath(conceptJson, conceptJson.image_storage_path),
      url: concept?.image_url,
    });

    const rows = (relatedVisuals || []) as Array<Record<string, unknown>>;
    const relevantSourceReferences = sourceGeometryLocked
      ? sourceReferencesForVisual(orderedSourceDocuments, visualType)
      : [];
    const approvedPlanReferences = sourceGeometryLocked
      ? []
      : requiredPlanTypes.map((requiredType) => {
          const planRow = rows.find((row) => String(row.visual_type || "") === requiredType);
          const planMetadata = metadataRecord(planRow?.metadata);
          const planAssets = metadataRecord(planMetadata.technical_assets);
          return planRow
            ? imageReference({
                label: `Approved ${requiredType.replace(/_/g, " ")} for the exact same project. The architecture, openings, circulation and indoor-outdoor relationships in the visual must remain consistent with this plan.`,
                storagePath: planAssets.master_storage_path,
                url: planAssets.preview_url || planRow.image_url,
              })
            : null;
        });
    const tourPreviousType = group === "tour" && typeof visualMetadata.tour_previous_visual_type === "string"
      ? visualMetadata.tour_previous_visual_type
      : null;
    const relatedType =
      tourPreviousType ||
      (visualType === "night_view" ? "day_view" :
      visualType === "rear_exterior" ? "front_exterior" :
      visualType === "street_view" ? "front_exterior" :
      visualType === "aerial_view" ? "front_exterior" :
      null);
    const related = relatedType
      ? rows.find((row) => row.visual_type === relatedType && row.id !== visual.id)
      : null;
    const relatedMetadata = metadataRecord(related?.metadata);
    const relatedReference = related && (!sourceGeometryLocked || sourceGrounded(relatedMetadata, sourceFingerprint))
      ? imageReference({
          label:
            group === "tour"
              ? "Adjacent room in the same immersive tour. Preserve doorway alignment, material continuity and the same approved property."
              : visualType === "night_view"
                ? "Source-grounded day view. Change lighting and sky only; preserve the exact architecture."
                : "Previously generated SOURCE-GROUNDED coordinated view of the same property.",
          storagePath: preferredMasterPath(relatedMetadata, related.storage_path),
          url: related.image_url,
        })
      : null;
    const currentGroundedReference = !sourceGeometryLocked || sourceGrounded(visualMetadata, sourceFingerprint)
      ? currentTargetReference
      : null;
    const conceptGroundedReference = !sourceGeometryLocked || sourceGrounded(conceptJson, sourceFingerprint)
      ? conceptReference
      : null;

    const generated = await paidGenerate(quality === "final" ? "architectureProfessionalFinal" : "architectureVisual", { target: "visual", quality, visual_type: visual.visual_type }, () => generateAndStoreArchitectureImage({
      supabase,
      userId: authenticatedUserId,
      projectId,
      folder: "visuals",
      filenamePrefix: String(visual.visual_type || "architecture-visual"),
      prompt: sourceGeometryLocked
        ? [
            existingDesignVisualPrompt({
              visualType,
              title: String(visual.title || visual.visual_type || "Architecture Visual"),
              direction: masterDirection,
              sourceBrief: project.source_brief,
            }),
            group === "tour"
              ? "TOUR OUTPUT RULES: create one immersive room panorama with a level horizon and camera at eye height. Derive door/window/circulation positions from the source plans only."
              : "",
          ].filter(Boolean).join("\n\n")
        : [
            prompt,
            group === "tour"
              ? "TOUR OUTPUT RULES: create one immersive room panorama with a level horizon, camera at eye height and strong continuity at the left and right edges. Preserve all approved door, window and circulation positions. This is one node in a connected room-to-room tour, not an unrelated interior redesign."
              : "",
            canonicalPlan
              ? `Canonical site and plan relationship: ${JSON.stringify(canonicalPlan)}`
              : "",
          ].filter(Boolean).join("\n\n"),
      plan,
      architectureDna: sourceGeometryLocked ? null : architectureDna,
      sourceGeometryReferences: relevantSourceReferences,
      preserveSourceGeometry: sourceGeometryLocked,
      referenceImages: sourceGeometryLocked
        ? uniqueReferences([
            currentGroundedReference,
            relatedReference,
          ])
        : uniqueReferences([
            ...approvedPlanReferences,
            masterReference,
            currentTargetReference,
            relatedReference,
            conceptGroundedReference,
          ]),
      targetRole: sourceGeometryLocked
        ? `Generate only the ${String(visual.title || visual.visual_type)} view of the EXISTING uploaded design. SOURCE GEOMETRY references define the building. Style references may affect materials, colour, landscape and lighting only.`
        : group === "tour"
          ? `Generate only the ${String(visual.title || visual.visual_type)} immersive tour node of the same locked property. Keep the room navigable and visually continuous with adjacent tour nodes.`
          : `Generate only the ${String(visual.title || visual.visual_type)} view of the same locked property.`,
      tier: quality,
    }));
    imageUrl = generated.imageUrl;
    storagePath = generated.storagePath;
    imageMetadata = {
      architecture_dna: architectureDna,
      canonical_plan: canonicalPlan,
      image_usage: generated.usage,
      image_reference_count: generated.referenceCount,
      image_generation_method: generated.generationMethod,
      image_tier: quality,
      image_quality: generated.quality,
      source_geometry_locked: sourceGeometryLocked,
      source_reference_fingerprint: sourceGeometryLocked ? sourceFingerprint : null,
      source_geometry_stale: false,
      source_reference_categories: sourceGeometryLocked
        ? orderedSourceDocuments.map((document) => String(document.category || "source"))
        : [],
      [visualAssetKey]: assetRecord(generated),
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from("architecture_visuals")
    .update({
      image_url: imageUrl,
      storage_path: storagePath,
      is_approved: false,
      metadata: {
        ...visualMetadata,
        ...imageMetadata,
        mode,
        image_model: imageModel,
        visual_continuity_version: 2,
        master_direction_id: project.selected_direction_id,
        master_direction_storage_path: masterReference?.storagePath || null,
        image_variation: Number(visualMetadata.image_variation || 0) + 1,
        image_regenerated_at: new Date().toISOString(),
      },
    })
    .eq("id", targetId)
    .eq("project_id", projectId)
    .eq("user_id", authenticatedUserId)
    .select("*")
    .single();
  if (updateError || !updated) {
    if (assetMetadataKey) await removeStoredAssets(supabase, imageMetadata[assetMetadataKey]);
    throw new Error(updateError?.message || "Architecture visual could not be saved.");
  }
  if (previousAssetMetadata) await removeStoredAssets(supabase, previousAssetMetadata);
  if (!assetMetadataKey && previousPath) {
    await removePreviousStorage(supabase, previousPath, storagePath);
  }
  return {
    success: true,
    mode,
    targetType,
    quality,
    planMode: group === "plans" ? planMode : undefined,
    visual: updated,
  };
}
