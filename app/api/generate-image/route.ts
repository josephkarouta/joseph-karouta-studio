import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { CreditError } from "@/lib/credits/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { processTextToImageJob } from "@/lib/tools/text-to-image-job";
import {
  cleanupGenerationStart,
  isActiveGenerationStatus,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;
  let startedJob: GenerationJobStart | null = null;
  let accepted = false;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const body = await request.json();
    const projectId = Number(body.project_id);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!Number.isFinite(projectId) || !prompt) {
      return NextResponse.json(
        { success: false, error: "A project and prompt are required." },
        { status: 400 },
      );
    }

    const { data: project, error: projectError } = await admin
      .from("user_projects")
      .select("id,project_name")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .single();
    if (projectError || !project) {
      return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
    }

    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: "legacy-project-ai-image",
      dedupe: { projectId, prompt },
      action: "textToImagePreview",
      projectId: String(projectId),
      tool: "text_to_image",
      provider: "openai",
      input: {
        prompt,
        fullPrompt: prompt,
        styleNotes: "",
        quality: "preview",
        size: "1536x1024",
        projectId: String(projectId),
        model,
        source: "legacy_project_ai",
        projectName: project.project_name || null,
      },
      metadata: {
        source: "legacy_project_ai",
        tool: "text_to_image",
        project_id: String(projectId),
        size: "1536x1024",
        quality: "preview",
      },
    });

    if (!startedJob.created && startedJob.status !== "queued") {
      return NextResponse.json({
        success: true,
        jobId: startedJob.jobId,
        status: startedJob.status === "finalizing" ? "processing" : startedJob.status,
        creditsReserved: startedJob.creditsReserved,
      });
    }

    const origin = new URL(request.url).origin;
    const signature = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
      .update(`text-to-image:${startedJob.jobId}`)
      .digest("hex");
    const backgroundResponse = await fetch(
      `${origin}/.netlify/functions/text-to-image-background`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Heyy-Job-Signature": signature,
        },
        body: JSON.stringify({ jobId: startedJob.jobId }),
        cache: "no-store",
      },
    ).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      accepted = true;
      await processTextToImageJob(startedJob.jobId);
    } else {
      throw new Error(
        `Background generation could not start (${backgroundResponse?.status || "unavailable"}).`,
      );
    }

    return NextResponse.json({
      success: true,
      jobId: startedJob.jobId,
      status: "processing",
      creditsReserved: startedJob.creditsReserved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation could not start.";

    if (!accepted && admin && startedJob) {
      const status = await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Image generation could not start. Your credits were returned.",
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

    if (error instanceof ApiAuthError || error instanceof CreditError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error instanceof CreditError ? error.code : undefined,
        },
        { status: error.status },
      );
    }
    console.error("Generate project image error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
