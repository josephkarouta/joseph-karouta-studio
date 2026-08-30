import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { getSubscriptionRow } from "@/lib/billing/stripe";
import { backfillPaymentHistory } from "@/lib/payments/payment-receipts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const existingCount = await admin
      .from("payment_records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!existingCount.error && Number(existingCount.count || 0) === 0) {
      try {
        const subscriptionRow = await getSubscriptionRow(admin, user.id);
        await backfillPaymentHistory({
          userId: user.id,
          userEmail: user.email,
          stripeCustomerId: String(subscriptionRow?.stripe_customer_id || "").trim() || null,
        });
      } catch (backfillError) {
        console.warn("Payment history backfill skipped:", backfillError);
      }
    }

    const { data, error, count } = await admin
      .from("payment_records")
      .select(
        "id,payment_type,description,amount_total,tax_amount,currency,status,invoice_number,paid_at,related_id",
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .order("paid_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    const total = Number(count || 0);
    return NextResponse.json({
      success: true,
      payments: data || [],
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    const status = error instanceof ApiAuthError ? error.status : 500;
    console.error("Payment history error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof ApiAuthError ? error.message : "Payment history is temporarily unavailable.",
      },
      { status },
    );
  }
}
