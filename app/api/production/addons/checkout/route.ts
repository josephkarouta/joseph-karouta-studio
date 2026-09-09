import { NextRequest, NextResponse } from "next/server";

import { checkoutCollectionOptions, stripeProductTaxCode } from "@/lib/billing/profile";
import { getStripe, resolveStripeCustomer } from "@/lib/billing/stripe";
import { buildProductionWorkspaceHref, resolveProductionService } from "@/lib/production/service-registry";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

function withParams(path: string, params: Record<string, string>) {
  const url = new URL(path, "https://heyy.local");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json()) as { addonId?: unknown };
    const addonId = String(body.addonId || "").trim();
    if (!addonId) return NextResponse.json({ success: false, error: "Project addition is required." }, { status: 400 });

    const { data: addon, error: addonError } = await admin
      .from("production_addons")
      .select("*")
      .eq("id", addonId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (addonError) throw addonError;
    if (!addon) return NextResponse.json({ success: false, error: "Project addition not found." }, { status: 404 });
    if (addon.status === "paid") return NextResponse.json({ success: false, error: "This project addition is already paid." }, { status: 409 });
    if (addon.status !== "sent" || Number(addon.client_amount_cents || 0) <= 0) {
      return NextResponse.json({ success: false, error: "This project addition is not ready for payment." }, { status: 409 });
    }

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .select("id,user_id,project_id,project_name,service,service_id,studio,metadata")
      .eq("id", addon.production_job_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ success: false, error: "Production job not found." }, { status: 404 });

    const stripe = getStripe();
    const { customer } = await resolveStripeCustomer({ stripe, admin, user, createIfMissing: true });
    if (!customer) return NextResponse.json({ success: false, error: "Unable to prepare secure checkout." }, { status: 500 });

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
    const successPath = withParams(basePath, { productionView: addon.kind === "extra_revision" ? "revisions" : "review", addonPayment: "paid", session_id: "HEYY_CHECKOUT_SESSION_ID" });
    const cancelPath = withParams(basePath, { productionView: addon.kind === "extra_revision" ? "revisions" : "review", addonPayment: "cancelled" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: customer.id,
      client_reference_id: user.id,
      ...checkoutCollectionOptions(true),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: String(addon.currency || "USD").toLowerCase(),
          unit_amount: Number(addon.client_amount_cents),
          tax_behavior: "exclusive",
          product_data: {
            name: addon.title || "Production project addition",
            description: addon.description || "Additional production scope",
            ...(stripeProductTaxCode() ? { tax_code: stripeProductTaxCode() } : {}),
          },
        },
      }],
      metadata: {
        production_addon_id: addon.id,
        production_job_id: job.id,
        production_addon_kind: addon.kind,
        project_id: job.project_id || "",
      },
      success_url: `${baseUrl}${successPath.replace("HEYY_CHECKOUT_SESSION_ID", "{CHECKOUT_SESSION_ID}")}`,
      cancel_url: `${baseUrl}${cancelPath}`,
    });

    const { error: updateError } = await admin
      .from("production_addons")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", addon.id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Create production add-on checkout error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not prepare secure checkout." }, { status: 500 });
  }
}
