import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job")?.trim();

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Job ID is required." },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .eq("tool", "brand_system")
      .maybeSingle();

    if (jobError) {
      return NextResponse.json(
        { success: false, error: "Brand generation status could not be loaded." },
        { status: 500 },
      );
    }

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Brand generation job not found." },
        { status: 404 },
      );
    }

    const output = isRecord(job.output) ? job.output : {};

    if (job.status === "succeeded") {
      return succeededPayload(job, output);
    }

    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        status: "failed",
        error:
          String(job.error || "") ||
          "Brand workspace generation failed. Your credits were returned.",
      });
    }

    // Recovery for the narrow edge case where the project and credit commit were
    // persisted but the final generation_jobs status update was interrupted.
    const projectId = cleanString(output.project_id) || cleanString(job.project_id);
    if (projectId && job.credit_reservation_id) {
      const { data: reservation } = await auth.admin
        .from("credit_reservations")
        .select("status")
        .eq("id", job.credit_reservation_id)
        .maybeSingle();

      if (reservation?.status === "committed") {
        await auth.admin
          .from("generation_jobs")
          .update({
            status: "succeeded",
            error: null,
            completed_at: job.completed_at || new Date().toISOString(),
          })
          .eq("id", job.id);

        return succeededPayload(job, output);
      }
    }

    return NextResponse.json({
      success: true,
      status: "processing",
      jobId: job.id,
    });
  } catch (error) {
    console.error("Brand Studio generation status error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Brand generation status could not be loaded." },
      { status: 500 },
    );
  }
}

function succeededPayload(
  job: Record<string, any>,
  output: Record<string, unknown>,
) {
  return NextResponse.json({
    success: true,
    status: "succeeded",
    jobId: job.id,
    projectId: cleanString(output.project_id) || cleanString(job.project_id),
    brandSystem: isRecord(output.brand_system) ? output.brand_system : null,
    creditsUsed: Number(output.credits_used || 0),
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
