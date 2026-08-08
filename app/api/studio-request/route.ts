import "server-only";

import { NextResponse } from "next/server";
import { Notifications } from "@/lib/notifications";
import { resolveProductionService } from "@/lib/production/service-registry";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const notes = typeof body.notes === "string" ? body.notes : "";
    const projectBrief = typeof body.project_brief === "string" ? body.project_brief : "";
    const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {};

    const projectId = metadata.project_id ? String(metadata.project_id) : null;
    const projectName = metadata.project_name ? String(metadata.project_name) : null;
    const studio = metadata.studio ? String(metadata.studio) : "brand_studio";
    const productionService = resolveProductionService({
      serviceId: metadata.service_id,
      service: metadata.service || metadata.production_type,
      studio,
    });
    const service = productionService.label;
    const canonicalMetadata = {
      ...metadata,
      studio: productionService.studio,
      service: productionService.label,
      service_id: productionService.id,
      production_type: productionService.label,
    };

    if (!projectId || !projectName) {
      return NextResponse.json(
        { success: false, error: "Project ID and project name are required." },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("studio_requests")
      .insert({
        project_id: projectId,
        project_name: projectName,
        user_id: user.id,
        studio: productionService.studio,
        service_id: productionService.id,
        service,
        notes,
        project_brief: projectBrief,
        preview_image: metadata.preview_image ? String(metadata.preview_image) : null,
        metadata: canonicalMetadata,
        status: "New",
      })
      .select()
      .single();
    if (error) throw error;

    await Notifications.emit({
      event: "production.requested",
      projectId: data.project_id,
      projectName: data.project_name,
      service: data.service,
      studio: data.studio,
      userId: data.user_id,
      clientName: data.client_name || data.name || user.user_metadata?.full_name || null,
      clientEmail: data.client_email || data.email || user.email || null,
      clientPhone: data.client_phone || data.phone || null,
      metadata: { requestId: data.id, serviceId: productionService.id },
    });

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Studio Request Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Could not create studio request" },
      { status: 500 },
    );
  }
}
