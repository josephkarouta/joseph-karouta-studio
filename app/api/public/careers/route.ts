import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const RESUME_BUCKET = "career-application-files";
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { positions: [], error: "Careers are temporarily unavailable." },
      { status: 503 },
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("career_positions")
    .select("id,title,department,location,employment_type,summary,description,published_at,closes_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Public careers load failed:", error);
    return NextResponse.json(
      { positions: [], error: "Careers are temporarily unavailable." },
      { status: 500 },
    );
  }

  return NextResponse.json({ positions: data || [] });
}

export async function POST(request: Request) {
  let uploadedResumePath: string | null = null;
  let cleanupUploadedResume: (() => Promise<void>) | null = null;

  try {
    const form = await request.formData();
    const positionId = String(form.get("positionId") || "").trim();
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const location = String(form.get("location") || "").trim();
    const message = String(form.get("message") || "").trim();
    const resumeValue = form.get("resume");
    const resume = resumeValue instanceof File && resumeValue.size > 0 ? resumeValue : null;

    if (!positionId || name.length < 2 || !validEmail(email)) {
      return NextResponse.json(
        { error: "Add your name and a valid email address." },
        { status: 400 },
      );
    }
    if (message.length < 20) {
      return NextResponse.json(
        { error: "Tell us a little more about why the role fits you (at least 20 characters)." },
        { status: 400 },
      );
    }
    if (!resume) {
      return NextResponse.json({ error: "Attach your CV or resume." }, { status: 400 });
    }
    const resumeType = normalizedResumeType(resume);
    if (!resumeType) {
      return NextResponse.json({ error: "CV must be a PDF, DOC or DOCX file." }, { status: 400 });
    }
    if (resume.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: "CV must be 10 MB or smaller." }, { status: 400 });
    }

    let portfolioUrl: string | null;
    let linkedinUrl: string | null;
    try {
      portfolioUrl = normalizeOptionalUrl(form.get("portfolioUrl"));
      linkedinUrl = normalizeOptionalUrl(form.get("linkedinUrl"));
    } catch (urlError) {
      return NextResponse.json(
        { error: urlError instanceof Error ? urlError.message : "Check the portfolio or LinkedIn URL." },
        { status: 400 },
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "Career applications are not configured." },
        { status: 503 },
      );
    }

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: position, error: positionError } = await admin
      .from("career_positions")
      .select("id,status,closes_at")
      .eq("id", positionId)
      .eq("status", "published")
      .maybeSingle();

    if (positionError) throw positionError;
    if (!position || (position.closes_at && new Date(position.closes_at).getTime() < Date.now())) {
      return NextResponse.json(
        { error: "This position is no longer accepting applications." },
        { status: 404 },
      );
    }

    const extension = resumeType === "application/pdf" ? "pdf" : resumeType === "application/msword" ? "doc" : "docx";
    uploadedResumePath = `${positionId}/${Date.now()}-${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from(RESUME_BUCKET)
      .upload(uploadedResumePath, Buffer.from(await resume.arrayBuffer()), {
        contentType: resumeType,
        upsert: false,
        cacheControl: "3600",
      });
    if (uploadError) throw new Error(`CV upload failed: ${uploadError.message}`);

    cleanupUploadedResume = async () => {
      await admin.storage.from(RESUME_BUCKET).remove([uploadedResumePath!]);
    };

    const { data, error } = await admin
      .from("career_applications")
      .insert({
        position_id: positionId,
        name,
        email,
        location,
        portfolio_url: portfolioUrl,
        linkedin_url: linkedinUrl,
        message,
        resume_url: uploadedResumePath,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    if (uploadedResumePath && cleanupUploadedResume) {
      try {
        await cleanupUploadedResume();
      } catch {
        // Best-effort cleanup after a failed application insert.
      }
    }
    console.error("Career application failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Application could not be sent." },
      { status: 500 },
    );
  }
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeOptionalUrl(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  const url = new URL(candidate);
  if (!/^https?:$/.test(url.protocol) || !url.hostname || !url.hostname.includes(".")) {
    throw new Error("Enter a valid portfolio or LinkedIn address, for example www.example.com.");
  }
  return url.toString();
}

function normalizedResumeType(file: File) {
  if (RESUME_TYPES.has(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return null;
}
