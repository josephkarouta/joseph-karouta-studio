import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { getCreditPack } from "@/lib/platform/plans";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const { sessionId } = (await request.json()) as { sessionId?: string };

    if (!sessionId || !sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Invalid Stripe session." }, { status: 400 });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.mode !== "payment" || session.metadata?.type !== "credit_top_up") {
      return NextResponse.json({ error: "This is not a credit top-up payment." }, { status: 400 });
    }
    if (
      session.metadata?.user_id !== user.id ||
      (session.client_reference_id && session.client_reference_id !== user.id)
    ) {
      return NextResponse.json({ error: "This payment belongs to another account." }, { status: 403 });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "The payment is not confirmed yet." }, { status: 409 });
    }

    const credits = Number(session.metadata?.credits || 0);
    const packId = String(session.metadata?.pack_id || "custom");
    const pack = getCreditPack(packId);
    if (!pack || !Number.isFinite(credits) || credits !== pack.credits) {
      return NextResponse.json({ error: "Invalid credit amount." }, { status: 400 });
    }

    const { error } = await admin.rpc("heyy_apply_credit_top_up", {
      p_user_id: user.id,
      p_stripe_session_id: session.id,
      p_pack_id: packId,
      p_credits: credits,
      p_amount_total: session.amount_total || 0,
      p_currency: session.currency || "usd",
    });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      creditsAdded: credits,
      sessionId: session.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The top-up could not be verified." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}
