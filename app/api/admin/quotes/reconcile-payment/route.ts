import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { processQuotePayment } from "@/lib/payments/process-quote-payment";

import { requireAdminApiCapability } from "@/lib/server/admin-api";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Route handlers may not always be able to write refreshed cookies.
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sign in to confirm this payment." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const quoteId = String(body.quoteId || "").trim();

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: "Missing quote ID." },
        { status: 400 },
      );
    }

    const { data: quote, error: quoteError } = await serviceSupabase
      .from("workspace_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { success: false, error: "Quote not found." },
        { status: 404 },
      );
    }

    const { data: studioRequest, error: requestError } = await serviceSupabase
      .from("studio_requests")
      .select("id,user_id")
      .eq("id", quote.studio_request_id)
      .maybeSingle();

    if (requestError) throw requestError;

    if (!studioRequest || studioRequest.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "This quote does not belong to your account." },
        { status: 403 },
      );
    }

    if (quote.status === "Paid" && quote.production_job_id) {
      return NextResponse.json({
        success: true,
        paid: true,
        productionJobId: quote.production_job_id,
      });
    }

    if (!quote.stripe_session_id) {
      return NextResponse.json({
        success: true,
        paid: false,
        processing: false,
        message: "Checkout has not started for this quote yet.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(
      quote.stripe_session_id,
    );

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        success: true,
        paid: false,
        processing: session.status === "complete",
        message:
          session.status === "complete"
            ? "The payment is still being confirmed."
            : "This checkout has not been paid.",
      });
    }

    const result = await processQuotePayment(session);

    return NextResponse.json({
      success: true,
      paid: result.handled,
      productionJobId: result.productionJobId,
    });
  } catch (error) {
    console.error("Payment reconciliation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment could not be confirmed.",
      },
      { status: 500 },
    );
  }
}
