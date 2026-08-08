import "server-only";

import { NextResponse } from "next/server";
import { toFile } from "openai";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, withCreditReservation, type CreditReservation } from "@/lib/credits/server";
import { getOpenAI } from "@/lib/ai/openai-server";
import { storeGeneratedAsset } from "@/lib/assets-server";
import type { CreditAction } from "@/lib/credits/config";

export const runtime = "nodejs";
export const maxDuration = 180;

type PlanType = "space_plan" | "furniture_plan" | "lighting_plan";
type VisualType =
  | "main_space"
  | "alternate_angle"
  | "focal_point"
  | "material_detail"
  | "day_view"
  | "evening_view";
type ImageType = PlanType | VisualType;
type GenerationStage = "technical" | "preview" | "final";

const PLAN_LABELS: Record<PlanType, string> = {
  space_plan: "Furniture & Space Plan",
  furniture_plan: "Furniture Placement Plan",
  lighting_plan: "Lighting & Ceiling Plan",
};

const VISUAL_LABELS: Record<VisualType, string> = {
  main_space: "Main Space Perspective",
  alternate_angle: "Alternative Angle",
  focal_point: "Feature Wall & Joinery View",
  material_detail: "Materials & Lighting Detail",
  day_view: "Daylight Atmosphere",
  evening_view: "Evening Atmosphere",
};

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const imageType = String(body?.viewType || "") as ImageType;
    const stage = String(body?.stage || "preview") as GenerationStage;
    const isPlan = Object.prototype.hasOwnProperty.call(PLAN_LABELS, imageType);
    const isVisual = Object.prototype.hasOwnProperty.call(VISUAL_LABELS, imageType);

    if (!projectId) return NextResponse.json({ error: "Project is required." }, { status: 400 });
    if (!isPlan && !isVisual) return NextResponse.json({ error: "Choose a valid interior plan or visual." }, { status: 400 });
    if (!(["technical", "preview", "final"] as string[]).includes(stage)) {
      return NextResponse.json({ error: "Choose a valid generation stage." }, { status: 400 });
    }
    if (isVisual && stage === "technical") {
      return NextResponse.json({ error: "Interior visuals begin with a preview, then a professional final." }, { status: 400 });
    }

    const { data: project, error: projectError } = await auth.admin
      .from("studio_projects")
      .select("id,user_id,studio,project_name,project_type,input,output")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "interior_studio")
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: projectError?.message || "Interior project not found." }, { status: 404 });
    }

    const dependencyError = await validateDependencies(auth.admin, projectId, imageType, stage);
    if (dependencyError) return NextResponse.json({ error: dependencyError }, { status: 409 });

    const label = isPlan ? PLAN_LABELS[imageType as PlanType] : VISUAL_LABELS[imageType as VisualType];
    const prompt = buildInteriorImagePrompt({
      projectName: String(project.project_name || "Interior project"),
      imageType,
      stage,
      input: (project.input || {}) as Record<string, unknown>,
      output: (project.output || {}) as Record<string, unknown>,
    });

    const creditAction: CreditAction = stage === "technical"
      ? "interiorTechnicalPlan"
      : stage === "preview"
        ? "interiorPreview"
        : "interiorProfessionalFinal";

    const { result, reservation } = await withCreditReservation({
      admin: auth.admin,
      userId: auth.user.id,
      action: creditAction,
      metadata: {
        studio: "interior_studio",
        project_id: projectId,
        image_type: imageType,
        output_kind: isPlan ? "plan" : "visual",
        stage,
      },
      work: async (creditReservation: CreditReservation) => {
        const openai = getOpenAI();
        const references = await loadReferences(
          auth.admin,
          auth.user.id,
          projectId,
          imageType,
          stage,
          (project.input || {}) as Record<string, unknown>,
        );
        const common = {
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          prompt,
          size: "1536x1024" as const,
          quality: stage === "final" ? "high" as const : "medium" as const,
          output_format: "png" as const,
        };

        const image = references.length
          ? await openai.images.edit({
              ...common,
              image: references.length === 1 ? references[0] : references,
            })
          : await openai.images.generate(common);

        const base64 = image.data?.[0]?.b64_json;
        if (!base64) throw new Error("The image provider returned no image.");

        const outputKind = isPlan ? "plan" : "visual";
        const assetType = `interior_${outputKind}_${imageType}_${stage}`;
        const asset = await storeGeneratedAsset({
          admin: auth.admin,
          userId: auth.user.id,
          projectId,
          studio: "interior_studio",
          assetType,
          title: `${project.project_name || "Interior project"} — ${label} — ${stageLabel(stage)}`,
          buffer: Buffer.from(base64, "base64"),
          extension: "png",
          contentType: "image/png",
          payload: { prompt, imageType, stage, projectName: project.project_name },
          metadata: {
            view_type: imageType,
            output_kind: outputKind,
            stage,
            approved: false,
            source: "interior_studio",
            credit_reservation_id: creditReservation.id,
            connected_architecture_id: architectureProjectIdFromInput((project.input || {}) as Record<string, unknown>) || null,
          },
        });

        await auth.admin
          .from("studio_projects")
          .update({
            progress: stage === "final" ? 94 : isPlan ? 86 : 92,
            current_step: stage === "final" ? `${outputKind}_final_ready` : `${outputKind}_${stage}_ready`,
          })
          .eq("id", projectId)
          .eq("user_id", auth.user.id);

        return { imageUrl: asset.file_url || `data:image/png;base64,${base64}`, asset, stage };
      },
    });

    return NextResponse.json({ success: true, ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Interior image generation error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Interior image generation failed." }, { status: 500 });
  }
}

function buildInteriorImagePrompt({
  projectName,
  imageType,
  stage,
  input,
  output,
}: {
  projectName: string;
  imageType: ImageType;
  stage: GenerationStage;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}) {
  const planInstruction: Record<PlanType, string> = {
    space_plan:
      "Create a complete top-down interior furniture and space plan showing the full boundary, walls, openings, doors with swings, windows, circulation paths, built-in joinery, furniture, rugs, room labels and key dimensions. Show the complete drawing inside the canvas with generous margins.",
    furniture_plan:
      "Create a coordinated top-down furniture placement plan. Preserve every wall, opening, door, window and circulation route from the approved Furniture & Space Plan. Add furniture footprints, item labels, quantities, rug extents and critical clearances.",
    lighting_plan:
      "Create a professional reflected ceiling and lighting plan. Preserve the approved room geometry and furniture layout. Show ceiling zones, recessed lights, pendants, wall lights, decorative fixtures, indirect lighting, switching groups and a concise symbol legend.",
  };

  const visualInstruction: Record<VisualType, string> = {
    main_space:
      "Create a wide hero perspective that follows the approved interior plan. Match walls, openings, doors, windows, circulation and principal furniture placement instead of inventing a different room.",
    alternate_angle:
      "Create a second perspective from the opposite useful corner. Preserve the exact same room, layout, furniture, materials and lighting as the main concept.",
    focal_point:
      "Create a composed architectural perspective focused on the principal feature wall, custom joinery or focal furniture moment while preserving the same room geometry and design system.",
    material_detail:
      "Create a close editorial interior detail showing the approved material junctions, custom joinery, furniture texture and layered lighting. It must visibly belong to the same project.",
    day_view:
      "Create a daylight version of the approved room with realistic natural light direction, balanced exposure and the exact same layout, furniture and materials.",
    evening_view:
      "Create an evening version of the approved room with warm layered artificial lighting while preserving the exact same layout, furniture, materials and architectural openings.",
  };

  const isPlanOutput = Object.prototype.hasOwnProperty.call(planInstruction, imageType);
  const stageInstruction: Record<GenerationStage, string> = {
    technical:
      "LEGACY TECHNICAL STAGE: prioritise accurate geometry, readable symbols, dimensions, openings, furniture footprints and coordination. This stage is retained only for compatibility with older Interior projects.",
    preview:
      isPlanOutput
        ? "PREVIEW STAGE: create the primary AI plan output. Prioritise accurate geometry, readable room labels, doors, windows, furniture, circulation, legends and clear presentation. Use restrained material colour and furniture styling without hiding important plan information. This is a polished concept plan, not a construction or CAD document."
        : "PREVIEW STAGE: create a refined concept-quality render. Preserve geometry, furniture placement, materials and lighting direction exactly.",
    final:
      "PROFESSIONAL FINAL STAGE: use the supplied preview and approved references as fixed sources. Improve presentation quality, realism, material accuracy, lighting, joinery detail and polish without changing geometry, layout, furniture placement or design direction. Produce one complete uncropped final image.",
  };

  const instruction = Object.prototype.hasOwnProperty.call(planInstruction, imageType)
    ? planInstruction[imageType as PlanType]
    : visualInstruction[imageType as VisualType];
  const outputType = Object.prototype.hasOwnProperty.call(planInstruction, imageType) ? "INTERIOR PLAN" : "INTERIOR VISUAL";

  const briefContext = compactInteriorBrief(input);
  const conceptContext = compactInteriorConcept(output);
  const prompt = `Create a premium ${outputType.toLowerCase()} for Heyy Studio.\n\nPROJECT\n${projectName}\n\nOUTPUT\n${Object.prototype.hasOwnProperty.call(PLAN_LABELS, imageType) ? PLAN_LABELS[imageType as PlanType] : VISUAL_LABELS[imageType as VisualType]}\n${stageInstruction[stage]}\n${instruction}\n\nSAVED PROJECT BRIEF\n${promptJson(briefContext, 11000)}\n\nAPPROVED INTERIOR CONCEPT\n${promptJson(conceptContext, 11000)}\n\nNON-NEGOTIABLE CONSISTENCY RULES\n- If this Interior project is connected to Architecture Studio, the supplied architecture floor plans, sections and elevations are the highest-priority geometry references.\n- Treat supplied reference images as the source of truth for geometry and approved design decisions.\n- Preserve all walls, openings, doors, windows, circulation, ceiling relationships and furniture positions from the previous approved stage.\n- Use the saved layout, materials, colour palette, furniture and lighting as one connected design system.\n- Respect room type, dimensions, project location, investment level, retained items and functional requirements.\n- Keep realistic furniture proportions, circulation clearances, joinery, openings and lighting.\n- Do not invent a different architectural space between plans, previews and finals.\n- No fake logos, watermark, moodboard collage or split-screen presentation.\n- Plans must show the entire drawing with generous margins and must never crop labels, dimensions or legends.\n- Visuals must be one complete full-frame image with professional architectural photography and no fake text.`;

  return prompt.length <= 30000
    ? prompt
    : `${prompt.slice(0, 29600)}\n\n[Context shortened automatically to stay within the image model prompt limit.]`;
}

function compactInteriorBrief(input: Record<string, unknown>) {
  const connected = input.connectedArchitecture && typeof input.connectedArchitecture === "object"
    ? input.connectedArchitecture as Record<string, unknown>
    : null;
  const { connectedArchitecture: _connectedArchitecture, ...baseInput } = input;

  return sanitizePromptValue({
    ...baseInput,
    connectedArchitecture: connected
      ? {
          projectName: connected.projectName,
          projectType: connected.projectType,
          location: connected.location,
          architecturalStyle: connected.architecturalStyle,
          workingMode: connected.workingMode,
          selectedSpaces: connected.selectedSpaces,
          notes: connected.notes,
          professionalBrief: connected.professionalBrief,
          site: connected.site,
          spaceProgram: connected.spaceProgram,
          selectedMaterials: connected.selectedMaterials,
          selectedDirection: connected.selectedDirection,
          concept: connected.concept,
          planSet: compactArchitecturePlanSet(connected.planSet),
          approvedVisuals: compactArchitectureVisualList(connected.approvedVisuals),
        }
      : null,
  });
}

function compactInteriorConcept(output: Record<string, unknown>) {
  return sanitizePromptValue({
    conceptSummary: output.conceptSummary,
    designDirection: output.designDirection,
    layoutPlan: output.layoutPlan,
    materialPalette: output.materialPalette,
    furniturePlan: output.furniturePlan,
    lightingPlan: output.lightingPlan,
    colorPalette: output.colorPalette,
    stylingNotes: output.stylingNotes,
    procurementPriorities: output.procurementPriorities,
    visualPrompt: output.visualPrompt,
    professionalPackage: output.professionalPackage,
  });
}

function compactArchitecturePlanSet(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const plan = value as Record<string, unknown>;
  return {
    generationMode: plan.generation_mode,
    totalEstimatedArea: plan.total_estimated_area,
    areaSchedule: plan.area_schedule,
    notes: plan.notes,
  };
}

function compactArchitectureVisualList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      visualType: row.visual_type,
      title: row.title,
      approved: row.is_approved,
    };
  });
}

function sanitizePromptValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^data:/i.test(value) || /^blob:/i.test(value)) return "[binary asset omitted; supplied separately when relevant]";
    if (/^https?:\/\//i.test(value) && value.length > 500) return "[asset URL omitted]";
    return value.length > 1400 ? `${value.slice(0, 1400)}…` : value;
  }
  if (depth >= 5) return "[nested detail omitted]";
  if (Array.isArray(value)) return value.slice(0, 24).map((item) => sanitizePromptValue(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/^(image_url|file_url|thumbnail_url|storage_path|preview_url|svg|base64|data_url|allVisuals)$/i.test(key)) continue;
      if (/^(metadata|payload)$/i.test(key) && depth >= 2) continue;
      output[key] = sanitizePromptValue(item, depth + 1);
    }
    return output;
  }
  return String(value);
}

function promptJson(value: unknown, maxChars: number) {
  const text = JSON.stringify(value);
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 80)}… [context shortened]`;
}

async function addConnectedArchitectureSourceDrawings(args: {
  admin: any;
  userId: string;
  architectureProjectId: string;
  imageType: ImageType;
  references: any[];
  limit: number;
}) {
  const { data: documents } = await args.admin
    .from("architecture_documents")
    .select("id,category,filename,storage_path,mime_type,created_at")
    .eq("project_id", args.architectureProjectId)
    .eq("user_id", args.userId)
    .like("category", "source-plan-%")
    .order("created_at", { ascending: false })
    .limit(40);

  const rows = Array.isArray(documents) ? documents : [];
  if (!rows.length) return;

  const priority = architectureSourcePriority(args.imageType);
  const latestByType = new Map<string, any>();
  for (const row of rows) {
    const type = String(row.category || "").replace(/^source-plan-/, "");
    if (!type || latestByType.has(type)) continue;
    latestByType.set(type, row);
  }

  const ordered = [
    ...priority.map((type) => latestByType.get(type)).filter(Boolean),
    ...Array.from(latestByType.entries())
      .filter(([type]) => !priority.includes(type))
      .map(([, row]) => row),
  ].slice(0, args.limit);

  for (const row of ordered) {
    if (!String(row.mime_type || "").startsWith("image/") || !row.storage_path) continue;
    try {
      const { data: blob, error } = await args.admin.storage
        .from("architecture-files")
        .download(String(row.storage_path));
      if (error || !blob) continue;
      const referenceFile = await toFile(
        Buffer.from(await blob.arrayBuffer()),
        `architecture-${String(row.category || "source-plan")}.png`,
        { type: String(row.mime_type || "image/png") },
      );
      args.references.push(referenceFile);
    } catch {
      // Continue with any remaining source drawings.
    }
  }
}

function architectureSourcePriority(imageType: ImageType) {
  if (imageType === "space_plan" || imageType === "furniture_plan" || imageType === "lighting_plan") {
    return ["ground_floor", "upper_floor", "section", "front_elevation", "rear_elevation", "site_plan"];
  }
  if (imageType === "main_space" || imageType === "alternate_angle" || imageType === "focal_point") {
    return ["ground_floor", "upper_floor", "section", "front_elevation", "rear_elevation", "site_plan"];
  }
  return ["section", "ground_floor", "upper_floor", "front_elevation", "rear_elevation", "site_plan"];
}

async function validateDependencies(admin: any, projectId: string, imageType: ImageType, stage: GenerationStage) {
  const isPlan = Object.prototype.hasOwnProperty.call(PLAN_LABELS, imageType);

  // New Interior workflows start at Preview. Legacy Technical requests remain accepted
  // only so older saved projects do not break.
  if (imageType === "furniture_plan" || imageType === "lighting_plan" || !isPlan) {
    if (!(await hasApprovedAssetAtAnyStage(admin, projectId, "space_plan"))) {
      return "Generate and approve the Furniture & Space Plan first.";
    }
  }

  return null;
}

async function loadReferences(
  admin: any,
  userId: string,
  projectId: string,
  imageType: ImageType,
  stage: GenerationStage,
  input: Record<string, unknown>,
): Promise<any[]> {
  const references: any[] = [];
  const used = new Set<string>();
  const isPlan = Object.prototype.hasOwnProperty.call(PLAN_LABELS, imageType);

  async function addReference(viewType: ImageType, preferredStages: GenerationStage[], approvedOnly = false) {
    for (const preferredStage of preferredStages) {
      const key = `${viewType}:${preferredStage}:${approvedOnly ? "approved" : "any"}`;
      if (used.has(key)) continue;
      used.add(key);
      const file = await loadLatestAssetFile(admin, projectId, viewType, preferredStage, approvedOnly);
      if (file) {
        references.push(file);
        return;
      }
    }
  }


  const connectedArchitectureId = architectureProjectIdFromInput(input);
  if (connectedArchitectureId) {
    await addConnectedArchitectureSourceDrawings({
      admin,
      userId,
      architectureProjectId: connectedArchitectureId,
      imageType,
      references,
      limit: 5,
    });

    // Older Architecture projects may not have organised source-plan documents yet.
    // In that case, fall back to approved/generated Architecture plan records.
    if (!references.length) {
      const { data: architectureReferences } = await admin
        .from("architecture_visuals")
        .select("id,visual_type,title,image_url,is_approved,metadata,created_at")
        .eq("project_id", connectedArchitectureId)
        .in("visual_type", ["ground_floor", "upper_floor", "site_plan", "functional_zoning", "front_elevation", "rear_elevation", "section"])
        .order("is_approved", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);

      const orderedTypes = ["ground_floor", "upper_floor", "section", "front_elevation", "rear_elevation", "site_plan", "functional_zoning"];
      for (const visualType of orderedTypes) {
        const row = (architectureReferences || []).find((item: any) => item.visual_type === visualType && item.image_url);
        const url = row?.image_url ? String(row.image_url) : "";
        if (!url) continue;
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          const referenceFile = await toFile(
            Buffer.from(await response.arrayBuffer()),
            `architecture-${visualType}.png`,
            { type: response.headers.get("content-type") || "image/png" },
          );
          references.push(referenceFile);
        } catch {
          // A missing optional reference must not block Interior generation.
        }
        if (references.length >= 5) break;
      }
    }
  }

  // Preview is now the first visible AI stage. Regeneration may reuse the previous
  // Preview, while older Technical assets remain a compatibility fallback.
  if (stage === "preview") await addReference(imageType, ["preview", "technical"]);
  if (stage === "final") await addReference(imageType, ["preview", "technical"]);

  // All connected plans and visuals use whichever Furniture & Space Plan stage the user approved.
  if ((isPlan && imageType !== "space_plan") || !isPlan) {
    await addReference("space_plan", ["final", "preview", "technical"], true);
  }

  // Secondary visual angles use the main-space image when it exists, but it is not a hard requirement.
  if (!isPlan && imageType !== "main_space") {
    await addReference("main_space", ["final", "preview"]);
  }

  return references;
}

async function hasAsset(admin: any, projectId: string, viewType: ImageType, stage: GenerationStage) {
  return Boolean(await loadLatestAssetRecord(admin, projectId, viewType, stage, false));
}

async function hasApprovedAssetAtAnyStage(admin: any, projectId: string, viewType: ImageType) {
  for (const stage of ["final", "preview", "technical"] as GenerationStage[]) {
    if (await loadLatestAssetRecord(admin, projectId, viewType, stage, true)) return true;
  }
  return false;
}

async function loadLatestAssetRecord(admin: any, projectId: string, viewType: ImageType, stage: GenerationStage, approvedOnly: boolean) {
  const outputKind = Object.prototype.hasOwnProperty.call(PLAN_LABELS, viewType) ? "plan" : "visual";
  const exactType = `interior_${outputKind}_${viewType}_${stage}`;
  const legacyType = `interior_${outputKind}_${viewType}`;
  const { data } = await admin
    .from("project_assets")
    .select("id,file_url,asset_type,metadata,created_at")
    .eq("project_id", projectId)
    .eq("studio", "interior_studio")
    .in("asset_type", [exactType, legacyType])
    .order("created_at", { ascending: false })
    .limit(20);

  return (data || []).find((asset: any) => {
    const metadata = asset?.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
    const metadataStage = String(metadata.stage || (asset.asset_type === legacyType ? (outputKind === "plan" ? "technical" : "preview") : ""));
    const approved = metadata.approved === true || metadata.approved === "true";
    return metadataStage === stage && (!approvedOnly || approved);
  }) || null;
}

async function loadLatestAssetFile(admin: any, projectId: string, viewType: ImageType, stage: GenerationStage, approvedOnly = false) {
  const record = await loadLatestAssetRecord(admin, projectId, viewType, stage, approvedOnly);
  const url = record?.file_url ? String(record.file_url) : "";
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const type = response.headers.get("content-type") || "image/png";
  return toFile(Buffer.from(await response.arrayBuffer()), `${viewType}-${stage}`, { type });
}

function architectureProjectIdFromInput(input: Record<string, unknown>) {
  const connected = input.connectedArchitecture && typeof input.connectedArchitecture === "object"
    ? input.connectedArchitecture as Record<string, unknown>
    : null;
  return String(connected?.id || input.architectureProjectId || "").trim();
}

function stageLabel(stage: GenerationStage) {
  return stage === "technical" ? "Technical" : stage === "preview" ? "Preview" : "Professional Final";
}
