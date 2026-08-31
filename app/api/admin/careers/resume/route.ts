import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";

const RESUME_BUCKET = "career-application-files";

export async function GET(request: Request) {
  const access = await requireAdminApiCapability("careers");
  if (access.response) return access.response;

  try {
    const applicationId = new URL(request.url).searchParams.get("applicationId")?.trim();
    if (!applicationId) return NextResponse.json({ error: "Application ID is required." }, { status: 400 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: application, error } = await admin
      .from("career_applications")
      .select("id,name,resume_url")
      .eq("id", applicationId)
      .maybeSingle();
    if (error) throw error;
    if (!application?.resume_url) return NextResponse.json({ error: "No CV is attached to this application." }, { status: 404 });

    const resumePath = String(application.resume_url);
    const extension = resumePath.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "pdf";
    const downloadName = `${String(application.name || "candidate").replace(/[^a-z0-9]+/gi, "-")}-CV.${extension}`;
    const { data: signed, error: signedError } = await admin.storage
      .from(RESUME_BUCKET)
      .createSignedUrl(resumePath, 60 * 10, { download: downloadName });
    if (signedError || !signed?.signedUrl) throw signedError || new Error("CV download could not be prepared.");

    return NextResponse.redirect(signed.signedUrl);
  } catch (error) {
    console.error("Career CV download failed:", error);
    return NextResponse.json({ error: "CV download could not be prepared." }, { status: 500 });
  }
}
