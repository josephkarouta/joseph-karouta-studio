import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const id = Number(body.id);
    const status = body.status;
    const project_tag = body.project_tag;

    const updateData: any = {};

    if (status) updateData.status = status;
    if (project_tag) updateData.project_tag = project_tag;

    if (!id || Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing id or update data" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Project update API error:", error);

    return NextResponse.json(
      { success: false, error: "Could not update project" },
      { status: 500 }
    );
  }
}