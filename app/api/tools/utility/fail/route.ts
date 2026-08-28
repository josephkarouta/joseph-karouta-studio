import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const operationId = String(body?.operationId || "").trim();
    if (!operationId) return NextResponse.json({ error: "Operation ID is required." }, { status: 400 });

    // Subscriber operations reserve no credits and create no utility row.
    if (operationId.startsWith("subscriber:")) {
      return NextResponse.json({ success: true });
    }

    const { error } = await auth.admin.rpc("heyy_fail_utility_operation", {
      p_user_id: auth.user.id,
      p_operation_id: operationId,
      p_reason: String(body?.reason || "Utility operation failed").slice(0, 500),
    });
    if (error) console.error("Utility failure cleanup error:", error);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ success: true });
  }
}
