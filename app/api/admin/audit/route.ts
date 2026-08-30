import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/admin-api";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const accessError = await requireAdminApiAccess();
  if (accessError) return accessError;
  const { data, error } = await admin
    .from("admin_audit_log")
    .select("id,actor_user_id,action,entity_type,entity_id,summary,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ success: false, error: "Audit log could not be loaded." }, { status: 500 });
  return NextResponse.json({ success: true, entries: data || [] });
}
