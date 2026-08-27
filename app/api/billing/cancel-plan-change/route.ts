import "server-only";

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { findBestSubscription, getStripe, resolveStripeCustomer } from "@/lib/billing/stripe";

export const runtime = "nodejs";

async function retrieveSchedule(stripe: Stripe, subscription: Stripe.Subscription) {
  const value = subscription.schedule;
  if (!value) return null;
  if (typeof value !== "string") return value as Stripe.SubscriptionSchedule;
  return stripe.subscriptionSchedules.retrieve(value);
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const stripe = getStripe();
    const { customer } = await resolveStripeCustomer({
      stripe,
      admin,
      user,
      createIfMissing: false,
    });
    if (!customer) {
      return NextResponse.json({ error: "No Stripe billing account exists for this user." }, { status: 404 });
    }

    const subscription = await findBestSubscription(stripe, customer.id);
    if (!subscription) {
      return NextResponse.json({ error: "No subscription exists for this account." }, { status: 404 });
    }

    const schedule = await retrieveSchedule(stripe, subscription);
    if (!schedule || !["active", "not_started"].includes(schedule.status)) {
      return NextResponse.json({ success: true, changed: false });
    }
    if (!String(schedule.metadata?.heyy_pending_plan || "").trim()) {
      return NextResponse.json(
        { error: "This Stripe schedule was not created by Heyy Studio and was left unchanged." },
        { status: 409 },
      );
    }

    await stripe.subscriptionSchedules.release(schedule.id);
    return NextResponse.json({ success: true, changed: true });
  } catch (error) {
    const status = error instanceof ApiAuthError ? error.status : 500;
    console.error("Cancel Stripe plan change error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduled plan change could not be cancelled." },
      { status },
    );
  }
}
