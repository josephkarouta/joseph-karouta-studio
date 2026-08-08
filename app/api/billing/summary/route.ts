import "server-only";

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import {
  findBestSubscription,
  getStripe,
  getSubscriptionRow,
  planFromSubscription,
  resolveStripeCustomer,
  subscriptionPayload,
  syncSubscription,
} from "@/lib/billing/stripe";
import { normalizePlan } from "@/lib/platform/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const stripe = getStripe();
    const existing = await getSubscriptionRow(admin, user.id);
    const { customer } = await resolveStripeCustomer({
      stripe,
      admin,
      user,
      createIfMissing: false,
    });

    let subscription: Stripe.Subscription | null = null;
    const storedSubscriptionId = String(existing?.stripe_subscription_id || "").trim();

    if (storedSubscriptionId) {
      try {
        subscription = await stripe.subscriptions.retrieve(storedSubscriptionId);
      } catch {
        subscription = null;
      }
    }

    if (!subscription && customer) {
      subscription = await findBestSubscription(stripe, customer.id);
    }

    let row = existing;
    if (subscription) {
      row = await syncSubscription(
        admin,
        user.id,
        subscription,
        planFromSubscription(subscription),
      );
    }

    const payload = subscription
      ? subscriptionPayload(subscription)
      : {
          plan: normalizePlan(row?.plan),
          status: String(row?.status || "free"),
          stripe_customer_id: customer?.id || row?.stripe_customer_id || null,
          stripe_subscription_id: row?.stripe_subscription_id || null,
          stripe_price_id: row?.stripe_price_id || null,
          current_period_start: row?.current_period_start || null,
          current_period_end: row?.current_period_end || null,
          cancel_at_period_end: Boolean(row?.cancel_at_period_end),
          canceled_at: row?.canceled_at || null,
          currency: row?.currency || null,
          amount: row?.amount ?? null,
        };


    const liveCancelAtSeconds = subscription
      ? Number((subscription as unknown as { cancel_at?: number | null }).cancel_at || 0)
      : 0;
    const liveScheduledCancelAt = liveCancelAtSeconds > 0
      ? new Date(liveCancelAtSeconds * 1000).toISOString()
      : null;
    const cancelAtPeriodEnd = Boolean(
      payload.cancel_at_period_end || liveScheduledCancelAt,
    );
    const scheduledCancelAt =
      liveScheduledCancelAt ||
      (cancelAtPeriodEnd ? payload.current_period_end : null);

    return NextResponse.json({
      success: true,
      billing: {
        plan: payload.plan,
        status: payload.status,
        customerId: payload.stripe_customer_id,
        subscriptionId: payload.stripe_subscription_id,
        priceId: payload.stripe_price_id,
        currentPeriodStart: payload.current_period_start,
        currentPeriodEnd: payload.current_period_end,
        cancelAtPeriodEnd,
        scheduledCancelAt,
        canceledAt: payload.canceled_at,
        currency: payload.currency,
        amount: payload.amount,
        canManage: Boolean(payload.stripe_customer_id),
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const status = error instanceof ApiAuthError ? error.status : 500;
    console.error("Load billing summary error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load billing details.",
      },
      { status },
    );
  }
}
