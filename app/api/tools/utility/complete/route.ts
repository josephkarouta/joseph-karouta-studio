import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { ensureCreditWallet, CreditError } from "@/lib/credits/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const operationId = String(body?.operationId || "").trim();
    if (!operationId) return NextResponse.json({ error: "Operation ID is required." }, { status: 400 });

    if (operationId.startsWith("subscriber:")) {
      const ensured = await ensureCreditWallet({ admin: auth.admin, userId: auth.user.id });
      if (ensured.plan !== "starter" && ensured.plan !== "pro") {
        return NextResponse.json({ error: "This unlimited utility operation requires an active subscription." }, { status: 403 });
      }
      return NextResponse.json({ success: true, chargeType: "subscriber", alreadyCompleted: false });
    }

    const { data, error } = await auth.admin.rpc("heyy_complete_utility_operation", {
      p_user_id: auth.user.id,
      p_operation_id: operationId,
      p_metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });
    if (error) {
      const missingMigration = /does not exist|schema cache|heyy_complete_utility_operation/i.test(error.message || "");
      return NextResponse.json(
        { error: missingMigration ? "The utility-tools database migration has not been applied yet." : error.message || "Operation could not be completed." },
        { status: missingMigration ? 503 : 500 },
      );
    }
    return NextResponse.json({ success: true, ...(data || {}) });
  } catch (error) {
    if (error instanceof ApiAuthError || error instanceof CreditError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Utility complete error:", error);
    return NextResponse.json({ error: "Operation could not be completed." }, { status: 500 });
  }
}
