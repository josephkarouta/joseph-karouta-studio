import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { commitCredits, refundCredits } from "@/lib/credits/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    const { data: job, error } = await auth.admin.from("generation_jobs").select("*").eq("id", jobId).eq("user_id", auth.user.id).single();
    if (error || !job) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
    if (["succeeded", "failed"].includes(job.status)) return NextResponse.json({ success: true, status: job.status, error: job.error || null });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 503 });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(job.provider_job_id)}`, {
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Could not check Gemini file status.");
    const state = String(data?.state || "PROCESSING").toUpperCase();
    if (state === "FAILED") {
      await refundCredits(auth.admin, job.credit_reservation_id, String(data?.error?.message || "Video generation failed"));
      await auth.admin.from("generation_jobs").update({ status: "failed", error: String(data?.error?.message || "Video generation failed"), output: { ...(job.output || {}), file: data }, completed_at: new Date().toISOString() }).eq("id", job.id);
      return NextResponse.json({ success: true, status: "failed", error: data?.error?.message || "Video generation failed." });
    }
    if (state === "ACTIVE") {
      await commitCredits(auth.admin, job.credit_reservation_id, { provider_job_id: job.provider_job_id });
      await auth.admin.from("generation_jobs").update({ status: "succeeded", output: { ...(job.output || {}), file: data }, completed_at: new Date().toISOString() }).eq("id", job.id);
      return NextResponse.json({ success: true, status: "succeeded" });
    }
    await auth.admin.from("generation_jobs").update({ status: "processing", output: { ...(job.output || {}), file: data } }).eq("id", job.id);
    return NextResponse.json({ success: true, status: "processing", providerState: state });
  } catch (error) {
    console.error("Video status error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check video status." }, { status: 500 });
  }
}
