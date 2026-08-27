import "server-only";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });

    const { data: job } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .eq("status", "succeeded")
      .single();

    const assetUrl = String(job?.output?.asset_url || "");
    const providerUri = String(job?.output?.video_uri || "");
    const uri = assetUrl || providerUri;
    if (!uri) return NextResponse.json({ error: "Finished video not found." }, { status: 404 });
    const fetchUri = assetUrl || (job?.provider === "google_gemini_omni"
      ? `${GEMINI_BASE}/files/${encodeURIComponent(String(job.provider_job_id))}:download?alt=media`
      : /^https?:\/\//i.test(providerUri)
        ? providerUri
        : `${GEMINI_BASE}/${providerUri.replace(/^\/+/, "")}`);

    const headers: Record<string, string> = {};
    if (!assetUrl) {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "Video generation is not configured." }, { status: 503 });
      }
      headers["x-goog-api-key"] = process.env.GEMINI_API_KEY;
    }

    const response = await fetch(fetchUri, { headers, redirect: "follow" });
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "The finished video could not be downloaded." }, { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "video/mp4",
        "Content-Disposition": "inline; filename=heyy-studio-video.mp4",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video download failed." },
      { status: 500 },
    );
  }
}
