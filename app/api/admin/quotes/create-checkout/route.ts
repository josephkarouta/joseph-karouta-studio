import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { buildProductionWorkspaceHref, resolveProductionService } from "@/lib/production/service-registry";

import { requireAdminApiAccess } from "@/lib/server/admin-api";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const { quoteId } = await request.json();

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: "Missing quoteId" },
        { status: 400 },
      );
    }

    const { data: quote, error } = await supabase
      .from("workspace_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (error || !quote) {
      throw error || new Error("Quote not found");
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

    const { error: updateError } = await supabase
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
  } catch (error: any) {
    console.error("Quote checkout error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not create quote checkout",
      },
      { status: 500 },
    );
  }
}
