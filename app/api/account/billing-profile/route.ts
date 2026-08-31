import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { getStripe, resolveStripeCustomer } from "@/lib/billing/stripe";
import { loadBillingProfile } from "@/lib/billing/profile";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const profile = await loadBillingProfile(admin, user.id);
    return NextResponse.json({
      profile: profile || {
        customer_type: "personal",
        legal_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        company_name: "",
        company_number: "",
        tax_id: "",
        email: user.email || "",
        address_line1: "",
        address_line2: "",
        city: "",
        state_region: "",
        postal_code: "",
        country_code: "AU",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing information could not be loaded." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const customerType = body.customer_type === "business" ? "business" : "personal";
    const legalName = clean(body.legal_name, 160);
    const companyName = clean(body.company_name, 180);
    const email = clean(body.email, 220).toLowerCase();
    const addressLine1 = clean(body.address_line1, 220);
    const city = clean(body.city, 120);
    const stateRegion = clean(body.state_region, 120);
    const postalCode = clean(body.postal_code, 40);
    const countryCode = clean(body.country_code, 2).toUpperCase();

    if (!legalName || !email.includes("@") || !addressLine1 || !city || !postalCode || countryCode.length !== 2) {
      return NextResponse.json({ error: "Complete the required billing name, email and address fields." }, { status: 400 });
    }
    if (customerType === "business" && !companyName) {
      return NextResponse.json({ error: "Add the company or legal business name." }, { status: 400 });
    }

    const row = {
      user_id: user.id,
      customer_type: customerType,
      legal_name: legalName,
      company_name: customerType === "business" ? companyName : null,
      company_number: customerType === "business" ? clean(body.company_number, 100) || null : null,
      tax_id: clean(body.tax_id, 100) || null,
      email,
      address_line1: addressLine1,
      address_line2: clean(body.address_line2, 220) || null,
      city,
      state_region: stateRegion || null,
      postal_code: postalCode,
      country_code: countryCode,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("billing_profiles")
      .upsert(row, { onConflict: "user_id" })
      .select("user_id,customer_type,legal_name,company_name,company_number,tax_id,email,address_line1,address_line2,city,state_region,postal_code,country_code")
      .single();
    if (error) throw error;

    // Keep future Stripe checkouts aligned with the saved Heyy billing identity.
    try {
      const stripe = getStripe();
      const { customer } = await resolveStripeCustomer({ stripe, admin, user, createIfMissing: false });
      if (customer) {
        await stripe.customers.update(customer.id, {
          name: customerType === "business" ? companyName : legalName,
          email,
          address: {
            line1: addressLine1,
            line2: row.address_line2 || undefined,
            city,
            state: stateRegion || undefined,
            postal_code: postalCode,
            country: countryCode,
          },
        });
      }
    } catch (stripeError) {
      console.warn("Saved Heyy billing profile but could not sync Stripe customer:", stripeError);
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing information could not be saved." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}
