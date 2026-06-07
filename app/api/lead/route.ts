import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const projectId = `HS-${Date.now()}`;

const { error } = await supabase.from("leads").insert({
  project_id: projectId,
  status: "New",

  name: body.name,
  email: body.email,
  phone: body.phone,
  company: body.company,
  notes: body.notes,
  attachments: body.attachments,
  project_brief: body.project_brief,
});

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, error: "Could not save lead" },
      { status: 500 }
    );
  }
}