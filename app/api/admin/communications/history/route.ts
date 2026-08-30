import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminApiCapability } from "@/lib/server/admin-api";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const access = await requireAdminApiCapability("communications");
  if (access.response) return access.response;
  const { data, error } = await admin
    .from("communication_sends")
    .select("id,recipient_email,template_key,subject,status,related_type,related_id,sent_at,created_at,error_message")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ success: false, error: "Send history could not be loaded." }, { status: 500 });
  return NextResponse.json({ success: true, sends: data || [] });
}
