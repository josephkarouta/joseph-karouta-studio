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

type MarketingVisualType =
  | "key_visual"
  | "social_feed"
  | "story_cover"
  | "carousel_cover"
  | "landing_hero"
  | "email_header"
  | "display_ad"
  | "outdoor_poster";

type GenerationStage = "preview" | "final";

const VISUALS: Record<MarketingVisualType, { label: string; format: string; size: "1024x1024" | "1536x1024" | "1024x1536" }> = {
  key_visual: { label: "Campaign Key Visual", format: "master campaign image", size: "1536x1024" },
  social_feed: { label: "Social Feed Ad", format: "square social feed creative", size: "1024x1024" },
  story_cover: { label: "Story / Reel Cover", format: "vertical story or reel cover", size: "1024x1536" },
  carousel_cover: { label: "Carousel Cover", format: "square carousel cover", size: "1024x1024" },
  landing_hero: { label: "Landing-Page Hero", format: "wide website landing-page hero", size: "1536x1024" },
  email_header: { label: "Email Header", format: "wide email campaign header", size: "1536x1024" },
  display_ad: { label: "Display Ad", format: "clean digital display-ad composition", size: "1536x1024" },
  outdoor_poster: { label: "Outdoor / Poster", format: "vertical outdoor poster concept", size: "1024x1536" },
};

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const viewType = String(body?.viewType || "") as MarketingVisualType;
    const stage = String(body?.stage || "preview") as GenerationStage;
    const tweak = String(body?.tweak || "").trim().slice(0, 1000);

    if (!projectId) return NextResponse.json({ error: "Project is required." }, { status: 400 });
    if (!Object.prototype.hasOwnProperty.call(VISUALS, viewType)) {
      return NextResponse.json({ error: "Choose a valid campaign visual." }, { status: 400 });
    }
    if (!(stage === "preview" || stage === "final")) {
      return NextResponse.json({ error: "Choose Preview or Professional Final." }, { status: 400 });
    }

    const { data: project, error: projectError } = await auth.admin
      .from("studio_projects")
      .select("id,user_id,studio,project_name,project_type,input,output")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "marketing_studio")
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: projectError?.message || "Marketing project not found." }, { status: 404 });
    }

    if (stage === "final") {
      const preview = await latestAsset(auth.admin, projectId, viewType, "preview", false);
      if (!preview?.file_url) {
        return NextResponse.json(
          { error: "Generate the Preview for this campaign visual before creating its Professional Final." },
          { status: 409 },
        );
      }
    }

    const definition = VISUALS[viewType];
    const prompt = buildMarketingVisualPrompt({
      projectName: String(project.project_name || "Marketing campaign"),
      viewType,
      stage,
      input: (project.input || {}) as Record<string, unknown>,
      output: (project.output || {}) as Record<string, unknown>,
      tweak,
    });

    const creditAction: CreditAction = stage === "final" ? "marketingProfessionalFinal" : "marketingVisualPreview";
    const { result, reservation } = await withCreditReservation({
      admin: auth.admin,
      userId: auth.user.id,
      action: creditAction,
      metadata: {
        studio: "marketing_studio",
        project_id: projectId,
        visual_type: viewType,
        stage,
      },
      work: async (creditReservation: CreditReservation) => {
        const openai = getOpenAI();
        const references = await loadReferences(
          auth.admin,
          projectId,
          viewType,
          stage,
          Boolean(tweak),
          (project.input || {}) as Record<string, unknown>,
        );
        const common = {
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          prompt,
          size: definition.size,
          quality: stage === "final" ? "high" as const : "medium" as const,
          output_format: "png" as const,
        };

        const generated = references.length
          ? await openai.images.edit({
              ...common,
              image: references.length === 1 ? references[0] : references,
            })
          : await openai.images.generate(common);

        const base64 = generated.data?.[0]?.b64_json;
        if (!base64) throw new Error("The image provider returned no campaign image.");

        const asset = await storeGeneratedAsset({
          admin: auth.admin,
          userId: auth.user.id,
          projectId,
          studio: "marketing_studio",
          assetType: `marketing_visual_${viewType}_${stage}`,
          title: `${project.project_name || "Marketing campaign"} — ${definition.label} — ${stage === "final" ? "Professional Final" : "Preview"}`,
          buffer: Buffer.from(base64, "base64"),
          extension: "png",
          contentType: "image/png",
          payload: { prompt, viewType, stage, tweak: tweak || null, projectName: project.project_name },
          metadata: {
            view_type: viewType,
            output_kind: "visual",
            stage,
            approved: false,
            source: "marketing_studio",
            format: definition.format,
            credit_reservation_id: creditReservation.id,
            connected_brand_id: brandProjectIdFromInput((project.input || {}) as Record<string, unknown>) || null,
          },
        });

        await auth.admin
          .from("studio_projects")
          .update({
            progress: stage === "final" ? 95 : 90,
            current_step: `visual_${viewType}_${stage}_ready`,
          })
          .eq("id", projectId)
          .eq("user_id", auth.user.id)
          .eq("studio", "marketing_studio");

        return { imageUrl: asset.file_url || `data:image/png;base64,${base64}`, asset, stage };
      },
    });

    return NextResponse.json({ success: true, ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Marketing visual generation error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketing visual generation failed." }, { status: 500 });
  }
}

function buildMarketingVisualPrompt({
  projectName,
  viewType,
  stage,
  input,
  output,
  tweak,
}: {
  projectName: string;
  viewType: MarketingVisualType;
  stage: GenerationStage;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  tweak: string;
}) {
  const definition = VISUALS[viewType];
  const prompts = output.visualPrompts && typeof output.visualPrompts === "object"
    ? output.visualPrompts as Record<string, unknown>
    : {};
  const specificPrompt = compactText(prompts[viewType], 4000);
  const stageInstruction = stage === "final"
    ? "Create a polished professional-final campaign image with refined art direction, premium detail, controlled lighting and production-quality composition. Preserve the approved campaign system and any supplied reference image."
    : "Create a strong campaign preview that clearly communicates the selected creative direction and can be reviewed before professional finalisation.";

  const compactInput = compactMarketingInput(input);
  const compactOutput = compactMarketingOutput(output, viewType);

  const prompt = `Create a ${definition.format} for Heyy Studio's Marketing Studio.\n\nCAMPAIGN\n${projectName}\n\nSTAGE\n${stage === "final" ? "Professional Final" : "Preview"}\n${stageInstruction}\n\nFORMAT-SPECIFIC DIRECTION\n${specificPrompt || "Translate the saved campaign strategy and creative brief into this format."}\n\n${tweak ? `USER TWEAK\nApply this requested adjustment while preserving the campaign system and everything not mentioned:\n${tweak}\n\n` : ""}CAMPAIGN INPUT\n${JSON.stringify(compactInput, null, 2)}\n\nAPPROVED CAMPAIGN SYSTEM\n${JSON.stringify(compactOutput, null, 2)}\n\nNON-NEGOTIABLE RULES\n- Use the saved big idea, audience insight, offer, message hierarchy, tone and visual direction as one connected system.\n- If a connected brand system exists, respect its colours, typography mood, positioning and image language.\n- Use supplied Brand Studio images as visual references; do not repeat their URLs or metadata in the artwork.\n- Create one clean full-frame composition, not a moodboard, split screen or presentation sheet.\n- Do not invent a different product, audience, offer or campaign concept.\n- Avoid fake logos, illegible body copy, random watermarks and unapproved claims.\n- Reserve intentional clean space where real campaign copy may later be typeset.\n- Use realistic, commercially useful art direction appropriate to the selected channel and market.\n- The image must fill the canvas without cropping the main subject or essential composition.`;

  // OpenAI image prompts currently have a 32,000-character maximum.
  // Keep a safety margin so connected Brand/Marketing data can never exceed the provider limit.
  return prompt.length <= 30000
    ? prompt
    : `${prompt.slice(0, 29750)}\n\n[Project context compacted to fit the image-generation limit.]`;
}

function compactMarketingInput(input: Record<string, unknown>) {
  const connectedBrand = input.connectedBrand && typeof input.connectedBrand === "object"
    ? input.connectedBrand as Record<string, unknown>
    : null;

  return compactObject({
    projectType: input.projectType,
    campaignName: input.campaignName,
    campaignObjective: input.campaignObjective,
    objective: input.objective,
    audience: input.audience,
    targetAudience: input.targetAudience,
    offer: input.offer,
    keyMessage: input.keyMessage,
    product: input.product,
    service: input.service,
    channels: input.channels,
    platforms: input.platforms,
    market: input.market,
    location: input.location,
    tone: input.tone,
    callToAction: input.callToAction,
    deliverables: input.deliverables,
    notes: input.notes,
    connectedBrand: connectedBrand
      ? {
          id: connectedBrand.id,
          name: connectedBrand.project_name || connectedBrand.name,
          industry: connectedBrand.industry,
          audience: connectedBrand.audience,
          style: connectedBrand.style,
        }
      : undefined,
  }, 9000);
}

function compactMarketingOutput(output: Record<string, unknown>, viewType: MarketingVisualType) {
  const strategy = output.strategy && typeof output.strategy === "object"
    ? output.strategy as Record<string, unknown>
    : null;
  const campaign = output.campaign && typeof output.campaign === "object"
    ? output.campaign as Record<string, unknown>
    : null;
  const creativeDirection = output.creativeDirection && typeof output.creativeDirection === "object"
    ? output.creativeDirection as Record<string, unknown>
    : output.creative_direction && typeof output.creative_direction === "object"
      ? output.creative_direction as Record<string, unknown>
      : null;
  const visualPrompts = output.visualPrompts && typeof output.visualPrompts === "object"
    ? output.visualPrompts as Record<string, unknown>
    : null;

  return compactObject({
    bigIdea: output.bigIdea || output.big_idea || campaign?.bigIdea || campaign?.big_idea,
    audienceInsight: output.audienceInsight || output.audience_insight || strategy?.audienceInsight,
    positioning: output.positioning || strategy?.positioning,
    objective: output.objective || strategy?.objective,
    offer: output.offer || campaign?.offer,
    keyMessage: output.keyMessage || output.key_message || campaign?.keyMessage,
    messageHierarchy: output.messageHierarchy || output.message_hierarchy,
    tone: output.tone || strategy?.tone,
    channels: output.channels || campaign?.channels,
    contentPillars: output.contentPillars || output.content_pillars,
    creativeDirection,
    selectedVisualPrompt: visualPrompts?.[viewType],
  }, 12000);
}

function compactObject(value: unknown, maxChars: number): unknown {
  return compactValue(value, maxChars, 0);
}

function compactValue(value: unknown, maxChars: number, depth: number): unknown {
  if (value == null) return undefined;
  if (typeof value === "string") {
    if (isLargeDataString(value)) return undefined;
    return value.length > Math.min(maxChars, 2500) ? `${value.slice(0, Math.min(maxChars, 2500))}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 4) return undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, 12)
      .map((item) => compactValue(item, Math.max(500, Math.floor(maxChars / 12)), depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    const blockedKeys = /(^|_)(url|uri|path|storage|thumbnail|preview|image|file|asset|base64|data)(_|$)/i;
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      if (blockedKeys.test(key)) continue;
      const compacted = compactValue(item, Math.max(500, Math.floor(maxChars / 8)), depth + 1);
      if (compacted !== undefined && compacted !== "") result[key] = compacted;
      if (JSON.stringify(result).length >= maxChars) break;
    }
    return result;
  }
  return undefined;
}

function compactText(value: unknown, maxChars: number) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

function isLargeDataString(value: string) {
  return value.startsWith("data:") || value.length > 12000 || /^(https?:\/\/|\/storage\/|\/api\/)/i.test(value);
}

async function loadReferences(
  admin: any,
  projectId: string,
  viewType: MarketingVisualType,
  stage: GenerationStage,
  includeCurrentStage: boolean,
  input: Record<string, unknown>,
) {
  const references: any[] = [];
  const urls: string[] = [];

  const connectedBrandId = brandProjectIdFromInput(input);
  if (connectedBrandId) {
    const { data: brandAssets } = await admin
      .from("project_assets")
      .select("id,title,file_url,thumbnail_url,asset_type,metadata,created_at")
      .eq("project_id", connectedBrandId)
      .order("created_at", { ascending: false })
      .limit(40);

    const preferredBrandAssets = (brandAssets || [])
      .filter((asset: any) => Boolean(asset.file_url))
      .map((asset: any) => {
        const type = String(asset.asset_type || "").toLowerCase();
        const approved = asset?.metadata?.approved === true || asset?.metadata?.approved === "true";
        const priority =
          type.includes("logo_selected") || type === "existing_logo" ? 0 :
          type.includes("direction_selected") || type.includes("creative_direction_selected") ? 1 :
          type.includes("moodboard_selected") ? 2 :
          type.includes("direction") || type.includes("moodboard") ? 3 :
          type.includes("application") || type.includes("brand_visual") ? 4 : 20;
        return { ...asset, __priority: priority - (approved ? 0.25 : 0) };
      })
      .filter((asset: any) => asset.__priority < 20)
      .sort((a: any, b: any) => a.__priority - b.__priority)
      .slice(0, 3);

    for (const asset of preferredBrandAssets) {
      const url = String(asset.file_url || "");
      if (!url) continue;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const referenceFile = await toFile(
          Buffer.from(await response.arrayBuffer()),
          `brand-${String(asset.asset_type || "reference")}.png`,
          { type: response.headers.get("content-type") || "image/png" },
        );
        references.push(referenceFile);
      } catch {
        // Optional brand references should not block campaign generation.
      }
    }
  }

  if (includeCurrentStage) {
    const current = await latestAsset(admin, projectId, viewType, stage, false);
    if (current?.file_url) urls.push(String(current.file_url));
  }

  if (stage === "final") {
    const preview = await latestAsset(admin, projectId, viewType, "preview", false);
    if (preview?.file_url) urls.push(String(preview.file_url));
  }

  if (viewType !== "key_visual") {
    const approvedMaster = await latestAsset(admin, projectId, "key_visual", "final", true)
      || await latestAsset(admin, projectId, "key_visual", "preview", true)
      || await latestAsset(admin, projectId, "key_visual", "final", false)
      || await latestAsset(admin, projectId, "key_visual", "preview", false);
    if (approvedMaster?.file_url) urls.push(String(approvedMaster.file_url));
  }

  for (const url of Array.from(new Set(urls)).slice(0, 3)) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const referenceFile = await toFile(
      Buffer.from(await response.arrayBuffer()),
      "marketing-reference.png",
      { type: response.headers.get("content-type") || "image/png" },
    );
    references.push(referenceFile);
  }

  return references;
}

function brandProjectIdFromInput(input: Record<string, unknown>) {
  const connected = input.connectedBrand && typeof input.connectedBrand === "object"
    ? input.connectedBrand as Record<string, unknown>
    : null;
  return String(connected?.id || input.brandProjectId || "").trim();
}

async function latestAsset(
  admin: any,
  projectId: string,
  viewType: MarketingVisualType,
  stage: GenerationStage,
  approvedOnly: boolean,
) {
  const { data } = await admin
    .from("project_assets")
    .select("id,file_url,asset_type,metadata,created_at")
    .eq("project_id", projectId)
    .eq("studio", "marketing_studio")
    .eq("asset_type", `marketing_visual_${viewType}_${stage}`)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data || []).find((asset: any) => {
    const metadata = asset?.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
    const approved = metadata.approved === true || metadata.approved === "true";
    return !approvedOnly || approved;
  }) || null;
}
