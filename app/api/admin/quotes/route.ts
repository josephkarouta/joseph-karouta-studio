import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { requireAdminApiAccess } from "@/lib/server/admin-api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function isLockedQuote(quote: any) {
  const status = String(quote?.status || "").toLowerCase();
  return Boolean(
    quote?.paid_at ||
      quote?.production_job_id ||
      ["paid", "converted", "completed"].includes(status),
  );
}

async function expireOpenCheckoutSession(sessionId: unknown) {
  const value = String(sessionId || "").trim();
  if (!value || !process.env.STRIPE_SECRET_KEY) return;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(value);

  if (session.status === "complete") {
    throw new Error(
      "This checkout has already completed. Reconcile the payment before changing the quote.",
    );
  }

  if (session.status === "open") {
    await stripe.checkout.sessions.expire(value);
  }
}

async function readQuote(quoteId: string) {
  const { data, error } = await supabase
    .from("workspace_quotes")
    .select("*")
    .eq("id", quoteId)
    .single();

  if (error || !data) throw error || new Error("Quote not found");
  return data;
}

export async function GET(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workspace_quotes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, quotes: data });
}

export async function POST(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  const body = await request.json();

  const { data, error } = await supabase
    .from("workspace_quotes")
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, quote: data });
}

export async function PATCH(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const body = await request.json();
    const quoteId = String(body.quoteId || body.id || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const subtotalAmount = Number(body.subtotal_amount ?? body.amount);
    const discountAmount = Number(body.discount_amount || 0);
    const discountLabel = String(body.discount_label || "").trim();
    const estimatedDays = Number(body.estimated_days);
    const includedRevisions = Number(body.included_revisions);
    const extraRevisionFee = Number(body.extra_revision_fee);
    const amount = subtotalAmount - discountAmount;

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: "A quote ID is required." },
        { status: 400 },
      );
    }
    if (!title || !description) {
      return NextResponse.json(
        { success: false, error: "Quote title and scope are required." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(subtotalAmount) || subtotalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Quote subtotal must be greater than zero." },
        { status: 400 },
      );
    }
    if (
      !Number.isFinite(discountAmount) ||
      discountAmount < 0 ||
      discountAmount > subtotalAmount
    ) {
      return NextResponse.json(
        { success: false, error: "Discount must be between zero and the quote subtotal." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "The final quote amount must be greater than zero." },
        { status: 400 },
      );
    }
    if (!Number.isInteger(estimatedDays) || estimatedDays < 1) {
      return NextResponse.json(
        { success: false, error: "Delivery must be at least one whole day." },
        { status: 400 },
      );
    }
    if (!Number.isInteger(includedRevisions) || includedRevisions < 0) {
      return NextResponse.json(
        { success: false, error: "Included revisions must be zero or more." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(extraRevisionFee) || extraRevisionFee < 0) {
      return NextResponse.json(
        { success: false, error: "Extra revision fee must be zero or more." },
        { status: 400 },
      );
    }

    const existing = await readQuote(quoteId);
    if (isLockedQuote(existing)) {
      return NextResponse.json(
        { success: false, error: "Paid or active-production quotes cannot be edited." },
        { status: 409 },
      );
    }

    await expireOpenCheckoutSession(existing.stripe_session_id);

    const { data: quote, error } = await supabase
      .from("workspace_quotes")
      .update({
        title,
        description,
        amount,
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        discount_label: discountAmount > 0 ? discountLabel || "Discount" : null,
        estimated_days: estimatedDays,
        included_revisions: includedRevisions,
        extra_revision_fee: extraRevisionFee,
        stripe_session_id: null,
        status: "Sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .select()
      .single();

    if (error || !quote) throw error || new Error("Could not update quote");

    return NextResponse.json({ success: true, quote });
  } catch (error) {
    console.error("Admin quote update failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not update quote.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const body = await request.json();
    const quoteId = String(body.quoteId || body.id || "").trim();

    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: "A quote ID is required." },
        { status: 400 },
      );
    }

    const quote = await readQuote(quoteId);
    if (isLockedQuote(quote)) {
      return NextResponse.json(
        { success: false, error: "Paid or active-production quotes cannot be deleted." },
        { status: 409 },
      );
    }

    await expireOpenCheckoutSession(quote.stripe_session_id);

    const { error: deleteError } = await supabase
      .from("workspace_quotes")
      .delete()
      .eq("id", quoteId);
    if (deleteError) throw deleteError;

    if (quote.studio_request_id) {
      const { error: requestError } = await supabase
        .from("studio_requests")
        .update({
          status: "Quote Needed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", quote.studio_request_id);
      if (requestError) throw requestError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin quote delete failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not delete quote.",
      },
      { status: 500 },
    );
  }
}
