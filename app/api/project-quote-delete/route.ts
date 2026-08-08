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

    const updatedHistory = (lead?.quote_history || []).filter(
      (_item: any, index: number) => index !== body.index
    );

    const latestQuote = updatedHistory[0]?.amount || null;

    const { error } = await supabase
      .from("leads")
      .update({
        quote_history: updatedHistory,
        quote_value: latestQuote,
      })
      .eq("id", body.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}