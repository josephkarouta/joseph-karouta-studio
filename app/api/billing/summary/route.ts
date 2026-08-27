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

function isoFromUnixSeconds(value: unknown) {
  const seconds = Number(value || 0);
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}


async function retrieveSubscriptionSchedule(
  stripe: ReturnType<typeof getStripe>,
  subscription: Stripe.Subscription,
) {
  const value = subscription.schedule;
  if (!value) return null;
  if (typeof value !== "string") return value as Stripe.SubscriptionSchedule;
  try {
    return await stripe.subscriptionSchedules.retrieve(value);
  } catch {
    return null;
  }
}

function priceId(value: string | Stripe.Price | undefined) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

function normalizedPriceId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function pendingPlanFromSchedule(
  schedule: Stripe.SubscriptionSchedule | null,
  currentPriceId: string | null | undefined,
) {
  if (!schedule || !["active", "not_started"].includes(schedule.status)) {
    return { plan: null as null | "starter" | "pro", effectiveAt: null as string | null };
  }

  const current = String(currentPriceId || "");
  const phases = (schedule.phases || []) as unknown as Array<{
    start_date?: number;
    items?: { data?: Array<{ price?: string | Stripe.Price }> };
  }>;

  for (const phase of phases) {
    const nextPrice = priceId(phase.items?.data?.[0]?.price);
    if (!nextPrice || nextPrice === current) continue;
    if (nextPrice === process.env.STRIPE_STARTER_PRICE_ID_USD) {
      return {
        plan: "starter" as const,
        effectiveAt: isoFromUnixSeconds(phase.start_date),
      };
    }
    if (nextPrice === process.env.STRIPE_PRO_PRICE_ID_USD) {
      return {
        plan: "pro" as const,
        effectiveAt: isoFromUnixSeconds(phase.start_date),
      };
    }
  }

  return { plan: null as null | "starter" | "pro", effectiveAt: null as string | null };
}

function isTerminalSubscriptionStatus(value: unknown) {
  return ["cancelled", "canceled", "inactive", "incomplete_expired"].includes(
    String(value || "").toLowerCase(),
  );
}

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

    const subscriptionIsTerminal = Boolean(
      subscription && isTerminalSubscriptionStatus(subscription.status),
    );

    const subscriptionSchedule = subscription
      ? await retrieveSubscriptionSchedule(stripe, subscription)
      : null;

    let row = existing;
    if (subscription) {
      row = await syncSubscription(
        admin,
        user.id,
        subscription,
        subscriptionIsTerminal ? "free" : planFromSubscription(subscription),
      );
    }

    const payload = subscription
      ? subscriptionPayload(subscription, subscriptionIsTerminal ? "free" : undefined)
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
    const terminalStatus = isTerminalSubscriptionStatus(payload.status);
    const autoRenewal = Boolean(
      payload.stripe_subscription_id && !cancelAtPeriodEnd && !terminalStatus,
    );
    const subscriptionStartedAt = subscription
      ? isoFromUnixSeconds(subscription.created)
      : String(row?.created_at || "").trim() || null;
    const pendingPlan = pendingPlanFromSchedule(
      subscriptionSchedule,
      normalizedPriceId(payload.stripe_price_id),
    );

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
        subscriptionStartedAt,
        cancelAtPeriodEnd,
        autoRenewal,
        nextRenewalAt: autoRenewal ? payload.current_period_end : null,
        accessEndsAt: cancelAtPeriodEnd
          ? scheduledCancelAt
          : terminalStatus
            ? payload.canceled_at || payload.current_period_end
            : null,
        scheduledCancelAt,
        canceledAt: payload.canceled_at,
        currency: payload.currency,
        amount: payload.amount,
        canManage: Boolean(payload.stripe_customer_id),
        pendingPlan: pendingPlan.plan,
        pendingPlanEffectiveAt: pendingPlan.effectiveAt,
        canChangePlan: Boolean(
          payload.stripe_subscription_id &&
            !terminalStatus &&
            !cancelAtPeriodEnd &&
            ["active", "trialing"].includes(String(payload.status || "").toLowerCase()),
        ),
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
