import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiCapability } from "@/lib/server/admin-api";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const { data, error } = await supabase
      .from("production_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      jobs: data || [],
    });
  } catch (error) {
    console.error("Admin production jobs error:", error);

    return NextResponse.json(
      { success: false, error: "Could not load production jobs" },
      { status: 500 }
    );
  }
}