import { toFile } from "openai";
import { getOpenAI } from "@/lib/ai/openai-server";
import { recordProviderCall } from "@/lib/ai/provider-telemetry";

export type RoutedImageScope = "architecture" | "interior";
export type RoutedImageProvider = "openai" | "gemini" | "grok";
export type RoutedImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export type RoutedImageQuality = "low" | "medium" | "high";

export type RoutedImageReference = {
  bytes: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  filename: string;
};

export type RoutedImageResult = {
  bytes: Buffer;
  provider: RoutedImageProvider;
  model: string;
  usage: unknown;
  referenceCount: number;
  generationMethod: string;
};

function clean(value: string | undefined) {
  return value?.trim() || "";
}

export function resolveRoutedImageProvider(scope: RoutedImageScope): RoutedImageProvider {
  // OpenAI baseline for the launch Studios: keep Architecture and Interior on the
  // same image-provider path while we validate quality and consistency.
  if (scope === "architecture" || scope === "interior") return "openai";
  return "openai";
}

function modelForProvider(
  scope: RoutedImageScope,
  provider: RoutedImageProvider,
  fallbackOpenAIModel?: string,
) {
  if (provider === "openai") {
    return clean(
      scope === "architecture"
        ? process.env.ARCHITECTURE_IMAGE_MODEL
        : process.env.INTERIOR_IMAGE_MODEL,
    ) || clean(fallbackOpenAIModel) || clean(process.env.OPENAI_IMAGE_MODEL) || "gpt-image-2.5-sunburst";
  }

  if (provider === "gemini") {
    return clean(
      scope === "architecture"
        ? process.env.ARCHITECTURE_GEMINI_IMAGE_MODEL
        : process.env.INTERIOR_GEMINI_IMAGE_MODEL,
    ) || clean(process.env.GEMINI_IMAGE_MODEL) || "gemini-3-pro-image";
  }

  return clean(
    scope === "architecture"
      ? process.env.ARCHITECTURE_GROK_IMAGE_MODEL
      : process.env.INTERIOR_GROK_IMAGE_MODEL,
  ) || "grok-imagine-image-2.0";
}

function aspectRatioForSize(size: RoutedImageSize) {
  if (size === "1024x1024") return "1:1";
  if (size === "1024x1536") return "2:3";
  return "3:2";
}

function geminiImageSize(scope: RoutedImageScope) {
  return clean(
    scope === "architecture"
      ? process.env.ARCHITECTURE_GEMINI_IMAGE_SIZE
      : process.env.INTERIOR_GEMINI_IMAGE_SIZE,
  ) || clean(process.env.GEMINI_IMAGE_SIZE) || "2K";
}

function grokQuality(scope: RoutedImageScope) {
  const raw = clean(
    scope === "architecture"
      ? process.env.ARCHITECTURE_GROK_IMAGE_QUALITY
      : process.env.INTERIOR_GROK_IMAGE_QUALITY,
  ).toLowerCase();
  return raw === "low" || raw === "auto" ? raw : "medium";
}

function providerReferenceLimit(provider: RoutedImageProvider) {
  if (provider === "grok") return 5;
  if (provider === "gemini") return 14;
  return 6;
}

async function generateOpenAIImage(args: {
  model: string;
  prompt: string;
  references: RoutedImageReference[];
  size: RoutedImageSize;
  quality: RoutedImageQuality;
}) {
  const openai = getOpenAI();
  const references = args.references.slice(0, providerReferenceLimit("openai"));
  const common = {
    model: args.model,
    prompt: args.prompt,
    size: args.size,
    quality: args.quality,
    output_format: "png" as const,
  };

  const result = references.length
    ? await openai.images.edit({
        ...common,
        image: await Promise.all(
          references.map((reference) =>
            toFile(reference.bytes, reference.filename, { type: reference.mimeType }),
          ),
        ),
      })
    : await openai.images.generate(common);

  const base64 = result.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI image generation returned no image data.");

  return {
    bytes: Buffer.from(base64, "base64"),
    usage: result.usage || null,
    referenceCount: references.length,
  };
}

async function generateGeminiImage(args: {
  scope: RoutedImageScope;
  model: string;
  prompt: string;
  references: RoutedImageReference[];
  size: RoutedImageSize;
}) {
  const apiKey = clean(process.env.GEMINI_API_KEY);
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for Gemini image generation.");

  const references = args.references.slice(0, providerReferenceLimit("gemini"));
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent`;

  const body = JSON.stringify({
    contents: [{
      role: "user",
      parts: [
        ...references.map((reference) => ({
          inlineData: {
            mimeType: reference.mimeType,
            data: reference.bytes.toString("base64"),
          },
        })),
        { text: args.prompt },
      ],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatioForSize(args.size),
        imageSize: geminiImageSize(args.scope),
      },
    },
  });

  type GeminiPayload = {
    error?: { message?: string };
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
    usageMetadata?: unknown;
  };

  const maxAttempts = 4;
  let response: Response | null = null;
  let payload: GeminiPayload = {};

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
    });

    payload = await response.json() as GeminiPayload;

    if (response.ok) break;

    const retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500;

    if (!retryable || attempt === maxAttempts) {
      throw new Error(payload.error?.message || `Gemini image generation failed (${response.status}).`);
    }

    const baseMs = attempt === 1 ? 2000 : attempt === 2 ? 5000 : 10000;
    const jitterMs = Math.floor(Math.random() * 900);

    console.warn("Gemini image generation transient failure; retrying:", {
      model: args.model,
      status: response.status,
      attempt,
      nextAttempt: attempt + 1,
      delayMs: baseMs + jitterMs,
      message: payload.error?.message || null,
    });

    await new Promise((resolve) => setTimeout(resolve, baseMs + jitterMs));
  }

  if (!response?.ok) {
    throw new Error(payload.error?.message || "Gemini image generation failed.");
  }

  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
  const image = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const base64 = image?.inlineData?.data || image?.inline_data?.data;
  if (!base64) throw new Error("Gemini image generation returned no image data.");

  return {
    bytes: Buffer.from(base64, "base64"),
    usage: payload.usageMetadata || null,
    referenceCount: references.length,
  };
}

async function generateGrokImage(args: {
  scope: RoutedImageScope;
  model: string;
  prompt: string;
  references: RoutedImageReference[];
  size: RoutedImageSize;
}) {
  const apiKey = clean(process.env.XAI_API_KEY);
  if (!apiKey) throw new Error("XAI_API_KEY is required for Grok image generation.");

  const references = args.references.slice(0, providerReferenceLimit("grok"));
  const endpoint = references.length
    ? "https://api.x.ai/v1/images/edits"
    : "https://api.x.ai/v1/images/generations";
  const encodedReferences = references.map((reference) => ({
    type: "image_url",
    url: `data:${reference.mimeType};base64,${reference.bytes.toString("base64")}`,
  }));

  const body: Record<string, unknown> = {
    model: args.model,
    prompt: args.prompt,
    quality: grokQuality(args.scope),
    resolution: "2k",
    aspect_ratio: aspectRatioForSize(args.size),
    response_format: "b64_json",
  };

  if (encodedReferences.length === 1) body.image = encodedReferences[0];
  if (encodedReferences.length > 1) body.images = encodedReferences;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json() as {
    error?: { message?: string } | string;
    model?: string;
    data?: Array<{ b64_json?: string; url?: string; mime_type?: string }>;
    usage?: unknown;
  };

  if (!response.ok) {
    const providerMessage = typeof payload.error === "string" ? payload.error : payload.error?.message;
    throw new Error(providerMessage || `Grok image generation failed (${response.status}).`);
  }

  const output = payload.data?.[0];
  if (output?.b64_json) {
    return {
      bytes: Buffer.from(output.b64_json, "base64"),
      usage: payload.usage || null,
      referenceCount: references.length,
      servedModel: payload.model || args.model,
    };
  }

  if (output?.url) {
    const imageResponse = await fetch(output.url);
    if (!imageResponse.ok) throw new Error("Grok generated an image URL that could not be downloaded.");
    return {
      bytes: Buffer.from(await imageResponse.arrayBuffer()),
      usage: payload.usage || null,
      referenceCount: references.length,
      servedModel: payload.model || args.model,
    };
  }

  throw new Error("Grok image generation returned no image data.");
}

export async function generateRoutedStudioImage(args: {
  scope: RoutedImageScope;
  prompt: string;
  references?: RoutedImageReference[];
  size: RoutedImageSize;
  quality: RoutedImageQuality;
  fallbackOpenAIModel?: string;
}): Promise<RoutedImageResult> {
  const provider = resolveRoutedImageProvider(args.scope);
  const model = modelForProvider(args.scope, provider, args.fallbackOpenAIModel);
  const references = args.references || [];
  const startedAt = new Date();
  const startedMs = Date.now();

  try {
    if (provider === "gemini") {
      const result = await generateGeminiImage({
        scope: args.scope,
        model,
        prompt: args.prompt,
        references,
        size: args.size,
      });
      const completedAt = new Date();
      await recordProviderCall({
        provider,
        model,
        callKind: result.referenceCount ? "image_reference_generation" : "image_text_generation",
        status: "succeeded",
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Date.now() - startedMs,
        referenceCount: result.referenceCount,
        requestedQuality: "provider-default",
        requestedSize: geminiImageSize(args.scope),
        usage: result.usage,
        metadata: { scope: args.scope, requested_aspect_size: args.size },
      });
      return {
        bytes: result.bytes,
        provider,
        model,
        usage: result.usage,
        referenceCount: result.referenceCount,
        generationMethod: result.referenceCount ? "gemini-reference-generation" : "gemini-text-generation",
      };
    }

    if (provider === "grok") {
      const result = await generateGrokImage({
        scope: args.scope,
        model,
        prompt: args.prompt,
        references,
        size: args.size,
      });
      const servedModel = result.servedModel || model;
      const completedAt = new Date();
      await recordProviderCall({
        provider,
        model: servedModel,
        callKind: result.referenceCount ? "image_reference_edit" : "image_text_generation",
        status: "succeeded",
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Date.now() - startedMs,
        referenceCount: result.referenceCount,
        requestedQuality: grokQuality(args.scope),
        requestedSize: "2K",
        usage: result.usage,
        metadata: { scope: args.scope, requested_aspect_size: args.size },
      });
      return {
        bytes: result.bytes,
        provider,
        model: servedModel,
        usage: result.usage,
        referenceCount: result.referenceCount,
        generationMethod: result.referenceCount ? "grok-reference-edit" : "grok-text-generation",
      };
    }

    const result = await generateOpenAIImage({
      model,
      prompt: args.prompt,
      references,
      size: args.size,
      quality: args.quality,
    });
    const completedAt = new Date();
    await recordProviderCall({
      provider,
      model,
      callKind: result.referenceCount ? "image_reference_edit" : "image_text_generation",
      status: "succeeded",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Date.now() - startedMs,
      referenceCount: result.referenceCount,
      requestedQuality: args.quality,
      requestedSize: args.size,
      usage: result.usage,
      metadata: { scope: args.scope },
    });
    return {
      bytes: result.bytes,
      provider,
      model,
      usage: result.usage,
      referenceCount: result.referenceCount,
      generationMethod: result.referenceCount ? "openai-reference-edit" : "openai-text-generation",
    };
  } catch (error) {
    const completedAt = new Date();
    await recordProviderCall({
      provider,
      model,
      callKind: references.length ? "image_reference_edit" : "image_text_generation",
      status: "failed",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Date.now() - startedMs,
      referenceCount: Math.min(references.length, providerReferenceLimit(provider)),
      requestedQuality: provider === "grok" ? grokQuality(args.scope) : provider === "gemini" ? "provider-default" : args.quality,
      requestedSize: provider === "grok" ? "2K" : provider === "gemini" ? geminiImageSize(args.scope) : args.size,
      usage: null,
      error: error instanceof Error ? error.message : "Image generation failed.",
      metadata: { scope: args.scope, requested_aspect_size: args.size },
    });
    throw error;
  }
}
