import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Notifications } from "@/lib/notifications";
import { resolveProductionService } from "@/lib/production/service-registry";

import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const body = await request.json();

    const requestId = String(body.request_id || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const currency = String(body.currency || "USD").trim().toUpperCase();
    const subtotalAmount = Number(body.subtotal_amount ?? body.amount);
    const discountAmount = Number(body.discount_amount || 0);
    const discountLabel = String(body.discount_label || "").trim();
    const amount = subtotalAmount - discountAmount;
    const estimatedDays = Number(body.estimated_days);
    const includedRevisions = Number(body.included_revisions);
    const extraRevisionFee = Number(body.extra_revision_fee);

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "A studio request ID is required." },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: "A quote title is required." },
        { status: 400 },
      );
    }

    if (!description) {
      return NextResponse.json(
        { success: false, error: "Scope and inclusions are required." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(subtotalAmount) || subtotalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Quote subtotal must be greater than zero." },
        { status: 400 },
      );
    }

    if (!isNonNegativeNumber(discountAmount) || discountAmount > subtotalAmount) {
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
        {
          success: false,
          error: "Estimated delivery must be at least one whole day.",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(includedRevisions) || includedRevisions < 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Included revisions must be a whole number of zero or more.",
        },
        { status: 400 },
      );
    }

    if (!isNonNegativeNumber(extraRevisionFee)) {
      return NextResponse.json(
        {
          success: false,
          error: "Extra revision fee must be zero or more.",
        },
        { status: 400 },
      );
    }

    const { data: studioRequest, error: requestError } = await supabase
      .from("studio_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError || !studioRequest) {
      throw requestError || new Error("Studio request not found");
    }

    const { data: existingQuote, error: existingQuoteError } = await supabase
      .from("workspace_quotes")
      .select("*")
      .eq("studio_request_id", studioRequest.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingQuoteError) throw existingQuoteError;

    if (existingQuote) {
      return NextResponse.json(
        {
          success: false,
          error: "This request already has a quote.",
          quote: existingQuote,
        },
        { status: 409 },
      );
    }

    const productionService = resolveProductionService({
      serviceId: studioRequest.service_id || studioRequest.metadata?.service_id,
      service: studioRequest.service,
      studio: studioRequest.studio,
    });

    const { data: quote, error: quoteError } = await supabase
      .from("workspace_quotes")
      .insert({
        project_id: studioRequest.project_id,
        production_job_id: null,
        studio: productionService.studio,
        title,
        description,
        amount,
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        discount_label: discountAmount > 0 ? discountLabel || "Discount" : null,
        currency,
        estimated_days: estimatedDays,
        included_revisions: includedRevisions,
        extra_revision_fee: extraRevisionFee,
        status: "Sent",
        service_id: productionService.id,
        service: productionService.label,
        studio_request_id: studioRequest.id,
      })
      .select()
      .single();

    if (quoteError || !quote) {
      throw quoteError || new Error("Could not create quote");
    }

    const { error: updateError } = await supabase
      .from("studio_requests")
      .update({
        status: "Quoted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    await recordAdminAudit({
      actorUserId: access.user!.id,
      action: "quote.created",
      entityType: "workspace_quote",
      entityId: quote.id,
      summary: `Created and sent quote: ${title}`,
      metadata: { request_id: studioRequest.id, amount: quote.amount, currency: quote.currency, service_id: productionService.id },
    });

    await Notifications.emit({
      event: "quote.ready",
      projectId: studioRequest.project_id,
      projectName: studioRequest.project_name,
      service: productionService.label,
      studio: productionService.studio,
      userId: studioRequest.user_id,
      metadata: {
        requestId: studioRequest.id,
        quoteId: quote.id,
        amount: quote.amount,
        subtotalAmount: quote.subtotal_amount,
        discountAmount: quote.discount_amount,
        discountLabel: quote.discount_label,
        currency: quote.currency,
        estimatedDays: quote.estimated_days,
        includedRevisions: quote.included_revisions,
        extraRevisionFee: quote.extra_revision_fee,
        serviceId: productionService.id,
        scopeId: studioRequest.metadata?.production_scope_id || productionService.workspaceScope || null,
      },
    });

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    console.error("Create quote from request error:", error);

    return NextResponse.json(
      { success: false, error: error.message || "Could not create quote" },
      { status: 500 },
    );
  }
}
