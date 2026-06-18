import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json({ plan: "free" });
    }

    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("plan, status")
      .eq("user_id", user_id)
      .eq("status", "active")
      .single();

    if (error || !data) {
      return NextResponse.json({ plan: "free" });
    }

    return NextResponse.json({
      plan: data.plan || "free",
    });
  } catch (error) {
    console.error("Get user plan error:", error);
    return NextResponse.json({ plan: "free" });
  }
}