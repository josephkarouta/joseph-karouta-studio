import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteId } = body;

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: "Missing quoteId" },
        { status: 400 }
      );
    }

    const { data: quote, error: quoteError } = await supabase
      .from("workspace_quotes")
      .update({
        status: "Accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .select()
      .single();

    if (quoteError) throw quoteError;

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    console.error("Accept Quote Error:", error);

    return NextResponse.json(
      { success: false, error: error.message || "Could not accept quote" },
      { status: 500 }
    );
  }
}