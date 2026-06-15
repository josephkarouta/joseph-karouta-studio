import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      user_id,
      name,
      email,
      phone,
      company,
      notes,
      project_brief,
      attachments,
    } = body;

    if (!name || !email || !phone) {
      return NextResponse.json(
        { success: false, error: "Missing contact details" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("expert_requests")
      .insert({
        user_id: user_id || null,
        name,
        email,
        phone,
        company,
        notes,
        project_brief,
        attachments: attachments || [],
        status: "New",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    console.error("Expert request error:", error);

    return NextResponse.json(
      { success: false, error: "Could not submit expert request" },
      { status: 500 }
    );
  }
}