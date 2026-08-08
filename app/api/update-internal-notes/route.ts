import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { id, notes } = await request.json();

  const { error } = await supabase
    .from("leads")
    .update({
      internal_notes: notes,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({
      success: false,
    });
  }

  return NextResponse.json({
    success: true,
  });
}