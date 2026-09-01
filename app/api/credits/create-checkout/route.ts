import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { getStripe, resolveStripeCustomer } from "@/lib/billing/stripe";
import { checkoutCollectionOptions, stripeProductTaxCode } from "@/lib/billing/profile";
import { CreditError, ensureCreditWallet } from "@/lib/credits/server";
import { getCreditPack } from "@/lib/platform/plans";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const pack = getCreditPack(body.packId);

    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
    }

    await ensureCreditWallet({
      admin,
      userId: user.id,
      user,
    });

    const stripe = getStripe();
    const { customer } = await resolveStripeCustomer({
      stripe,
      admin,
      user,
      createIfMissing: true,
    });

    if (!customer) {
      return NextResponse.json({ error: "Unable to prepare secure checkout." }, { status: 500 });
    }

    const site = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer: customer.id,
      ...checkoutCollectionOptions(true),
      client_reference_id: user.id,
      metadata: {
        type: "credit_top_up",
        user_id: user.id,
        pack_id: pack.id,
        credits: String(pack.credits),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(pack.priceUsd * 100),
            tax_behavior: "exclusive",
            product_data: {
              name: `Heyy Studio — ${pack.name}`,
              description: pack.description,
              ...(stripeProductTaxCode() ? { tax_code: stripeProductTaxCode() } : {}),
            },
          },
        },
      ],
      success_url: `${site}/credits?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/credits?topup=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create credit checkout." },
      {
        status:
          error instanceof ApiAuthError || error instanceof CreditError
            ? error.status
            : 500,
      },
    );
  }
}
