import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { priceId, userEmail, userId, planName } = await req.json();

    if (!priceId) {
      return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
  payment_method_types: ["card"],
  mode: "subscription",

  client_reference_id: userId,

  metadata: {
    user_id: userId,
    plan: planName,
  },

  subscription_data: {
    metadata: {
      user_id: userId,
      plan: planName,
    },
  },

  line_items: [
    {
      price: priceId,
      quantity: 1,
    },
  ],

  success_url: `${
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  }/dashboard?subscribed=true`,

  cancel_url: `${
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  }/#pricing`,
};

    if (userEmail && userEmail.includes("@")) {
      sessionConfig.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    return NextResponse.json(
      { error: "Could not create checkout session" },
      { status: 500 }
    );
  }
}