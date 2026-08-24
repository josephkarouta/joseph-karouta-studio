import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  generationReconciliationSignature,
  validGenerationReconciliationSignature,
} from "../../lib/generation-jobs/reconciliation-signature";
import { completeGenerationJob, failGenerationJob } from "../../lib/credits/lifecycle";

type ProviderJob = {
  id: string;
  tool: "ai_upscaler" | "image_to_video";
};

export default async function handler(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const runId = typeof body?.runId === "string" ? body.runId.trim() : "";
    const supplied = request.headers.get("x-heyy-reconciliation-signature");

    if (!runId || !validGenerationReconciliationSignature(`dispatch:${runId}`, supplied)) {
      console.error("Rejected unauthorized provider reconciliation invocation.");
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase is not configured.");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin
      .from("generation_jobs")
      .select("id,tool")
      .in("tool", ["ai_upscaler", "image_to_video"])
      .in("status", ["processing", "finalizing"])
      .not("provider_job_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(12);

    if (error) throw new Error(error.message || "Provider jobs could not be loaded.");

    const jobs = (data || []).filter((job): job is ProviderJob =>
      job.tool === "ai_upscaler" || job.tool === "image_to_video",
    );

    for (const job of jobs) {
      try {
        await reconcileJob(job);
      } catch (error) {
        console.error(
          `Provider reconciliation failed for ${job.tool}:${job.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    await finishPersistedResults(admin);
    await refundAbandonedStarts(admin);
  } catch (error) {
    // Returning normally prevents Netlify's automatic background retry from
    // running the same provider reconciliation batch concurrently.
    console.error(
      "Provider generation reconciliation error:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function finishPersistedResults(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("generation_jobs")
    .select("id,output")
    .eq("status", "finalizing")
    .contains("output", { result_persisted: true })
    .order("updated_at", { ascending: true })
    .limit(12);
  if (error) throw new Error(error.message || "Persisted generation results could not be loaded.");

  for (const job of data || []) {
    try {
      await completeGenerationJob(admin, String(job.id), job.output || {}, {
        reconciliation: "persisted_result",
      });
    } catch (error) {
      console.error(
        `Persisted result finalization failed for ${job.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

async function refundAbandonedStarts(admin: SupabaseClient) {
  // Netlify background functions stop after 15 minutes. Waiting 30 minutes
  // before refunding provider-less work avoids touching a legitimate invocation.
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data, error } = await admin
    .from("generation_jobs")
    .select("id,status")
    .in("status", ["queued", "processing"])
    .is("provider_job_id", null)
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(12);
  if (error) throw new Error(error.message || "Abandoned generation jobs could not be loaded.");

  for (const job of data || []) {
    const status = job.status === "queued" ? "queued" : "processing";
    try {
      await failGenerationJob(admin, {
        jobId: String(job.id),
        expectedStatus: status,
        reason: "Generation did not complete within the background execution window.",
        publicError: "Generation could not be completed. Your credits were returned.",
      });
    } catch (error) {
      console.error(
        `Abandoned generation refund failed for ${job.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export const config = {
  background: true,
};

async function reconcileJob(job: ProviderJob) {
  const site = siteUrl();
  const path = job.tool === "ai_upscaler"
    ? "/api/tools/ai-upscaler/status"
    : "/api/tools/image-to-video/status";
  const target = `provider-status:${job.tool}:${job.id}`;
  const signature = generationReconciliationSignature(target);
  const response = await fetch(`${site}${path}?job=${encodeURIComponent(job.id)}`, {
    headers: { "X-Heyy-Reconciliation-Signature": signature },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Status ${response.status}${text ? `: ${text.slice(0, 240)}` : ""}`);
  }
}

function siteUrl() {
  const raw = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) throw new Error("The deployed site URL is missing.");
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") throw new Error("The deployed site URL must use HTTPS.");
  return parsed.origin;
}
