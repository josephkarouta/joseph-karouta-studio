import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      projectName,
      industry,
      audience,
      style,
      description,
      brandSystem,
    } = body;

    if (!projectName || !brandSystem) {
      return NextResponse.json(
        { error: "Missing projectName or brandSystem." },
        { status: 400 }
      );
    }

    const conceptCompletion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "You are Heyy Studio, a senior creative director. Generate premium brand moodboard concepts. Return only valid JSON.",
        },
        {
          role: "user",
          content: `
Create 3 premium moodboard concepts for this brand project.

Project name: ${projectName}
Industry: ${industry || "Not provided"}
Audience: ${audience || "Not provided"}
Style: ${style || "Not provided"}
Description: ${description || "Not provided"}

Brand system JSON:
${JSON.stringify(brandSystem)}

Return JSON only in this exact shape:
{
  "moodboards": [
    {
      "title": "Moodboard title",
      "visualDirection": "Short visual direction.",
      "paletteUsage": "How colours should be used.",
      "typographyMood": "How typography should feel.",
      "imagePrompt": "A detailed prompt for a premium square brand moodboard image. The image should look like a curated design board with textures, typography samples, colour swatches, lifestyle imagery, layout fragments and brand atmosphere. No logos. No readable long text.",
      "applications": ["Website", "Social", "Packaging"]
    }
  ]
}
`,
        },
      ],
    });

    const raw = conceptCompletion.choices[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const moodboards = parsed?.moodboards || [];

    const moodboardsWithImages = await Promise.all(
      moodboards.map(async (moodboard: any) => {
        const image = await openai.images.generate({
          model: "gpt-image-1",
          prompt: moodboard.imagePrompt,
          size: "1024x1024",
        });

        const base64 = image.data?.[0]?.b64_json;

        return {
          ...moodboard,
          imageBase64: base64 ? `data:image/png;base64,${base64}` : null,
        };
      })
    );

    return NextResponse.json({
      moodboards: moodboardsWithImages,
    });
  } catch (error) {
    console.error("Moodboard API error:", error);

    return NextResponse.json(
      { error: "Unable to generate moodboards." },
      { status: 500 }
    );
  }
}