import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  executeArchitectureImageGeneration,
  type ArchitectureImageJobInput,
} from "./architecture-image-executor";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";

export async function processArchitectureImageJob(jobId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Architecture background generation is not configured.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: jobError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tool", "architecture_image")
    .maybeSingle();

  if (jobError) throw new Error(jobError.message || "Architecture generation job could not be loaded.");
  if (!existing) throw new Error("Architecture generation job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existing.status || ""))) return;
  if (String(existing.status || "") !== "queued") return;

  const { data: claimed, error: claimError } = await admin
    .from("generation_jobs")
    .update({ status: "processing", error: null })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message || "Architecture generation job could not be started.");
  if (!claimed) return;

  const input = (claimed.input || {}) as ArchitectureImageJobInput & { credits?: number };
  const userId = String(claimed.user_id || "");
  if (!userId) {
    await failJob(admin, claimed, "Architecture generation job data is incomplete.");
    return;
  }

  let creditsCommitted = false;

  try {
    const result = await executeArchitectureImageGeneration({
      admin,
      userId,
      input,
    });

    const durableOutput = {
      result,
      credits_used: Number(input.credits || 0),
    };
    const outputSaved = await updateJobWithRetry(admin, jobId, { output: durableOutput });
    if (!outputSaved) throw new Error("Architecture generation result could not be recorded.");

    await completeGenerationJob(admin, jobId, durableOutput, {
      studio: "architecture_studio",
      tool: "architecture_image",
      project_id: claimed.project_id || input.projectId || null,
      target: input.targetType || null,
      target_id: input.targetId || null,
      quality: input.quality || "preview",
      plan_mode: input.planMode || "technical",
    });
    creditsCommitted = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Architecture image generation failed.";

    if (!creditsCommitted) {
      await failGenerationJob(admin, {
        jobId,
        expectedStatus: "processing",
        reason: message,
        publicError: publicGenerationError(message),
      });
    }

    console.error("Architecture image background error:", {
      jobId,
      targetType: input.targetType,
      targetId: input.targetId,
      message,
    });
  }
}

async function failJob(
  admin: SupabaseClient,
  job: { id: string; credit_reservation_id?: string | null },
  message: string,
) {
  await failGenerationJob(admin, {
    jobId: job.id,
    expectedStatus: "processing",
    reason: message,
    publicError: publicGenerationError(message),
  });
}

async function updateJobWithRetry(
  admin: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await admin.from("generation_jobs").update(patch).eq("id", jobId);
    if (!error) return true;
    console.error("Architecture generation job update failed:", {
      jobId,
      attempt: attempt + 1,
      message: error.message,
    });
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function publicGenerationError(message: string) {
  const userActionErrors = [
    /Select an Architecture Direction/i,
    /no saved image prompt/i,
    /Refresh the Concept Strategy/i,
    /Refresh the Plan Content/i,
    /Canonical Plan Specification/i,
    /Prepare and approve/i,
    /Approve .* before generating visuals/i,
    /source plans are preserved/i,
    /Master Architecture Reference/i,
  ];
  if (userActionErrors.some((pattern) => pattern.test(message))) return message;
  if (/content|safety|policy|moderation/i.test(message)) {
    return "This Architecture image request could not be completed. Try adjusting the project content or reference image.";
  }
  return "Architecture image generation could not be completed. Your credits were returned.";
}
