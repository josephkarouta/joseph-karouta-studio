import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendExpertNetworkApplicationEmails } from "@/lib/communications/careers";
import { expertRoleSlug } from "@/lib/expert-network/public";

const RESUME_BUCKET = "career-application-files";
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function listExpertNetworkPositions() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ positions: [], error: "The Expert Network is temporarily unavailable." }, { status: 503 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("career_positions")
    .select("id,title,department,location,employment_type,summary,description,published_at,closes_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Public Expert Network load failed:", error);
    return NextResponse.json({ positions: [], error: "The Expert Network is temporarily unavailable." }, { status: 500 });
  }

  return NextResponse.json({
    positions: (data || []).map((position) => ({ ...position, slug: expertRoleSlug(position.title) })),
  });
}


export async function checkExpertNetworkEmail(request: Request) {
  try {
    const email = clean(new URL(request.url).searchParams.get("email")).toLowerCase();
    if (!validEmail(email)) {
      return NextResponse.json({ registered: false });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ registered: false, error: "Expert Network applications are not configured." }, { status: 503 });
    }

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const [existingApplicationResult, existingProfileResult] = await Promise.all([
      admin
        .from("career_applications")
        .select("id")
        .eq("application_kind", "expert_network")
        .eq("email", email)
        .limit(1)
        .maybeSingle(),
      admin
        .from("expert_profiles")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle(),
    ]);

    if (existingApplicationResult.error) throw existingApplicationResult.error;
    if (existingProfileResult.error) throw existingProfileResult.error;

    return NextResponse.json({
      registered: Boolean(existingApplicationResult.data || existingProfileResult.data),
    });
  } catch (error) {
    console.error("Expert Network email check failed:", error);
    return NextResponse.json({ registered: false }, { status: 500 });
  }
}

export async function submitExpertNetworkApplication(request: Request) {
  let uploadedResumePath: string | null = null;
  let cleanupUploadedResume: (() => Promise<void>) | null = null;

  try {
    const form = await request.formData();
    const positionId = clean(form.get("positionId"));
    const name = clean(form.get("name"));
    const email = clean(form.get("email")).toLowerCase();
    const location = clean(form.get("location"));
    const timezone = clean(form.get("timezone"));
    const message = clean(form.get("message"));
    const availability = clean(form.get("availability"));
    const source = safeSource(form.get("source"));
    const yearsExperience = optionalInteger(form.get("yearsExperience"));
    const specialties = listValue(form.get("specialties"));
    const softwareTools = listValue(form.get("softwareTools"));
    const languages = listValue(form.get("languages"));
    const consent = clean(form.get("consent")) === "true";
    const resumeValue = form.get("resume");
    const resume = resumeValue instanceof File && resumeValue.size > 0 ? resumeValue : null;

    if (!positionId || name.length < 2 || !validEmail(email)) {
      return NextResponse.json({ error: "Add your name and a valid email address." }, { status: 400 });
    }
    if (!location) return NextResponse.json({ error: "Add your current city and country." }, { status: 400 });
    if (!availability) return NextResponse.json({ error: "Select your current availability." }, { status: 400 });
    if (!specialties.length) return NextResponse.json({ error: "Add at least one specialty." }, { status: 400 });
    if (message.length < 30) {
      return NextResponse.json({ error: "Tell us a little about your experience and the projects you enjoy (at least 30 characters)." }, { status: 400 });
    }
    if (!consent) return NextResponse.json({ error: "Confirm that Heyy Studio may review and store your application." }, { status: 400 });
    if (!resume) return NextResponse.json({ error: "Attach your CV or resume." }, { status: 400 });

    const resumeType = normalizedResumeType(resume);
    if (!resumeType) return NextResponse.json({ error: "CV must be a PDF, DOC or DOCX file." }, { status: 400 });
    if (resume.size > MAX_RESUME_BYTES) return NextResponse.json({ error: "CV must be 10 MB or smaller." }, { status: 400 });

    let portfolioUrl: string | null;
    let linkedinUrl: string | null;
    try {
      portfolioUrl = normalizeOptionalUrl(form.get("portfolioUrl"));
      linkedinUrl = normalizeOptionalUrl(form.get("linkedinUrl"));
    } catch (urlError) {
      return NextResponse.json({ error: urlError instanceof Error ? urlError.message : "Check the portfolio or LinkedIn URL." }, { status: 400 });
    }
    if (!portfolioUrl && !linkedinUrl) {
      return NextResponse.json({ error: "Add either a portfolio or LinkedIn profile." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Expert Network applications are not configured." }, { status: 503 });
    }

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: position, error: positionError } = await admin
      .from("career_positions")
      .select("id,title,department,location,status,closes_at")
      .eq("id", positionId)
      .eq("status", "published")
      .maybeSingle();

    if (positionError) throw positionError;
    if (!position || (position.closes_at && new Date(position.closes_at).getTime() < Date.now())) {
      return NextResponse.json({ error: "This Expert Network opportunity is no longer accepting applications." }, { status: 404 });
    }

    // One Expert Network identity per email. Check both applications and
    // approved/invited Expert profiles before uploading the CV so a forgotten
    // second application does not create duplicate records or files.
    const [existingApplicationResult, existingProfileResult] = await Promise.all([
      admin
        .from("career_applications")
        .select("id")
        .eq("application_kind", "expert_network")
        .eq("email", email)
        .limit(1)
        .maybeSingle(),
      admin
        .from("expert_profiles")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle(),
    ]);

    if (existingApplicationResult.error) throw existingApplicationResult.error;
    if (existingProfileResult.error) throw existingProfileResult.error;
    if (existingApplicationResult.data || existingProfileResult.data) {
      return duplicateExpertNetworkEmailResponse();
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
        timezone: timezone || null,
        years_experience: yearsExperience,
        specialties,
        software_tools: softwareTools,
        languages,
        availability,
        source,
        application_kind: "expert_network",
      })
      .select("id")
      .single();

    if (error) {
      if (isDuplicateExpertNetworkEmailError(error)) {
        if (uploadedResumePath && cleanupUploadedResume) {
          try { await cleanupUploadedResume(); } catch { /* best-effort cleanup */ }
          uploadedResumePath = null;
          cleanupUploadedResume = null;
        }
        return duplicateExpertNetworkEmailResponse();
      }
      throw error;
    }

    await sendExpertNetworkApplicationEmails({
      applicationId: data.id,
      name,
      email,
      location,
      portfolioUrl,
      linkedinUrl,
      availability,
      source,
      position: {
        id: position.id,
        title: position.title,
        department: position.department,
        location: position.location,
      },
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    if (uploadedResumePath && cleanupUploadedResume) {
      try { await cleanupUploadedResume(); } catch { /* best-effort cleanup */ }
    }
    console.error("Expert Network application failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Application could not be sent." }, { status: 500 });
  }
}

function duplicateExpertNetworkEmailResponse() {
  return NextResponse.json(
    {
      error: "This email is already registered with the Heyy Studio Expert Network.",
      code: "expert_network_email_exists",
    },
    { status: 409 },
  );
}

function isDuplicateExpertNetworkEmailError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message || "");
  return message.includes("expert_network_email_already_registered");
}

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}
function listValue(value: FormDataEntryValue | null) {
  return clean(value).split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
}
function safeSource(value: FormDataEntryValue | null) {
  return clean(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 80) || "direct";
}
function optionalInteger(value: FormDataEntryValue | null) {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(60, parsed));
}
function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function normalizeOptionalUrl(value: FormDataEntryValue | null) {
  const raw = clean(value);
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
