import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { project_id, service } = body;

    if (!project_id || !service) {
      return NextResponse.json(
        { success: false, error: "Missing project_id or service" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("production_jobs")
      .select("*")
      .eq("project_id", project_id)
      .eq("service", service)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      exists: !!data,
      job: data || null,
      status: data?.status || null,
    });
  } catch (error) {
    console.error("Production status error:", error);

    return NextResponse.json(
      { success: false, error: "Could not check production status" },
      { status: 500 }
    );
  }
}