import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { buildExpertPayoutStatementPdf } from "@/lib/payments/expert-payout-statement";
import { loadExpertPayoutStatementData } from "@/lib/payments/load-expert-payout-statement";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, admin } = await requireApiUser(request);
    const { id } = await context.params;
    const loaded = await loadExpertPayoutStatementData(admin, id);
    if (String(loaded.expert.user_id || "") !== user.id) {
      return NextResponse.json({ error: "Payout statement not found." }, { status: 404 });
    }
    const statement = await buildExpertPayoutStatementPdf(loaded.data);
    return new NextResponse(statement.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Heyy-Studio-${statement.statementNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Expert payout statement error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payout statement could not be created." }, { status: 400 });
  }
}
