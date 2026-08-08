import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { processQuotePayment } from "../../../lib/payments/process-quote-payment";
import { getPlan, normalizePlan } from "@/lib/platform/plans";
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
    : {
        start: Math.floor(Date.now() / 1000),
        end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

  const { error } = await supabase.from("credit_wallets").upsert(
    {
      user_id: userId,
      monthly_balance: plan.monthlyCredits,
      period_start: new Date(period.start * 1000).toISOString(),
      period_end: new Date(period.end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
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
        return NextResponse.json({
          received: true,
          quoteId: quoteResult.quoteId,
          productionJobId: quoteResult.productionJobId,
        });
      }

      const userId = session.metadata?.user_id;
      const topUpType = session.metadata?.type;
      if (userId && topUpType === "credit_top_up") {
        const credits = Number(session.metadata?.credits || 0);
        const packId = String(session.metadata?.pack_id || "custom");
        if (!Number.isFinite(credits) || credits <= 0) {
          throw new Error("Invalid credit top-up metadata.");
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

    if (event.type === "invoice.paid") {
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
      if (subscription) await syncStripeSubscription(subscription);
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncStripeSubscription(subscription);
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
        await applyMonthlyPlanCredits({ userId, planValue: "free", subscription: null });
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
