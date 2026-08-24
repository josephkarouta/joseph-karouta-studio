import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  generateBrandLogo,
  generateBrandLogoVariation,
  generateBrandMoodboard,
  generateBrandMoodboardVariation,
} from "./brand-image-generators";
import { generateBrandApplicationVisual } from "./application-visual-generator";
import type { BrandImageStorageContext } from "./brand-image-storage";
import type { BrandImageJobTool } from "./brand-image-job-start";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";

const BRAND_IMAGE_TOOLS: BrandImageJobTool[] = [
  "brand_logo",
  "brand_logo_variation",
  "brand_moodboard",
  "brand_moodboard_variation",
  "brand_application_visual",
];

type JobInput = Record<string, any> & { credits?: number };

type ProjectAssetRow = {
  id: string;
  file_url?: string | null;
};

export async function processBrandImageJob(jobId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Brand background generation is not configured.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: jobError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .in("tool", BRAND_IMAGE_TOOLS)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message || "Brand generation job could not be loaded.");
  if (!existing) throw new Error("Brand generation job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existing.status || ""))) return;
  if (String(existing.status || "") !== "queued") return;

  const { data: claimed, error: claimError } = await admin
    .from("generation_jobs")
    .update({ status: "processing", error: null })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message || "Brand generation job could not be started.");
  if (!claimed) return;

  const input = (claimed.input || {}) as JobInput;
  const userId = String(claimed.user_id || "");
  const projectId = String(claimed.project_id || input?.project?.id || "");
  const tool = String(claimed.tool || "") as BrandImageJobTool;

  if (!userId || !projectId || !BRAND_IMAGE_TOOLS.includes(tool)) {
    await failJob(admin, claimed, "Brand generation job data is incomplete.");
    return;
  }

  const { data: project, error: projectError } = await admin
    .from("brand_projects")
    .select("id,user_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (projectError || !project) {
    await failJob(admin, claimed, projectError?.message || "The Brand project could not be found.");
    return;
  }

  const storageContext: BrandImageStorageContext = { admin, userId, projectId };
  let result: any = null;
  let asset: ProjectAssetRow | null = null;
  let creditsCommitted = false;

  try {
    result = await runGeneration(tool, storageContext, input);
    asset = await persistProjectAsset(admin, {
      jobId,
      tool,
      userId,
      projectId,
      input,
      result,
    });

    const completedOutput = {
      result: {
        ...result,
        assetId: asset.id,
        creditsUsed: Number(input.credits || 0),
      },
      asset_id: asset.id,
      credits_used: Number(input.credits || 0),
    };

    await completeGenerationJob(admin, jobId, completedOutput, {
      studio: "brand_studio",
      tool,
      project_id: projectId,
      asset_id: asset.id,
      provider: claimed.provider || "openai",
    });
    creditsCommitted = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Brand image generation failed.";

    if (!creditsCommitted) {
      await failGenerationJob(admin, {
        jobId,
        expectedStatus: "processing",
        reason: message,
        publicError: publicGenerationError(message),
      });
      if (asset?.id) {
        await admin.from("project_assets").delete().eq("id", asset.id);
      }
      await removeGeneratedFiles(admin, result);

    }

    console.error("Brand image background error:", { jobId, tool, message });
  }
}

async function runGeneration(
  tool: BrandImageJobTool,
  storageContext: BrandImageStorageContext,
  input: JobInput,
) {
  switch (tool) {
    case "brand_logo":
      return generateBrandLogo(storageContext, input);
    case "brand_logo_variation":
      return generateBrandLogoVariation(storageContext, input);
    case "brand_moodboard":
      return generateBrandMoodboard(storageContext, input);
    case "brand_moodboard_variation":
      return generateBrandMoodboardVariation(storageContext, input);
    case "brand_application_visual":
      return generateBrandApplicationVisual(storageContext, input);
    default:
      throw new Error("Unsupported Brand image generation job.");
  }
}

async function persistProjectAsset(
  admin: SupabaseClient,
  args: {
    jobId: string;
    tool: BrandImageJobTool;
    userId: string;
    projectId: string;
    input: JobInput;
    result: any;
  },
): Promise<ProjectAssetRow> {
  const projectName = String(args.input?.project?.project_name || "Brand Project");
  const base = {
    user_id: args.userId,
    project_id: args.projectId,
    project_type: "brand",
  };

  let row: Record<string, unknown>;

  if (args.tool === "brand_logo") {
    const directionIndex = integerOr(args.input?.directionIndex, 0);
    const logo = args.result?.logos?.[0];
    if (!logo?.imageUrl) throw new Error("The generated logo was not saved.");
    const nextConcepts: Record<string, any> = {
      ...(objectOrEmpty(args.input?.existingConcepts)),
      [directionIndex]: {
        ...logo,
        directionIndex,
        tier: args.input?.tier === "final" ? "final" : "preview",
        variation: null,
      },
    };
    row = {
      ...base,
      asset_type: "logo_concept",
      title: `Logo Concept - ${String(args.input?.logoDirection?.title || `Direction ${directionIndex + 1}`)}`,
      input_payload: {
        projectName,
        logoDirection: args.input?.logoDirection || null,
        creativeDirection: args.input?.creativeDirection || null,
        generationJobId: args.jobId,
      },
      output_payload: {
        generationJobId: args.jobId,
        conceptsByDirection: nextConcepts,
        selectedDirection: directionIndex,
        directionIndex,
        selectedLogo: directionIndex,
        logos: [nextConcepts[directionIndex]],
      },
      file_url: logo.imageUrl,
      thumbnail_url: logo.imageUrl,
    };
  } else if (args.tool === "brand_logo_variation") {
    const directionIndex = integerOr(args.input?.directionIndex, 0);
    const variation = args.result?.variations?.[0];
    if (!variation?.imageUrl) throw new Error("The generated logo variation was not saved.");
    const selectedLogo = objectOrEmpty(args.input?.selectedLogo);
    const nextLogo = {
      ...selectedLogo,
      variation: { imageUrl: variation.imageUrl, storagePath: variation.storagePath || null },
    };
    const nextConcepts: Record<string, any> = {
      ...(objectOrEmpty(args.input?.existingConcepts)),
      [directionIndex]: nextLogo,
    };
    const selectedDirection = Number.isInteger(args.input?.selectedLogoDirection)
      ? Number(args.input.selectedLogoDirection)
      : directionIndex;
    row = {
      ...base,
      asset_type: "logo_variation",
      title: `Logo Variation - ${String(args.input?.logoDirection?.title || `Direction ${directionIndex + 1}`)}`,
      input_payload: {
        projectName,
        logoDirection: args.input?.logoDirection || null,
        generationJobId: args.jobId,
      },
      output_payload: {
        generationJobId: args.jobId,
        conceptsByDirection: nextConcepts,
        selectedDirection,
        directionIndex: selectedDirection,
        selectedLogo: selectedDirection,
        logos: nextConcepts[selectedDirection] ? [nextConcepts[selectedDirection]] : [],
      },
      file_url: variation.imageUrl,
      thumbnail_url: variation.imageUrl,
    };
  } else if (args.tool === "brand_moodboard") {
    const directionIndex = integerOr(args.input?.directionIndex, 0);
    if (!args.result?.imageUrl) throw new Error("The creative-direction visual was not saved.");
    const directions = arrayOrEmpty(args.input?.directions);
    const nextDirections = directions.length
      ? directions.map((item, index) => index === directionIndex
          ? { ...item, imageUrl: args.result.imageUrl, imageTier: args.input?.tier === "final" ? "final" : "preview", variation: null }
          : item)
      : [{ ...(args.input?.direction || {}), imageUrl: args.result.imageUrl, imageTier: args.input?.tier === "final" ? "final" : "preview", variation: null }];
    const selectedMoodboard = Number.isInteger(args.input?.selectedMoodboard)
      ? Number(args.input.selectedMoodboard)
      : null;
    row = {
      ...base,
      asset_type: "moodboard",
      title: `Creative Direction Visual - ${String(args.input?.direction?.title || `Direction ${directionIndex + 1}`)}`,
      input_payload: {
        projectName,
        industry: args.input?.project?.industry || null,
        audience: args.input?.project?.audience || null,
        style: args.input?.project?.style || null,
        generationJobId: args.jobId,
      },
      output_payload: {
        generationJobId: args.jobId,
        selectedMoodboard,
        directions: nextDirections,
        moodboards: nextDirections,
        selectedConcept: selectedMoodboard !== null ? nextDirections[selectedMoodboard] || null : null,
      },
      file_url: args.result.imageUrl,
      thumbnail_url: args.result.imageUrl,
    };
  } else if (args.tool === "brand_moodboard_variation") {
    const directionIndex = integerOr(args.input?.directionIndex, 0);
    const variation = args.result?.variations?.[0];
    if (!variation?.imageUrl) throw new Error("The direction variation was not saved.");
    const directions = arrayOrEmpty(args.input?.directions);
    const nextDirections = directions.length
      ? directions.map((item, index) => index === directionIndex
          ? { ...item, variation: { imageUrl: variation.imageUrl, storagePath: variation.storagePath || null } }
          : item)
      : [{ ...(args.input?.direction || {}), variation: { imageUrl: variation.imageUrl, storagePath: variation.storagePath || null } }];
    const selectedMoodboard = Number.isInteger(args.input?.selectedMoodboard)
      ? Number(args.input.selectedMoodboard)
      : null;
    row = {
      ...base,
      asset_type: "moodboard_variations",
      title: `Creative Direction Variation - ${String(args.input?.direction?.title || `Direction ${directionIndex + 1}`)}`,
      input_payload: {
        projectName,
        generationJobId: args.jobId,
      },
      output_payload: {
        generationJobId: args.jobId,
        selectedMoodboard,
        directions: nextDirections,
        moodboards: nextDirections,
        selectedConcept: selectedMoodboard !== null ? nextDirections[selectedMoodboard] || null : null,
      },
      file_url: variation.imageUrl,
      thumbnail_url: variation.imageUrl,
    };
  } else {
    const first = args.result?.outputs?.[0] || args.result;
    if (!first?.imageUrl) throw new Error("The generated application visual was not saved.");
    const application = args.input?.application || {};
    const nextVisual = {
      applicationId: args.result?.applicationId || application?.id,
      applicationLabel: args.result?.applicationLabel || application?.label,
      imageUrl: first.imageUrl,
      storagePath: first.storagePath || args.result?.storagePath || null,
      width: first.width || args.result?.width || null,
      height: first.height || args.result?.height || null,
      outputs: Array.isArray(args.result?.outputs) ? args.result.outputs : [first],
      exactSize: Boolean(args.result?.exactSize),
      mockup: Boolean(args.result?.mockup),
      tier: "concept",
      logoPreserved: Boolean(args.result?.logoPreserved || args.input?.logoReferenceUrl),
      creativeDirectionApplied: Boolean(
        args.result?.creativeDirectionApplied || args.input?.selectedDirection || args.input?.directionReferenceUrl,
      ),
      selectedDirectionTitle:
        args.input?.selectedDirection?.title || args.input?.selectedDirection?.conceptName || null,
      creditsUsed: Number(args.input?.credits || 0),
      generatedAt: new Date().toISOString(),
      approved: false,
      approval: null,
      generationJobId: args.jobId,
    };
    row = {
      ...base,
      asset_type: "brand_application_visual",
      title: `${String(application?.label || "Application")} AI Visual - ${projectName}`,
      input_payload: {
        applicationId: application?.id || null,
        applicationLabel: application?.label || null,
        applicationBrief: args.input?.brief || {},
        applicationPlan: args.input?.plan || null,
        logoReferenceUrl: args.input?.logoReferenceUrl || null,
        directionReferenceUrl: args.input?.directionReferenceUrl || null,
        selectedDirection: args.input?.selectedDirection || null,
        referenceImageUrls: args.input?.referenceImageUrls || [],
        generationJobId: args.jobId,
      },
      output_payload: nextVisual,
      file_url: nextVisual.imageUrl,
      thumbnail_url: nextVisual.imageUrl,
    };
  }

  const { data, error } = await admin.from("project_assets").insert(row).select("id,file_url").single();
  if (error || !data) {
    throw new Error(`Brand project asset could not be saved: ${error?.message || "Unknown error"}`);
  }
  return data as ProjectAssetRow;
}

async function failJob(admin: SupabaseClient, claimed: any, message: string) {
  await failGenerationJob(admin, {
    jobId: String(claimed.id),
    expectedStatus: "processing",
    reason: message,
    publicError: publicGenerationError(message),
  });
  console.error("Brand image background error:", message);
}

async function removeGeneratedFiles(admin: SupabaseClient, result: any) {
  const paths = new Set<string>();
  collectStoragePaths(result, paths);
  if (!paths.size) return;
  const { error } = await admin.storage.from("project-assets").remove(Array.from(paths));
  if (error) console.error("Brand image cleanup failed:", error.message);
}

function collectStoragePaths(value: unknown, paths: Set<string>) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectStoragePaths(item, paths));
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.storagePath === "string" && record.storagePath.trim()) {
    paths.add(record.storagePath.trim());
  }
  Object.values(record).forEach((item) => collectStoragePaths(item, paths));
}

function publicGenerationError(message: string) {
  if (/content|safety|policy|moderation/i.test(message)) {
    return "This Brand image request could not be completed. Try adjusting the brief or reference image.";
  }
  if (/reference|logo.*load|image.*unavailable/i.test(message)) {
    return "A Brand reference image could not be loaded. Re-select the logo or creative direction and try again. Your credits were returned.";
  }
  return "Brand image generation could not be completed. Your credits were returned.";
}

function objectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function arrayOrEmpty(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function integerOr(value: unknown, fallback: number) {
  return Number.isInteger(value) ? Number(value) : fallback;
}
