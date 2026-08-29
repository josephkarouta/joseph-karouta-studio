import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";

type BrandSystemJobInput = {
  businessName?: string;
  industry?: string;
  audience?: string;
  style?: string;
  description?: string;
  projectJourney?: Record<string, unknown>;
  model?: string;
  credits?: number;
};

type BrandSystem = Record<string, unknown>;

export async function processBrandSystemJob(jobId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !serviceKey || !openaiKey) {
    throw new Error("Background Brand Studio generation is not configured.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: jobError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tool", "brand_system")
    .maybeSingle();

  if (jobError) throw new Error(jobError.message || "Brand generation job could not be loaded.");
  if (!existing) throw new Error("Brand generation job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existing.status || ""))) return;
  if (String(existing.status || "") !== "queued") return;

  // Atomic queued -> processing claim prevents duplicate background invocations
  // from creating two paid provider calls.
  const { data: claimed, error: claimError } = await admin
    .from("generation_jobs")
    .update({ status: "processing", error: null })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message || "Brand generation job could not be started.");
  if (!claimed) return;

  const input = (claimed.input || {}) as BrandSystemJobInput;
  let projectId: string | null = null;
  let brandSystem: BrandSystem | null = null;

  try {
    const businessName = cleanString(input.businessName);
    const industry = cleanString(input.industry);
    const audience = cleanString(input.audience);
    const style = cleanString(input.style);
    const description = cleanString(input.description);
    const projectJourney = isRecord(input.projectJourney) ? input.projectJourney : {};
    const model =
      cleanString(input.model) ||
      process.env.OPENAI_TEXT_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4.1-mini";

    if (!businessName || !industry || !audience || !style) {
      throw new Error("Brand generation input is incomplete.");
    }

    const prompt = buildPrompt({
      businessName,
      industry,
      audience,
      style,
      description,
      projectJourney,
    });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    const data = await readProviderJson(response);
    if (!response.ok) {
      const providerMessage =
        cleanString(data?.error?.message) ||
        cleanString(data?.message) ||
        `Creative generation request failed (${response.status}).`;
      throw new Error(providerMessage);
    }

    const outputText = extractOutputText(data);
    if (!outputText) {
      throw new Error("No structured brand system was returned.");
    }

    try {
      brandSystem = normalizeBrandSystem(JSON.parse(outputText));
    } catch {
      throw new Error("Brand system JSON could not be parsed.");
    }

    brandSystem = {
      ...brandSystem,
      projectJourney,
    };

    const { data: savedProject, error: saveError } = await admin
      .from("brand_projects")
      .insert({
        user_id: claimed.user_id,
        project_name: businessName,
        industry,
        audience,
        style,
        description,
        brand_system_json: brandSystem,
      })
      .select("id")
      .single();

    if (saveError || !savedProject?.id) {
      throw new Error(saveError?.message || "The Brand Studio project could not be saved.");
    }

    projectId = String(savedProject.id);

    const durableOutput = {
      project_id: projectId,
      brand_system: brandSystem,
      model,
      credits_used: Number(input.credits || 0),
    };

    // Persist the output before committing credits. If the worker is interrupted
    // after the credit RPC, the status route can recover this completed job.
    const { error: outputError } = await admin
      .from("generation_jobs")
      .update({
        project_id: projectId,
        output: durableOutput,
      })
      .eq("id", jobId);

    if (outputError) {
      throw new Error(outputError.message || "Brand generation result could not be recorded.");
    }

    await completeGenerationJob(admin, jobId, durableOutput, {
      studio: "brand_studio",
      tool: "brand_system",
      project_id: projectId,
      project_name: businessName,
      model,
    });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : "Brand workspace generation failed.";
    const reservationStatus = claimed.credit_reservation_id
      ? await getReservationStatus(admin, String(claimed.credit_reservation_id))
      : null;

    // If the project and credit commit are already durable, do not destroy a paid
    // successful result because a later bookkeeping update failed.
    if (projectId && brandSystem && reservationStatus === "committed") {
      await admin
        .from("generation_jobs")
        .update({
          status: "succeeded",
          error: null,
          project_id: projectId,
          output: {
            ...((isRecord(claimed.output) ? claimed.output : {}) as Record<string, unknown>),
            project_id: projectId,
            brand_system: brandSystem,
            credits_used: Number(input.credits || 0),
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      return;
    }

    await failGenerationJob(admin, {
      jobId,
      expectedStatus: "processing",
      reason: internalMessage,
      publicError: publicGenerationError(internalMessage),
    });

    if (projectId) {
      const { error: deleteError } = await admin
        .from("brand_projects")
        .delete()
        .eq("id", projectId)
        .eq("user_id", claimed.user_id);
      if (deleteError) {
        console.error("Failed Brand project cleanup after generation error:", deleteError.message);
      }
    }

    console.error("Brand Studio background error:", internalMessage);
  }
}

async function getReservationStatus(admin: SupabaseClient, reservationId: string) {
  const { data, error } = await admin
    .from("credit_reservations")
    .select("status")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    console.error("Credit reservation status check failed:", error.message);
    return null;
  }
  return data?.status ? String(data.status) : null;
}

async function readProviderJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function extractOutputText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const search = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed : null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = search(item);
        if (found) return found;
      }
      return null;
    }
    if (typeof value === "object") {
      if (typeof value.text === "string" && value.text.trim()) return value.text.trim();
      if (typeof value.content === "string" && value.content.trim()) return value.content.trim();
      for (const key of Object.keys(value)) {
        const found = search(value[key]);
        if (found) return found;
      }
    }
    return null;
  };

  return search(data?.output);
}

function normalizeBrandSystem(raw: any): BrandSystem {
  const foundation = isRecord(raw?.foundation) ? raw.foundation : {};
  const rawBrandStrategy = isRecord(raw?.brandStrategy) ? raw.brandStrategy : {};
  const rawBrandVoice = isRecord(raw?.brandVoice) ? raw.brandVoice : {};
  const rawPersonality = isRecord(raw?.personality) ? raw.personality : {};

  const brandVoice = isRecord(foundation.brandVoice)
    ? foundation.brandVoice
    : Object.keys(rawBrandVoice).length
      ? rawBrandVoice
      : { headline: "Brand Voice", description: "", toneWords: [] };

  const personality = isRecord(foundation.personality)
    ? foundation.personality
    : Object.keys(rawPersonality).length
      ? rawPersonality
      : { headline: "Personality", traits: [] };

  return {
    ...raw,
    summary: cleanString(raw?.summary) || cleanString(foundation.summary),
    brandStrategy: Object.keys(rawBrandStrategy).length
      ? rawBrandStrategy
      : {
          positioning: cleanString(foundation.positioning) || "Brand Strategy",
          description: cleanString(foundation.strategy) || cleanString(foundation.summary),
          mission: cleanString(foundation.mission),
          vision: cleanString(foundation.vision),
          brandPromise: cleanString(foundation.brandPromise),
          targetAudience: cleanString(foundation.targetAudience),
          coreValues: arrayValue(foundation.coreValues),
          keywords: arrayValue(foundation.keywords),
          recommendations: arrayValue(foundation.recommendations),
        },
    brandVoice,
    personality,
    foundation: {
      summary: cleanString(foundation.summary) || cleanString(raw?.summary),
      positioning: cleanString(foundation.positioning) || cleanString(rawBrandStrategy.positioning),
      strategy: cleanString(foundation.strategy) || cleanString(rawBrandStrategy.description),
      mission: cleanString(foundation.mission) || cleanString(rawBrandStrategy.mission),
      vision: cleanString(foundation.vision) || cleanString(rawBrandStrategy.vision),
      brandPromise: cleanString(foundation.brandPromise) || cleanString(rawBrandStrategy.brandPromise),
      targetAudience: cleanString(foundation.targetAudience) || cleanString(raw?.targetAudience),
      brandVoice,
      toneOfVoice: arrayValue(foundation.toneOfVoice).length
        ? arrayValue(foundation.toneOfVoice)
        : arrayValue(rawBrandVoice.toneWords),
      personality,
      keywords: arrayValue(foundation.keywords).length
        ? arrayValue(foundation.keywords)
        : arrayValue(raw?.keywords),
      coreValues: arrayValue(foundation.coreValues).length
        ? arrayValue(foundation.coreValues)
        : arrayValue(raw?.coreValues),
      recommendations: arrayValue(foundation.recommendations).length
        ? arrayValue(foundation.recommendations)
        : arrayValue(raw?.recommendations),
    },
  };
}

function buildPrompt({
  businessName,
  industry,
  audience,
  style,
  description,
  projectJourney,
}: {
  businessName: string;
  industry: string;
  audience: string;
  style: string;
  description: string;
  projectJourney: Record<string, unknown>;
}) {
  return `
You are a senior brand strategist and creative director inside Heyy Studio.

Create a complete premium Brand Blueprint for this business.

Business name: ${businessName}
Industry: ${industry}
Audience: ${audience}
Style direction: ${style}
Extra notes: ${description || "None"}
Selected project journey and scope: ${JSON.stringify(projectJourney)}

Important positioning:
- This output is an AI creative direction / Brand Blueprint.
- Make the strategy specific to the selected journey and deliverables. Do not fill the document with generic advice.
- Do not claim that AI-generated logos, images or mockups are production-ready.
- Final vector logos, editable source files, print-ready files and launch-ready assets require expert production.
- Image/logo/moodboard outputs should remain directions/prompts/demo concepts for now.
- Text should be concise, commercially useful and suitable for a professional brand document.
- Avoid generic buzzwords such as "innovative", "dynamic" and "cutting-edge" unless they are clearly justified.
- Do not repeat the same idea across multiple fields.
- Return ONLY valid JSON. No markdown. No explanation.

JSON shape:
{
  "foundation": {
    "summary": "1 concise paragraph describing the brand direction",
    "positioning": "short strategic positioning statement",
    "strategy": "1 to 2 paragraphs explaining the strategic opportunity and how the brand should compete",
    "mission": "clear practical mission statement",
    "vision": "clear aspirational vision statement",
    "brandPromise": "clear promise to the customer",
    "targetAudience": "specific audience description, not generic",
    "brandVoice": {
      "headline": "short voice headline",
      "description": "1 paragraph explaining how the brand should sound",
      "toneWords": ["4 to 6 tone words"]
    },
    "toneOfVoice": ["4 to 6 practical tone principles"],
    "personality": {
      "headline": "short personality headline",
      "traits": ["4 to 6 traits"]
    },
    "keywords": ["6 to 10 brand keywords"],
    "coreValues": ["4 to 6 values"],
    "recommendations": ["4 to 6 actionable creative recommendations"]
  },
  "summary": "same as foundation.summary for backward compatibility",
  "brandStrategy": {
    "positioning": "same as foundation.positioning",
    "description": "same as foundation.strategy"
  },
  "brandVoice": {
    "headline": "same as foundation.brandVoice.headline",
    "description": "same as foundation.brandVoice.description",
    "toneWords": ["same as foundation.brandVoice.toneWords"]
  },
  "personality": {
    "headline": "same as foundation.personality.headline",
    "traits": ["same as foundation.personality.traits"]
  },
  "taglines": ["10 tagline strings"],
  "colourPalette": [
    {
      "name": "string",
      "hex": "#000000",
      "rgb": "0, 0, 0",
      "cmyk": "0, 0, 0, 100",
      "usage": "clear usage guidance"
    }
  ],
  "typography": [
    {
      "role": "Heading",
      "font": "Google Font name",
      "fallback": "string",
      "reason": "why this font fits the brand",
      "sourceUrl": "https://fonts.google.com/specimen/Font+Name"
    }
  ],
  "logoDirections": [
    {
      "title": "string",
      "description": "string",
      "prompt": "image generation prompt for a demo logo concept only",
      "productionNote": "short note explaining that expert vector refinement is required before real use"
    }
  ],
  "moodboardPrompts": ["string"]
}

Rules:
- foundation must be fully completed. Do not leave mission, vision, targetAudience, keywords, coreValues or recommendations empty.
- taglines must contain exactly 10 items.
- colourPalette must contain 4 to 6 items and each colour must include HEX, RGB and CMYK.
- typography must contain 2 to 3 Google Fonts.
- logoDirections must contain exactly 3 directions and are creative directions only, not production-ready logos.
- moodboardPrompts must contain 4 to 6 prompts.
- All JSON arrays must contain strings or objects only. No trailing commas.
`;
}

function publicGenerationError(message: string) {
  if (/content|safety|policy|moderation/i.test(message)) {
    return "This Brand Studio request could not be completed. Adjust the project description and try again. Your credits were returned.";
  }
  return "Brand workspace generation could not be completed. Your credits were returned.";
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
