import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const id = Number(body.id);
    const status = body.status;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing id or status" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("expert_requests")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    console.error("Expert request status error:", error);

    return NextResponse.json(
      { success: false, error: "Could not update status" },
      { status: 500 }
    );
  }
}