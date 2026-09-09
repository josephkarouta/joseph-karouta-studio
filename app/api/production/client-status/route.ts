import { NextRequest, NextResponse } from "next/server";
import {
  productionServiceMatches,
  resolveProductionService,
} from "@/lib/production/service-registry";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

// Never return private Admin-only production fields (especially internal_notes)
// through the client status endpoint. Add client-visible fields explicitly here.
const CLIENT_JOB_FIELDS = "id,project_id,project_name,user_id,studio,assigned_studio,service_id,service,status,priority,delivery_status,preview_image,notes,metadata,created_at,updated_at,client_approved_at,payment_quote_id" as const;

export async function GET(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const serviceId = request.nextUrl.searchParams.get("serviceId");
    const service = request.nextUrl.searchParams.get("service");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 },
      );
    }

    // Brand and other Studio workspaces can be opened from normal navigation
    // without a service query string. Return the latest production service so the
    // client is taken back to an existing request/quote/job instead of a blank
    // first-service panel.
    if (!serviceId && !service) {
      const [{ data: recentRequests, error: latestRequestError }, { data: recentJobs, error: latestJobError }] = await Promise.all([
        admin
          .from("studio_requests")
          .select("id,project_id,project_name,user_id,studio,service_id,service,status,metadata,created_at")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("production_jobs")
          .select(CLIENT_JOB_FIELDS)
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (latestRequestError) throw latestRequestError;
      if (latestJobError) throw latestJobError;

      const requestRow = recentRequests?.[0] || null;
      const jobRow = recentJobs?.[0] || null;

      // A new unpaid request on the same project must not hide an existing paid
      // production job and its delivered files when the Studio is reopened.
      // Once the new request is paid it creates a newer production job, which
      // naturally becomes the job restored here. Only fall back to a request
      // when this project has never created a production job.
      const latestRow = jobRow || requestRow;

      if (!latestRow) {
        return NextResponse.json({ success: true, latest: null });
      }

      const latestStudio =
        latestRow.studio || (latestRow === jobRow ? jobRow?.assigned_studio : null);

      const resolved = resolveProductionService({
        serviceId: latestRow.service_id,
        service: latestRow.service,
        studio: latestStudio,
      });
      const matchingRequest = requestRow && productionServiceMatches(requestRow, resolved)
        ? requestRow
        : (recentRequests || []).find((item: any) => productionServiceMatches(item, resolved)) || null;

      return NextResponse.json({
        success: true,
        latest: {
          serviceId: resolved.id,
          service: resolved.label,
          studio: resolved.studio,
          projectName: latestRow.project_name || matchingRequest?.project_name || null,
          productionOnly: Boolean(matchingRequest?.metadata?.production_only || (latestRow === jobRow && jobRow?.metadata?.production_only)),
          workspaceScope: resolved.workspaceScope || null,
          selectedScopes:
            (latestRow === jobRow ? jobRow?.metadata?.selected_production_scopes : null) ||
            (latestRow === jobRow ? jobRow?.metadata?.project_context?.selected_production_scopes : null) ||
            matchingRequest?.metadata?.selected_production_scopes ||
            matchingRequest?.metadata?.project_context?.selected_production_scopes ||
            null,
        },
      });
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

    const latestRequestTime = latestRequest?.created_at ? new Date(latestRequest.created_at).getTime() : 0;
    const latestJobTime = job?.created_at ? new Date(job.created_at).getTime() : 0;
    const requestIsNewer = Boolean(latestRequest && latestRequestTime > latestJobTime);

    if (!job || requestIsNewer) {
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
