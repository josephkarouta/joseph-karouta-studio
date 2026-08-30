import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function GET(request: NextRequest) {
  const access = await requireAdminApiCapability("templates");
  if (access.response) return access.response;
  const kind = String(request.nextUrl.searchParams.get("kind") || "").trim();
  let query = admin().from("admin_saved_templates").select("*").order("updated_at", { ascending: false });
  if (kind === "quote" || kind === "checklist") query = query.eq("kind", kind);
  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, templates: data || [] });
}

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("templates");
  if (access.response) return access.response;
  const body = await request.json();
  const payload = sanitize(body, access.user!.id);
  if (!payload.name || !["quote", "checklist"].includes(payload.kind)) {
    return NextResponse.json({ success: false, error: "Template type and name are required." }, { status: 400 });
  }
  const { data, error } = await admin().from("admin_saved_templates").insert(payload).select("*").single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await recordAdminAudit({ actorUserId: access.user!.id, action: `${payload.kind}_template.created`, entityType: "admin_saved_template", entityId: data.id, summary: `Created ${payload.kind} template: ${payload.name}` });
  return NextResponse.json({ success: true, template: data });
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdminApiCapability("templates");
  if (access.response) return access.response;
  const body = await request.json();
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ success: false, error: "Template ID is required." }, { status: 400 });
  const payload = sanitize(body, access.user!.id);
  delete (payload as Record<string, unknown>).created_by;
  const { data, error } = await admin().from("admin_saved_templates").update(payload).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await recordAdminAudit({ actorUserId: access.user!.id, action: `${data.kind}_template.updated`, entityType: "admin_saved_template", entityId: id, summary: `Updated ${data.kind} template: ${data.name}` });
  return NextResponse.json({ success: true, template: data });
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminApiCapability("templates");
  if (access.response) return access.response;
  const id = String(request.nextUrl.searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ success: false, error: "Template ID is required." }, { status: 400 });
  const client = admin();
  const { data: existing } = await client.from("admin_saved_templates").select("id,kind,name").eq("id", id).maybeSingle();
  const { error } = await client.from("admin_saved_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await recordAdminAudit({ actorUserId: access.user!.id, action: `${existing?.kind || "admin"}_template.deleted`, entityType: "admin_saved_template", entityId: id, summary: `Deleted template: ${existing?.name || id}` });
  return NextResponse.json({ success: true });
}

function sanitize(body: Record<string, unknown>, actor: string) {
  const kind = String(body.kind || "").trim().toLowerCase();
  const rawContent = body.content;
  const content = rawContent && typeof rawContent === "object" && !Array.isArray(rawContent) ? rawContent : {};
  return {
    kind,
    name: String(body.name || "").trim(),
    studio: String(body.studio || "").trim() || null,
    service_id: String(body.service_id || body.serviceId || "").trim() || null,
    content,
    enabled: body.enabled !== false,
    created_by: actor,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  };
}
