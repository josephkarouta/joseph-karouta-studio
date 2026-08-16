import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  executeArchitectureImageGeneration,
  type ArchitectureImageJobInput,
} from "./architecture-image-executor";

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

    if (claimed.credit_reservation_id) {
      const { error: commitError } = await admin.rpc("heyy_commit_credits", {
        p_reservation_id: claimed.credit_reservation_id,
        p_metadata: {
          studio: "architecture_studio",
          tool: "architecture_image",
          project_id: claimed.project_id || input.projectId || null,
          target: input.targetType || null,
          target_id: input.targetId || null,
          quality: input.quality || "preview",
          plan_mode: input.planMode || "technical",
          generation_intent: input.generationIntent || "normal",
        },
      });
      if (commitError) throw new Error(commitError.message || "Credits could not be committed.");
      creditsCommitted = true;
    }

    const completed = await updateJobWithRetry(admin, jobId, {
      status: "succeeded",
      error: null,
      output: {
        result,
        credits_used: Number(input.credits || 0),
      },
      completed_at: new Date().toISOString(),
    });

    if (!completed) {
      console.error(
        "Architecture image background warning: output was saved and credits were committed, but the job status could not be finalized.",
        { jobId, projectId: claimed.project_id, targetType: input.targetType, targetId: input.targetId },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Architecture image generation failed.";

    if (!creditsCommitted && claimed.credit_reservation_id) {
      const { error: refundError } = await admin.rpc("heyy_refund_credits", {
        p_reservation_id: claimed.credit_reservation_id,
        p_reason: message.slice(0, 500),
      });
      if (refundError) console.error("Architecture image background refund failed:", refundError);
    }

    if (!creditsCommitted) {
      await updateJobWithRetry(admin, jobId, {
        status: "failed",
        error: publicGenerationError(message),
        completed_at: new Date().toISOString(),
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
  if (job.credit_reservation_id) {
    const { error: refundError } = await admin.rpc("heyy_refund_credits", {
      p_reservation_id: job.credit_reservation_id,
      p_reason: message.slice(0, 500),
    });
    if (refundError) console.error("Architecture image background refund failed:", refundError);
  }
  await updateJobWithRetry(admin, job.id, {
    status: "failed",
    error: publicGenerationError(message),
    completed_at: new Date().toISOString(),
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
    /Generate the selected Architecture Direction visual/i,
    /Approve the .* Floor/i,
    /connected floor/i,
  ];
  if (userActionErrors.some((pattern) => pattern.test(message))) return message;
  if (/content|safety|policy|moderation/i.test(message)) {
    return "This Architecture image request could not be completed. Try adjusting the project content or reference image.";
  }
  return "Architecture image generation could not be completed. Your credits were returned.";
}
