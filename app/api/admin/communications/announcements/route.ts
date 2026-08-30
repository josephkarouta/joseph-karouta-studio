import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const audiences = new Set(["everyone", "free", "starter", "pro", "subscribers"]);
const channels = new Set(["email", "in_app", "both"]);

export async function GET() {
  const access = await requireAdminApiCapability("communications");
  if (access.response) return access.response;
  const { data, error } = await admin().from("admin_announcements").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, announcements: data || [] });
}

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("communications");
  if (access.response) return access.response;
  const body = await request.json();
  const payload = sanitize(body, access.user!.id);
  if (!payload.title || !payload.subject || !payload.body) return NextResponse.json({ success: false, error: "Title, subject and message are required." }, { status: 400 });
  const { data, error } = await admin().from("admin_announcements").insert(payload).select("*").single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await recordAdminAudit({ actorUserId: access.user!.id, action: "announcement.created", entityType: "announcement", entityId: data.id, summary: `Created announcement: ${data.title}`, metadata: { audience: data.audience, channel: data.channel } });
  return NextResponse.json({ success: true, announcement: data });
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdminApiCapability("communications");
  if (access.response) return access.response;
  const body = await request.json();
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ success: false, error: "Announcement ID is required." }, { status: 400 });
  const payload = sanitize(body, access.user!.id);
  delete (payload as Record<string, unknown>).created_by;
  const { data, error } = await admin().from("admin_announcements").update(payload).eq("id", id).eq("status", "draft").select("*").single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await recordAdminAudit({ actorUserId: access.user!.id, action: "announcement.updated", entityType: "announcement", entityId: id, summary: `Updated announcement: ${data.title}` });
  return NextResponse.json({ success: true, announcement: data });
}

function sanitize(body: Record<string, unknown>, actor: string) {
  const audience = String(body.audience || "everyone").toLowerCase();
  const channel = String(body.channel || "both").toLowerCase();
  return {
    title: String(body.title || "").trim(),
    subject: String(body.subject || "").trim(),
    preheader: String(body.preheader || "").trim() || null,
    body: String(body.body || "").trim(),
    cta_label: String(body.cta_label || body.ctaLabel || "Open Heyy Studio").trim() || null,
    cta_path: String(body.cta_path || body.ctaPath || "/dashboard").trim() || "/dashboard",
    audience: audiences.has(audience) ? audience : "everyone",
    channel: channels.has(channel) ? channel : "both",
    created_by: actor,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  };
}
