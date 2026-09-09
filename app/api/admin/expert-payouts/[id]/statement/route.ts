import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { buildExpertPayoutStatementPdf } from "@/lib/payments/expert-payout-statement";
import { loadExpertPayoutStatementData } from "@/lib/payments/load-expert-payout-statement";

export const runtime = "nodejs";

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;
  try {
    const { id } = await context.params;
    const { data } = await loadExpertPayoutStatementData(adminClient(), id);
    const statement = await buildExpertPayoutStatementPdf(data);
    return new NextResponse(statement.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Heyy-Studio-${statement.statementNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Admin Expert payout statement error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payout statement could not be created." }, { status: 400 });
  }
}
