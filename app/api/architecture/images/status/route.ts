import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);

    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    }

    const { data: job, error } = await admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .eq("tool", "architecture_image")
      .maybeSingle();

    if (error) throw new Error(error.message || "Architecture generation status could not be loaded.");
    if (!job) {
      return NextResponse.json({ error: "Architecture generation job not found." }, { status: 404 });
    }

    if (job.status === "succeeded") {
      return NextResponse.json({
        success: true,
        status: "succeeded",
        ...(job.output?.result || {}),
        creditsUsed: Number(job.output?.credits_used || job.input?.credits || 0),
      });
    }

    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        status: "failed",
        error: job.error || "Architecture image generation failed. Your credits were returned.",
      });
    }

    return NextResponse.json({ success: true, status: "processing" });
  } catch (error) {
    console.error("Architecture image status error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Architecture generation status could not be loaded." },
      { status: 500 },
    );
  }
}
