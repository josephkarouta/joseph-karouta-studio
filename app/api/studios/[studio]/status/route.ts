import "server-only";

import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ studio: string }> }) {
  try {
    const { studio } = await context.params;
    if (!(studio === "interior" || studio === "marketing")) return NextResponse.json({ error: "Unknown Studio." }, { status: 404 });
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });

    const { data: job, error } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .eq("tool", "guided_studio")
      .maybeSingle();
    if (error) throw new Error(error.message || "Generation status could not be loaded.");
    if (!job) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
    if (String(job.input?.studio || "") !== studio) return NextResponse.json({ error: "Generation job does not belong to this Studio." }, { status: 404 });

    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({ success: true, status: "failed", error: job.error || "Generation failed. Your credits were returned." });
    }
    if (job.status !== "succeeded") return NextResponse.json({ success: true, status: "processing" });

    const projectId = String(job.output?.project_id || job.project_id || "").trim();
    if (!projectId) throw new Error("Completed generation has no project ID.");
    const databaseId = studio === "interior" ? "interior_studio" : "marketing_studio";
    const { data: project, error: projectError } = await auth.admin
      .from("studio_projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", databaseId)
      .single();
    if (projectError || !project) throw new Error(projectError?.message || "Generated project could not be loaded.");

    return NextResponse.json({
      success: true,
      status: "succeeded",
      project,
      output: project.output || {},
      workMode: job.output?.work_mode || job.input?.workMode || "guided",
      usage: job.output?.usage || null,
      creditsUsed: Number(job.output?.credits_used || job.input?.credits || 0),
    });
  } catch (error) {
    console.error("Guided Studio status error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation status could not be loaded." }, { status: 500 });
  }
}
