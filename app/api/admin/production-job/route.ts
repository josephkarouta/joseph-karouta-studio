import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiAccess } from "@/lib/server/admin-api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing production job." },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("production_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Production job not found." },
        { status: 404 },
      );
    }

    const { count: unreadClientMessages, error: countError } = await supabase
      .from("production_messages")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", job.id)
      .eq("sender_type", "client")
      .is("read_by_admin_at", null);

    if (countError) throw countError;

    return NextResponse.json({
      success: true,
      job: {
        ...job,
        unread_client_messages: unreadClientMessages || 0,
      },
    });
  } catch (error) {
    console.error("Load admin production job error:", error);
    return NextResponse.json(
      { success: false, error: "Could not load production job." },
      { status: 500 },
    );
  }
}
