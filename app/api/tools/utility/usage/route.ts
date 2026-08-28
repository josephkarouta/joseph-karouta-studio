import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { ensureCreditWallet, CreditError } from "@/lib/credits/server";
import {
  isUtilityTool,
  UTILITY_DAILY_FREE_LIMIT,
  UTILITY_CREDIT_COST,
} from "@/lib/tools/utility-policy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const url = new URL(request.url);
    const tool = url.searchParams.get("tool");
    if (!isUtilityTool(tool)) {
      return NextResponse.json({ error: "Unknown utility tool." }, { status: 400 });
    }

    const ensured = await ensureCreditWallet({ admin: auth.admin, userId: auth.user.id });
    const unlimited = ensured.plan === "starter" || ensured.plan === "pro";

    // Subscribers do not consume a daily allowance or utility credits. Return
    // immediately so their tools keep working even if the free-user usage
    // migration has not been installed yet.
    if (unlimited) {
      return NextResponse.json({
        plan: ensured.plan,
        unlimited: true,
        dailyLimit: UTILITY_DAILY_FREE_LIMIT,
        freeUsed: 0,
        freeRemaining: UTILITY_DAILY_FREE_LIMIT,
        creditCostAfterFree: UTILITY_CREDIT_COST,
      });
    }

    const { error: cleanupError } = await auth.admin.rpc("heyy_cleanup_expired_utility_operations", {
      p_user_id: auth.user.id,
    });
    if (cleanupError && !/does not exist|schema cache/i.test(cleanupError.message || "")) {
      console.error("Utility cleanup failed:", cleanupError);
    }

    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await auth.admin
      .from("utility_operations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("tool", tool)
      .eq("usage_date", today)
      .eq("charge_type", "free")
      .in("status", ["reserved", "completed"]);

    if (error) {
      const missingMigration = /does not exist|schema cache|utility_operations/i.test(error.message || "");
      return NextResponse.json(
        { error: missingMigration ? "The utility-tools database migration has not been applied yet." : "Usage could not be loaded." },
        { status: missingMigration ? 503 : 500 },
      );
    }

    const used = Math.max(0, Number(count || 0));
    return NextResponse.json({
      tool,
      plan: ensured.plan,
      unlimited,
      dailyLimit: UTILITY_DAILY_FREE_LIMIT,
      freeUsed: used,
      freeRemaining: unlimited ? UTILITY_DAILY_FREE_LIMIT : Math.max(0, UTILITY_DAILY_FREE_LIMIT - used),
      creditCostAfterFree: UTILITY_CREDIT_COST,
    });
  } catch (error) {
    if (error instanceof ApiAuthError || error instanceof CreditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Utility usage error:", error);
    return NextResponse.json({ error: "Usage could not be loaded." }, { status: 500 });
  }
}
