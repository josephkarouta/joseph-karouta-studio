import "server-only";

import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    const query = auth.admin
      .from("generation_jobs")
      .select("id,status,error,output,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .eq("tool", "digital_adaptations");
    const { data: job, error } = jobId
      ? await query.eq("id", jobId).maybeSingle()
      : await query
        .in("status", ["queued", "processing", "finalizing"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(error.message || "Digital adaptations status could not be loaded.");
    if (!job) {
      if (!jobId) return NextResponse.json({ success: true, status: "idle" });
      return NextResponse.json({ error: "Digital adaptations job not found." }, { status: 404 });
    }

    if (job.status === "succeeded") {
      return NextResponse.json({
        success: true,
        jobId: job.id,
        status: "succeeded",
        ...(job.output?.response || {}),
        creditsUsed: Number(job.output?.credits_used || 0),
      });
    }
    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        jobId: job.id,
        status: "failed",
        error: job.error || "Digital adaptations failed. Your credits were returned.",
      });
    }
    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "processing",
      progress: job.output?.progress || null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    });
  } catch (error) {
    console.error("Digital adaptations status error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Digital adaptations status could not be loaded." },
      { status: 500 },
    );
  }
}
