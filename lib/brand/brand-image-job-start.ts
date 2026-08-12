import "server-only";

import { createHmac } from "node:crypto";
import type { CreditAction } from "@/lib/credits/config";
import { reserveCredits, refundCredits } from "@/lib/credits/server";
import { requireBrandImageProject } from "@/lib/brand/generated-image-storage";

export type BrandImageJobTool =
  | "brand_logo"
  | "brand_logo_variation"
  | "brand_moodboard"
  | "brand_moodboard_variation"
  | "brand_application_visual";

export async function startBrandImageJob(args: {
  request: Request;
  projectId: string;
  tool: BrandImageJobTool;
  action: CreditAction;
  provider: "openai" | "gemini";
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  let reservationId: string | null = null;
  let jobId: string | null = null;
  let accepted = false;
  const storageContext = await requireBrandImageProject(args.projectId);

  try {
    const reservation = await reserveCredits({
      admin: storageContext.admin,
      userId: storageContext.userId,
      action: args.action,
      metadata: {
        project_id: storageContext.projectId,
        studio: "brand_studio",
        tool: args.tool,
        ...args.metadata,
      },
    });
    reservationId = reservation.id;

    const { data: job, error: jobError } = await storageContext.admin
      .from("generation_jobs")
      .insert({
        user_id: storageContext.userId,
        project_id: storageContext.projectId,
        tool: args.tool,
        provider: args.provider,
        provider_job_id: null,
        credit_reservation_id: reservation.id,
        status: "queued",
        input: {
          ...args.input,
          credits: reservation.amount,
        },
        output: {},
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message || "Brand generation job could not be saved.");
    }
    jobId = String(job.id);

    const origin = new URL(args.request.url).origin;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const signature = createHmac("sha256", secret)
      .update(`brand-image:${jobId}`)
      .digest("hex");

    const backgroundResponse = await fetch(
      `${origin}/.netlify/functions/brand-image-background`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Heyy-Job-Signature": signature,
        },
        body: JSON.stringify({ jobId }),
        cache: "no-store",
      },
    ).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(args.request.url).hostname)) {
      accepted = true;
      const { processBrandImageJob } = await import("@/lib/brand/brand-image-job");
      await processBrandImageJob(jobId);
    } else {
      throw new Error(
        `Brand background generation could not start (${backgroundResponse?.status || "unavailable"}).`,
      );
    }

    return {
      success: true,
      jobId,
      status: "processing" as const,
      creditsReserved: reservation.amount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Brand image generation could not start.";

    if (!accepted && jobId) {
      // Fail/refund only while the job is still queued. If the Background
      // Function already claimed it, a lost HTTP 202 must not refund a paid job.
      const { data: failedQueuedJob, error: failError } = await storageContext.admin
        .from("generation_jobs")
        .update({
          status: "failed",
          error: "Brand image generation could not start. Your credits were returned.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (failError) {
        console.error("Brand generation start cleanup failed:", failError.message);
      } else if (failedQueuedJob && reservationId) {
        await refundCredits(storageContext.admin, reservationId, message);
      }
    } else if (!accepted && reservationId) {
      await refundCredits(storageContext.admin, reservationId, message);
    }

    throw error;
  }
}
