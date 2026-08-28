import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import {
  ensureCreditWallet,
  reserveCredits,
  refundCredits,
  CreditError,
} from "@/lib/credits/server";
import {
  isUtilityOperation,
  isUtilityTool,
  utilityCreditAction,
  UTILITY_CREDIT_COST,
  UTILITY_DAILY_FREE_LIMIT,
} from "@/lib/tools/utility-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let admin: SupabaseClient | null = null;
  let creditReservationId: string | null = null;

  try {
    const auth = await requireApiUser(request);
    admin = auth.admin;
    const body = await request.json();
    const tool = body?.tool;
    const operation = body?.operation;
    if (!isUtilityTool(tool) || !isUtilityOperation(tool, operation)) {
      return NextResponse.json({ error: "Invalid utility operation." }, { status: 400 });
    }

    const { error: cleanupError } = await admin.rpc("heyy_cleanup_expired_utility_operations", {
      p_user_id: auth.user.id,
    });
    if (cleanupError && !/does not exist|schema cache/i.test(cleanupError.message || "")) {
      console.error("Utility cleanup failed:", cleanupError);
    }

    const ensured = await ensureCreditWallet({ admin, userId: auth.user.id });
    const unlimited = ensured.plan === "starter" || ensured.plan === "pro";

    if (unlimited) {
      // Subscriber utilities are included with the plan and the file itself is
      // processed entirely in the browser. No utility-operation database row
      // is needed just to permit an unlimited local conversion.
      return NextResponse.json({
        operationId: `subscriber:${crypto.randomUUID()}`,
        chargeType: "subscriber",
        creditsReserved: 0,
        unlimited: true,
        freeRemaining: UTILITY_DAILY_FREE_LIMIT,
      });
    }

    const { data: freeRows, error: freeError } = await admin.rpc("heyy_claim_free_utility_operation", {
      p_user_id: auth.user.id,
      p_tool: tool,
      p_operation: operation,
      p_limit: UTILITY_DAILY_FREE_LIMIT,
    });
    if (freeError) {
      const missingMigration = /does not exist|schema cache|heyy_claim_free_utility_operation/i.test(freeError.message || "");
      if (missingMigration) {
        return NextResponse.json({ error: "The utility-tools database migration has not been applied yet." }, { status: 503 });
      }
      throw new Error(freeError.message || "Free daily usage could not be checked.");
    }

    const freeClaim = Array.isArray(freeRows) ? freeRows[0] : freeRows;
    if (freeClaim?.operation_id) {
      const used = Number(freeClaim.free_used || 1);
      return NextResponse.json({
        operationId: freeClaim.operation_id,
        chargeType: "free",
        creditsReserved: 0,
        unlimited: false,
        freeRemaining: Math.max(0, UTILITY_DAILY_FREE_LIMIT - used),
      });
    }

    const reservation = await reserveCredits({
      admin,
      userId: auth.user.id,
      action: utilityCreditAction(tool),
      amountOverride: UTILITY_CREDIT_COST,
      metadata: { tool, utility_operation: operation },
    });
    creditReservationId = reservation.id;

    const { data, error } = await admin
      .from("utility_operations")
      .insert({
        user_id: auth.user.id,
        tool,
        operation,
        charge_type: "credit",
        credit_reservation_id: reservation.id,
        status: "reserved",
      })
      .select("id")
      .single();
    if (error || !data?.id) throw new Error(error?.message || "Utility operation could not be started.");

    return NextResponse.json({
      operationId: data.id,
      chargeType: "credit",
      creditsReserved: UTILITY_CREDIT_COST,
      unlimited: false,
      freeRemaining: 0,
    });
  } catch (error) {
    if (admin && creditReservationId) {
      await refundCredits(admin, creditReservationId, "Utility operation could not start");
    }
    if (error instanceof ApiAuthError || error instanceof CreditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Utility authorize error:", error);
    const message = error instanceof Error ? error.message : "Utility operation could not be started.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
