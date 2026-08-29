import "server-only";

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import {
  findBestSubscription,
  getStripe,
  planFromSubscription,
  resolveStripeCustomer,
  validateStripeSubscriptionCatalog,
} from "@/lib/billing/stripe";
import { getPlan, normalizePlan, type PlanId } from "@/lib/platform/plans";

export const runtime = "nodejs";

type ChangeablePlan = Extract<PlanId, "starter" | "pro">;

type ScheduleItem = {
  price?: string | Stripe.Price;
  quantity?: number | null;
};

type SchedulePhase = {
  start_date?: number;
  end_date?: number;
  items?: ScheduleItem[] | { data?: ScheduleItem[] };
  metadata?: Record<string, string>;
};

function phaseItems(phase: SchedulePhase) {
  const items = phase.items;
  if (Array.isArray(items)) return items;
  if (items && typeof items === "object" && Array.isArray(items.data)) return items.data;
  return [] as ScheduleItem[];
}

function priceId(value: string | Stripe.Price | undefined) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

function configuredPriceId(plan: ChangeablePlan) {
  return String(
    plan === "starter"
      ? process.env.STRIPE_STARTER_PRICE_ID_USD || ""
      : process.env.STRIPE_PRO_PRICE_ID_USD || "",
  ).trim();
}

async function retrieveSchedule(stripe: Stripe, subscription: Stripe.Subscription) {
  const value = subscription.schedule;
  if (!value) return null;
  if (typeof value !== "string") return value as Stripe.SubscriptionSchedule;
  try {
    return await stripe.subscriptionSchedules.retrieve(value);
  } catch {
    return null;
  }
}

function currentPhaseFor(schedule: Stripe.SubscriptionSchedule) {
  const phases = (schedule.phases || []) as unknown as SchedulePhase[];
  const now = Math.floor(Date.now() / 1000);
  return (
    phases.find((phase) => Number(phase.start_date || 0) <= now && Number(phase.end_date || 0) > now) ||
    phases[0] ||
    null
  );
}

function currentPhaseInput(phase: SchedulePhase, fallbackPriceId: string) {
  const items = phaseItems(phase)
    .map((item) => ({
      price: priceId(item.price) || fallbackPriceId,
      quantity: Math.max(1, Number(item.quantity || 1)),
    }))
    .filter((item) => Boolean(item.price));

  if (!items.length) items.push({ price: fallbackPriceId, quantity: 1 });

  return {
    items,
    start_date: Number(phase.start_date || 0),
    end_date: Number(phase.end_date || 0),
    proration_behavior: "none" as const,
    metadata: phase.metadata || {},
  };
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const targetPlan = normalizePlan(body?.plan);
    if (!(targetPlan === "starter" || targetPlan === "pro")) {
      return NextResponse.json({ error: "Choose Starter or Pro." }, { status: 400 });
    }

    const stripe = getStripe();
    await validateStripeSubscriptionCatalog(stripe);

    const { customer } = await resolveStripeCustomer({
      stripe,
      admin,
      user,
      createIfMissing: false,
    });
    if (!customer) {
      return NextResponse.json({ error: "No paid billing account exists for this user." }, { status: 404 });
    }

    const subscription = await findBestSubscription(stripe, customer.id);
    if (!subscription || !["active", "trialing"].includes(subscription.status)) {
      return NextResponse.json(
        { error: "An active Starter or Pro subscription is required before changing plans." },
        { status: 409 },
      );
    }
    if (subscription.cancel_at_period_end) {
      return NextResponse.json(
        { error: "Resume your subscription before scheduling a plan change." },
        { status: 409 },
      );
    }

    const currentPlan = planFromSubscription(subscription);
    if (!(currentPlan === "starter" || currentPlan === "pro")) {
      return NextResponse.json({ error: "The current paid plan could not be identified." }, { status: 409 });
    }
    if (currentPlan === targetPlan) {
      return NextResponse.json({ error: `You are already on ${getPlan(targetPlan).name}.` }, { status: 409 });
    }

    const currentPriceId = priceId(subscription.items?.data?.[0]?.price);
    const targetPriceId = configuredPriceId(targetPlan as ChangeablePlan);
    if (!currentPriceId || !targetPriceId) {
      return NextResponse.json({ error: "Plan changes are temporarily unavailable." }, { status: 503 });
    }

    let schedule = await retrieveSchedule(stripe, subscription);
    if (schedule && ["active", "not_started"].includes(schedule.status)) {
      const ownedByHeyy = Boolean(String(schedule.metadata?.heyy_pending_plan || "").trim());
      if (!ownedByHeyy) {
        return NextResponse.json(
          { error: "A billing update is already scheduled. Cancel that update before scheduling another plan change." },
          { status: 409 },
        );
      }
    } else {
      schedule = await stripe.subscriptionSchedules.create({
        from_subscription: subscription.id,
      });
    }

    const phase = currentPhaseFor(schedule);
    if (!phase) throw new Error("The current billing schedule could not be read.");

    const currentInput = currentPhaseInput(phase, currentPriceId);
    if (!currentInput.start_date || !currentInput.end_date) {
      throw new Error("The current billing period could not be scheduled safely.");
    }

    const updated = await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      proration_behavior: "none",
      metadata: {
        ...(schedule.metadata || {}),
        heyy_user_id: user.id,
        heyy_pending_plan: targetPlan,
      },
      phases: [
        currentInput,
        {
          items: [{ price: targetPriceId, quantity: 1 }],
          duration: { interval: "month", interval_count: 1 },
          proration_behavior: "none",
          metadata: {
            user_id: user.id,
            plan: targetPlan,
          },
        },
      ],
    });

    const effectiveAt = new Date(currentInput.end_date * 1000).toISOString();
    return NextResponse.json({
      success: true,
      currentPlan,
      pendingPlan: targetPlan,
      effectiveAt,
      scheduleId: updated.id,
    });
  } catch (error) {
    const status = error instanceof ApiAuthError ? error.status : 500;
    console.error("Schedule Stripe plan change error:", error);
    return NextResponse.json(
      { error: error instanceof ApiAuthError ? error.message : "Plan change could not be scheduled. Please try again." },
      { status },
    );
  }
}
