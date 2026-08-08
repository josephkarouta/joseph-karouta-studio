import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, withCreditReservation } from "@/lib/credits/server";

export const runtime = "nodejs";

type BrandStudioInput = {
  businessName: string;
  industry: string;
  audience: string;
  style: string;
  description?: string;
  projectJourney?: Record<string, unknown>;
};

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
    }
    if (typeof value === "object") {
      if (typeof value.text === "string" && value.text.trim()) return value.text.trim();
      if (typeof value.content === "string" && value.content.trim()) return value.content.trim();
      for (const item of Object.values(value)) {
        const found = search(item);
        if (found) return found;
      }
    }
    return null;
  };

  return search(data?.output);
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function normaliseDirection(direction: any, index: number) {
  const fallbackTitles = ["Distinctive Core", "Human Expression", "Confident System"];
  return {
    title: direction?.title || fallbackTitles[index] || `Creative Direction ${index + 1}`,
    conceptIdea:
      direction?.conceptIdea ||
      direction?.idea ||
      direction?.summary ||
      "A clear creative route built from the project strategy and audience.",
    strategicRole:
      direction?.strategicRole ||
      direction?.strategy ||
      "Explain how this route helps the brand compete and become recognisable.",
    brandStory:
      direction?.brandStory ||
      direction?.story ||
      direction?.visualDirection ||
      "A focused story that connects the business purpose with a distinctive visual world.",
    emotionalTone: asArray(direction?.emotionalTone || direction?.toneWords),
    visualWorld:
      direction?.visualWorld ||
      direction?.visualDirection ||
      "A coherent visual world with consistent colour, image and composition behaviour.",
    imageStyle:
      direction?.imageStyle ||
      "Curated imagery with a consistent subject, lighting and art-direction approach.",
    colourBehaviour:
      direction?.colourBehaviour ||
      "A controlled palette hierarchy with purposeful accent colour usage.",
    graphicLanguage:
      direction?.graphicLanguage ||
      "A repeatable layout, shape and graphic-device system.",
    differentiation:
      direction?.differentiation ||
      "The element that makes this direction meaningfully different from the other routes.",
    bestFor: asArray(direction?.bestFor || direction?.applications),
    keywords: asArray(direction?.keywords),
    imagePrompt:
      direction?.imagePrompt ||
      "Premium square brand direction board showing imagery, materials, colour behaviour, graphic devices and composition. No logo. No long readable text.",
  };
}

function normaliseBrandSystem(raw: any, input: BrandStudioInput) {
  const foundation = raw?.foundation || {};
  // The user's saved scope is authoritative. AI may enrich content, but it must
  // never change the journey, deliverables or workspace sections.
  const projectJourney = {
    ...(raw?.projectJourney || {}),
    ...(input.projectJourney || {}),
    projectName: input.businessName,
  };
  const creativeDirections = asArray(raw?.creativeDirections)
    .slice(0, 3)
    .map(normaliseDirection);
  const logoDirections = asArray(raw?.logoDirections).slice(0, 3).map((direction: any, index: number) => ({
    title: direction?.title || `Logo Direction ${index + 1}`,
    conceptIdea: direction?.conceptIdea || direction?.description || "A distinct logo concept route.",
    recommendedType: direction?.recommendedType || "Combination mark",
    symbolLogic: direction?.symbolLogic || direction?.description || "A simple and ownable symbol idea.",
    wordmarkBehaviour: direction?.wordmarkBehaviour || "Clear wordmark proportions and spacing.",
    shapeLanguage: direction?.shapeLanguage || "A restrained and scalable shape system.",
    scalability: direction?.scalability || "Must remain legible from favicon to signage.",
    avoid: asArray(direction?.avoid),
    prompt: direction?.prompt || "Premium abstract logo concept on a clean neutral presentation background.",
    productionNote:
      direction?.productionNote ||
      "AI concept only. Final vector drawing, spacing, kerning, variants and trademark review require expert production.",
  }));

  const normalised = {
    ...raw,
    projectJourney,
    businessName: input.businessName,
    summary: raw?.summary || foundation?.summary || "",
    foundation: {
      summary: foundation?.summary || raw?.summary || "",
      purpose: foundation?.purpose || "",
      positioning: foundation?.positioning || raw?.brandStrategy?.positioning || "",
      strategy: foundation?.strategy || raw?.brandStrategy?.description || "",
      mission: foundation?.mission || "",
      vision: foundation?.vision || "",
      brandPromise: foundation?.brandPromise || "",
      targetAudience: foundation?.targetAudience || input.audience,
      audienceNeeds: asArray(foundation?.audienceNeeds),
      coreValues: asArray(foundation?.coreValues),
      personality: {
        headline: foundation?.personality?.headline || raw?.personality?.headline || "Brand Personality",
        traits: asArray(foundation?.personality?.traits || raw?.personality?.traits),
      },
      brandVoice: {
        headline: foundation?.brandVoice?.headline || raw?.brandVoice?.headline || "Brand Voice",
        description: foundation?.brandVoice?.description || raw?.brandVoice?.description || "",
        toneWords: asArray(foundation?.brandVoice?.toneWords || raw?.brandVoice?.toneWords),
      },
      messagingPillars: asArray(foundation?.messagingPillars),
      proofPoints: asArray(foundation?.proofPoints),
      dos: asArray(foundation?.dos),
      donts: asArray(foundation?.donts),
      keywords: asArray(foundation?.keywords),
      recommendations: asArray(foundation?.recommendations),
    },
    brandStrategy: raw?.brandStrategy || {
      positioning: foundation?.positioning || "",
      description: foundation?.strategy || "",
      mission: foundation?.mission || "",
      vision: foundation?.vision || "",
      brandPromise: foundation?.brandPromise || "",
    },
    brandVoice: raw?.brandVoice || foundation?.brandVoice || {},
    personality: raw?.personality || foundation?.personality || {},
    creativeDirections,
    moodboardPrompts: creativeDirections.map((direction: any) => direction.imagePrompt),
    logoDirections,
    applicationPlan: asArray(raw?.applicationPlan),
    guidelinePlan: raw?.guidelinePlan || {},
    taglines: asArray(raw?.taglines).slice(0, 10),
    colourPalette: asArray(raw?.colourPalette || raw?.colorPalette).slice(0, 6),
    typography: asArray(raw?.typography).slice(0, 3),
  };

  if (projectJourney?.includeCreativeDirections === false) {
    normalised.creativeDirections = [];
    normalised.moodboardPrompts = [];
  } else {
    while (normalised.creativeDirections.length < 3) {
      normalised.creativeDirections.push(normaliseDirection({}, normalised.creativeDirections.length));
    }
    normalised.moodboardPrompts = normalised.creativeDirections.map((direction: any) => direction.imagePrompt);
  }

  if (projectJourney?.logoAction !== "create" && projectJourney?.logoAction !== "refine") {
    normalised.logoDirections = [];
  }

  return normalised;
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const input = (await request.json()) as BrandStudioInput;
    const businessName = input.businessName?.trim();
    const industry = input.industry?.trim();
    const audience = input.audience?.trim();
    const style = input.style?.trim();

    if (!businessName || !industry || !audience || !style) {
      return NextResponse.json(
        { success: false, error: "Complete business name, industry, audience and style direction." },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY is missing from the server environment." },
        { status: 500 },
      );
    }

    const projectJourney = input.projectJourney || {};
    const includeDirections = projectJourney?.includeCreativeDirections !== false;
    const logoAction = String(projectJourney?.logoAction || "create");
    const includeLogo = logoAction === "create" || logoAction === "refine";

    const prompt = `
You are Heyy Studio's senior brand strategist and creative director.

Prepare a tailored Brand Studio blueprint. The user may want a complete brand, a rebrand, an existing-logo system, one application, stationery, a logo-only project or guidelines only. Never force a complete rebrand when the selected journey asks to preserve the current identity.

PROJECT
Business name: ${businessName}
Industry: ${industry}
Audience: ${audience}
Preferred style: ${style}
Additional context: ${input.description?.trim() || "None"}
Selected journey: ${JSON.stringify(projectJourney)}

WORKFLOW RULES
- Respect selectedDeliverables, logoAction and directionMode.
- If directionMode is keep-current, do not invent a new visual identity. Describe how to apply or organise the existing identity.
- If logoAction is keep or none, logoDirections must be an empty array.
- If logoAction is refine, each logo direction must explain what existing equity should be preserved.
- Creative Directions are conceptual routes, not typography or logo directions. Focus on idea, story, emotional tone, visual world, image style, colour behaviour, graphic language, differentiation and best applications.
- AI outputs are concept previews. Final vector, editable, trademark-reviewed, print-ready and launch-ready files require expert production.
- Write concise, specific, commercially useful content. Avoid generic buzzwords and repetition.
- Return ONLY valid JSON.

JSON SHAPE
{
  "projectJourney": {
    "journeyId": "same as input",
    "journeyTitle": "same as input",
    "selectedDeliverables": ["same IDs as input"],
    "logoAction": "create | refine | keep | none",
    "directionMode": "explore | keep-current",
    "includeCreativeDirections": true,
    "includeGuidelines": true,
    "preserveNotes": "same as input",
    "changeNotes": "same as input",
    "customScope": "same as input"
  },
  "foundation": {
    "summary": "one concise brand summary",
    "purpose": "why the brand exists",
    "positioning": "specific positioning statement",
    "strategy": "one or two concise paragraphs",
    "mission": "practical mission",
    "vision": "aspirational vision",
    "brandPromise": "customer promise",
    "targetAudience": "specific audience description",
    "audienceNeeds": ["4 to 6 needs"],
    "coreValues": ["4 to 6 values"],
    "personality": { "headline": "short title", "traits": ["4 to 6 traits"] },
    "brandVoice": { "headline": "short title", "description": "one paragraph", "toneWords": ["4 to 6 words"] },
    "messagingPillars": ["3 to 5 pillars"],
    "proofPoints": ["3 to 5 credible proof ideas"],
    "dos": ["4 practical language examples"],
    "donts": ["4 practical language warnings"],
    "keywords": ["6 to 10 words"],
    "recommendations": ["4 to 6 actions"]
  },
  "creativeDirections": [
    {
      "title": "distinctive direction name",
      "conceptIdea": "the central concept",
      "strategicRole": "how this route helps the brand compete",
      "brandStory": "short direction narrative",
      "emotionalTone": ["4 tone words"],
      "visualWorld": "imagery, composition and atmosphere",
      "imageStyle": "photography or illustration behaviour",
      "colourBehaviour": "palette hierarchy and usage",
      "graphicLanguage": "shapes, grid, devices and layout behaviour",
      "differentiation": "why this route is different",
      "bestFor": ["relevant touchpoints"],
      "keywords": ["4 to 6 words"],
      "imagePrompt": "detailed premium square creative-direction board prompt; no logo and no long readable text"
    }
  ],
  "logoDirections": [
    {
      "title": "logo direction name",
      "conceptIdea": "central logo idea",
      "recommendedType": "wordmark | symbol | monogram | combination mark",
      "symbolLogic": "meaning and construction logic",
      "wordmarkBehaviour": "letterform and name behaviour",
      "shapeLanguage": "shape and geometry approach",
      "scalability": "small and large usage guidance",
      "avoid": ["3 to 5 warnings"],
      "prompt": "clean premium logo concept prompt",
      "productionNote": "expert production note"
    }
  ],
  "taglines": ["10 concise options"],
  "colourPalette": [
    { "name": "colour name", "hex": "#000000", "rgb": "0, 0, 0", "cmyk": "0, 0, 0, 100", "role": "Primary | Secondary | Accent | Neutral", "usage": "specific usage" }
  ],
  "typography": [
    { "role": "Primary heading", "font": "Google Font name", "fallback": "fallback", "reason": "why it fits", "sourceUrl": "Google Fonts URL" }
  ],
  "applicationPlan": [
    { "id": "selected deliverable ID", "title": "display title", "objective": "what this application must achieve", "contentNeeds": ["required content"], "designPriorities": ["3 to 5 priorities"], "productionNote": "what expert production must complete" }
  ],
  "guidelinePlan": {
    "foundationModules": ["relevant modules"],
    "identityModules": ["relevant modules"],
    "applicationModules": ["selected deliverable IDs"],
    "readinessNotes": ["project-specific checklist notes"]
  }
}

RULES
- creativeDirections must contain exactly ${includeDirections ? "3" : "0"} items.
- logoDirections must contain exactly ${includeLogo ? "3" : "0"} items.
- applicationPlan must contain one entry for every selected deliverable that is an application.
- colourPalette must contain 4 to 6 colours.
- typography must contain 2 to 3 fonts.
- taglines must contain exactly 10 items.
`;

    const { result, reservation } = await withCreditReservation({
      admin: auth.admin,
      userId: auth.user.id,
      action: "brandSystemText",
      metadata: { studio: "brand_studio", tool: "brand_blueprint", business_name: businessName },
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
        if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed.");
        const outputText = extractOutputText(data);
        if (!outputText) throw new Error("OpenAI returned an empty Brand Studio response.");
        let parsed: any;
        try {
          parsed = JSON.parse(outputText);
        } catch {
          throw new Error("Brand Studio JSON could not be parsed.");
        }
        return {
          brandSystem: normaliseBrandSystem(parsed, input),
          model: data?.model || process.env.OPENAI_TEXT_MODEL || null,
          usage: data?.usage || null,
        };
      },
    });

    return NextResponse.json({ success: true, ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Brand Studio generation error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Brand Studio generation failed." },
      { status: 500 },
    );
  }
}
