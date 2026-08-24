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
      .select("status,error,output")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .eq("tool", "digital_adaptations")
      .maybeSingle();
    if (error) throw new Error(error.message || "Digital adaptations status could not be loaded.");
    if (!job) return NextResponse.json({ error: "Digital adaptations job not found." }, { status: 404 });

    if (job.status === "succeeded") {
      return NextResponse.json({
        success: true,
        status: "succeeded",
        ...(job.output?.response || {}),
        creditsUsed: Number(job.output?.credits_used || 0),
      });
    }
    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        status: "failed",
        error: job.error || "Digital adaptations failed. Your credits were returned.",
      });
    }
    return NextResponse.json({ success: true, status: "processing" });
  } catch (error) {
    console.error("Digital adaptations status error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Digital adaptations status could not be loaded." },
      { status: 500 },
    );
  }
}
