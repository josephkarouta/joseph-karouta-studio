import "server-only";

import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("jobId")?.trim() || "";
    if (!jobId) return NextResponse.json({ error: "Presentation job is required." }, { status: 400 });

    const { data: job, error } = await auth.admin
      .from("generation_jobs")
      .select("id,status,error,output,credit_reservation_id,created_at,completed_at")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .eq("tool", "powerpoint_generator")
      .maybeSingle();

    if (error) {
      console.error("PowerPoint status load error:", error.message);
      return NextResponse.json({ error: "Presentation status could not be loaded." }, { status: 500 });
    }
    if (!job) return NextResponse.json({ error: "Presentation job was not found." }, { status: 404 });

    const status = String(job.status || "queued");
    const output = (job.output || {}) as Record<string, any>;
    const result = output.result && typeof output.result === "object" ? output.result : null;

    // If the asset/result exists but the final status write was interrupted,
    // never hide a completed paid result from the customer.
    if ((status === "succeeded" || status === "finalizing") && result?.fileUrl) {
      return NextResponse.json({
        success: true,
        status: "succeeded",
        result,
      });
    }

    if (status === "failed" || status === "cancelled") {
      return NextResponse.json({
        success: false,
        status,
        error: safePublicError(job.error),
      });
    }

    return NextResponse.json({
      success: true,
      status: status === "queued" ? "processing" : status,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("PowerPoint status error:", error);
    return NextResponse.json({ error: "Presentation status could not be loaded." }, { status: 500 });
  }
}

function safePublicError(value: unknown) {
  const message = typeof value === "string" ? value.trim() : "";
  if (message && message.length <= 240 && !/[{}<>`]/.test(message) && !/https?:\/\//i.test(message)) {
    return message;
  }
  return "Presentation generation could not be completed. Your credits were returned.";
}
