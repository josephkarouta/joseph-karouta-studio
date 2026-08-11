import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });

    const { data: job, error } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .eq("tool", "text_to_image")
      .maybeSingle();

    if (error) throw new Error(error.message || "Generation status could not be loaded.");
    if (!job) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });

    if (job.status === "succeeded") {
      return NextResponse.json({
        success: true,
        status: "succeeded",
        imageUrl: job.output?.asset_url || null,
        asset: job.output?.asset_id
          ? { id: job.output.asset_id, file_url: job.output?.asset_url || null }
          : undefined,
        creditsUsed: Number(job.output?.credits_used || job.input?.credits || 0),
      });
    }

    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        status: "failed",
        error: job.error || "Image generation failed. Your credits were returned.",
      });
    }

    return NextResponse.json({ success: true, status: "processing" });
  } catch (error) {
    console.error("Text-to-image status error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation status could not be loaded." },
      { status: 500 },
    );
  }
}
