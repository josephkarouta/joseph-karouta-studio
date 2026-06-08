import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { data: lead } = await supabase
      .from("leads")
      .select("quote_history")
      .eq("id", body.id)
      .single();

    const currentHistory = lead?.quote_history || [];

    const newEntry = {
      amount: Number(body.amount),
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("leads")
      .update({
        quote_value: Number(body.amount),
        quote_history: [newEntry, ...currentHistory],
      })
      .eq("id", body.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}