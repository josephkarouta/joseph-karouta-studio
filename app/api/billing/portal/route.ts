import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { getStripe, resolveStripeCustomer } from "@/lib/billing/stripe";

export const runtime = "nodejs";

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
      return NextResponse.json(
        {
          success: false,
          error: "No Stripe billing account exists for this user yet.",
        },
        { status: 404 },
      );
    }

    // Billing should always return to the exact site that opened the portal.
    // Do not let a stale NEXT_PUBLIC_SITE_URL (for example localhost in a
    // deployed environment) redirect customers away from the active site.
    const siteUrl = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${siteUrl}/billing?portal=returned`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    const status = error instanceof ApiAuthError ? error.status : 500;
    console.error("Create Stripe billing portal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to open billing management.",
      },
      { status },
    );
  }
}
