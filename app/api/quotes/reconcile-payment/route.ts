import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { processQuotePayment } from "../../../../lib/payments/process-quote-payment";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing from the server environment.`);
  return value;
}

const stripe = new Stripe(requiredEnvironment("STRIPE_SECRET_KEY"));

const serviceSupabase = createClient(
  requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function extractStripeSessionId(value: unknown): string | null {
  const text = String(value || "").trim();
  if (!text) return null;

  // Supports a plain Checkout Session ID and also extracts it if an older
  // database row accidentally contains a Stripe URL or query string.
  const match = text.match(/cs_(?:test|live)_[A-Za-z0-9_]+/);
  return match?.[0] || null;
}

function bearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export async function POST(request: NextRequest) {
  let stage = "starting";

  try {
    stage = "reading request";
    const body = await request.json();
    const quoteId = String(body.quoteId || "").trim();
    const returnedSessionId = extractStripeSessionId(body.sessionId);

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: "Missing quote ID." },
        { status: 400 },
      );
    }

    stage = "checking login";
    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Your login session could not be read. Refresh the page and try again.",
        },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await serviceSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Your login session expired. Sign in again, then check the payment.",
        },
        { status: 401 },
      );
    }

    stage = "loading quote";
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

    stage = "checking quote ownership";
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

    if (
      String(quote.status || "").toLowerCase() === "paid" &&
      quote.production_job_id
    ) {
      return NextResponse.json({
        success: true,
        paid: true,
        productionJobId: quote.production_job_id,
      });
    }

    stage = "finding Stripe session";
    const { data: paymentRecord, error: paymentRecordError } =
      await serviceSupabase
        .from("payments")
        .select("stripe_session_id")
        .eq("quote_id", quote.id)
        .not("stripe_session_id", "is", null)
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (paymentRecordError) throw paymentRecordError;

    const candidateIds = Array.from(
      new Set(
        [
          returnedSessionId,
          extractStripeSessionId(quote.stripe_session_id),
          extractStripeSessionId(paymentRecord?.stripe_session_id),
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    if (candidateIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No valid Stripe Checkout Session was found for this quote. The quote is safe, but its old checkout reference was not saved correctly.",
        },
        { status: 400 },
      );
    }

    stage = "checking Stripe";
    let session: Stripe.Checkout.Session | null = null;
    let lastStripeError = "";

    for (const candidateId of candidateIds) {
      try {
        const candidate = await stripe.checkout.sessions.retrieve(candidateId);

        // Every quote checkout created by Heyy Studio includes quote_id metadata.
        // This prevents a session from another quote being reconciled accidentally.
        if (candidate.metadata?.quote_id === quote.id) {
          session = candidate;
          break;
        }

        lastStripeError = "The Stripe session belongs to a different quote.";
      } catch (error) {
        lastStripeError =
          error instanceof Error ? error.message : "Stripe session lookup failed.";
      }
    }

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error:
            lastStripeError ||
            "Stripe could not find the Checkout Session for this quote.",
        },
        { status: 400 },
      );
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        success: true,
        paid: false,
        processing: session.status === "complete",
        message:
          session.status === "complete"
            ? "Stripe has completed checkout but is still confirming the payment. Try again shortly."
            : "This checkout has not been paid.",
      });
    }

    stage = "repairing production records";
    const result = await processQuotePayment(session);

    return NextResponse.json({
      success: true,
      paid: result.handled,
      productionJobId: result.productionJobId,
    });
  } catch (error) {
    console.error(`Payment reconciliation failed while ${stage}:`, error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `${error.message} (while ${stage})`
            : `Payment could not be confirmed while ${stage}.`,
      },
      { status: 500 },
    );
  }
}
