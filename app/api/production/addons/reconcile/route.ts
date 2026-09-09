import { NextRequest, NextResponse } from "next/server";

import { getStripe } from "@/lib/billing/stripe";
import { processProductionAddonPayment } from "@/lib/payments/process-production-addon-payment";
import { recordCheckoutPayment } from "@/lib/payments/payment-receipts";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json()) as { sessionId?: unknown };
    const sessionId = String(body.sessionId || "").trim();
    if (!sessionId) return NextResponse.json({ success: false, error: "Checkout session is required." }, { status: 400 });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (String(session.client_reference_id || "") !== user.id) {
      return NextResponse.json({ success: false, error: "This payment does not belong to your account." }, { status: 403 });
    }

    const addonId = String(session.metadata?.production_addon_id || "").trim();
    if (!addonId) return NextResponse.json({ success: false, error: "This checkout is not a production add-on payment." }, { status: 400 });
    const { data: addon, error: addonError } = await admin
      .from("production_addons")
      .select("id,user_id,title")
      .eq("id", addonId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (addonError) throw addonError;
    if (!addon) return NextResponse.json({ success: false, error: "Production add-on not found." }, { status: 404 });

    const result = await processProductionAddonPayment(session);
    if (!result.handled) return NextResponse.json({ success: false, error: "Payment could not be reconciled." }, { status: 409 });

    try {
      await recordCheckoutPayment({
        session,
        userId: user.id,
        paymentType: "production",
        description: result.title,
        relatedId: result.addonId,
        metadata: { production_job_id: result.productionJobId, production_addon_id: result.addonId, kind: result.kind },
      });
    } catch (receiptError) {
      console.error("Production add-on reconcile receipt failed:", receiptError);
    }

    return NextResponse.json({ success: true, addonId: result.addonId, jobId: result.productionJobId, kind: result.kind });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Reconcile production add-on payment error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not confirm the payment." }, { status: 500 });
  }
}
