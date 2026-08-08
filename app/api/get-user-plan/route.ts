import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { resolveSubscriptionPlan } from "../../../lib/server/subscription-plan";

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const { data, error } = await admin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id);
    if (error) throw error;
    const resolved = resolveSubscriptionPlan(
      (data || []) as Record<string, unknown>[],
      user,
    );
    return NextResponse.json({ plan: resolved.plan });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ plan: "free", error: error.message }, { status: error.status });
    }
    console.error("Get user plan error:", error);
    return NextResponse.json({ plan: "free" });
  }
}
