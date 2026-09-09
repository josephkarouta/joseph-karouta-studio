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
    const expertCostAmount = body.expert_cost_amount === null || body.expert_cost_amount === undefined
      ? null
      : Number(body.expert_cost_amount);
    const managementFeePercent = body.management_fee_percent === null || body.management_fee_percent === undefined
      ? null
      : Number(body.management_fee_percent);
    const managementFeeAmount =
      expertCostAmount !== null && managementFeePercent !== null
        ? Number((expertCostAmount * managementFeePercent / 100).toFixed(2))
        : body.management_fee_amount === null || body.management_fee_amount === undefined
          ? null
          : Number(body.management_fee_amount);
    const calculatedSubtotal =
      expertCostAmount !== null && managementFeeAmount !== null
        ? Number((expertCostAmount + managementFeeAmount).toFixed(2))
        : null;
    const subtotalAmount = calculatedSubtotal ?? Number(body.subtotal_amount ?? body.amount);
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

    if (expertCostAmount !== null && (!Number.isFinite(expertCostAmount) || expertCostAmount <= 0)) {
      return NextResponse.json(
        { success: false, error: "Expert production cost must be greater than zero." },
        { status: 400 },
      );
    }

    if (managementFeePercent !== null && (!Number.isFinite(managementFeePercent) || managementFeePercent < 0)) {
      return NextResponse.json(
        { success: false, error: "Management fee percentage must be zero or more." },
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

    const metadataPreferredOpportunityId = String(
      studioRequest.metadata?.preferred_expert_opportunity_id || "",
    ).trim();

    let preferredExpertOpportunity: any = null;
    let preferredExpertError: any = null;

    if (metadataPreferredOpportunityId) {
      const result = await supabase
        .from("expert_opportunities")
        .select("id,expert_profile_id,quoted_fee_cents,currency,turnaround_days,included_revisions,extra_revision_fee_cents,status")
        .eq("id", metadataPreferredOpportunityId)
        .eq("studio_request_id", String(studioRequest.id))
        .limit(1)
        .maybeSingle();
      preferredExpertOpportunity = result.data;
      preferredExpertError = result.error;
    }

    if (!preferredExpertOpportunity && !preferredExpertError) {
      const result = await supabase
        .from("expert_opportunities")
        .select("id,expert_profile_id,quoted_fee_cents,currency,turnaround_days,included_revisions,extra_revision_fee_cents,status")
        .eq("studio_request_id", String(studioRequest.id))
        .eq("status", "selected")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      preferredExpertOpportunity = result.data;
      preferredExpertError = result.error;
    }

    if (preferredExpertError) throw preferredExpertError;

    const preferredExpertOpportunityId = preferredExpertOpportunity?.id || null;
    const authoritativeExpertCostAmount =
      preferredExpertOpportunity?.quoted_fee_cents !== null &&
      preferredExpertOpportunity?.quoted_fee_cents !== undefined
        ? Number((Number(preferredExpertOpportunity.quoted_fee_cents) / 100).toFixed(2))
        : null;
    const authoritativeExpertExtraRevisionCostAmount =
      preferredExpertOpportunity?.extra_revision_fee_cents !== null &&
      preferredExpertOpportunity?.extra_revision_fee_cents !== undefined
        ? Number((Number(preferredExpertOpportunity.extra_revision_fee_cents) / 100).toFixed(2))
        : null;

    // A quote that includes Expert pricing must be tied to the exact preferred
    // Expert opportunity. Never allow a paid Expert-priced quote to lose that
    // handoff and silently become a direct Heyy Studio production job.
    if (expertCostAmount !== null && !preferredExpertOpportunityId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The preferred Expert link is missing. Return to Expert Sourcing, select the preferred Expert again, then send the client quote.",
        },
        { status: 409 },
      );
    }

    if (preferredExpertOpportunityId && authoritativeExpertCostAmount === null) {
      return NextResponse.json(
        { success: false, error: "The preferred Expert quote is missing its fee." },
        { status: 409 },
      );
    }

    const finalExpertCostAmount = preferredExpertOpportunityId
      ? authoritativeExpertCostAmount
      : null;
    const finalManagementFeePercent = preferredExpertOpportunityId
      ? managementFeePercent ?? 25
      : null;
    const finalManagementFeeAmount =
      finalExpertCostAmount !== null && finalManagementFeePercent !== null
        ? Number((finalExpertCostAmount * finalManagementFeePercent / 100).toFixed(2))
        : null;
    const finalSubtotalAmount =
      finalExpertCostAmount !== null && finalManagementFeeAmount !== null
        ? Number((finalExpertCostAmount + finalManagementFeeAmount).toFixed(2))
        : subtotalAmount;
    const finalExpertExtraRevisionCostAmount = preferredExpertOpportunityId
      ? authoritativeExpertExtraRevisionCostAmount
      : null;
    const finalExtraRevisionFee =
      finalExpertExtraRevisionCostAmount !== null && finalManagementFeePercent !== null
        ? Number((finalExpertExtraRevisionCostAmount * (1 + finalManagementFeePercent / 100)).toFixed(2))
        : extraRevisionFee;
    const finalAmount = Number((finalSubtotalAmount - discountAmount).toFixed(2));

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "The final quote amount must be greater than zero." },
        { status: 400 },
      );
    }
    if (discountAmount > finalSubtotalAmount) {
      return NextResponse.json(
        { success: false, error: "Discount cannot exceed the quote subtotal." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(finalExtraRevisionFee) || finalExtraRevisionFee < 0) {
      return NextResponse.json(
        { success: false, error: "Extra revision pricing must be zero or more." },
        { status: 400 },
      );
    }

    const { data: quote, error: quoteError } = await supabase
      .from("workspace_quotes")
      .insert({
        project_id: studioRequest.project_id,
        production_job_id: null,
        studio: productionService.studio,
        title,
        description,
        amount: finalAmount,
        subtotal_amount: finalSubtotalAmount,
        expert_cost_amount: finalExpertCostAmount,
        management_fee_percent: finalManagementFeePercent,
        management_fee_amount: finalManagementFeeAmount,
        discount_amount: discountAmount,
        discount_label: discountAmount > 0 ? discountLabel || "Discount" : null,
        currency,
        estimated_days: estimatedDays,
        included_revisions: includedRevisions,
        expert_extra_revision_cost_amount: finalExpertExtraRevisionCostAmount,
        extra_revision_fee: finalExtraRevisionFee,
        status: "Sent",
        service_id: productionService.id,
        service: productionService.label,
        studio_request_id: studioRequest.id,
        expert_opportunity_id: preferredExpertOpportunityId,
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
      metadata: {
        request_id: studioRequest.id,
        amount: quote.amount,
        currency: quote.currency,
        service_id: productionService.id,
        expert_cost_amount: quote.expert_cost_amount,
        management_fee_percent: quote.management_fee_percent,
        management_fee_amount: quote.management_fee_amount,
        expert_opportunity_id: quote.expert_opportunity_id,
      },
    });

    await Notifications.emit({
      event: "quote.ready",
      projectId: studioRequest.project_id,
      projectName: studioRequest.project_name,
      service: productionService.label,
      studio: productionService.studio,
      userId: studioRequest.user_id,
      clientName:
        studioRequest.metadata?.client_name ||
        studioRequest.metadata?.name ||
        null,
      clientEmail:
        studioRequest.metadata?.client_email ||
        studioRequest.metadata?.email ||
        null,
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
        selectedScopes:
          studioRequest.metadata?.selected_production_scopes ||
          studioRequest.metadata?.project_context?.selected_production_scopes ||
          null,
        productionOnly: Boolean(studioRequest.metadata?.production_only),
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

export async function PATCH(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const body = await request.json();
    const requestId = String(body.request_id || "").trim();
    const quoteId = String(body.quote_id || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const currency = String(body.currency || "USD").trim().toUpperCase();
    const requestedExpertCost = body.expert_cost_amount === null || body.expert_cost_amount === undefined
      ? null
      : Number(body.expert_cost_amount);
    const managementFeePercent = body.management_fee_percent === null || body.management_fee_percent === undefined
      ? null
      : Number(body.management_fee_percent);
    const requestedExpertExtraRevisionCost = body.expert_extra_revision_cost_amount === null || body.expert_extra_revision_cost_amount === undefined
      ? null
      : Number(body.expert_extra_revision_cost_amount);
    const directSubtotal = Number(body.subtotal_amount ?? body.amount);
    const discountAmount = Number(body.discount_amount || 0);
    const discountLabel = String(body.discount_label || "").trim();
    const estimatedDays = Number(body.estimated_days);
    const includedRevisions = Number(body.included_revisions);
    const extraRevisionFee = Number(body.extra_revision_fee);

    if (!requestId || !quoteId) {
      return NextResponse.json({ success: false, error: "Request and quote are required." }, { status: 400 });
    }
    if (!title || !description) {
      return NextResponse.json({ success: false, error: "Quote title and scope are required." }, { status: 400 });
    }
    if (!Number.isInteger(estimatedDays) || estimatedDays < 1) {
      return NextResponse.json({ success: false, error: "Estimated delivery must be at least one whole day." }, { status: 400 });
    }
    if (!Number.isInteger(includedRevisions) || includedRevisions < 0) {
      return NextResponse.json({ success: false, error: "Included revisions must be zero or more." }, { status: 400 });
    }
    if (!isNonNegativeNumber(extraRevisionFee)) {
      return NextResponse.json({ success: false, error: "Extra revision fee must be zero or more." }, { status: 400 });
    }

    const { data: studioRequest, error: requestError } = await supabase
      .from("studio_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (requestError || !studioRequest) throw requestError || new Error("Studio request not found");

    const { data: existingQuote, error: quoteError } = await supabase
      .from("workspace_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("studio_request_id", requestId)
      .maybeSingle();
    if (quoteError) throw quoteError;
    if (!existingQuote) return NextResponse.json({ success: false, error: "Quote not found." }, { status: 404 });

    const paid = Boolean(existingQuote.paid_at) || String(existingQuote.status || "").toLowerCase() === "paid" || Boolean(existingQuote.production_job_id);
    if (paid) {
      return NextResponse.json(
        { success: false, error: "This quote has already been paid and cannot be edited. Use an additional-scope/change-order flow for new work." },
        { status: 409 },
      );
    }

    const productionService = resolveProductionService({
      serviceId: existingQuote.service_id || studioRequest.service_id || studioRequest.metadata?.service_id,
      service: existingQuote.service || studioRequest.service,
      studio: existingQuote.studio || studioRequest.studio,
    });

    const expertOpportunityId = String(
      existingQuote.expert_opportunity_id || studioRequest.metadata?.preferred_expert_opportunity_id || "",
    ).trim();
    let expertOpportunity: any = null;
    if (expertOpportunityId) {
      const { data, error } = await supabase
        .from("expert_opportunities")
        .select("id,expert_profile_id,quoted_fee_cents,extra_revision_fee_cents,currency,status")
        .eq("id", expertOpportunityId)
        .eq("studio_request_id", requestId)
        .maybeSingle();
      if (error) throw error;
      expertOpportunity = data;
    }

    let finalExpertCostAmount: number | null = null;
    let finalManagementFeePercent: number | null = null;
    let finalManagementFeeAmount: number | null = null;
    let finalExpertExtraRevisionCostAmount: number | null = null;
    let finalSubtotalAmount = directSubtotal;
    let finalExtraRevisionFee = extraRevisionFee;

    if (expertOpportunity) {
      if (requestedExpertCost === null || !Number.isFinite(requestedExpertCost) || requestedExpertCost <= 0) {
        return NextResponse.json({ success: false, error: "Enter the revised agreed Expert cost." }, { status: 400 });
      }
      if (managementFeePercent === null || !Number.isFinite(managementFeePercent) || managementFeePercent < 0) {
        return NextResponse.json({ success: false, error: "Enter a valid Heyy Studio management fee percentage." }, { status: 400 });
      }
      if (requestedExpertExtraRevisionCost === null || !Number.isFinite(requestedExpertExtraRevisionCost) || requestedExpertExtraRevisionCost < 0) {
        return NextResponse.json({ success: false, error: "Enter the agreed Expert fee for one additional revision." }, { status: 400 });
      }
      finalExpertCostAmount = Number(requestedExpertCost.toFixed(2));
      finalManagementFeePercent = Number(managementFeePercent.toFixed(2));
      finalManagementFeeAmount = Number((finalExpertCostAmount * finalManagementFeePercent / 100).toFixed(2));
      finalExpertExtraRevisionCostAmount = Number(requestedExpertExtraRevisionCost.toFixed(2));
      finalSubtotalAmount = Number((finalExpertCostAmount + finalManagementFeeAmount).toFixed(2));
      finalExtraRevisionFee = Number((finalExpertExtraRevisionCostAmount * (1 + finalManagementFeePercent / 100)).toFixed(2));
    } else if (!Number.isFinite(finalSubtotalAmount) || finalSubtotalAmount <= 0) {
      return NextResponse.json({ success: false, error: "Quote subtotal must be greater than zero." }, { status: 400 });
    }

    if (!isNonNegativeNumber(discountAmount) || discountAmount > finalSubtotalAmount) {
      return NextResponse.json({ success: false, error: "Discount must be between zero and the quote subtotal." }, { status: 400 });
    }
    const finalAmount = Number((finalSubtotalAmount - discountAmount).toFixed(2));
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return NextResponse.json({ success: false, error: "The final quote amount must be greater than zero." }, { status: 400 });
    }

    const now = new Date().toISOString();
    if (expertOpportunity && finalExpertCostAmount !== null) {
      const { error: expertQuoteUpdateError } = await supabase
        .from("expert_opportunities")
        .update({
          quoted_fee_cents: Math.round(finalExpertCostAmount * 100),
          extra_revision_fee_cents: Math.round(Number(finalExpertExtraRevisionCostAmount || 0) * 100),
          updated_at: now,
        })
        .eq("id", expertOpportunity.id)
        .eq("studio_request_id", requestId);
      if (expertQuoteUpdateError) throw expertQuoteUpdateError;
    }

    const { data: quote, error: updateError } = await supabase
      .from("workspace_quotes")
      .update({
        title,
        description,
        amount: finalAmount,
        subtotal_amount: finalSubtotalAmount,
        expert_cost_amount: finalExpertCostAmount,
        management_fee_percent: finalManagementFeePercent,
        management_fee_amount: finalManagementFeeAmount,
        discount_amount: discountAmount,
        discount_label: discountAmount > 0 ? discountLabel || "Discount" : null,
        currency,
        estimated_days: estimatedDays,
        included_revisions: includedRevisions,
        expert_extra_revision_cost_amount: finalExpertExtraRevisionCostAmount,
        extra_revision_fee: finalExtraRevisionFee,
        status: "Sent",
        updated_at: now,
      })
      .eq("id", existingQuote.id)
      .eq("studio_request_id", requestId)
      .select()
      .single();
    if (updateError || !quote) throw updateError || new Error("Quote could not be updated.");

    await recordAdminAudit({
      actorUserId: access.user!.id,
      action: "quote.updated",
      entityType: "workspace_quote",
      entityId: quote.id,
      summary: `Updated unpaid client quote: ${title}`,
      metadata: {
        request_id: requestId,
        previous_amount: existingQuote.amount,
        amount: quote.amount,
        previous_expert_cost_amount: existingQuote.expert_cost_amount,
        expert_cost_amount: quote.expert_cost_amount,
        management_fee_percent: quote.management_fee_percent,
      },
    });

    await Notifications.emit({
      event: "quote.updated",
      projectId: studioRequest.project_id,
      projectName: studioRequest.project_name,
      service: productionService.label,
      studio: productionService.studio,
      userId: studioRequest.user_id,
      clientName: studioRequest.metadata?.client_name || studioRequest.metadata?.name || null,
      clientEmail: studioRequest.metadata?.client_email || studioRequest.metadata?.email || null,
      metadata: {
        requestId: studioRequest.id,
        quoteId: quote.id,
        quoteUpdateId: now,
        messageId: `quote-update:${now}`,
        amount: quote.amount,
        subtotalAmount: quote.subtotal_amount,
        currency: quote.currency,
        estimatedDays: quote.estimated_days,
        includedRevisions: quote.included_revisions,
        extraRevisionFee: quote.extra_revision_fee,
        serviceId: productionService.id,
        selectedScopes: studioRequest.metadata?.selected_production_scopes || studioRequest.metadata?.project_context?.selected_production_scopes || null,
        productionOnly: Boolean(studioRequest.metadata?.production_only),
      },
    });

    return NextResponse.json({ success: true, quote });
  } catch (error: any) {
    console.error("Update quote from request error:", error);
    return NextResponse.json({ success: false, error: error.message || "Could not update quote" }, { status: 500 });
  }
}
