import { NextRequest, NextResponse } from "next/server";
import {
  productionServiceMatches,
  resolveProductionService,
} from "@/lib/production/service-registry";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

// Never return private Admin-only production fields (especially internal_notes)
// through the client status endpoint. Add client-visible fields explicitly here.
const CLIENT_JOB_FIELDS = "id,project_id,project_name,user_id,studio,assigned_studio,service_id,service,status,priority,delivery_status,preview_image,notes,created_at,updated_at,client_approved_at,payment_quote_id" as const;

export async function GET(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const serviceId = request.nextUrl.searchParams.get("serviceId");
    const service = request.nextUrl.searchParams.get("service");

    if (!projectId || (!serviceId && !service)) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 },
      );
    }

    const expectedService = resolveProductionService({ serviceId, service });

    const { data: projectRequests, error: requestError } = await admin
      .from("studio_requests")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (requestError) throw requestError;

    const latestRequest = (projectRequests || []).find((item: any) =>
      productionServiceMatches(item, expectedService),
    );

    const { data: projectJobs, error: jobError } = await admin
      .from("production_jobs")
      .select(CLIENT_JOB_FIELDS)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (jobError) throw jobError;

    const job = (projectJobs || []).find((item: any) =>
      productionServiceMatches(item, expectedService),
    );

    if (!job) {
      return NextResponse.json({
        success: true,
        exists: false,
        service: expectedService,
        request: latestRequest || null,
      });
    }

    const { data: timeline, error: timelineError } = await admin
      .from("production_timeline")
      .select("id,production_job_id,title,description,status,created_by,created_at")
      .eq("production_job_id", job.id)
      .order("created_at", { ascending: true });

    if (timelineError) throw timelineError;

    return NextResponse.json({
      success: true,
      exists: true,
      service: expectedService,
      job,
      request: latestRequest || null,
      timeline: timeline || [],
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    console.error("Load client production status error:", error);
    return NextResponse.json(
      { success: false, error: "Could not load production status" },
      { status: 500 },
    );
  }
}
