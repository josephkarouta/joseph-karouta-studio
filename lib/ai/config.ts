import "server-only";

export type AiPlan = "free" | "starter" | "pro";
export type AiMode = "demo" | "live";
export type ImageGenerationTier = "preview" | "final";

export type AiPlanConfig = {
  textModel: string;
  imageModel: string;
  imageQuality: "low" | "medium" | "high";
  previewImageQuality: "low" | "medium" | "high";
  finalImageQuality: "low" | "medium" | "high";
  maxDirectionImages: number;
  maxOutputTokens: number;
};

function env(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is missing from the server environment.`);
}

export function getAiMode(): AiMode {
  return process.env.AI_MODE === "live" ? "live" : "demo";
}

export function getAiPlanConfig(_plan: AiPlan): AiPlanConfig {
  // Every subscription receives the same generation quality. Plans differ by
  // the credit balance enforced by the commercial engine, not by hidden model tiers.
  const textModel = env("OPENAI_TEXT_MODEL", "gpt-4.1-mini");
  const imageModel = env("OPENAI_IMAGE_MODEL", "gpt-image-2");
  const previewImageQuality = env("OPENAI_PREVIEW_IMAGE_QUALITY", "medium") as
    | "low"
    | "medium"
    | "high";
  const finalImageQuality = env("OPENAI_FINAL_IMAGE_QUALITY", "high") as
    | "low"
    | "medium"
    | "high";

  return {
    textModel,
    imageModel,
    imageQuality: previewImageQuality,
    previewImageQuality,
    finalImageQuality,
    maxDirectionImages: 3,
    // Canonical-plan JSON can be large. GPT-4.1 nano has no hidden reasoning
    // step, so this budget is available to the structured JSON itself.
    maxOutputTokens: 16000,
  };
}

export function imageQualityForTier(
  plan: AiPlanConfig,
  tier: ImageGenerationTier,
): "low" | "medium" | "high" {
  return tier === "final" ? plan.finalImageQuality : plan.previewImageQuality;
}

export function resolveAiPlan(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): AiPlan {
  const forced = process.env.ARCHITECTURE_TEST_PLAN?.toLowerCase();
  if (forced === "free" || forced === "starter" || forced === "pro") return forced;

  const raw =
    user.app_metadata?.plan ??
    user.user_metadata?.plan ??
    user.app_metadata?.subscription_plan ??
    user.user_metadata?.subscription_plan;

  const plan = String(raw || "free").toLowerCase();
  if (plan.includes("pro")) return "pro";
  if (plan.includes("starter")) return "starter";
  return "free";
}
