import { NextResponse } from "next/server";

function extractOutputText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const search = (value: any): string | null => {
    if (!value) return null;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = search(item);
        if (found) return found;
      }
    }

    if (typeof value === "object") {
      if (typeof value.text === "string" && value.text.trim()) {
        return value.text;
      }

      if (typeof value.content === "string" && value.content.trim()) {
        return value.content;
      }

      for (const key of Object.keys(value)) {
        const found = search(value[key]);
        if (found) return found;
      }
    }

    return null;
  };

  return search(data?.output);
}

function safeArray(value: any): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeGuidelines(raw: any, brand: any, projectName: string) {
  const foundation = raw?.foundation || raw || {};

  const brandVoice = foundation?.brandVoice || raw?.brandVoice || {};
  const personality = foundation?.personality || raw?.personality || {};

  const toneWords =
    safeArray(brandVoice?.toneWords).length > 0
      ? safeArray(brandVoice?.toneWords)
      : safeArray(brand?.brandVoice?.toneWords);

  const personalityTraits =
    safeArray(personality?.traits).length > 0
      ? safeArray(personality?.traits)
      : safeArray(brand?.personality?.traits || brand?.personality);

  return {
    brandOverview:
      foundation?.brandOverview ||
      foundation?.summary ||
      raw?.brandOverview ||
      brand?.summary ||
      `A clear brand system for ${projectName}.`,

    positioning:
      foundation?.positioning ||
      raw?.positioning ||
      brand?.brandStrategy?.positioning ||
      `${projectName} should be positioned as a focused and distinctive brand.`,

    strategy:
      foundation?.strategy ||
      raw?.strategy ||
      brand?.brandStrategy?.description ||
      "",

    mission:
      foundation?.mission ||
      raw?.mission ||
      brand?.foundation?.mission ||
      brand?.brandStrategy?.mission ||
      "",

    vision:
      foundation?.vision ||
      raw?.vision ||
      brand?.foundation?.vision ||
      brand?.brandStrategy?.vision ||
      "",

    brandPromise:
      foundation?.brandPromise ||
      raw?.brandPromise ||
      brand?.foundation?.brandPromise ||
      brand?.brandStrategy?.brandPromise ||
      "",

    targetAudience:
      foundation?.targetAudience ||
      raw?.targetAudience ||
      brand?.foundation?.targetAudience ||
      brand?.targetAudience ||
      "",

    personality:
      personalityTraits,

    coreValues:
      safeArray(foundation?.coreValues || raw?.coreValues),

    keywords:
      safeArray(foundation?.keywords || raw?.keywords || brand?.foundation?.keywords || brand?.keywords),

    recommendations:
      safeArray(
        foundation?.recommendations ||
          raw?.recommendations ||
          brand?.foundation?.recommendations ||
          brand?.recommendations
      ),

    toneOfVoice: {
      headline:
        brandVoice?.headline ||
        raw?.toneOfVoice?.headline ||
        brand?.brandVoice?.headline ||
        "Brand Voice",

      description:
        brandVoice?.description ||
        raw?.toneOfVoice?.description ||
        brand?.brandVoice?.description ||
        "",

      toneWords,

      principles:
        safeArray(
          foundation?.toneOfVoice ||
            raw?.toneOfVoice?.principles ||
            raw?.toneOfVoice?.traits ||
            toneWords
        ),
    },

    colourPsychology:
      raw?.colourPsychology ||
      foundation?.colourPsychology ||
      "Use the selected palette consistently to create recognition, contrast and emotional consistency across touchpoints.",

    typographyRationale:
      raw?.typographyRationale ||
      foundation?.typographyRationale ||
      "Typography should create clear hierarchy, confident headlines and readable supporting copy.",

    logoRationale:
      raw?.logoRationale ||
      foundation?.logoRationale ||
      "The selected logo should be treated as an AI creative direction and professionally redrawn before production use.",

    imageryGuidelines:
      raw?.imageryGuidelines ||
      foundation?.imageryGuidelines ||
      "Imagery should stay aligned with the selected creative direction and avoid mixed visual languages.",

    applications:
      raw?.applications ||
      foundation?.applications ||
      "Apply the brand direction consistently across website, social, presentation, print and client-facing applications.",

    summary:
      raw?.summary ||
      foundation?.summary ||
      `${projectName} has a clear creative direction that can be developed into production-ready brand assets by an expert.`,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const project = body?.project || {};
    const brand = body?.brand || {};

    const projectName =
      project?.project_name ||
      project?.name ||
      brand?.businessName ||
      "Brand Project";

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY is missing from environment variables.",
        },
        { status: 500 }
      );
    }

    const prompt = `
You are a senior brand strategist and creative director.

Your task is to expand an existing AI-generated brand system into professional Brand Book text.

Important:
- Do not invent a completely new brand direction.
- Use the existing brand system as the source of truth.
- The output is a Brand Blueprint / creative direction document.
- Be honest: AI-generated logos and images are concept previews, not final production-ready files.
- Anything requiring vector files, transparent logo systems, print-ready files, editable files, trademark review or launch-ready assets requires expert production.
- Write concise, commercially useful content.
- Avoid generic buzzwords.
- Return ONLY valid JSON. No markdown. No explanation.

Project:
${JSON.stringify(
  {
    projectName,
    industry: project?.industry,
    audience: project?.audience,
    style: project?.style,
  },
  null,
  2
)}

Existing brand system:
${JSON.stringify(brand, null, 2)}

Return this exact JSON shape:
{
  "foundation": {
    "brandOverview": "1 concise paragraph describing the brand direction",
    "positioning": "short strategic positioning statement",
    "strategy": "1 to 2 paragraphs explaining the brand strategy and competitive opportunity",
    "mission": "clear practical mission statement",
    "vision": "clear aspirational vision statement",
    "brandPromise": "clear promise the brand makes to customers",
    "targetAudience": "specific audience summary based on the project",
    "brandVoice": {
      "headline": "short voice headline",
      "description": "1 paragraph explaining how the brand should sound",
      "toneWords": ["4 to 6 tone words"]
    },
    "toneOfVoice": ["4 to 6 practical tone principles"],
    "personality": {
      "headline": "short personality headline",
      "traits": ["4 to 6 personality traits"]
    },
    "keywords": ["6 to 10 brand keywords"],
    "coreValues": ["4 to 6 core values"],
    "recommendations": ["4 to 6 actionable creative recommendations"],
    "colourPsychology": "how the selected palette should be used emotionally and strategically",
    "typographyRationale": "how the typography supports the brand",
    "logoRationale": "how the selected AI logo direction should be treated and refined",
    "imageryGuidelines": "imagery and visual direction guidance",
    "applications": "how the brand direction should be applied across touchpoints"
  },
  "summary": "short summary of the completed Brand Blueprint"
}

Rules:
- Do not leave any field empty.
- Make mission and vision distinct.
- Recommendations must be actionable, not generic.
- Keep all text suitable for display inside a brand guidelines interface.
- Do not mention that you are an AI.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_TEXT_MODEL ||
          process.env.OPENAI_MODEL ||
          "gpt-4.1-mini",
        input: prompt,
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Creative generation request failed.",
          details: data,
        },
        { status: 500 }
      );
    }

    const outputText = extractOutputText(data);

    if (!outputText) {
      console.error("Creative generation raw response:", JSON.stringify(data, null, 2));

      return NextResponse.json(
        {
          success: false,
          error: "No structured brand guidelines were returned.",
          details: data,
        },
        { status: 500 }
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      console.error("Brand guidelines JSON parse error:", parseError);
      console.error("Raw output:", outputText);

      return NextResponse.json(
        {
          success: false,
          error: "Brand guidelines JSON could not be parsed.",
          raw: outputText,
        },
        { status: 500 }
      );
    }

    const guidelines = normalizeGuidelines(parsed, brand, projectName);

    return NextResponse.json({
      success: true,
      guidelines,
    });
  } catch (error) {
    console.error("Brand guidelines generation error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong while generating brand guidelines.",
      },
      { status: 500 }
    );
  }
}
