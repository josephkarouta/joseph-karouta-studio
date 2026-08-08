import { GoogleGenAI } from "@google/genai";

type GeminiReferenceImage = {
  mimeType: string;
  data: string; // base64
};

type GenerateGeminiImageInput = {
  prompt: string;
  referenceImages?: GeminiReferenceImage[];
};

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in .env.local");
  }

  return new GoogleGenAI({ apiKey });
}

export function getGeminiImageModel() {
  return process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
}

export async function generateGeminiImage({
  prompt,
  referenceImages = [],
}: GenerateGeminiImageInput) {
  const ai = getGeminiClient();
  const model = getGeminiImageModel();

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  for (const image of referenceImages) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  const candidates = response.candidates || [];

  for (const candidate of candidates) {
    const responseParts = candidate.content?.parts || [];

    for (const part of responseParts) {
      const inlineData = (part as { inlineData?: { mimeType?: string; data?: string } }).inlineData;

      if (inlineData?.data && inlineData?.mimeType) {
        return {
          mimeType: inlineData.mimeType,
          base64: inlineData.data,
          text:
            responseParts
              .map((p) => ("text" in p ? p.text : ""))
              .filter(Boolean)
              .join("\n") || null,
        };
      }
    }
  }

  throw new Error("Gemini did not return an image");
}