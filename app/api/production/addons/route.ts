import { NextRequest, NextResponse } from "next/server";

import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const jobId = String(request.nextUrl.searchParams.get("jobId") || "").trim();
    if (!jobId) return NextResponse.json({ success: false, error: "Production job is required." }, { status: 400 });

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .select("id,user_id,client_approved_at")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ success: false, error: "Production job not found." }, { status: 404 });

    const { data, error } = await admin
      .from("production_addons")
      .select("id,kind,status,title,description,currency,client_amount_cents,sent_to_client_at,paid_at,created_at")
      .eq("production_job_id", jobId)
      .eq("user_id", user.id)
      .in("status", ["sent", "paid"])
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ success: true, addons: data || [] });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Load production add-ons error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not load project additions." }, { status: 500 });
  }
}
