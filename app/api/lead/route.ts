import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY EXISTS:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { error } = await supabase.from("leads").insert({
      name: body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      notes: body.notes,
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