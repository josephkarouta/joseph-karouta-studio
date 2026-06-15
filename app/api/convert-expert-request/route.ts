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

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing request id" },
        { status: 400 }
      );
    }

    const { data: request, error: requestError } = await supabase
      .from("expert_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (requestError || !request) {
      return NextResponse.json(
        { success: false, error: "Expert request not found" },
        { status: 404 }
      );
    }

    const projectId = `HS-${Date.now()}`;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        project_id: projectId,
        status: request.status || "Reviewing",
        name: request.name,
        email: request.email,
        phone: request.phone,
        company: request.company,
        notes: request.notes,
        project_brief: request.project_brief,
        attachments: request.attachments || [],
      })
      .select()
      .single();

    if (leadError) {
      throw leadError;
    }

    await supabase
  .from("expert_requests")
  .update({ status: "Converted" })
  .eq("id", id);

    return NextResponse.json({
      success: true,
      lead,
    });
  } catch (error) {
    console.error("Convert expert request error:", error);

    return NextResponse.json(
      { success: false, error: "Could not convert expert request" },
      { status: 500 }
    );
  }
}