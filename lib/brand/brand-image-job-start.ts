import "server-only";

import { createHmac } from "node:crypto";
import type { CreditAction } from "@/lib/credits/config";
import { requireBrandImageProject } from "@/lib/brand/generated-image-storage";
import {
  cleanupGenerationStart,
  isActiveGenerationStatus,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";

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
  let jobId: string | null = null;
  let startedJob: GenerationJobStart | null = null;
  let accepted = false;
  const storageContext = await requireBrandImageProject(args.projectId);

  try {
    startedJob = await startGenerationJob({
      admin: storageContext.admin,
      userId: storageContext.userId,
      request: args.request,
      scope: `brand-image:${args.tool}`,
      dedupe: {
        projectId: storageContext.projectId,
        tool: args.tool,
        input: args.input,
      },
      action: args.action,
      projectId: storageContext.projectId,
      tool: args.tool,
      provider: args.provider,
      input: args.input,
      metadata: {
        project_id: storageContext.projectId,
        studio: "brand_studio",
        tool: args.tool,
        ...args.metadata,
      },
    });
    jobId = startedJob.jobId;

    if (!startedJob.created && startedJob.status !== "queued") {
      return {
        success: true,
        jobId,
        status: startedJob.status === "finalizing" ? "processing" as const : startedJob.status,
        creditsReserved: startedJob.creditsReserved,
      };
    }

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
      creditsReserved: startedJob.creditsReserved,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Brand image generation could not start.";

    if (!accepted && startedJob) {
      const status = await cleanupGenerationStart({
        admin: storageContext.admin,
        job: startedJob,
        reason: message,
        publicError: "Brand image generation could not start. Your credits were returned.",
      });
      if (!startedJob.created || isActiveGenerationStatus(status) || status === "succeeded") {
        return {
          success: true,
          jobId: startedJob.jobId,
          status: status === "finalizing" || status === "queued" ? "processing" as const : status,
          creditsReserved: startedJob.creditsReserved,
        };
      }
    }

    throw error;
  }
}
