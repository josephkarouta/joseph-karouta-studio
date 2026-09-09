import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";
import { Notifications } from "@/lib/notifications";
import { resolveProductionService } from "@/lib/production/service-registry";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function clean(value: unknown, max = 5000) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const body = await request.json();
    const contactId = clean(body.contactId, 100);
    const projectNameInput = clean(body.projectName, 180);
    const studioInput = clean(body.studio, 80);
    const serviceIdInput = clean(body.serviceId, 160);

    if (!contactId) {
      return NextResponse.json({ success: false, error: "Contact request ID is required." }, { status: 400 });
    }

    const admin = adminClient();
    const { data: contact, error: contactError } = await admin
      .from("contact_submissions")
      .select("*")
      .eq("id", contactId)
      .maybeSingle();

    if (contactError) throw contactError;
    if (!contact) return NextResponse.json({ success: false, error: "Contact request not found." }, { status: 404 });

    const metadata = record(contact.metadata);
    const topicKey = clean(metadata.topic_key || contact.topic, 80).toLowerCase();
    if (!topicKey.includes("expert") && !String(contact.topic || "").toLowerCase().includes("project request")) {
      return NextResponse.json({ success: false, error: "Only Expert / Project Request submissions can be converted to production." }, { status: 409 });
    }

    if (metadata.converted_studio_request_id) {
      return NextResponse.json({
        success: true,
        alreadyConverted: true,
        requestId: String(metadata.converted_studio_request_id),
        href: `/admin/studio-requests/${encodeURIComponent(String(metadata.converted_studio_request_id))}?section=expert-sourcing`,
      });
    }

    const userId = clean(contact.user_id, 100);
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: "This Expert request is not connected to a Heyy Studio account. Ask the client to sign in and resubmit the Expert / Project Request so quotes, payments and files can stay private in their workspace.",
      }, { status: 409 });
    }

    const linkedProjectId = clean(metadata.project_id, 100);
    const productionOnly = !linkedProjectId;
    const projectId = linkedProjectId || randomUUID();
    const projectName = projectNameInput || clean(metadata.project_name || metadata.subject || contact.company || "Direct Expert Project", 180) || "Direct Expert Project";
    const productionService = resolveProductionService({
      studio: studioInput || metadata.studio || "brand_studio",
      serviceId: serviceIdInput || metadata.service_id,
      service: body.service,
    });

    const attachmentNames = Array.isArray(metadata.attachment_names)
      ? metadata.attachment_names.map((item: unknown) => clean(item, 180)).filter(Boolean)
      : [];

    const projectBrief = [
      "Direct Expert Production Request",
      "",
      `Project: ${projectName}`,
      `Studio: ${productionService.studio}`,
      `Requested service: ${productionService.label}`,
      "",
      "Client request",
      clean(contact.message) || "No additional message provided.",
      attachmentNames.length ? "" : null,
      attachmentNames.length ? "Attached reference files" : null,
      ...attachmentNames.map((name: string) => `- ${name}`),
      "",
      `Source contact reference: ${contactId}`,
    ].filter((value): value is string => typeof value === "string").join("\n");

    const requestMetadata = {
      client_name: clean(contact.name, 160) || null,
      client_email: clean(contact.email, 254) || null,
      company: clean(metadata.company || contact.company, 160) || null,
      source: "contact_expert_request",
      source_contact_id: contactId,
      source_job_id: clean(metadata.source_job_id, 100) || null,
      linked_project_id: linkedProjectId || null,
      production_only: productionOnly,
      direct_expert_request: true,
      studio: productionService.studio,
      service: productionService.label,
      service_id: productionService.id,
      production_type: productionService.label,
      contact_attachment_names: attachmentNames,
      contact_attachments: Array.isArray(metadata.attachments) ? metadata.attachments : [],
    };

    const { data: studioRequest, error: requestError } = await admin
      .from("studio_requests")
      .insert({
        project_id: projectId,
        project_name: projectName,
        user_id: userId,
        studio: productionService.studio,
        service_id: productionService.id,
        service: productionService.label,
        notes: clean(contact.message) || null,
        project_brief: projectBrief,
        preview_image: null,
        metadata: requestMetadata,
        status: "New",
      })
      .select("*")
      .single();

    if (requestError) throw requestError;

    const nextMetadata = {
      ...metadata,
      converted_studio_request_id: studioRequest.id,
      converted_project_id: projectId,
      converted_at: new Date().toISOString(),
      converted_by: access.user?.id || null,
      production_only: productionOnly,
      studio: productionService.studio,
      service_id: productionService.id,
    };

    const { error: contactUpdateError } = await admin
      .from("contact_submissions")
      .update({ status: "reviewing", metadata: nextMetadata })
      .eq("id", contactId);
    if (contactUpdateError) throw contactUpdateError;

    await recordAdminAudit({
      actorUserId: access.user?.id || null,
      action: "contact.converted_to_production",
      entityType: "studio_request",
      entityId: studioRequest.id,
      summary: `Converted Expert contact request into production request: ${projectName}`,
      metadata: { contact_id: contactId, project_id: projectId, production_only: productionOnly, service_id: productionService.id },
    });

    await Notifications.emit({
      event: "production.requested",
      projectId,
      projectName,
      service: productionService.label,
      studio: productionService.studio,
      userId,
      clientName: clean(contact.name, 160) || null,
      clientEmail: clean(contact.email, 254) || null,
      metadata: {
        requestId: studioRequest.id,
        serviceId: productionService.id,
        productionOnly,
        sourceContactId: contactId,
      },
    });

    return NextResponse.json({
      success: true,
      request: studioRequest,
      requestId: studioRequest.id,
      projectId,
      productionOnly,
      href: `/admin/studio-requests/${encodeURIComponent(studioRequest.id)}?section=expert-sourcing`,
    });
  } catch (error) {
    console.error("Contact to production conversion failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not convert this contact request into production." }, { status: 500 });
  }
}
