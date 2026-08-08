import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { projectName, industry, audience, style, brandSystem } = body;

    if (!projectName || !brandSystem) {
      return NextResponse.json(
        { error: "Missing projectName or brandSystem." },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are Heyy Studio, a senior brand strategist and creative director. Generate professional brand guidelines. Return only valid JSON.",
        },
        {
          role: "user",
          content: `
Create a premium brand guidelines document for this brand.

Project name: ${projectName}
Industry: ${industry || "Not provided"}
Audience: ${audience || "Not provided"}
Style: ${style || "Not provided"}

Brand system:
${JSON.stringify(brandSystem)}

Return JSON only in this exact shape:
{
  "guidelines": {
    "brandOverview": "Short brand overview.",
    "positioning": "Brand positioning statement.",
    "personality": ["Trait 1", "Trait 2", "Trait 3"],
    "toneOfVoice": {
      "headline": "Tone headline",
      "description": "Tone description",
      "dos": ["Do 1", "Do 2", "Do 3"],
      "donts": ["Don't 1", "Don't 2", "Don't 3"]
    },
    "logoUsage": {
      "primaryUse": "How to use the logo.",
      "clearSpace": "Clear space guidance.",
      "donts": ["Don't stretch", "Don't add effects", "Don't recolour randomly"]
    },
    "colourUsage": "How the colour palette should be used.",
    "typographyUsage": "How typography should be used.",
    "imageryStyle": "Imagery and art direction guidance.",
    "applications": ["Website", "Social Media", "Packaging", "Presentation"]
  }
}
`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Brand guidelines API error:", error);

    return NextResponse.json(
      { error: error?.message || "Unable to generate brand guidelines." },
      { status: 500 }
    );
  }
}
