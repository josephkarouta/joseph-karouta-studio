import "server-only";
import { NextResponse } from "next/server";
import { requireBrandImageProject } from "@/lib/brand/generated-image-storage";
import { CreditError } from "@/lib/credits/server";
import { extractLogoPaletteFromUrl } from "@/lib/brand/logo-palette";
import { runSynchronousGenerationJob } from "@/lib/generation-jobs/synchronous";

export const runtime = "nodejs";

function extractOutputText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
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
    }
    if (typeof value === "object") {
      if (typeof value.text === "string" && value.text.trim()) return value.text.trim();
      for (const item of Object.values(value)) {
        const found = search(item);
        if (found) return found;
      }
    }
    return null;
  };
  return search(data?.output);
}

function list(value: any) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normaliseGuidelines(raw: any, brand: any, project: any) {
  const foundation = raw?.foundation || {};
  const identity = raw?.identity || {};
  const journey = brand?.projectJourney || {};
  const applications = Array.isArray(raw?.applications) ? raw.applications : [];
  const checklist = Array.isArray(raw?.checklist) ? raw.checklist : [];

  return {
    foundation: {
      overview: foundation?.overview || foundation?.brandOverview || brand?.foundation?.summary || "",
      purpose: foundation?.purpose || brand?.foundation?.purpose || "",
      positioning: foundation?.positioning || brand?.foundation?.positioning || "",
      mission: foundation?.mission || brand?.foundation?.mission || "",
      vision: foundation?.vision || brand?.foundation?.vision || "",
      brandPromise: foundation?.brandPromise || brand?.foundation?.brandPromise || "",
      audience: foundation?.audience || brand?.foundation?.targetAudience || project?.audience || "",
      audienceNeeds: list(foundation?.audienceNeeds || brand?.foundation?.audienceNeeds),
      values: list(foundation?.values || brand?.foundation?.coreValues),
      personality: list(foundation?.personality || brand?.foundation?.personality?.traits),
      voice: {
        headline: foundation?.voice?.headline || brand?.foundation?.brandVoice?.headline || "Brand Voice",
        description: foundation?.voice?.description || brand?.foundation?.brandVoice?.description || "",
        toneWords: list(foundation?.voice?.toneWords || brand?.foundation?.brandVoice?.toneWords),
        principles: list(foundation?.voice?.principles),
        dos: list(foundation?.voice?.dos || brand?.foundation?.dos),
        donts: list(foundation?.voice?.donts || brand?.foundation?.donts),
      },
      messagingPillars: list(foundation?.messagingPillars || brand?.foundation?.messagingPillars),
      proofPoints: list(foundation?.proofPoints || brand?.foundation?.proofPoints),
    },
    identity: {
      creativeDirection: identity?.creativeDirection || brand?.workspaceContext?.selectedDirection || null,
      logoSystem: {
        status: identity?.logoSystem?.status || journey?.logoAction || "none",
        rationale: identity?.logoSystem?.rationale || "",
        primaryUse: identity?.logoSystem?.primaryUse || "",
        variants: list(identity?.logoSystem?.variants),
        clearSpace: identity?.logoSystem?.clearSpace || "",
        minimumSize: identity?.logoSystem?.minimumSize || "",
        backgroundRules: list(identity?.logoSystem?.backgroundRules),
        donts: list(identity?.logoSystem?.donts),
      },
      colourSystem: {
        rationale: identity?.colourSystem?.rationale || "",
        hierarchy: list(identity?.colourSystem?.hierarchy),
        accessibility: list(identity?.colourSystem?.accessibility),
        donts: list(identity?.colourSystem?.donts),
      },
      typographySystem: {
        rationale: identity?.typographySystem?.rationale || "",
        hierarchy: list(identity?.typographySystem?.hierarchy),
        digitalRules: list(identity?.typographySystem?.digitalRules),
        printRules: list(identity?.typographySystem?.printRules),
      },
      imagery: {
        direction: identity?.imagery?.direction || "",
        subjects: list(identity?.imagery?.subjects),
        composition: list(identity?.imagery?.composition),
        lighting: list(identity?.imagery?.lighting),
        donts: list(identity?.imagery?.donts),
      },
      graphicLanguage: {
        devices: list(identity?.graphicLanguage?.devices),
        layout: list(identity?.graphicLanguage?.layout),
        iconography: list(identity?.graphicLanguage?.iconography),
        motion: list(identity?.graphicLanguage?.motion),
      },
    },
    colourPalette:
      Array.isArray(raw?.colourPalette) && raw.colourPalette.length
        ? raw.colourPalette
        : Array.isArray(brand?.colourPalette)
          ? brand.colourPalette
          : Array.isArray(brand?.colorPalette)
            ? brand.colorPalette
            : [],
    applications,
    checklist,
    summary: raw?.summary || `${project?.project_name || "The brand"} has a tailored brand-guideline system aligned to the selected project scope.`,

    // Backward-compatible fields used by older Brand Book modules and exports.
    brandOverview: foundation?.overview || foundation?.brandOverview || brand?.foundation?.summary || "",
    positioning: foundation?.positioning || brand?.foundation?.positioning || "",
    mission: foundation?.mission || brand?.foundation?.mission || "",
    vision: foundation?.vision || brand?.foundation?.vision || "",
    brandPromise: foundation?.brandPromise || brand?.foundation?.brandPromise || "",
    targetAudience: foundation?.audience || brand?.foundation?.targetAudience || project?.audience || "",
    personality: list(foundation?.personality || brand?.foundation?.personality?.traits),
    coreValues: list(foundation?.values || brand?.foundation?.coreValues),
    toneOfVoice: {
      headline: foundation?.voice?.headline || "Brand Voice",
      description: foundation?.voice?.description || "",
      toneWords: list(foundation?.voice?.toneWords),
      principles: list(foundation?.voice?.principles),
      dos: list(foundation?.voice?.dos),
      donts: list(foundation?.voice?.donts),
    },
    colourPsychology: identity?.colourSystem?.rationale || "",
    typographyRationale: identity?.typographySystem?.rationale || "",
    logoRationale: identity?.logoSystem?.rationale || "",
    imageryGuidelines: identity?.imagery?.direction || "",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const brand = body?.brand || {};
    const journey = brand?.projectJourney || {};
    const projectName = project?.project_name || project?.name || brand?.businessName || "Brand Project";
    const selectedLogo = brand?.workspaceContext?.selectedLogo || null;
    const logoUrl =
      selectedLogo?.imageUrl ||
      selectedLogo?.image_url ||
      selectedLogo?.file_url ||
      journey?.existingLogoUrl ||
      "";
    let extractedLogoPalette: any[] = [];
    if (typeof logoUrl === "string" && logoUrl.trim()) {
      try {
        extractedLogoPalette = await extractLogoPaletteFromUrl(logoUrl.trim());
      } catch (paletteError) {
        console.warn("Brand guideline logo palette extraction skipped:", paletteError);
      }
    }
    const brandWithLogoPalette = extractedLogoPalette.length
      ? {
          ...brand,
          colourPalette: extractedLogoPalette,
          colorPalette: extractedLogoPalette,
        }
      : brand;
    if (!project?.id) return NextResponse.json({ error: "A Brand project ID is required." }, { status: 400 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is missing." }, { status: 500 });
    }

    const prompt = `
You are Heyy Studio's senior brand strategist and brand-guidelines director.

Create a tailored, practical guideline system for this exact project scope. Do not force modules that the user did not request. A business-card-only project should not pretend to be a complete new identity. A guidelines-only project using an existing logo should build rules around that identity. A rebrand should clearly distinguish what is preserved from what changes.

Project:
${JSON.stringify({
  name: projectName,
  industry: project?.industry,
  audience: project?.audience,
  style: project?.style,
  description: project?.description,
})}

Project journey:
${JSON.stringify(journey)}

Existing brand system and selected workspace context:
${JSON.stringify(brandWithLogoPalette)}

Return only valid JSON:
{
  "foundation": {
    "overview": "concise overview",
    "purpose": "why the brand exists",
    "positioning": "positioning statement",
    "mission": "mission",
    "vision": "vision",
    "brandPromise": "promise",
    "audience": "specific audience",
    "audienceNeeds": ["4 to 6 needs"],
    "values": ["4 to 6 values"],
    "personality": ["4 to 6 traits"],
    "voice": {
      "headline": "voice headline",
      "description": "voice description",
      "toneWords": ["4 to 6 words"],
      "principles": ["4 to 6 practical principles"],
      "dos": ["4 practical examples"],
      "donts": ["4 practical warnings"]
    },
    "messagingPillars": ["3 to 5 pillars"],
    "proofPoints": ["3 to 5 proof ideas"]
  },
  "identity": {
    "creativeDirection": {
      "summary": "selected-direction summary",
      "mustPreserve": ["important rules"],
      "avoid": ["important warnings"]
    },
    "logoSystem": {
      "status": "create | refine | keep | none",
      "rationale": "project-specific rationale",
      "primaryUse": "primary usage guidance",
      "variants": ["required variants"],
      "clearSpace": "conceptual clear-space guidance",
      "minimumSize": "conceptual minimum-size guidance",
      "backgroundRules": ["background rules"],
      "donts": ["logo misuse rules"]
    },
    "colourSystem": {
      "rationale": "colour strategy",
      "hierarchy": ["primary, secondary, accent and neutral rules"],
      "accessibility": ["contrast and accessibility rules"],
      "donts": ["colour misuse rules"]
    },
    "typographySystem": {
      "rationale": "typography strategy",
      "hierarchy": ["display, heading, body and caption rules"],
      "digitalRules": ["digital rules"],
      "printRules": ["print rules"]
    },
    "imagery": {
      "direction": "image-style direction",
      "subjects": ["preferred subjects"],
      "composition": ["composition rules"],
      "lighting": ["lighting rules"],
      "donts": ["image misuse rules"]
    },
    "graphicLanguage": {
      "devices": ["shapes, lines, patterns or frames"],
      "layout": ["grid and composition rules"],
      "iconography": ["icon rules"],
      "motion": ["motion principles"]
    }
  },
  "applications": [
    {
      "id": "selected deliverable ID only",
      "title": "display title",
      "objective": "what the application must achieve",
      "requiredContent": ["required content"],
      "layoutRules": ["layout rules"],
      "brandRules": ["identity rules"],
      "productionChecklist": ["expert-production requirements"]
    }
  ],
  "checklist": [
    { "id": "stable-id", "label": "specific readiness item", "category": "Foundation | Direction | Logo | Identity | Application | Production", "required": true, "completionRule": "what makes this complete" }
  ],
  "summary": "concise completion summary"
}

Rules:
- Applications must contain only IDs included in selectedDeliverables that are real applications.
- Logo rules must match logoAction. If logoAction is none, explain that logo rules are not part of scope.
- Checklist must be project-specific, not a generic fixed list.
- Clearly distinguish AI concept guidance from production-ready deliverables.
- When a selected or retained logo is available, the colour system must use the supplied logo-extracted palette as authoritative. Do not replace it with unrelated invented colours.
- Do not claim trademark, legal, print or vector completion.
`;

    const context = await requireBrandImageProject(project.id);
    const metadata = { project_id: context.projectId, studio: "brand_studio", tool: "brand_guidelines" };
    const { result, job } = await runSynchronousGenerationJob({
      admin: context.admin,
      userId: context.userId,
      request,
      scope: "brand-guidelines",
      dedupe: { projectId: context.projectId, project, brand: brandWithLogoPalette },
      projectId: context.projectId,
      tool: "brand_guidelines",
      provider: "openai",
      action: "brandGuidelines",
      input: { project, brand: brandWithLogoPalette },
      metadata,
      publicError: "Brand guidelines could not be completed. Your credits were returned.",
      work: async () => {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENAI_TEXT_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
            input: prompt,
            max_output_tokens: 12000,
            text: { format: { type: "json_object" } },
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || "Guideline generation failed.");
        const output = extractOutputText(data);
        if (!output) throw new Error("Guidelines generation returned an empty response.");
        const parsed = JSON.parse(output);
        return {
          guidelines: normaliseGuidelines(parsed, brandWithLogoPalette, project),
          usage: data?.usage || null,
        };
      },
    });
    return NextResponse.json({ success: true, ...result, creditsUsed: job.creditsReserved });
  } catch (error) {
    console.error("Brand guideline generation error:", error);
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate brand guidelines." },
      { status: 500 },
    );
  }
}
