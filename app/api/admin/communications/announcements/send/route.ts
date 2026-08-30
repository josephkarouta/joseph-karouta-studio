import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";
import { sendAnnouncement } from "@/lib/communications/announcements";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("communications");
  if (access.response) return access.response;
  const body = await request.json();
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ success: false, error: "Announcement ID is required." }, { status: 400 });
  const client = admin();
  const { data: announcement, error } = await client.from("admin_announcements").select("*").eq("id", id).single();
  if (error || !announcement) return NextResponse.json({ success: false, error: error?.message || "Announcement not found." }, { status: 404 });
  if (announcement.status === "sent") return NextResponse.json({ success: true, duplicate: true, announcement });
  await client.from("admin_announcements").update({ status: "sending", updated_by: access.user!.id, updated_at: new Date().toISOString() }).eq("id", id);
  try {
    const result = await sendAnnouncement(announcement);
    const status = result.failedCount > 0 && result.sentCount === 0 ? "failed" : "sent";
    const { data: updated } = await client.from("admin_announcements").update({ status, sent_count: result.sentCount, failed_count: result.failedCount, sent_at: new Date().toISOString(), updated_by: access.user!.id, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    await recordAdminAudit({ actorUserId: access.user!.id, action: "announcement.sent", entityType: "announcement", entityId: id, summary: `Sent announcement: ${announcement.title}`, metadata: result });
    return NextResponse.json({ success: true, result, announcement: updated || announcement });
  } catch (value) {
    await client.from("admin_announcements").update({ status: "failed", failed_count: 1, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ success: false, error: value instanceof Error ? value.message : "Announcement could not be sent." }, { status: 500 });
  }
}
