import { NextRequest, NextResponse } from "next/server";

import { getStripe, resolveStripeCustomer } from "@/lib/billing/stripe";
import { checkoutCollectionOptions, stripeProductTaxCode } from "@/lib/billing/profile";
import { buildProductionWorkspaceHref, resolveProductionService } from "@/lib/production/service-registry";
import { loadProductionRevisionPolicy } from "@/lib/production/revision-policy";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

function withParams(path: string, params: Record<string, string>) {
  const url = new URL(path, "https://heyy.local");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json()) as { jobId?: unknown };
    const jobId = String(body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ success: false, error: "Production job is required." }, { status: 400 });

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .select("id,user_id,project_id,project_name,service,service_id,studio,payment_quote_id,metadata,client_approved_at")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ success: false, error: "Production job not found." }, { status: 404 });
    if (job.client_approved_at) return NextResponse.json({ success: false, error: "This production job is already complete." }, { status: 409 });

    const { count: used, error: revisionError } = await admin
      .from("workspace_revisions")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", job.id);
    if (revisionError) throw revisionError;

    const policy = await loadProductionRevisionPolicy(admin, job, Number(used || 0));
    if (!policy.enforced) return NextResponse.json({ success: false, error: "This project does not have a paid revision policy." }, { status: 409 });
    if (policy.remaining > 0) return NextResponse.json({ success: false, error: `You still have ${policy.remaining} revision round${policy.remaining === 1 ? "" : "s"} available.` }, { status: 409 });
    if (!(policy.extraRevisionFee > 0)) return NextResponse.json({ success: false, error: "Additional revision pricing is not configured. Contact Heyy Studio." }, { status: 409 });

    const { count: openRevisions, error: openError } = await admin
      .from("workspace_revisions")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", job.id)
      .in("status", ["Requested", "In Progress"]);
    if (openError) throw openError;
    if (openRevisions) return NextResponse.json({ success: false, error: "Wait for the active revision round to finish before purchasing another." }, { status: 409 });

    const stripe = getStripe();
    const { customer } = await resolveStripeCustomer({ stripe, admin, user, createIfMissing: true });
    if (!customer) return NextResponse.json({ success: false, error: "Unable to prepare secure checkout." }, { status: 500 });

    const cents = Math.round(policy.extraRevisionFee * 100);

    // Extra revisions use the exact private Expert fee captured on the selected
    // Expert quote/assignment. The client-facing price already includes Heyy
    // Studio's management fee, so never deduct the fee from the Expert's quote.
    let expertRatio = 0.8;
    const { data: assignment } = await admin
      .from("expert_assignments")
      .select("id,opportunity_id,agreed_fee_cents,extra_revision_fee_cents")
      .eq("production_job_id", job.id)
      .maybeSingle();

    let hasExactExpertExtraRevisionCost = assignment?.extra_revision_fee_cents !== null && assignment?.extra_revision_fee_cents !== undefined;
    let exactExpertExtraRevisionCents = Number(assignment?.extra_revision_fee_cents || 0);
    let originalExpertCents = Number(assignment?.agreed_fee_cents || 0);
    if (assignment?.opportunity_id) {
      const { data: opportunity } = await admin
        .from("expert_opportunities")
        .select("quoted_fee_cents,extra_revision_fee_cents")
        .eq("id", assignment.opportunity_id)
        .maybeSingle();
      if (Number(opportunity?.quoted_fee_cents || 0) > 0) originalExpertCents = Number(opportunity!.quoted_fee_cents);
      if (Number(opportunity?.extra_revision_fee_cents || 0) >= 0 && opportunity?.extra_revision_fee_cents !== null && opportunity?.extra_revision_fee_cents !== undefined) {
        exactExpertExtraRevisionCents = Number(opportunity.extra_revision_fee_cents);
        hasExactExpertExtraRevisionCost = true;
      }
    }

    const quoteId = String(job.payment_quote_id || job.metadata?.quote_id || "").trim();
    let originalClientCents = 0;
    if (quoteId) {
      const { data: quote } = await admin
        .from("workspace_quotes")
        .select("subtotal_amount,amount,expert_extra_revision_cost_amount")
        .eq("id", quoteId)
        .maybeSingle();
      originalClientCents = Math.round(Number(quote?.subtotal_amount ?? quote?.amount ?? 0) * 100);
      if (!(exactExpertExtraRevisionCents > 0) && Number(quote?.expert_extra_revision_cost_amount || 0) > 0) {
        exactExpertExtraRevisionCents = Math.round(Number(quote!.expert_extra_revision_cost_amount) * 100);
        hasExactExpertExtraRevisionCost = true;
      }
    }
    if (originalExpertCents > 0 && originalClientCents > 0) {
      expertRatio = Math.min(1, Math.max(0.05, originalExpertCents / originalClientCents));
    }
    const expertCostCents = hasExactExpertExtraRevisionCost
      ? Math.max(0, exactExpertExtraRevisionCents)
      : Math.max(0, Math.round(cents * expertRatio));

    const now = new Date().toISOString();
    const { data: addon, error: addonError } = await admin
      .from("production_addons")
      .insert({
        production_job_id: job.id,
        user_id: user.id,
        kind: "extra_revision",
        status: "sent",
        title: `Additional revision — ${job.project_name || "Production project"}`,
        description: "One additional revision round for the current paid production scope.",
        currency: policy.currency,
        client_amount_cents: cents,
        expert_cost_cents: expertCostCents,
        sent_to_client_at: now,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (addonError || !addon) throw addonError || new Error("Could not create the additional revision.");

    const service = resolveProductionService({ serviceId: job.service_id, service: job.service, studio: job.studio });
    const basePath = buildProductionWorkspaceHref({
      projectId: job.project_id,
      studio: job.studio,
      serviceId: service.id,
      service: service.label,
      selectedScopes: job.metadata?.selected_production_scopes || job.metadata?.project_context?.selected_production_scopes || null,
      productionOnly: Boolean(job.metadata?.production_only),
    });
    const baseUrl = new URL(request.url).origin;
    const successPath = withParams(basePath, { productionView: "revisions", extraRevision: "paid", session_id: "HEYY_CHECKOUT_SESSION_ID" });
    const cancelPath = withParams(basePath, { productionView: "revisions", extraRevision: "cancelled" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: customer.id,
      client_reference_id: user.id,
      ...checkoutCollectionOptions(true),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: policy.currency.toLowerCase(),
          unit_amount: cents,
          tax_behavior: "exclusive",
          product_data: {
            name: "Additional production revision",
            description: addon.description,
            ...(stripeProductTaxCode() ? { tax_code: stripeProductTaxCode() } : {}),
          },
        },
      }],
      metadata: {
        production_addon_id: addon.id,
        production_job_id: job.id,
        production_addon_kind: "extra_revision",
        project_id: job.project_id || "",
      },
      success_url: `${baseUrl}${successPath.replace("HEYY_CHECKOUT_SESSION_ID", "{CHECKOUT_SESSION_ID}")}`,
      cancel_url: `${baseUrl}${cancelPath}`,
    });

    const { error: sessionError } = await admin
      .from("production_addons")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", addon.id);
    if (sessionError) throw sessionError;

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Create additional revision checkout error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not prepare the additional revision checkout." }, { status: 500 });
  }
}
