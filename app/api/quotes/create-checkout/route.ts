import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { buildProductionWorkspaceHref, resolveProductionService } from "@/lib/production/service-registry";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getReturnPath(quote: any, paymentState: "success" | "cancelled") {
  const service = resolveProductionService({
    serviceId: quote.service_id,
    service: quote.service,
    studio: quote.studio,
  });

  return buildProductionWorkspaceHref({
    projectId: quote.project_id,
    studio: quote.studio,
    serviceId: service.id,
    service: service.label,
    paymentState,
    quoteId: quote.id,
  });
}
export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const { quoteId } = await request.json();

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: "Missing quoteId" },
        { status: 400 },
      );
    }

    const { data: quote, error } = await admin
      .from("workspace_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (error || !quote) {
      return NextResponse.json(
        { success: false, error: "Quote not found" },
        { status: 404 },
      );
    }

    if (!quote.studio_request_id) {
      return NextResponse.json(
        { success: false, error: "This quote is not linked to a client request." },
        { status: 403 },
      );
    }

    const { data: studioRequest, error: requestError } = await admin
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

    const productionService = resolveProductionService({
      serviceId: quote.service_id,
      service: quote.service,
      studio: quote.studio,
    });
    const baseUrl = new URL(request.url).origin;
    const successPath = getReturnPath(quote, "success");
    const cancelPath = getReturnPath(quote, "cancelled");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: String(quote.currency || "USD").toLowerCase(),
            unit_amount: Math.round(Number(quote.amount) * 100),
            product_data: {
              name: quote.title || "Heyy Studio Quote",
              description: quote.description || "Heyy Studio service quote",
            },
          },
        },
      ],
      metadata: {
        quote_id: quote.id,
        project_id: quote.project_id || "",
        studio: quote.studio || "",
        service: productionService.label,
        service_id: productionService.id,
      },
      success_url: `${baseUrl}${successPath}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelPath}`,
    });

    const { error: updateError } = await admin
      .from("workspace_quotes")
      .update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    console.error("Quote checkout error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create quote checkout",
      },
      { status: 500 },
    );
  }
}
