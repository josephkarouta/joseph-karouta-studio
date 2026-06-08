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

    console.log("Updating project:", id, status);

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing id or status" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      throw error;
    }

    console.log("Updated row:", data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Project status API error:", error);

    return NextResponse.json(
      { success: false, error: "Could not update status" },
      { status: 500 }
    );
  }
}