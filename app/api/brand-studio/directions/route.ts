import "server-only";
import { NextResponse } from "next/server";
import { requireBrandImageProject } from "@/lib/brand/generated-image-storage";
import { CreditError } from "@/lib/credits/server";
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
        const result = search(item);
        if (result) return result;
      }
    }
    if (typeof value === "object") {
      if (typeof value.text === "string" && value.text.trim()) return value.text.trim();
      for (const item of Object.values(value)) {
        const result = search(item);
        if (result) return result;
      }
    }
    return null;
  };
  return search(data?.output);
}

function list(value: any) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normaliseDirection(direction: any, index: number) {
  return {
    title: direction?.title || `Creative Direction ${index + 1}`,
    conceptIdea: direction?.conceptIdea || direction?.idea || "A distinctive concept route.",
    strategicRole: direction?.strategicRole || direction?.strategy || "A clear strategic role for the brand.",
    brandStory: direction?.brandStory || direction?.story || "A concise brand story for this route.",
    emotionalTone: list(direction?.emotionalTone),
    visualWorld: direction?.visualWorld || "A coherent visual world.",
    imageStyle: direction?.imageStyle || "Consistent image art direction.",
    colourBehaviour: direction?.colourBehaviour || "Clear palette hierarchy.",
    graphicLanguage: direction?.graphicLanguage || "A repeatable graphic system.",
    differentiation: direction?.differentiation || "A meaningful point of difference.",
    bestFor: list(direction?.bestFor),
    keywords: list(direction?.keywords),
    imagePrompt:
      direction?.imagePrompt ||
      "Premium square brand creative-direction board, curated imagery, textures, colour behaviour and graphic devices, no logo, no long readable text.",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const brand = body?.brand || {};
    const journey = brand?.projectJourney || {};

    if (!project?.id || !project?.project_name) {
      return NextResponse.json({ error: "Project ID and project name are required." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is missing." }, { status: 500 });
    }

    const prompt = `
You are Heyy Studio's senior creative director.

Generate exactly three genuinely different creative directions for this brand project. These are not logo directions and not typography directions. Each route must explain a central concept, strategic role, brand story, emotional tone, visual world, image style, colour behaviour, graphic language, differentiation and best applications.

Project:
${JSON.stringify({
  name: project.project_name,
  industry: project.industry,
  audience: project.audience,
  style: project.style,
  description: project.description,
  journey,
})}

Existing brand foundation:
${JSON.stringify(brand?.foundation || brand?.brandStrategy || {})}

Return only valid JSON:
{
  "directions": [
    {
      "title": "distinctive direction name",
      "conceptIdea": "central creative idea",
      "strategicRole": "how the route helps the brand compete",
      "brandStory": "short narrative",
      "emotionalTone": ["4 words"],
      "visualWorld": "imagery and atmosphere",
      "imageStyle": "photography or illustration behaviour",
      "colourBehaviour": "palette logic",
      "graphicLanguage": "shapes, grids and layout behaviour",
      "differentiation": "why this is different",
      "bestFor": ["relevant applications"],
      "keywords": ["4 to 6 words"],
      "imagePrompt": "premium square creative-direction board prompt, no logo, no long readable text"
    }
  ]
}

Rules:
- Exactly three directions.
- Do not repeat the same concept with different adjectives.
- Respect any preserve or keep-current instructions.
- No claims of production-ready assets.
`;

    const context = await requireBrandImageProject(project.id);
    const metadata = { project_id: context.projectId, studio: "brand_studio", tool: "creative_directions" };
    const { result, job } = await runSynchronousGenerationJob({
      admin: context.admin,
      userId: context.userId,
      request,
      scope: "brand-creative-directions",
      dedupe: { projectId: context.projectId, project, brand },
      projectId: context.projectId,
      tool: "brand_creative_directions",
      provider: "openai",
      action: "brandDirectionText",
      input: { project, brand },
      metadata,
      publicError: "Brand directions could not be completed. Your credits were returned.",
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
            max_output_tokens: 7000,
            text: { format: { type: "json_object" } },
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || "Direction generation failed.");
        const output = extractOutputText(data);
        if (!output) throw new Error("OpenAI returned an empty creative-direction response.");
        const parsed = JSON.parse(output);
        const directions = (Array.isArray(parsed?.directions) ? parsed.directions : []).slice(0, 3).map(normaliseDirection);
        if (directions.length !== 3) throw new Error("OpenAI did not return three creative directions.");
        return { directions, usage: data?.usage || null };
      },
    });
    return NextResponse.json({ ...result, creditsUsed: job.creditsReserved });
  } catch (error) {
    console.error("Brand direction generation error:", error);
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate creative directions." },
      { status: 500 },
    );
  }
}
