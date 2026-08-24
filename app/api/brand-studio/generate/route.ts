import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { CreditError } from "@/lib/credits/server";
import {
  cleanupGenerationStart,
  isActiveGenerationStatus,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";
import { processBrandSystemJob } from "@/lib/brand/brand-system-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type BrandStudioInput = {
  businessName?: string;
  industry?: string;
  audience?: string;
  style?: string;
  description?: string;
  projectJourney?: Record<string, unknown>;
};

export async function POST(request: Request) {
  let jobId: string | null = null;
  let startedJob: GenerationJobStart | null = null;
  let accepted = false;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;

    const body = (await request.json()) as BrandStudioInput;
    const businessName = cleanString(body.businessName);
    const industry = cleanString(body.industry);
    const audience = cleanString(body.audience);
    const style = cleanString(body.style);
    const description = cleanString(body.description);
    const projectJourney = isRecord(body.projectJourney) ? body.projectJourney : {};

    if (!businessName || !industry || !audience || !style) {
      return NextResponse.json(
        {
          success: false,
          error: "Please complete business name, audience, industry and style direction.",
        },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Brand Studio generation is not configured." },
        { status: 503 },
      );
    }

    const model =
      process.env.OPENAI_TEXT_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4.1-mini";

    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: "brand-system",
      dedupe: {
        businessName,
        industry,
        audience,
        style,
        description,
        projectJourney,
      },
      action: "brandSystemText",
      projectId: null,
      tool: "brand_system",
      provider: "openai",
      input: {
        businessName,
        industry,
        audience,
        style,
        description,
        projectJourney,
        model,
      },
      metadata: {
        studio: "brand_studio",
        tool: "brand_system",
        project_name: businessName,
        model,
      },
    });
    jobId = startedJob.jobId;

    if (!startedJob.created && startedJob.status !== "queued") {
      return NextResponse.json({
        success: true,
        jobId,
        status: startedJob.status === "finalizing" ? "processing" : startedJob.status,
        creditsReserved: startedJob.creditsReserved,
      });
    }
    const signature = signJob(jobId);
    const origin = new URL(request.url).origin;
    const backgroundResponse = await fetch(
      `${origin}/.netlify/functions/brand-system-background`,
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
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      // Plain `npm run dev` does not run Netlify Functions. Process the same
      // durable job inline only for local development.
      accepted = true;
      await processBrandSystemJob(jobId);
    } else {
      throw new Error(
        `Background generation could not start (${backgroundResponse?.status || "unavailable"}).`,
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      status: "processing",
      creditsReserved: startedJob.creditsReserved,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Brand workspace generation could not start.";

    if (!accepted && admin && startedJob) {
      const status = await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Brand workspace generation could not start. Your credits were returned.",
      });
      if (!startedJob.created || isActiveGenerationStatus(status) || status === "succeeded") {
        return NextResponse.json({
          success: true,
          jobId: startedJob.jobId,
          status: status === "finalizing" || status === "queued" ? "processing" : status,
          creditsReserved: startedJob.creditsReserved,
        });
      }
    }

    console.error("Brand Studio generation start error:", error);

    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof CreditError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Brand workspace generation could not start. Your credits were returned.",
      },
      { status: 500 },
    );
  }
}

function signJob(jobId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Background generation signing is not configured.");
  return createHmac("sha256", secret)
    .update(`brand-system:${jobId}`)
    .digest("hex");
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
