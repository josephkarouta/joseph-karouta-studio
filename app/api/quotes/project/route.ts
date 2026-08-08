import { NextRequest, NextResponse } from "next/server";
import {
  productionServiceMatches,
  resolveProductionService,
} from "@/lib/production/service-registry";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const serviceId = request.nextUrl.searchParams.get("serviceId");
    const service = request.nextUrl.searchParams.get("service");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Missing projectId" },
        { status: 400 },
      );
    }

    const expectedService = serviceId || service
      ? resolveProductionService({ serviceId, service })
      : null;

    const { data: ownedRequests, error: requestError } = await admin
      .from("studio_requests")
      .select("id,service_id,service,studio,metadata")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (requestError) throw requestError;

    const requestIds = (ownedRequests || [])
      .filter((item: any) =>
        expectedService ? productionServiceMatches(item, expectedService) : true,
      )
      .map((item: any) => item.id);

    if (requestIds.length === 0) {
      return NextResponse.json({ success: true, quotes: [] });
    }

    const { data, error } = await admin
      .from("workspace_quotes")
      .select("*")
      .eq("project_id", projectId)
      .in("studio_request_id", requestIds)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      service: expectedService,
      quotes: data || [],
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    console.error("Load project quotes error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not load quotes",
      },
      { status: 500 },
    );
  }
}
