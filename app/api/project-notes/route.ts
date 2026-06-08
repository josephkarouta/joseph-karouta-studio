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
    const internal_notes = body.internal_notes || "";

    console.log("Saving notes for project:", id);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing project id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .update({ internal_notes })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase notes error:", error);
      throw error;
    }

    console.log("Saved notes:", data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Project notes API error:", error);

    return NextResponse.json(
      { success: false, error: "Could not save notes" },
      { status: 500 }
    );
  }
}