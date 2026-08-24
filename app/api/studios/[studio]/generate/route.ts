import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError } from "@/lib/credits/server";
import { GUIDED_STUDIOS, type GuidedStudioId } from "@/lib/studio/generic-config";
import { processGuidedStudioJob } from "@/lib/studio/guided-studio-async-job";
import {
  cleanupGenerationStart,
  isActiveGenerationStatus,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPPORTED = new Set<GuidedStudioId>(["interior", "marketing"]);

function signature(jobId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  return createHmac("sha256", secret).update(`guided-studio:${jobId}`).digest("hex");
}

export async function POST(request: Request, context: { params: Promise<{ studio: string }> }) {
  let jobId: string | null = null;
  let startedJob: GenerationJobStart | null = null;
  let accepted = false;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;

  try {
    const { studio: rawStudio } = await context.params;
    const studio = rawStudio as GuidedStudioId;
    if (!SUPPORTED.has(studio)) return NextResponse.json({ error: "Unknown Studio." }, { status: 404 });

    const config = GUIDED_STUDIOS[studio];
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const body = await request.json();
    const input = body?.input && typeof body.input === "object" ? body.input as Record<string, unknown> : {};
    const workMode = input.workMode === "professional" && Boolean(config.professionalSteps?.length) ? "professional" : "guided";
    const projectName = String(input[config.projectNameField] || "").trim();
    if (!projectName) return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI generation is not configured." }, { status: 503 });

    const activeSteps = workMode === "professional" && config.professionalSteps?.length ? config.professionalSteps : config.steps;
    const required = activeSteps.flatMap((step) => step.fields).filter((field) => field.required);
    const missing = required.filter((field) => Array.isArray(input[field.id]) ? !(input[field.id] as unknown[]).length : !String(input[field.id] || "").trim());
    if (missing.length) {
      return NextResponse.json({ error: `Complete ${missing.map((field) => field.label.toLowerCase()).join(", ")}.` }, { status: 400 });
    }

    const creditAction = workMode === "professional" && config.professionalCreditAction
      ? config.professionalCreditAction
      : config.creditAction;

    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: `guided-studio:${studio}`,
      dedupe: { studio, projectId: body?.projectId || null, projectName, workMode, input },
      action: creditAction,
      projectId: body?.projectId || null,
      tool: "guided_studio",
      provider: "openai",
      input: {
        studio,
        databaseId: config.databaseId,
        projectTypeField: config.projectTypeField,
        projectId: body?.projectId || null,
        projectName,
        workMode,
        input,
      },
      metadata: {
        studio: config.databaseId,
        project_id: body?.projectId || null,
        project_name: projectName,
        work_mode: workMode,
        async_generation: true,
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

    const origin = new URL(request.url).origin;
    const backgroundResponse = await fetch(`${origin}/.netlify/functions/guided-studio-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Heyy-Job-Signature": signature(jobId) },
      body: JSON.stringify({ jobId }),
      cache: "no-store",
    }).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      accepted = true;
      await processGuidedStudioJob(jobId);
    } else {
      throw new Error(`Studio background generation could not start (${backgroundResponse?.status || "unavailable"}).`);
    }

    return NextResponse.json({ success: true, status: "processing", jobId, creditsReserved: startedJob.creditsReserved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio generation could not start.";
    if (!accepted && admin && startedJob) {
      const status = await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Generation could not start. Your credits were returned.",
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
    console.error("Guided Studio async start error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
