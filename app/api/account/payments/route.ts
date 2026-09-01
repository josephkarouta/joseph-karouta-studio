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

    const syncRequested = url.searchParams.get("sync") === "1";
    const [existingCount, subscriptionRow, latestSubscriptionPayment] = await Promise.all([
      admin
        .from("payment_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      getSubscriptionRow(admin, user.id),
      admin
        .from("payment_records")
        .select("id,paid_at")
        .eq("user_id", user.id)
        .eq("payment_type", "subscription")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const stripeCustomerId = String(subscriptionRow?.stripe_customer_id || "").trim() || null;
    const plan = String(subscriptionRow?.plan || "free").toLowerCase();
    const status = String(subscriptionRow?.status || "").toLowerCase();
    const hasPaidPlan = Boolean(
      stripeCustomerId &&
      plan !== "free" &&
      !["cancelled", "canceled", "inactive", "unpaid", "incomplete_expired"].includes(status),
    );
    const periodStartMs = subscriptionRow?.current_period_start
      ? new Date(String(subscriptionRow.current_period_start)).getTime()
      : Number.NaN;
    const latestSubscriptionPaidAtMs = latestSubscriptionPayment.data?.paid_at
      ? new Date(String(latestSubscriptionPayment.data.paid_at)).getTime()
      : Number.NaN;

    // Only contact the payment provider when the local records indicate that
    // something is actually missing (or the user explicitly presses Refresh).
    // This avoids focus-based/background usage while still self-healing a paid
    // subscription invoice that was missed by webhook delivery.
    const currentSubscriptionPaymentMissing = hasPaidPlan && (
      !latestSubscriptionPayment.data ||
      (Number.isFinite(periodStartMs) &&
        (!Number.isFinite(latestSubscriptionPaidAtMs) || latestSubscriptionPaidAtMs + 5 * 60 * 1000 < periodStartMs))
    );
    const noLocalPaymentHistory = !existingCount.error && Number(existingCount.count || 0) === 0;

    if (syncRequested || noLocalPaymentHistory || currentSubscriptionPaymentMissing) {
      try {
        await backfillPaymentHistory({
          userId: user.id,
          userEmail: user.email,
          stripeCustomerId,
          // A missed current subscription should also repair the confirmation
          // email. The communication layer prevents duplicate sends.
          sendLatestSubscriptionEmail: currentSubscriptionPaymentMissing || syncRequested,
        });
      } catch (backfillError) {
        console.warn("Payment history reconciliation skipped:", backfillError);
      }
    }

    const { data, error, count } = await admin
      .from("payment_records")
      .select(
        "id,payment_type,description,amount_total,tax_amount,currency,status,invoice_number,paid_at,related_id,billing_country_code",
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
