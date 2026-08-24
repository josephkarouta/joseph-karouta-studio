import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditAction } from "@/lib/credits/config";
import { CreditError } from "@/lib/credits/server";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";
import {
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";

export async function runSynchronousGenerationJob<T>({
  admin,
  userId,
  request,
  scope,
  dedupe,
  projectId = null,
  tool,
  provider,
  action,
  input,
  metadata = {},
  amountOverride,
  publicError,
  work,
}: {
  admin: SupabaseClient;
  userId: string;
  request: Request;
  scope: string;
  dedupe: unknown;
  projectId?: string | null;
  tool: string;
  provider: string;
  action: CreditAction;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  amountOverride?: number;
  publicError: string;
  work: (job: GenerationJobStart) => Promise<T>;
}) {
  const job = await startGenerationJob({
    admin,
    userId,
    request,
    scope,
    dedupe,
    projectId,
    tool,
    provider,
    action,
    input,
    metadata,
    amountOverride,
  });

  if (!job.created || job.status !== "queued") {
    return await replayOrReject<T>(admin, job);
  }

  const { data: claimed, error: claimError } = await admin
    .from("generation_jobs")
    .update({ status: "processing", error: null })
    .eq("id", job.jobId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message || "Generation job could not be claimed.");
  if (!claimed) return await replayOrReject<T>(admin, job);

  let resultPersisted = false;
  try {
    const result = await work(job);
    resultPersisted = true;
    const durableOutput = {
      result_persisted: true,
      response: result,
      credits_used: job.creditsReserved,
    };

    const { error: outputError } = await admin
      .from("generation_jobs")
      .update({ status: "finalizing", error: null, output: durableOutput })
      .eq("id", job.jobId)
      .eq("status", "processing");
    if (outputError) throw new Error(outputError.message || "Generation result could not be recorded.");

    await completeGenerationJob(admin, job.jobId, durableOutput, {
      ...metadata,
      tool,
      provider,
      result_persisted: true,
    });

    return {
      result,
      job,
      replayed: false,
    };
  } catch (error) {
    // Once work() returns, its asset/result is already durable. Never refund a
    // persisted result because final credit bookkeeping had a temporary error;
    // the provider reconciler will finish that finalizing job safely.
    if (!resultPersisted) {
      await failGenerationJob(admin, {
        jobId: job.jobId,
        expectedStatus: "processing",
        reason: error instanceof Error ? error.message : "Generation failed",
        publicError,
      });
    }
    throw error;
  }
}

async function replayOrReject<T>(
  admin: SupabaseClient,
  job: GenerationJobStart,
) {
  const { data, error } = await admin
    .from("generation_jobs")
    .select("status,error,output")
    .eq("id", job.jobId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Generation job could not be loaded.");

  const status = String(data?.status || job.status);
  if (status === "succeeded" && data?.output?.response !== undefined) {
    return {
      result: data.output.response as T,
      job: { ...job, status: "succeeded" as const },
      replayed: true,
    };
  }
  if (status === "failed" || status === "cancelled") {
    throw new CreditError(
      String(data?.error || "The previous generation failed. Its credits were returned."),
      "CREDIT_OPERATION_FAILED",
      409,
    );
  }

  throw new CreditError(
    "This generation is already in progress. Check the Assets Library shortly before trying again.",
    "CREDIT_OPERATION_FAILED",
    409,
  );
}
