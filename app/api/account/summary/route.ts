import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { CreditError, ensureCreditWallet } from "@/lib/credits/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const { plan, wallet } = await ensureCreditWallet({
      admin,
      userId: user.id,
      user,
    });

    const monthly = Number(wallet.monthly_balance || 0);
    const purchased = Number(wallet.purchased_balance || 0);
    const reserved = Number(wallet.reserved_balance || 0);
    const available = Math.max(0, monthly + purchased - reserved);

    return NextResponse.json({
      success: true,
      plan,
      credits: {
        available,
        monthly,
        purchased,
        reserved,
        periodEnd: wallet.period_end,
      },
    });
  } catch (error) {
    const status =
      error instanceof ApiAuthError || error instanceof CreditError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load the account summary.",
      },
      { status },
    );
  }
}
