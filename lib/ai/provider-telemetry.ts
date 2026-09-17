import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "@supabase/supabase-js";

export type ProviderTelemetryContext = {
  jobId: string;
  userId: string;
  projectId?: string | null;
  studio?: string | null;
  stage?: string | null;
  tool?: string | null;
};

export type ProviderCallRecord = {
  provider: string;
  model: string;
  callKind: string;
  status: "succeeded" | "failed";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  referenceCount?: number | null;
  requestedQuality?: string | null;
  requestedSize?: string | null;
  usage?: unknown;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ProviderTelemetryGlobal = typeof globalThis & {
  __heyyProviderTelemetryStorage?: AsyncLocalStorage<ProviderTelemetryContext>;
};

const telemetryGlobal = globalThis as ProviderTelemetryGlobal;

// Important for Next.js dev/HMR and server chunking: provider call code and job
// wrapper code can be bundled as separate module instances. A module-local
// AsyncLocalStorage would then have two stores, causing recordProviderCall()
// to see no context even though the job wrapper established one. Keep one
// process-wide store on globalThis instead.
const telemetryContext =
  telemetryGlobal.__heyyProviderTelemetryStorage ||
  (telemetryGlobal.__heyyProviderTelemetryStorage =
    new AsyncLocalStorage<ProviderTelemetryContext>());

export function withProviderTelemetryContext<T>(
  context: ProviderTelemetryContext,
  callback: () => Promise<T>,
) {
  return telemetryContext.run(context, callback);
}

export function currentProviderTelemetryContext() {
  return telemetryContext.getStore() || null;
}

function cleanNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = cleanNumber(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function roundUsd(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? null
    : Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Provider-cost estimates are for test/commercial analysis only. They are not
 * accounting records. The provider dashboard/invoice remains the billing source
 * of truth. Rates below are intentionally model-specific and dated so they can
 * be updated without changing the telemetry schema.
 */
export function estimateProviderCost(args: {
  provider: string;
  model: string;
  usage?: unknown;
  referenceCount?: number | null;
  requestedQuality?: string | null;
  requestedSize?: string | null;
  status?: "succeeded" | "failed";
}) {
  const provider = args.provider.toLowerCase();
  const model = args.model.toLowerCase();
  const usage = record(args.usage);
  const inputDetails = record(usage.input_tokens_details || usage.prompt_tokens_details);
  const outputDetails = record(usage.output_tokens_details || usage.completion_tokens_details);

  // A transient provider failure that returns no usage must not be charged the
  // fixed image-output estimate. We cannot know whether a provider billed any
  // partial work, so keep the local estimate NULL and use the provider invoice
  // as the source of truth.
  if (args.status === "failed" && Object.keys(usage).length === 0) {
    return {
      estimatedCostUsd: null,
      pricingBasis: {
        version: "2026-09-14",
        source: "failed-call-no-usage",
        note: "No provider usage was returned. Failed call excluded from local cost total.",
      },
    };
  }

  if (provider === "openai" && /^gpt-image-2\.5-(?:sunburst|flare)/.test(model)) {
    const inputTokens = firstNumber(usage, ["input_tokens", "prompt_tokens"]) || 0;
    const outputTokens = firstNumber(usage, ["output_tokens", "completion_tokens"]) || 0;
    const textInputTokens = firstNumber(inputDetails, ["text_tokens"]);
    const imageInputTokens = firstNumber(inputDetails, ["image_tokens"]);

    // When Images API usage does not expose the split, text-only generations are
    // exact; edit requests use the higher image-input rate for the unsplit input
    // so the estimate is conservative rather than understated.
    const refs = Math.max(0, Number(args.referenceCount || 0));
    const resolvedText = textInputTokens ?? (refs === 0 ? inputTokens : 0);
    const resolvedImage = imageInputTokens ?? (refs > 0 ? inputTokens : 0);
    const cost = (resolvedText * 5 + resolvedImage * 8 + outputTokens * 30) / 1_000_000;

    return {
      estimatedCostUsd: roundUsd(cost),
      pricingBasis: {
        version: "2026-09-14",
        source: "openai-gpt-image-2.5",
        text_input_usd_per_million: 5,
        image_input_usd_per_million: 8,
        image_output_usd_per_million: 30,
        input_tokens: inputTokens,
        text_input_tokens: resolvedText,
        image_input_tokens: resolvedImage,
        output_tokens: outputTokens,
        input_split_inferred: textInputTokens === null || imageInputTokens === null,
      },
    };
  }

  if (provider === "openai" && /^gpt-5\.6-sol/.test(model)) {
    const inputTokens = firstNumber(usage, ["input_tokens", "prompt_tokens"]) || 0;
    const outputTokens = firstNumber(usage, ["output_tokens", "completion_tokens"]) || 0;
    const cachedTokens = firstNumber(inputDetails, ["cached_tokens"]) || 0;
    const uncachedTokens = Math.max(0, inputTokens - cachedTokens);
    const cost = (uncachedTokens * 4 + cachedTokens * 0.4 + outputTokens * 20) / 1_000_000;

    return {
      estimatedCostUsd: roundUsd(cost),
      pricingBasis: {
        version: "2026-09-14",
        source: "openai-gpt-5.6-sol",
        input_usd_per_million: 4,
        cached_input_usd_per_million: 0.4,
        output_usd_per_million: 20,
        input_tokens: inputTokens,
        cached_input_tokens: cachedTokens,
        output_tokens: outputTokens,
        reasoning_tokens: firstNumber(outputDetails, ["reasoning_tokens"]),
      },
    };
  }

  if (provider === "openai" && /^gpt-5\.6-terra/.test(model)) {
    const inputTokens = firstNumber(usage, ["input_tokens", "prompt_tokens"]) || 0;
    const outputTokens = firstNumber(usage, ["output_tokens", "completion_tokens"]) || 0;
    const cachedTokens = firstNumber(inputDetails, ["cached_tokens"]) || 0;
    const uncachedTokens = Math.max(0, inputTokens - cachedTokens);
    const cost =
      (uncachedTokens * 2 + cachedTokens * 0.2 + outputTokens * 12) /
      1_000_000;

    return {
      estimatedCostUsd: roundUsd(cost),
      pricingBasis: {
        version: "2026-09-14",
        source: "openai-gpt-5.6-terra",
        input_usd_per_million: 2,
        cached_input_usd_per_million: 0.2,
        output_usd_per_million: 12,
        input_tokens: inputTokens,
        cached_input_tokens: cachedTokens,
        output_tokens: outputTokens,
        reasoning_tokens: firstNumber(outputDetails, ["reasoning_tokens"]),
      },
    };
  }

  if (provider === "openai" && /^gpt-5\.6-luna/.test(model)) {
    const inputTokens = firstNumber(usage, ["input_tokens", "prompt_tokens"]) || 0;
    const outputTokens = firstNumber(usage, ["output_tokens", "completion_tokens"]) || 0;
    const cachedTokens = firstNumber(inputDetails, ["cached_tokens"]) || 0;
    const uncachedTokens = Math.max(0, inputTokens - cachedTokens);
    const cost =
      (uncachedTokens * 0.2 + cachedTokens * 0.02 + outputTokens * 1.2) /
      1_000_000;

    return {
      estimatedCostUsd: roundUsd(cost),
      pricingBasis: {
        version: "2026-09-14",
        source: "openai-gpt-5.6-luna",
        input_usd_per_million: 0.2,
        cached_input_usd_per_million: 0.02,
        output_usd_per_million: 1.2,
        input_tokens: inputTokens,
        cached_input_tokens: cachedTokens,
        output_tokens: outputTokens,
        reasoning_tokens: firstNumber(outputDetails, ["reasoning_tokens"]),
      },
    };
  }

  if (provider === "gemini" && model.includes("gemini-3-pro-image")) {
    const promptTokens = firstNumber(usage, ["promptTokenCount", "prompt_token_count"]) || 0;
    const thoughtTokens = firstNumber(usage, ["thoughtsTokenCount", "thoughts_token_count"]) || 0;
    const candidateTokens = firstNumber(usage, ["candidatesTokenCount", "candidates_token_count"]) || 0;
    const size = String(args.requestedSize || "2K").toUpperCase();
    const imageOutput = size === "4K" ? 0.24 : 0.134;
    // The fixed image-output estimate already covers the generated image. Do not
    // also price candidatesTokenCount as $12/M because provider usage can include
    // image-output tokens there; doing so would double-count the image.
    const cost = imageOutput + (promptTokens * 2 + thoughtTokens * 12) / 1_000_000;

    return {
      estimatedCostUsd: roundUsd(cost),
      pricingBasis: {
        version: "2026-09-14",
        source: "google-gemini-3-pro-image",
        requested_image_size: size,
        image_output_estimate_usd: imageOutput,
        input_usd_per_million: 2,
        text_and_thinking_output_usd_per_million: 12,
        prompt_tokens: promptTokens,
        thought_tokens: thoughtTokens,
        candidate_tokens_observed_not_double_counted: candidateTokens,
      },
    };
  }

  if (provider === "grok" && model.includes("grok-imagine-image-2.0")) {
    const quality = String(args.requestedQuality || "medium").toLowerCase();
    const size = String(args.requestedSize || "2K").toUpperCase();
    const outputCost = size.includes("2K")
      ? quality === "low" ? 0.06 : 0.08
      : quality === "low" ? 0.04 : 0.06;
    const refs = Math.max(0, Number(args.referenceCount || 0));
    const cost = outputCost + refs * 0.01;

    return {
      estimatedCostUsd: roundUsd(cost),
      pricingBasis: {
        version: "2026-09-14",
        source: "xai-grok-imagine-image-2.0",
        requested_resolution: size,
        requested_quality: quality,
        image_output_usd: outputCost,
        image_input_usd_each: 0.01,
        image_input_count: refs,
      },
    };
  }

  return {
    estimatedCostUsd: null,
    pricingBasis: {
      version: "2026-09-14",
      source: "unpriced-model",
      note: "No local estimate is configured for this provider/model. Use provider billing as source of truth.",
    },
  };
}

function telemetryAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function recordProviderCall(call: ProviderCallRecord) {
  const context = currentProviderTelemetryContext();
  if (!context) {
    console.warn("Provider telemetry skipped because no generation context is active:", {
      provider: call.provider,
      model: call.model,
      callKind: call.callKind,
    });
    return;
  }

  const admin = telemetryAdminClient();
  if (!admin) {
    console.warn("Provider telemetry skipped because the Supabase telemetry client is not configured:", {
      jobId: context.jobId,
      provider: call.provider,
      model: call.model,
      callKind: call.callKind,
    });
    return;
  }

  const estimate = estimateProviderCost({
    provider: call.provider,
    model: call.model,
    usage: call.usage,
    referenceCount: call.referenceCount,
    requestedQuality: call.requestedQuality,
    requestedSize: call.requestedSize,
    status: call.status,
  });

  const { error } = await admin.from("generation_provider_calls").insert({
    generation_job_id: context.jobId,
    user_id: context.userId,
    project_id: context.projectId || null,
    studio: context.studio || null,
    stage: context.stage || null,
    tool: context.tool || null,
    provider: call.provider,
    model: call.model,
    call_kind: call.callKind,
    status: call.status,
    started_at: call.startedAt,
    completed_at: call.completedAt,
    duration_ms: Math.max(0, Math.round(call.durationMs)),
    reference_count: Math.max(0, Number(call.referenceCount || 0)),
    requested_quality: call.requestedQuality || null,
    requested_size: call.requestedSize || null,
    usage: call.usage && typeof call.usage === "object" ? call.usage : {},
    estimated_cost_usd: estimate.estimatedCostUsd,
    pricing_basis: estimate.pricingBasis,
    error: call.error || null,
    metadata: call.metadata || {},
  });

  // Telemetry must never fail a paid user generation. A missing migration or a
  // temporary logging problem is surfaced in server logs only.
  if (error) {
    console.warn("Provider telemetry could not be recorded:", {
      jobId: context.jobId,
      provider: call.provider,
      model: call.model,
      callKind: call.callKind,
      message: error.message,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("Provider telemetry recorded:", {
      jobId: context.jobId,
      provider: call.provider,
      model: call.model,
      callKind: call.callKind,
      estimatedCostUsd: estimate.estimatedCostUsd,
    });
  }
}

export async function providerTelemetrySummary(jobId: string) {
  const admin = telemetryAdminClient();
  if (!admin) {
    return {
      telemetry_status: "unavailable",
      telemetry_error: "Supabase telemetry client is not configured.",
      provider_call_count: 0,
      provider_call_duration_ms: 0,
      estimated_provider_cost_usd: 0,
      calls: [],
    };
  }

  const { data, error } = await admin
    .from("generation_provider_calls")
    .select("provider,model,call_kind,status,duration_ms,reference_count,estimated_cost_usd")
    .eq("generation_job_id", jobId)
    .order("started_at", { ascending: true });

  if (error) {
    console.warn("Provider telemetry summary could not be loaded:", {
      jobId,
      message: error.message,
    });
    return {
      telemetry_status: "error",
      telemetry_error: error.message,
      provider_call_count: 0,
      provider_call_duration_ms: 0,
      estimated_provider_cost_usd: 0,
      calls: [],
    };
  }

  const rows = Array.isArray(data) ? data : [];
  const estimatedCost = rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0);
  const durationMs = rows.reduce((sum, row) => sum + Number(row.duration_ms || 0), 0);

  return {
    telemetry_status: rows.length ? "recorded" : "no_calls_recorded",
    telemetry_error: null,
    provider_call_count: rows.length,
    provider_call_duration_ms: durationMs,
    estimated_provider_cost_usd: Math.round(estimatedCost * 1_000_000) / 1_000_000,
    calls: rows,
  };
}
