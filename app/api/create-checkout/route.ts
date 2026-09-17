import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import {
  configuredSubscriptionPriceId,
  findBestSubscription,
  getStripe,
  hasManagedSubscription,
  resolveStripeCustomer,
  validateStripeSubscriptionCatalog,
} from "@/lib/billing/stripe";
import { checkoutCollectionOptions } from "@/lib/billing/profile";
import { normalizeBillingInterval, type BillingInterval } from "@/lib/platform/plans";

type SubscriptionPlan = "starter" | "pro";

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const normalizedPlan = String(body.planName || "").toLowerCase() as SubscriptionPlan;
    const billingInterval = normalizeBillingInterval(body.billingInterval) as BillingInterval;

    if (!(normalizedPlan === "starter" || normalizedPlan === "pro")) {
      return NextResponse.json({ error: "Invalid subscription plan." }, { status: 400 });
    }

    const priceId = configuredSubscriptionPriceId(normalizedPlan, billingInterval);
    if (!priceId) {
      return NextResponse.json(
        { error: `The ${normalizedPlan} subscription is temporarily unavailable.` },
        { status: 503 },
      );
    }

    const stripe = getStripe();

    // Fail closed if a stale sandbox/live Price ID still points at the old
    // commercial amount, interval or a separate Stripe product. This keeps the
    // customer-facing plan catalog and Stripe Checkout in lockstep.
    await validateStripeSubscriptionCatalog(stripe);

    const { customer } = await resolveStripeCustomer({
      stripe,
      admin,
      user,
      createIfMissing: true,
    });

    if (!customer) {
      return NextResponse.json({ error: "Unable to prepare secure checkout." }, { status: 500 });
    }

    const currentSubscription = await findBestSubscription(stripe, customer.id);
    if (hasManagedSubscription(currentSubscription)) {
      return NextResponse.json(
        {
          error: "You already have a subscription. Use Manage Billing to change or cancel it.",
          code: "ACTIVE_SUBSCRIPTION",
          manageBilling: true,
        },
        { status: 409 },
      );
    }

    const siteUrl = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customer.id,
      ...checkoutCollectionOptions(true),
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan: normalizedPlan,
        billing_interval: billingInterval,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: normalizedPlan,
          billing_interval: billingInterval,
        },
      },
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/billing?subscribed=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }
}
