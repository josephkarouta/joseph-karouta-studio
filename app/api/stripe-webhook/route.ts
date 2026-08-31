import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { processQuotePayment } from "../../../lib/payments/process-quote-payment";
import { applyMonthlyCredits } from "@/lib/credits/server";
import { getCreditPack, getPlan, normalizePlan } from "@/lib/platform/plans";
import { recordCheckoutPayment, recordProductionCheckoutReceipt, recordSubscriptionInvoice } from "@/lib/payments/payment-receipts";
import {
  getStripe,
  planFromSubscription,
  syncSubscription,
  userIdForSubscription,
} from "@/lib/billing/stripe";

const stripe = getStripe();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const record = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
  };
  const item = record.items?.data?.[0];
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    start: record.current_period_start || item?.current_period_start || nowSeconds,
    end: record.current_period_end || item?.current_period_end || nowSeconds + 30 * 24 * 60 * 60,
  };
}

async function applyMonthlyPlanCredits({
  userId,
  planValue,
  subscription,
}: {
  userId: string;
  planValue: unknown;
  subscription?: Stripe.Subscription | null;
}) {
  const plan = getPlan(normalizePlan(planValue));
  const period = subscription
    ? subscriptionPeriod(subscription)
    : currentCalendarPeriod();
  const periodStart = new Date(period.start * 1000).toISOString();
  const periodEnd = new Date(period.end * 1000).toISOString();
  const subscriptionId = subscription?.id || null;

  await applyMonthlyCredits(supabase, {
    userId,
    plan: plan.id,
    amount: plan.monthlyCredits,
    periodStart,
    periodEnd,
    grantKey: subscriptionId
      ? `stripe:${subscriptionId}:${periodStart}`
      : `${plan.id}:calendar:${periodStart}`,
    source: subscriptionId ? "stripe_webhook" : "subscription_ended",
    metadata: {
      stripe_subscription_id: subscriptionId,
    },
  });
}

async function expireSubscriptionPlanCredits({
  userId,
  subscription,
  endedAtSecondsOverride,
  source = "subscription_ended",
}: {
  userId: string;
  subscription: Stripe.Subscription;
  endedAtSecondsOverride?: number | null;
  source?: "subscription_ended" | "renewal_failed";
}) {
  const period = subscriptionPeriod(subscription);
  const endedAtSeconds =
    endedAtSecondsOverride ||
    subscription.canceled_at ||
    period.end ||
    Math.floor(Date.now() / 1000);
  const periodStart = new Date(endedAtSeconds * 1000);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const applied = await applyMonthlyCredits(supabase, {
    userId,
    plan: "free",
    amount: 0,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    grantKey: `stripe-${source}:${subscription.id}:${periodStart.toISOString()}`,
    source,
    metadata: {
      stripe_subscription_id: subscription.id,
      previous_plan: planFromSubscription(subscription),
      subscription_status: subscription.status,
      expiry_reason: source,
    },
  });

  if (applied) return;

  const { data, error } = await supabase
    .from("credit_wallets")
    .select("monthly_balance,reserved_balance")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  if (Number(data?.monthly_balance || 0) === 0) return;

  throw new Error(
    `Subscription credits are waiting for ${Number(data?.reserved_balance || 0)} reserved credits to settle.`,
  );
}

function currentCalendarPeriod() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

async function retrieveSubscription(value: string | Stripe.Subscription | null | undefined) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  return stripe.subscriptions.retrieve(value);
}

async function syncStripeSubscription(subscription: Stripe.Subscription, planOverride?: unknown) {
  const userId = await userIdForSubscription(supabase, subscription);
  if (!userId) return { userId: null, plan: planFromSubscription(subscription) };

  const plan = normalizePlan(planOverride || planFromSubscription(subscription));
  await syncSubscription(supabase, userId, subscription, plan);
  return { userId, plan };
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("Webhook signature error:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const quoteResult = await processQuotePayment(session);

      if (quoteResult.handled) {
        if (quoteResult.quoteId) {
          try {
            await recordProductionCheckoutReceipt({ session, quoteId: quoteResult.quoteId });
          } catch (receiptError) {
            console.error("Production payment receipt failed:", receiptError);
          }
        }
        return NextResponse.json({
          received: true,
          quoteId: quoteResult.quoteId,
          productionJobId: quoteResult.productionJobId,
        });
      }

      const userId = session.metadata?.user_id;
      const topUpType = session.metadata?.type;
      if (userId && topUpType === "credit_top_up") {
        const metadataCredits = Number(session.metadata?.credits || 0);
        const packId = String(session.metadata?.pack_id || "custom");
        const pack = getCreditPack(packId);
        const legacyCreditsByPack: Record<string, number> = { small: 100, medium: 300, large: 750 };
        const validMetadataCredits = pack
          ? metadataCredits === pack.credits || metadataCredits === legacyCreditsByPack[pack.id]
          : false;
        if (!pack || !Number.isFinite(metadataCredits) || !validMetadataCredits) {
          throw new Error("Invalid credit top-up metadata.");
        }
        // Pack ID + current server catalog are authoritative. This deliberately
        // upgrades a checkout session opened immediately before the denomination
        // cutover (100/300/750 metadata) to 1,000/3,000/7,500 credits without
        // changing what the customer paid.
        const credits = pack.credits;
        if (session.payment_status !== "paid") {
          throw new Error("Credit top-up payment is not confirmed.");
        }
        const { error } = await supabase.rpc("heyy_apply_credit_top_up", {
          p_user_id: userId,
          p_stripe_session_id: session.id,
          p_pack_id: packId,
          p_credits: credits,
          p_amount_total: session.amount_total || 0,
          p_currency: session.currency || "usd",
        });
        if (error) throw error;
        try {
          await recordCheckoutPayment({
            session,
            userId,
            paymentType: "credit_pack",
            description: `Heyy Studio ${pack.name}`,
            relatedId: pack.id,
            metadata: { pack_id: pack.id, credits: pack.credits },
          });
        } catch (receiptError) {
          console.error("Credit purchase receipt failed:", receiptError);
        }
        return NextResponse.json({ received: true, creditTopUp: true });
      }

      const plan = session.metadata?.plan;
      if (userId && plan) {
        const subscription = await retrieveSubscription(session.subscription);
        if (subscription) {
          await syncSubscription(supabase, userId, subscription, plan);
          await applyMonthlyPlanCredits({ userId, planValue: plan, subscription });
        }
      }
    }

    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_succeeded"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceRecord = invoice as unknown as {
        subscription?: string | Stripe.Subscription | null;
        parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } };
      };
      const subscriptionValue =
        invoiceRecord.subscription ||
        invoiceRecord.parent?.subscription_details?.subscription ||
        null;
      const subscription = await retrieveSubscription(subscriptionValue);

      if (subscription) {
        const { userId, plan } = await syncStripeSubscription(subscription);
        if (userId) {
          await applyMonthlyPlanCredits({ userId, planValue: plan, subscription });
          try {
            await recordSubscriptionInvoice({ invoice, userId, plan });
          } catch (receiptError) {
            console.error("Subscription payment receipt failed:", receiptError);
          }
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceRecord = invoice as unknown as {
        subscription?: string | Stripe.Subscription | null;
        parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } };
      };
      const subscription = await retrieveSubscription(
        invoiceRecord.subscription ||
          invoiceRecord.parent?.subscription_details?.subscription ||
          null,
      );
      if (subscription) {
        const { userId } = await syncStripeSubscription(subscription);
        if (userId) {
          const invoiceRecordWithPeriod = invoice as unknown as { period_start?: number | null };
          await expireSubscriptionPlanCredits({
            userId,
            subscription,
            endedAtSecondsOverride:
              Number(invoiceRecordWithPeriod.period_start || 0) ||
              subscriptionPeriod(subscription).start ||
              Math.floor(Date.now() / 1000),
            source: "renewal_failed",
          });
        }
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const { userId } = await syncStripeSubscription(subscription);
      if (
        userId &&
        (subscription.status === "unpaid" ||
          subscription.status === "incomplete_expired")
      ) {
        await expireSubscriptionPlanCredits({ userId, subscription });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await userIdForSubscription(supabase, subscription);

      if (userId) {
        await syncSubscription(supabase, userId, subscription, "free");
        const { error } = await supabase
          .from("user_subscriptions")
          .update({
            plan: "free",
            status: "cancelled",
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        if (error) throw error;
        await expireSubscriptionPlanCredits({ userId, subscription });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);

    return NextResponse.json(
      {
        error: "Webhook failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}