import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { user_id, title, project_brief } = body;

    if (!user_id || !project_brief) {
      return NextResponse.json(
        { success: false, error: "Missing user_id or project_brief" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_projects")
      .insert({
        user_id,
        title: title || "Untitled Project",
        project_brief,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, project: data });
  } catch (error) {
    console.error("Save project error:", error);

    return NextResponse.json(
      { success: false, error: "Could not save project" },
      { status: 500 }
    );
  }
}