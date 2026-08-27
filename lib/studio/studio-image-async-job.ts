import { randomUUID } from "node:crypto";
import OpenAI, { toFile } from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";

type StudioId = "interior" | "marketing";
type InteriorImageType = "space_plan" | "furniture_plan" | "lighting_plan" | "main_space" | "alternate_angle" | "focal_point" | "material_detail" | "day_view" | "evening_view";
type MarketingVisualType = "key_visual" | "social_feed" | "story_cover" | "carousel_cover" | "landing_hero" | "email_header" | "display_ad" | "outdoor_poster";
type GenerationStage = "technical" | "preview" | "final";

type StudioImageJobInput = {
  studio?: StudioId;
  projectId?: string;
  viewType?: InteriorImageType | MarketingVisualType;
  stage?: GenerationStage;
  tweak?: string | null;
  credits?: number;
  sourcePlanImageUrls?: string[];
  roomKey?: string | null;
  roomName?: string | null;
  floorLabel?: string | null;
  roomNotes?: string | null;
  sourcePlanAssetId?: string | null;
};

const INTERIOR_PLAN_LABELS: Record<string, string> = {
  space_plan: "Furniture & Space Plan",
  furniture_plan: "Furniture Placement Plan",
  lighting_plan: "Lighting & Ceiling Plan",
};
const INTERIOR_VISUAL_LABELS: Record<string, string> = {
  main_space: "Main Space Perspective",
  alternate_angle: "Alternative Angle",
  focal_point: "Feature Wall & Joinery View",
  material_detail: "Materials & Lighting Detail",
  day_view: "Daylight Atmosphere",
  evening_view: "Evening Atmosphere",
};
const MARKETING_VISUALS: Record<string, { label: string; format: string; size: "1024x1024" | "1536x1024" | "1024x1536" }> = {
  key_visual: { label: "Campaign Key Visual", format: "master campaign image", size: "1536x1024" },
  social_feed: { label: "Social Feed Ad", format: "square social feed creative", size: "1024x1024" },
  story_cover: { label: "Story / Reel Cover", format: "vertical story or reel cover", size: "1024x1536" },
  carousel_cover: { label: "Carousel Cover", format: "square carousel cover", size: "1024x1024" },
  landing_hero: { label: "Landing-Page Hero", format: "wide website landing-page hero", size: "1536x1024" },
  email_header: { label: "Email Header", format: "wide email campaign header", size: "1536x1024" },
  display_ad: { label: "Display Ad", format: "clean digital display-ad composition", size: "1536x1024" },
  outdoor_poster: { label: "Outdoor / Poster", format: "vertical outdoor poster concept", size: "1024x1536" },
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Studio image background generation is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function processStudioImageJob(jobId: string) {
  const admin = adminClient();
  const { data: existing, error: loadError } = await admin.from("generation_jobs").select("*").eq("id", jobId).eq("tool", "studio_image").maybeSingle();
  if (loadError) throw new Error(loadError.message || "Studio image job could not be loaded.");
  if (!existing) throw new Error("Studio image job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existing.status || ""))) return;
  if (String(existing.status || "") !== "queued") return;

  const { data: claimed, error: claimError } = await admin.from("generation_jobs").update({ status: "processing", error: null }).eq("id", jobId).eq("status", "queued").select("*").maybeSingle();
  if (claimError) throw new Error(claimError.message || "Studio image job could not be started.");
  if (!claimed) return;

  const input = (claimed.input || {}) as StudioImageJobInput;
  const studio = input.studio;
  const userId = String(claimed.user_id || "").trim();
  const projectId = String(input.projectId || claimed.project_id || "").trim();
  let assetId: string | null = null;
  let assetUrl: string | null = null;
  let creditsCommitted = false;

  try {
    if (!(studio === "interior" || studio === "marketing") || !userId || !projectId) throw new Error("Studio image job data is incomplete.");
    if (!process.env.OPENAI_API_KEY) throw new Error("AI image generation is not configured.");

    const { data: project, error: projectError } = await admin.from("studio_projects").select("id,user_id,studio,project_name,project_type,input,output").eq("id", projectId).eq("user_id", userId).eq("studio", studio === "interior" ? "interior_studio" : "marketing_studio").single();
    if (projectError || !project) throw new Error(projectError?.message || "Studio project not found.");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const reservationId = claimed.credit_reservation_id ? String(claimed.credit_reservation_id) : null;
    const generated = studio === "interior"
      ? await generateInteriorImage(admin, openai, userId, project, input, reservationId)
      : await generateMarketingImage(admin, openai, userId, project, input, reservationId);

    assetId = String(generated.asset.id);
    assetUrl = String(generated.asset.file_url || "") || null;

    await completeGenerationJob(admin, jobId, {
      asset_id: assetId,
      asset_url: assetUrl,
      credits_used: Number(input.credits || 0),
      stage: input.stage || null,
      view_type: input.viewType || null,
    }, {
      studio: project.studio,
      project_id: projectId,
      tool: "studio_image",
      asset_id: assetId,
      provider: "openai",
    });
    creditsCommitted = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio image generation failed.";
    if (!creditsCommitted) {
      await failGenerationJob(admin, {
        jobId,
        expectedStatus: "processing",
        reason: message,
        publicError: publicError(studio, message),
      });
      if (assetId) await deleteAsset(admin, assetId);
    }
    console.error("Studio image background error:", { jobId, studio, message });
  }
}

async function generateInteriorImage(admin: SupabaseClient, openai: OpenAI, userId: string, project: any, input: StudioImageJobInput, reservationId: string | null) {
  const imageType = String(input.viewType || "") as InteriorImageType;
  const stage = (input.stage || "preview") as GenerationStage;
  const isPlan = Boolean(INTERIOR_PLAN_LABELS[imageType]);
  const label = isPlan ? INTERIOR_PLAN_LABELS[imageType] : INTERIOR_VISUAL_LABELS[imageType];
  if (!label) throw new Error("Invalid Interior image type.");

  const prompt = buildInteriorImagePrompt(String(project.project_name || "Interior project"), imageType, stage, project.input || {}, project.output || {}, input);
  const references = await loadInteriorReferences(admin, userId, String(project.id), imageType, stage, project.input || {}, input);
  const common = { model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", prompt, size: "1536x1024" as const, quality: stage === "final" ? "high" as const : "medium" as const, output_format: "png" as const };
  const image = references.length ? await openai.images.edit({ ...common, image: references.length === 1 ? references[0] : references }) : await openai.images.generate(common);
  const base64 = image.data?.[0]?.b64_json;
  if (!base64) throw new Error("The image provider returned no image.");

  const outputKind = isPlan ? "plan" : "visual";
  const roomName = String(input.roomName || "").trim();
  const floorLabel = String(input.floorLabel || "").trim();
  const roomKey = String(input.roomKey || "").trim();
  const sourcePlanAssetId = String(input.sourcePlanAssetId || "").trim();
  const roomTitle = roomName ? `${floorLabel ? `${floorLabel} · ` : ""}${roomName} — ` : "";
  const asset = await storeGeneratedAsset(admin, {
    userId,
    projectId: String(project.id),
    studio: "interior_studio",
    assetType: `interior_${outputKind}_${imageType}_${stage}`,
    title: `${project.project_name || "Interior project"} — ${roomTitle}${label}`,
    buffer: Buffer.from(base64, "base64"),
    payload: { prompt, imageType, stage, projectName: project.project_name, roomKey: roomKey || null, roomName: roomName || null, floorLabel: floorLabel || null, sourcePlanAssetId: sourcePlanAssetId || null },
    metadata: {
      view_type: imageType,
      output_kind: outputKind,
      stage,
      approved: false,
      source: "interior_studio",
      credit_reservation_id: reservationId,
      connected_architecture_id: architectureProjectIdFromInput(project.input || {}) || null,
      room_key: roomKey || null,
      room_name: roomName || null,
      floor_label: floorLabel || null,
      room_notes: String(input.roomNotes || "").trim() || null,
      source_plan_asset_id: sourcePlanAssetId || null,
      plan_guided: Boolean(roomKey && sourcePlanAssetId),
    },
  });

  await admin.from("studio_projects").update({ progress: stage === "final" ? 94 : isPlan ? 86 : 92, current_step: stage === "final" ? `${outputKind}_final_ready` : `${outputKind}_${stage}_ready` }).eq("id", project.id).eq("user_id", userId);
  return { asset };
}

async function generateMarketingImage(admin: SupabaseClient, openai: OpenAI, userId: string, project: any, input: StudioImageJobInput, reservationId: string | null) {
  const viewType = String(input.viewType || "") as MarketingVisualType;
  const stage = input.stage === "final" ? "final" : "preview";
  const definition = MARKETING_VISUALS[viewType];
  if (!definition) throw new Error("Invalid Marketing visual type.");
  const tweak = String(input.tweak || "").trim().slice(0, 1000);
  const prompt = buildMarketingVisualPrompt(String(project.project_name || "Marketing campaign"), viewType, stage, project.input || {}, project.output || {}, tweak);
  const references = await loadMarketingReferences(admin, userId, String(project.id), viewType, stage, Boolean(tweak), project.input || {});
  const common = { model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", prompt, size: definition.size, quality: stage === "final" ? "high" as const : "medium" as const, output_format: "png" as const };
  const generated = references.length ? await openai.images.edit({ ...common, image: references.length === 1 ? references[0] : references }) : await openai.images.generate(common);
  const base64 = generated.data?.[0]?.b64_json;
  if (!base64) throw new Error("The image provider returned no campaign image.");

  const asset = await storeGeneratedAsset(admin, {
    userId,
    projectId: String(project.id),
    studio: "marketing_studio",
    assetType: `marketing_visual_${viewType}_${stage}`,
    title: `${project.project_name || "Marketing campaign"} — ${definition.label}`,
    buffer: Buffer.from(base64, "base64"),
    payload: { prompt, viewType, stage, tweak: tweak || null, projectName: project.project_name },
    metadata: { view_type: viewType, output_kind: "visual", stage, approved: false, source: "marketing_studio", format: definition.format, credit_reservation_id: reservationId, connected_brand_id: brandProjectIdFromInput(project.input || {}) || null },
  });

  await admin.from("studio_projects").update({ progress: stage === "final" ? 95 : 90, current_step: `visual_${viewType}_${stage}_ready` }).eq("id", project.id).eq("user_id", userId).eq("studio", "marketing_studio");
  return { asset };
}

function buildInteriorImagePrompt(projectName: string, imageType: InteriorImageType, stage: GenerationStage, input: Record<string, unknown>, output: Record<string, unknown>, jobInput: StudioImageJobInput = {}) {
  const planInstruction: Record<string, string> = {
    space_plan: "Create a complete top-down interior furniture and space plan showing the full boundary, walls, openings, doors with swings, windows, circulation paths, built-in joinery, furniture, rugs, room labels and key dimensions. Show the complete drawing inside the canvas with generous margins.",
    furniture_plan: "Create a coordinated top-down furniture placement plan. Preserve every wall, opening, door, window and circulation route from the approved Furniture & Space Plan. Add furniture footprints, item labels, quantities, rug extents and critical clearances.",
    lighting_plan: "Create a professional reflected ceiling and lighting plan. Preserve the approved room geometry and furniture layout. Show ceiling zones, recessed lights, pendants, wall lights, decorative fixtures, indirect lighting, switching groups and a concise symbol legend.",
  };
  const visualInstruction: Record<string, string> = {
    main_space: "Create the primary room concept perspective. Keep the selected room's plan topology, architectural openings and adjacencies recognisable while applying the approved interior direction.",
    alternate_angle: "Create a second perspective of the SAME mapped room from another useful camera position. Preserve the approved Main Concept's furniture, materials, lighting language and architectural relationships.",
    focal_point: "Create a deliberately tighter feature-focused view of the SAME mapped room. Focus on one joinery, feature-wall, material or crafted interior moment while preserving continuity with the approved Main Concept.",
    material_detail: "Create a true close-up editorial detail of the same approved room, concentrating on one or two material or lighting junctions instead of another room-wide perspective.",
    day_view: "Create a daylight interpretation of the same approved room while preserving its plan relationships, furniture and materials.",
    evening_view: "Create an evening interpretation of the same approved room with layered artificial lighting while preserving its plan relationships, furniture and materials.",
  };
  const isPlan = Boolean(planInstruction[imageType]);
  const roomKey = String(jobInput.roomKey || "").trim();
  const roomName = String(jobInput.roomName || "").trim();
  const floorLabel = String(jobInput.floorLabel || "").trim();
  const roomNotes = String(jobInput.roomNotes || "").trim();
  const planGuidedRoom = Boolean(!isPlan && roomKey && roomName && jobInput.sourcePlanAssetId);
  const stageInstruction = stage === "technical"
    ? "LEGACY TECHNICAL STAGE: prioritise accurate geometry, readable symbols, dimensions, openings, furniture footprints and coordination."
    : stage === "final"
      ? "PROFESSIONAL FINAL STAGE: improve image quality and realism without changing approved room identity or plan relationships."
      : isPlan
        ? "PREVIEW STAGE: create the primary AI plan output with clear geometry and presentation."
        : planGuidedRoom
          ? "PLAN-GUIDED CONCEPT STAGE: create a high-quality interior concept for the selected mapped room. The plan is a spatial reference, not permission to invent a different room."
          : "PREVIEW STAGE: create a refined concept-quality render. Preserve geometry, furniture placement, materials and lighting direction as closely as the supplied references allow.";
  const label = isPlan ? INTERIOR_PLAN_LABELS[imageType] : INTERIOR_VISUAL_LABELS[imageType];
  const detailReferenceRule = !isPlan && (imageType === "focal_point" || imageType === "material_detail")
    ? "- For this detail-focused output, keep the approved room identity but move the virtual camera much closer to the requested feature."
    : "";
  const brief = sanitizePromptValue(input);
  const concept = sanitizePromptValue({ conceptSummary: output.conceptSummary, designDirection: output.designDirection, layoutPlan: output.layoutPlan, materialPalette: output.materialPalette, furniturePlan: output.furniturePlan, lightingPlan: output.lightingPlan, colorPalette: output.colorPalette, stylingNotes: output.stylingNotes, procurementPriorities: output.procurementPriorities, visualPrompt: output.visualPrompt, professionalPackage: output.professionalPackage });
  const mappedRoom = planGuidedRoom
    ? `\nSELECTED PLAN / ROOM\nFloor or plan: ${floorLabel || "Uploaded plan"}\nRoom or zone: ${roomName}\n${roomNotes ? `Locator note: ${roomNotes}\n` : ""}The FIRST supplied reference image is the specific uploaded plan mapped to this room. Use it as the primary spatial reference.\n`
    : "";
  const planGuidedRules = planGuidedRoom
    ? `- Render ONLY the selected room or its directly connected open-plan zone; do not reinterpret unrelated floors or rooms.\n- Use the room name and locator note to locate the correct zone on the selected plan.\n- Keep visible room boundaries, door/window positions, major openings, circulation and adjacency relationships recognisable from the plan.\n- Do not move the room to another side of the plan, invent a different open-plan relationship, or merge unrelated spaces.\n- The plan may not define wall elevations, exact heights, joinery or every furniture detail. Interpret those visually from the approved interior direction without changing the room's core topology.\n- For alternate/detail views, the approved Main Concept is a continuity reference for materials, furniture and room identity; the selected plan remains the spatial reference.\n- This is plan-guided concept imagery, not an exact BIM/3D reconstruction.`
    : "";
  const prompt = `Create a premium ${isPlan ? "interior plan" : "interior visual"} for Heyy Studio.\n\nPROJECT\n${projectName}\n\nOUTPUT\n${label}\n${stageInstruction}\n${isPlan ? planInstruction[imageType] : visualInstruction[imageType]}\n${mappedRoom}\nSAVED PROJECT BRIEF\n${promptJson(brief, 10000)}\n\nAPPROVED INTERIOR CONCEPT\n${promptJson(concept, 10000)}\n\nNON-NEGOTIABLE CONSISTENCY RULES\n- Treat supplied reference images as the source of truth for approved spatial and design decisions.\n${planGuidedRules}\n- If this Interior project is connected to Architecture Studio, supplied architecture plans remain important geometry references.\n- Use the saved materials, colour palette, furniture and lighting as one connected design system.\n- Do not invent a completely different architectural space between related views.\n- No fake logos, watermarks, moodboard collages or split-screen presentations.\n${detailReferenceRule}\n- Plans must show the entire drawing with generous margins and never crop labels, dimensions or legends.\n- Visuals must be one complete full-frame image with professional architectural photography and no fake text.`;
  return prompt.length <= 30000 ? prompt : `${prompt.slice(0, 29600)}\n\n[Context shortened automatically to stay within the image model prompt limit.]`;
}

function buildMarketingVisualPrompt(projectName: string, viewType: MarketingVisualType, stage: "preview" | "final", input: Record<string, unknown>, output: Record<string, unknown>, tweak: string) {
  const definition = MARKETING_VISUALS[viewType];
  const prompts = output.visualPrompts && typeof output.visualPrompts === "object" ? output.visualPrompts as Record<string, unknown> : {};
  const specificPrompt = compactText(prompts[viewType], 4000);
  const stageInstruction = stage === "final"
    ? "Create a polished professional-final campaign image with refined art direction, premium detail, controlled lighting and production-quality composition. Preserve the approved campaign system and any supplied reference image."
    : "Create a strong campaign preview that clearly communicates the selected creative direction and can be reviewed before professional finalisation.";
  const compactInput = compactMarketingInput(input);
  const compactOutput = compactMarketingOutput(output, viewType);
  const prompt = `Create a ${definition.format} for Heyy Studio's Marketing Studio.\n\nCAMPAIGN\n${projectName}\n\nSTAGE\n${stage === "final" ? "Professional Final" : "Preview"}\n${stageInstruction}\n\nFORMAT-SPECIFIC DIRECTION\n${specificPrompt || "Translate the saved campaign strategy and creative brief into this format."}\n\n${tweak ? `USER TWEAK\nApply this requested adjustment while preserving the campaign system and everything not mentioned:\n${tweak}\n\n` : ""}CAMPAIGN INPUT\n${JSON.stringify(compactInput, null, 2)}\n\nAPPROVED CAMPAIGN SYSTEM\n${JSON.stringify(compactOutput, null, 2)}\n\nNON-NEGOTIABLE RULES\n- Use the saved big idea, audience insight, offer, message hierarchy, tone and visual direction as one connected system.\n- If a connected brand system exists, respect its colours, typography mood, positioning and image language.\n- Use supplied Brand Studio images as visual references; do not repeat their URLs or metadata in the artwork.\n- Create one clean full-frame composition, not a moodboard, split screen or presentation sheet.\n- Do not invent a different product, audience, offer or campaign concept.\n- Avoid fake logos, illegible body copy, random watermarks and unapproved claims.\n- Reserve intentional clean space where real campaign copy may later be typeset.\n- The image must fill the canvas without cropping the main subject or essential composition.`;
  return prompt.length <= 30000 ? prompt : `${prompt.slice(0, 29750)}\n\n[Project context compacted to fit the image-generation limit.]`;
}

async function loadInteriorReferences(admin: SupabaseClient, userId: string, projectId: string, imageType: InteriorImageType, stage: GenerationStage, input: Record<string, unknown>, jobInput: StudioImageJobInput = {}) {
  const refs: any[] = [];
  const roomKey = String(jobInput.roomKey || "").trim();
  const selectedPlanAssetId = String(jobInput.sourcePlanAssetId || "").trim();

  if (selectedPlanAssetId) {
    const loaded = await addSelectedInteriorPlanReference(admin, refs, projectId, selectedPlanAssetId);
    if (!loaded) throw new Error("The mapped room's uploaded plan image could not be loaded for visual generation.");
  } else {
    await addUploadedInteriorPlanReferences(admin, refs, projectId, input, 6);
  }

  const connectedArchitectureId = architectureProjectIdFromInput(input);
  if (connectedArchitectureId && !selectedPlanAssetId) {
    await addArchitectureSourceDrawings(admin, userId, connectedArchitectureId, imageType, refs, 5);
    if (!refs.length) {
      const { data: rows } = await admin.from("architecture_visuals").select("visual_type,image_url,is_approved,created_at").eq("project_id", connectedArchitectureId).eq("user_id", userId).in("visual_type", ["ground_floor", "upper_floor", "site_plan", "functional_zoning", "front_elevation", "rear_elevation", "section"]).order("is_approved", { ascending: false }).order("created_at", { ascending: false }).limit(20);
      const order = ["ground_floor", "upper_floor", "section", "front_elevation", "rear_elevation", "site_plan", "functional_zoning"];
      for (const type of order) {
        const row = (rows || []).find((r: any) => r.visual_type === type && r.image_url);
        if (row?.image_url) await pushUrlRef(refs, String(row.image_url), `architecture-${type}.png`);
        if (refs.length >= 5) break;
      }
    }
  }

  const isPlan = Boolean(INTERIOR_PLAN_LABELS[imageType]);
  if (roomKey) {
    if (stage === "final") await addInteriorAssetRef(admin, refs, projectId, imageType, ["preview"], false, roomKey);
    if (!isPlan && imageType !== "main_space") await addInteriorAssetRef(admin, refs, projectId, "main_space", ["final", "preview"], true, roomKey);
  } else {
    if (stage === "preview" || stage === "final") await addInteriorAssetRef(admin, refs, projectId, imageType, ["preview", "technical"], false);
    if ((isPlan && imageType !== "space_plan") || !isPlan) await addInteriorAssetRef(admin, refs, projectId, "space_plan", ["final", "preview", "technical"], true);
    if (!isPlan && imageType !== "main_space") await addInteriorAssetRef(admin, refs, projectId, "main_space", ["final", "preview"], false);
  }
  return refs.slice(0, 8);
}

async function addSelectedInteriorPlanReference(admin: SupabaseClient, refs: any[], projectId: string, assetId: string) {
  const { data: asset } = await admin
    .from("project_assets")
    .select("id,file_url,thumbnail_url,asset_type,metadata")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .eq("studio", "interior_studio")
    .maybeSingle();
  if (!asset) return false;
  const meta = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {};
  const contentType = String(meta.content_type || "").toLowerCase();
  if (!(meta.ai_reference === true || meta.ai_reference === "true") || !contentType.startsWith("image/")) return false;
  const url = String(asset.file_url || asset.thumbnail_url || "").trim();
  if (!url) return false;
  const before = refs.length;
  await pushUrlRef(refs, url, `mapped-interior-plan-${assetId}.png`);
  return refs.length > before;
}

async function addUploadedInteriorPlanReferences(admin: SupabaseClient, refs: any[], projectId: string, input: Record<string, unknown>, limit: number) {
  const directUrls = Array.isArray(input.sourcePlanImageUrls)
    ? input.sourcePlanImageUrls.map((url) => String(url || "").trim()).filter(Boolean)
    : [];

  const fallbackUrls: string[] = [];
  if (!directUrls.length) {
    const { data: assets } = await admin
      .from("project_assets")
      .select("file_url,thumbnail_url,asset_type,metadata,created_at")
      .eq("project_id", projectId)
      .eq("studio", "interior_studio")
      .in("asset_type", ["interior_source_plan_preview", "interior_source_document"])
      .order("created_at", { ascending: true })
      .limit(20);

    for (const asset of assets || []) {
      const meta = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {};
      const contentType = String(meta.content_type || "").toLowerCase();
      const aiReference = meta.ai_reference === true || meta.ai_reference === "true";
      if (!aiReference || !contentType.startsWith("image/")) continue;
      const url = String(asset.file_url || asset.thumbnail_url || "").trim();
      if (url) fallbackUrls.push(url);
    }
  }

  for (const [index, url] of Array.from(new Set(directUrls.length ? directUrls : fallbackUrls)).slice(0, limit).entries()) {
    await pushUrlRef(refs, url, `interior-source-plan-${index + 1}.png`);
  }
}

async function addInteriorAssetRef(admin: SupabaseClient, refs: any[], projectId: string, viewType: InteriorImageType, stages: GenerationStage[], approvedOnly: boolean, roomKey = "") {
  for (const stage of stages) {
    const row = await latestInteriorAsset(admin, projectId, viewType, stage, approvedOnly, roomKey);
    if (row?.file_url) { await pushUrlRef(refs, String(row.file_url), `${viewType}-${stage}${roomKey ? "-room" : ""}.png`); return; }
  }
}

async function latestInteriorAsset(admin: SupabaseClient, projectId: string, viewType: InteriorImageType, stage: GenerationStage, approvedOnly: boolean, roomKey = "") {
  const outputKind = INTERIOR_PLAN_LABELS[viewType] ? "plan" : "visual";
  const exactType = `interior_${outputKind}_${viewType}_${stage}`;
  const legacyType = `interior_${outputKind}_${viewType}`;
  const { data } = await admin.from("project_assets").select("id,file_url,asset_type,metadata,created_at").eq("project_id", projectId).eq("studio", "interior_studio").in("asset_type", [exactType, legacyType]).order("created_at", { ascending: false }).limit(20);
  return (data || []).find((asset: any) => {
    const meta = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
    const metaStage = String(meta.stage || (asset.asset_type === legacyType ? (outputKind === "plan" ? "technical" : "preview") : ""));
    const approved = meta.approved === true || meta.approved === "true";
    const assetRoomKey = String(meta.room_key || "");
    if (roomKey && assetRoomKey !== roomKey) return false;
    if (!roomKey && assetRoomKey) return false;
    return metaStage === stage && (!approvedOnly || approved);
  }) || null;
}

async function addArchitectureSourceDrawings(admin: SupabaseClient, userId: string, architectureProjectId: string, imageType: InteriorImageType, refs: any[], limit: number) {
  const { data: documents } = await admin.from("architecture_documents").select("id,category,filename,storage_path,mime_type,created_at").eq("project_id", architectureProjectId).eq("user_id", userId).like("category", "source-plan-%").order("created_at", { ascending: false }).limit(40);
  const rows = Array.isArray(documents) ? documents : [];
  const priority = architectureSourcePriority(imageType);
  const latestByType = new Map<string, any>();
  for (const row of rows) { const type = String(row.category || "").replace(/^source-plan-/, ""); if (type && !latestByType.has(type)) latestByType.set(type, row); }
  const ordered = [...priority.map((type) => latestByType.get(type)).filter(Boolean), ...Array.from(latestByType.entries()).filter(([type]) => !priority.includes(type)).map(([, row]) => row)].slice(0, limit);
  for (const row of ordered) {
    if (!String(row.mime_type || "").startsWith("image/") || !row.storage_path) continue;
    try {
      const { data: blob, error } = await admin.storage.from("architecture-files").download(String(row.storage_path));
      if (error || !blob) continue;
      refs.push(await toFile(Buffer.from(await blob.arrayBuffer()), `architecture-${String(row.category || "source-plan")}.png`, { type: String(row.mime_type || "image/png") }));
    } catch { /* optional source */ }
  }
}

function architectureSourcePriority(imageType: InteriorImageType) {
  if (["space_plan", "furniture_plan", "lighting_plan", "main_space", "alternate_angle", "focal_point"].includes(imageType)) return ["ground_floor", "upper_floor", "section", "front_elevation", "rear_elevation", "site_plan"];
  return ["section", "ground_floor", "upper_floor", "front_elevation", "rear_elevation", "site_plan"];
}

async function loadMarketingReferences(admin: SupabaseClient, userId: string, projectId: string, viewType: MarketingVisualType, stage: "preview" | "final", includeCurrentStage: boolean, input: Record<string, unknown>) {
  const refs: any[] = [];
  const connectedBrandId = brandProjectIdFromInput(input);
  if (connectedBrandId) {
    const { data: brandAssets } = await admin.from("project_assets").select("id,title,file_url,thumbnail_url,asset_type,metadata,created_at").eq("project_id", connectedBrandId).eq("user_id", userId).order("created_at", { ascending: false }).limit(40);
    const preferred = (brandAssets || []).filter((a: any) => Boolean(a.file_url)).map((a: any) => {
      const type = String(a.asset_type || "").toLowerCase(); const approved = a?.metadata?.approved === true || a?.metadata?.approved === "true";
      const priority = type.includes("logo_selected") || type === "existing_logo" ? 0 : type.includes("direction_selected") || type.includes("creative_direction_selected") ? 1 : type.includes("moodboard_selected") ? 2 : type.includes("direction") || type.includes("moodboard") ? 3 : type.includes("application") || type.includes("brand_visual") ? 4 : 20;
      return { ...a, priority: priority - (approved ? 0.25 : 0) };
    }).filter((a: any) => a.priority < 20).sort((a: any, b: any) => a.priority - b.priority).slice(0, 3);
    for (const a of preferred) await pushUrlRef(refs, String(a.file_url), `brand-${String(a.asset_type || "reference")}.png`);
  }
  const urls: string[] = [];
  if (includeCurrentStage) { const current = await latestMarketingAsset(admin, projectId, viewType, stage, false); if (current?.file_url) urls.push(String(current.file_url)); }
  if (stage === "final") { const preview = await latestMarketingAsset(admin, projectId, viewType, "preview", false); if (preview?.file_url) urls.push(String(preview.file_url)); }
  if (viewType !== "key_visual") {
    const master = await latestMarketingAsset(admin, projectId, "key_visual", "final", true) || await latestMarketingAsset(admin, projectId, "key_visual", "preview", true) || await latestMarketingAsset(admin, projectId, "key_visual", "final", false) || await latestMarketingAsset(admin, projectId, "key_visual", "preview", false);
    if (master?.file_url) urls.push(String(master.file_url));
  }
  for (const url of Array.from(new Set(urls)).slice(0, 3)) await pushUrlRef(refs, url, "marketing-reference.png");
  return refs;
}

async function latestMarketingAsset(admin: SupabaseClient, projectId: string, viewType: MarketingVisualType, stage: "preview" | "final", approvedOnly: boolean) {
  const { data } = await admin.from("project_assets").select("id,file_url,asset_type,metadata,created_at").eq("project_id", projectId).eq("studio", "marketing_studio").eq("asset_type", `marketing_visual_${viewType}_${stage}`).order("created_at", { ascending: false }).limit(20);
  return (data || []).find((a: any) => { const meta = a.metadata && typeof a.metadata === "object" ? a.metadata : {}; const approved = meta.approved === true || meta.approved === "true"; return !approvedOnly || approved; }) || null;
}

async function pushUrlRef(refs: any[], url: string, name: string) {
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) return;
    refs.push(await toFile(Buffer.from(await response.arrayBuffer()), name, { type: contentType }));
  } catch { /* optional ref */ }
}

async function storeGeneratedAsset(admin: SupabaseClient, args: { userId: string; projectId: string; studio: string; assetType: string; title: string; buffer: Buffer; payload: Record<string, unknown>; metadata: Record<string, unknown> }) {
  const path = `${args.userId}/${args.projectId}/${args.assetType}/${safeSegment(args.title)}-${Date.now()}-${randomUUID()}.png`;
  const { error: uploadError } = await admin.storage.from("project-assets").upload(path, args.buffer, { contentType: "image/png", cacheControl: "31536000", upsert: false });
  if (uploadError) throw new Error(`Asset upload failed: ${uploadError.message}`);
  const { data: publicData } = admin.storage.from("project-assets").getPublicUrl(path);
  const fileUrl = publicData.publicUrl || null;
  const { data: asset, error: assetError } = await admin.from("project_assets").insert({
    user_id: args.userId, project_id: args.projectId, studio: args.studio, asset_type: args.assetType, title: args.title, payload: args.payload,
    file_url: fileUrl, thumbnail_url: fileUrl,
    metadata: { provider: "openai", model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", ...args.metadata, storage_path: path, content_type: "image/png" },
  }).select().single();
  if (assetError) { await admin.storage.from("project-assets").remove([path]); throw new Error(`Asset record failed: ${assetError.message}`); }
  return asset;
}

async function deleteAsset(admin: SupabaseClient, assetId: string) {
  const { data: asset } = await admin.from("project_assets").select("id,metadata").eq("id", assetId).maybeSingle();
  const storagePath = asset?.metadata && typeof asset.metadata === "object" ? String((asset.metadata as any).storage_path || "") : "";
  if (storagePath) await admin.storage.from("project-assets").remove([storagePath]);
  await admin.from("project_assets").delete().eq("id", assetId);
}

function safeSegment(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "asset"; }
function architectureProjectIdFromInput(input: Record<string, unknown>) { const connected = input.connectedArchitecture && typeof input.connectedArchitecture === "object" ? input.connectedArchitecture as Record<string, unknown> : null; return String(connected?.id || input.architectureProjectId || "").trim(); }
function brandProjectIdFromInput(input: Record<string, unknown>) { const connected = input.connectedBrand && typeof input.connectedBrand === "object" ? input.connectedBrand as Record<string, unknown> : null; return String(connected?.id || input.brandProjectId || "").trim(); }
function promptJson(value: unknown, maxChars: number) { const text = JSON.stringify(value); return text.length <= maxChars ? text : `${text.slice(0, maxChars - 80)}… [context shortened]`; }
function sanitizePromptValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") { if (/^data:/i.test(value) || /^blob:/i.test(value)) return "[binary asset omitted; supplied separately when relevant]"; return value.length > 1400 ? `${value.slice(0, 1400)}…` : value; }
  if (depth >= 5) return "[nested detail omitted]";
  if (Array.isArray(value)) return value.slice(0, 24).map((item) => sanitizePromptValue(item, depth + 1));
  if (typeof value === "object") { const output: Record<string, unknown> = {}; for (const [key, item] of Object.entries(value as Record<string, unknown>)) { if (/^(image_url|file_url|thumbnail_url|storage_path|preview_url|svg|base64|data_url|allVisuals)$/i.test(key)) continue; if (/^(metadata|payload)$/i.test(key) && depth >= 2) continue; output[key] = sanitizePromptValue(item, depth + 1); } return output; }
  return String(value);
}
function compactText(value: unknown, max: number) { const text = typeof value === "string" ? value.trim() : ""; return text.length > max ? `${text.slice(0, max)}…` : text; }
function compactMarketingInput(input: Record<string, unknown>) { const connected = input.connectedBrand && typeof input.connectedBrand === "object" ? input.connectedBrand as Record<string, unknown> : null; return compactValue({ projectType: input.projectType, campaignName: input.campaignName, campaignObjective: input.campaignObjective, objective: input.objective, audience: input.audience, targetAudience: input.targetAudience, offer: input.offer, keyMessage: input.keyMessage, product: input.product, service: input.service, channels: input.channels, platforms: input.platforms, market: input.market, location: input.location, tone: input.tone, callToAction: input.callToAction, deliverables: input.deliverables, notes: input.notes, connectedBrand: connected ? { id: connected.id, name: connected.project_name || connected.name, industry: connected.industry, audience: connected.audience, style: connected.style } : undefined }, 0); }
function compactMarketingOutput(output: Record<string, unknown>, viewType: MarketingVisualType) { const strategy = output.strategy && typeof output.strategy === "object" ? output.strategy as Record<string, unknown> : null; const campaign = output.campaign && typeof output.campaign === "object" ? output.campaign as Record<string, unknown> : null; const creativeDirection = output.creativeDirection && typeof output.creativeDirection === "object" ? output.creativeDirection : output.creative_direction; const visualPrompts = output.visualPrompts && typeof output.visualPrompts === "object" ? output.visualPrompts as Record<string, unknown> : null; return compactValue({ bigIdea: output.bigIdea || output.big_idea || campaign?.bigIdea || campaign?.big_idea, audienceInsight: output.audienceInsight || output.audience_insight || strategy?.audienceInsight, positioning: output.positioning || strategy?.positioning, objective: output.objective || strategy?.objective, offer: output.offer || campaign?.offer, keyMessage: output.keyMessage || output.key_message || campaign?.keyMessage, messageHierarchy: output.messageHierarchy || output.message_hierarchy, tone: output.tone || strategy?.tone, channels: output.channels || campaign?.channels, contentPillars: output.contentPillars || output.content_pillars, creativeDirection, selectedVisualPrompt: visualPrompts?.[viewType] }, 0); }
function compactValue(value: unknown, depth: number): unknown { if (value == null) return undefined; if (typeof value === "string") return value.length > 2500 ? `${value.slice(0, 2500)}…` : value; if (typeof value === "number" || typeof value === "boolean") return value; if (depth >= 4) return undefined; if (Array.isArray(value)) return value.slice(0, 12).map((item) => compactValue(item, depth + 1)).filter((item) => item !== undefined); if (typeof value === "object") { const out: Record<string, unknown> = {}; for (const [key, item] of Object.entries(value as Record<string, unknown>)) { if (/base64|file_url|thumbnail_url|storage_path|image_url/i.test(key)) continue; const next = compactValue(item, depth + 1); if (next !== undefined) out[key] = next; } return out; } return String(value); }
function publicError(studio: StudioId | undefined, message: string) { if (/credit|balance|insufficient/i.test(message)) return message; return studio === "marketing" ? "Campaign visual generation could not be completed. Your credits were returned." : "Interior image generation could not be completed. Your credits were returned."; }
