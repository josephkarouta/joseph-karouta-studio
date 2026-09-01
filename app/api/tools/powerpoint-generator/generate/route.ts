import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError } from "@/lib/credits/server";
import { getPowerPointCreditCost } from "@/lib/credits/config";
import {
  cleanupGenerationStart,
  startGenerationJob,
  type GenerationJobStart,
} from "@/lib/generation-jobs/server";
import { processPowerPointJob } from "@/lib/tools/powerpoint-job";
import type { PresentationStyle } from "@/lib/tools/powerpoint-deck";

export const runtime = "nodejs";
export const maxDuration = 60;

const PRESENTATION_MODEL = process.env.PRESENTATION_TEXT_MODEL?.trim() || "gpt-5.6-luna";
const GENERATOR_VERSION = 6;
const PRESENTATION_STYLES: PresentationStyle[] = ["auto", "editorial", "corporate", "bold", "minimal", "luxury"];
const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 5 * 1024 * 1024;
const BUCKET = "project-assets";
const SUPPORTED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "rtf", "odt", "ppt", "pptx", "txt", "md", "csv", "xls", "xlsx",
  "png", "jpg", "jpeg", "jfif", "webp", "svg",
]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "jfif", "webp", "svg"]);
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

type AttachmentDescriptor = {
  name: string;
  size: number;
  extension: string;
  mimeType: string;
  kind: "document" | "image";
};

type StoredAttachmentRef = AttachmentDescriptor & {
  storagePath: string;
};

class PresentationInputError extends Error {}

export async function POST(request: Request) {
  let admin: Awaited<ReturnType<typeof requireApiUser>>["admin"] | null = null;
  let startedJob: GenerationJobStart | null = null;
  let storedPaths: string[] = [];
  let dispatched = false;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const form = await request.formData();

    const title = String(form.get("title") || "").trim().slice(0, 140);
    const objective = String(form.get("objective") || "").trim().slice(0, 1500);
    const source = String(form.get("source") || "").trim().slice(0, 50_000);
    const audience = String(form.get("audience") || "General audience").trim().slice(0, 300);
    const tone = String(form.get("tone") || "Premium and concise").trim().slice(0, 120);
    const slideCount = Math.max(5, Math.min(20, Math.floor(Number(form.get("slideCount")) || 10)));
    const visualStyleValue = String(form.get("visualStyle") || "auto");
    const visualStyle = PRESENTATION_STYLES.includes(visualStyleValue as PresentationStyle)
      ? visualStyleValue as PresentationStyle
      : "auto";
    const logoAttachmentName = String(form.get("logoAttachmentName") || "").trim().slice(0, 180);
    const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
    const descriptors = validateAttachments(files, logoAttachmentName);
    const creditCost = getPowerPointCreditCost(slideCount);

    if (!title || !objective || (source.length < 10 && descriptors.length === 0)) {
      return NextResponse.json(
        { error: "Add a title, objective and either source notes or at least one attachment." },
        { status: 400 },
      );
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Presentation generation is not configured." }, { status: 503 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Presentation generation is temporarily unavailable." }, { status: 503 });
    }

    const attachmentDescriptors = descriptors.map(({ name, size, kind }) => ({ name, size, kind }));
    const inputBase = {
      title,
      objective,
      source,
      audience,
      tone,
      slideCount,
      visualStyle,
      attachmentNames: descriptors.map((attachment) => attachment.name),
      logoAttachmentName: logoAttachmentName || null,
      quality: "best",
      model: PRESENTATION_MODEL,
      generatorVersion: GENERATOR_VERSION,
      creditCost,
    };

    startedJob = await startGenerationJob({
      admin,
      userId: auth.user.id,
      request,
      scope: "powerpoint-generator",
      dedupe: {
        title,
        objective,
        source,
        audience,
        tone,
        slideCount,
        visualStyle,
        attachments: attachmentDescriptors,
        logoAttachmentName,
        generatorVersion: GENERATOR_VERSION,
      },
      tool: "powerpoint_generator",
      provider: "openai",
      action: "powerpointFull",
      amountOverride: creditCost,
      input: inputBase,
      metadata: {
        tool: "powerpoint_generator",
        title,
        slide_count: slideCount,
        quality: "best",
        visual_style: visualStyle,
        model: PRESENTATION_MODEL,
        attachment_count: descriptors.length,
        attachment_names: descriptors.map((attachment) => attachment.name),
        logo_attachment: logoAttachmentName || null,
        async_generation: true,
      },
    });

    if (!startedJob.created || startedJob.status !== "queued") {
      return NextResponse.json({
        success: true,
        jobId: startedJob.jobId,
        status: startedJob.status === "succeeded" ? "succeeded" : "processing",
        creditsReserved: startedJob.creditsReserved,
        existing: true,
      });
    }

    const attachmentRefs: StoredAttachmentRef[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const descriptor = descriptors[index];
      const safeSuffix = descriptor.extension || "bin";
      const storagePath = `${auth.user.id}/tools/powerpoint-inputs/${startedJob.jobId}/${String(index + 1).padStart(2, "0")}-${safeStorageName(descriptor.name)}.${safeSuffix}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
          contentType: descriptor.mimeType,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message || "An attachment could not be prepared.");
      storedPaths.push(storagePath);
      attachmentRefs.push({ ...descriptor, storagePath });
    }

    const { error: inputUpdateError } = await admin
      .from("generation_jobs")
      .update({
        input: {
          ...inputBase,
          attachmentRefs,
        },
      })
      .eq("id", startedJob.jobId)
      .eq("status", "queued");
    if (inputUpdateError) throw new Error(inputUpdateError.message || "Presentation inputs could not be saved.");

    const signature = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY)
      .update(`powerpoint:${startedJob.jobId}`)
      .digest("hex");
    const origin = new URL(request.url).origin;
    const backgroundResponse = await fetch(`${origin}/.netlify/functions/powerpoint-background`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Heyy-Job-Signature": signature,
      },
      body: JSON.stringify({ jobId: startedJob.jobId }),
      cache: "no-store",
    }).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      dispatched = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      dispatched = true;
      void processPowerPointJob(startedJob.jobId).catch((localError) => {
        console.error("Local PowerPoint background worker error:", localError);
      });
    } else {
      throw new Error("The background presentation worker could not start.");
    }

    return NextResponse.json({
      success: true,
      jobId: startedJob.jobId,
      status: "processing",
      creditsReserved: startedJob.creditsReserved,
    });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : "Presentation generation could not start.";

    if (!dispatched && admin && startedJob) {
      await cleanupGenerationStart({
        admin,
        job: startedJob,
        reason: internalMessage,
        publicError: "Presentation generation could not start. Your credits were returned.",
      });
    }
    if (!dispatched && admin && storedPaths.length) {
      const { error: cleanupError } = await admin.storage.from(BUCKET).remove(storedPaths);
      if (cleanupError) console.error("PowerPoint attachment cleanup failed:", cleanupError.message);
      storedPaths = [];
    }

    console.error("PowerPoint generation start error:", error);
    if (error instanceof PresentationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CreditError) {
      if (error.status === 409) {
        return NextResponse.json(
          { error: "This presentation is already being prepared. Check its progress before starting another one." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: safeCreditMessage(error), code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Presentation generation could not start. Your credits were returned." },
      { status: 500 },
    );
  }
}

function validateAttachments(files: File[], logoAttachmentName: string): AttachmentDescriptor[] {
  if (files.length > MAX_ATTACHMENTS) {
    throw new PresentationInputError(`Attach no more than ${MAX_ATTACHMENTS} files.`);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
    throw new PresentationInputError("Attachments can be up to 5 MB combined.");
  }

  const safeNames = files.map((file) => safeAttachmentName(file.name));
  const duplicateName = safeNames.find(
    (name, index) => safeNames.findIndex((candidate) => candidate.toLowerCase() === name.toLowerCase()) !== index,
  );
  if (duplicateName) {
    throw new PresentationInputError(`Only one attachment can use the name ${duplicateName}. Rename duplicate files before attaching them.`);
  }

  const descriptors = files.map((file, index) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new PresentationInputError(`${file.name} is larger than 5 MB.`);
    }
    const name = safeNames[index];
    const extension = resolvedAttachmentExtension(name, file.type);
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new PresentationInputError(`${name} is not a supported document or image type.`);
    }
    return {
      name,
      size: file.size,
      extension,
      mimeType: file.type || MIME_BY_EXTENSION[extension] || "application/octet-stream",
      kind: IMAGE_EXTENSIONS.has(extension) ? "image" as const : "document" as const,
    };
  });

  if (logoAttachmentName) {
    const logo = descriptors.find((attachment) => attachment.name === logoAttachmentName && attachment.kind === "image");
    if (!logo) {
      throw new PresentationInputError("The selected logo attachment could not be read as an image.");
    }
  }

  return descriptors;
}

function safeAttachmentName(value: string) {
  return String(value || "attachment")
    .replace(/[\\/\0\r\n]+/g, "-")
    .trim()
    .slice(0, 180) || "attachment";
}

function safeStorageName(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "attachment";
}

function attachmentExtension(name: string) {
  return name.split(".").pop()?.trim().toLowerCase() || "";
}

function resolvedAttachmentExtension(name: string, mimeType: string) {
  const extension = attachmentExtension(name);
  if (SUPPORTED_EXTENSIONS.has(extension)) return extension;
  const mime = String(mimeType || "").trim().toLowerCase();
  if (mime === "image/jpeg" || mime === "image/pjpeg") return "jpeg";
  return extension;
}

function safeCreditMessage(error: CreditError) {
  if (error.code === "INSUFFICIENT_CREDITS") {
    const match = error.message.match(/need\s+(\d+)\s+credits/i);
    return match
      ? `You need ${match[1]} credits to generate this presentation. Buy more credits and try again.`
      : "You do not have enough credits to generate this presentation.";
  }
  if (/refreshing/i.test(error.message)) return "Your monthly credits are refreshing. Please try again shortly.";
  return "Presentation generation is temporarily unavailable. Please try again shortly.";
}
