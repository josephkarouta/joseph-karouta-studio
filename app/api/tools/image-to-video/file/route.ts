import "server-only";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    const { data: job } = await auth.admin.from("generation_jobs").select("*").eq("id", jobId).eq("user_id", auth.user.id).eq("status", "succeeded").single();
    const storedUri = String(job?.output?.video_uri || "");
    if (!storedUri) return NextResponse.json({ error: "Finished video not found." }, { status: 404 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 503 });
    const uri = storedUri.startsWith("http") ? storedUri : `https://generativelanguage.googleapis.com/v1beta/${storedUri}`;
    const response = await fetch(uri, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY } });
    if (!response.ok || !response.body) return NextResponse.json({ error: "The provider video could not be downloaded." }, { status: 502 });
    return new Response(response.body, { headers: { "Content-Type": response.headers.get("content-type") || "video/mp4", "Content-Disposition": "inline; filename=heyy-studio-video.mp4", "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video download failed." }, { status: 500 });
  }
}
