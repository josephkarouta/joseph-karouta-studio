import "server-only";

import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError } from "@/lib/credits/server";
import { CREDIT_COSTS } from "@/lib/credits/config";
import {
  cleanupGenerationStart,
  isActiveGenerationStatus,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";
import { normalizeDigitalAdaptationSource, processDigitalAdaptationsJob } from "@/lib/tools/digital-adaptations-job";
import {
  type DigitalAdaptationFormat,
  uniqueFamilies,
  uniqueCompositionKeys,
  validateAdaptationFormat,
} from "@/lib/tools/digital-adaptations";

export const runtime = "nodejs";
export const maxDuration = 60;

const SOURCE_BUCKET = "project-assets";
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_FORMATS = 24;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  let startedJob: GenerationJobStart | null = null;
  let sourcePath: string | null = null;
  let accepted = false;
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const form = await request.formData();
    const sourceFile = form.get("source");
    const notes = String(form.get("notes") || "").trim().slice(0, 1200);
    const projectId = String(form.get("projectId") || "").trim() || null;
    const projectName = String(form.get("projectName") || "Digital campaign").trim().slice(0, 100);

    if (!(sourceFile instanceof File)) {
      return NextResponse.json({ error: "Upload the main key visual first." }, { status: 400 });
    }
    if (!ACCEPTED_TYPES.has(sourceFile.type)) {
      return NextResponse.json({ error: "Use a PNG, JPG or WebP key visual." }, { status: 400 });
    }
    if (sourceFile.size <= 0 || sourceFile.size > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "The key visual must be 4 MB or smaller." }, { status: 400 });
    }

    const formats = readFormats(form.get("formats"));
    if (!formats.length) {
      return NextResponse.json({ error: "Select at least one digital size." }, { status: 400 });
    }

    const source = await normalizeDigitalAdaptationSource(Buffer.from(await sourceFile.arrayBuffer()));
    const sourceHash = createHash("sha256").update(source).digest("hex");
    const families = uniqueFamilies(formats);
    const compositions = uniqueCompositionKeys(formats);
    const creditAmount = compositions.length * CREDIT_COSTS.digitalAdaptationFamily;
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    sourcePath = `${auth.user.id}/tools/digital-adaptation-sources/${sourceHash}.png`;

    startedJob = await startGenerationJob({
      admin: auth.admin,
      userId: auth.user.id,
      request,
      scope: "digital-adaptations",
      dedupe: { sourceHash, notes, projectId, projectName, formats },
      projectId,
      tool: "digital_adaptations",
      provider: "openai",
      action: "digitalAdaptationFamily",
      amountOverride: creditAmount,
      metadata: {
        tool: "digital_adaptations",
        adaptation_method: "ai_recompose_exact_ratio",
        project_id: projectId,
        format_count: formats.length,
        aspect_families: families,
        aspect_compositions: compositions,
        model,
      },
      input: {
        sourceHash,
        sourcePath,
        sourceName: sourceFile.name,
        notes,
        projectId,
        projectName,
        formats,
        families,
        compositions,
        model,
        credits: creditAmount,
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

    const { error: uploadError } = await auth.admin.storage
      .from(SOURCE_BUCKET)
      .upload(sourcePath, source, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: true,
      });
    if (uploadError) throw new Error(`Source artwork upload failed: ${uploadError.message}`);

    const origin = new URL(request.url).origin;
    const signature = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
      .update(`digital-adaptations:${startedJob.jobId}`)
      .digest("hex");
    const backgroundResponse = await fetch(`${origin}/.netlify/functions/digital-adaptations-background`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Heyy-Job-Signature": signature,
      },
      body: JSON.stringify({ jobId: startedJob.jobId }),
      cache: "no-store",
    }).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      accepted = true;
      await processDigitalAdaptationsJob(startedJob.jobId);
    } else {
      throw new Error(`Digital adaptations background generation could not start (${backgroundResponse?.status || "unavailable"}).`);
    }

    return NextResponse.json({
      success: true,
      jobId: startedJob.jobId,
      status: "processing",
      creditsReserved: startedJob.creditsReserved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Digital adaptations could not start.";

    if (!accepted && admin && startedJob) {
      const status = await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: message,
        publicError: "Digital adaptations could not start. Your credits were returned.",
      });
      if (startedJob.created && status === "failed" && sourcePath) {
        await admin.storage.from(SOURCE_BUCKET).remove([sourcePath]);
      }
      if (!startedJob.created || isActiveGenerationStatus(status) || status === "succeeded") {
        return NextResponse.json({
          success: true,
          jobId: startedJob.jobId,
          status: status === "finalizing" || status === "queued" ? "processing" : status,
          creditsReserved: startedJob.creditsReserved,
        });
      }
    }

    console.error("Digital adaptations start error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function readFormats(value: FormDataEntryValue | null) {
  let rawFormats: unknown[] = [];
  try {
    const parsed = JSON.parse(String(value || "[]"));
    rawFormats = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }

  return rawFormats
    .map(validateAdaptationFormat)
    .filter((item): item is DigitalAdaptationFormat => Boolean(item))
    .slice(0, MAX_FORMATS);
}
