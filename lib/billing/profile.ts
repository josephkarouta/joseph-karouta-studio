import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export type BillingCustomerType = "personal" | "business";

export type BillingProfile = {
  user_id: string;
  customer_type: BillingCustomerType;
  legal_name: string | null;
  company_name: string | null;
  company_number: string | null;
  tax_id: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country_code: string | null;
};

export async function loadBillingProfile(admin: SupabaseClient, userId: string): Promise<BillingProfile | null> {
  const { data, error } = await admin
    .from("billing_profiles")
    .select("user_id,customer_type,legal_name,company_name,company_number,tax_id,email,address_line1,address_line2,city,state_region,postal_code,country_code")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (/does not exist|schema cache/i.test(error.message || "")) return null;
    throw error;
  }
  return data as BillingProfile | null;
}

export function billingAddressLines(profile: Partial<BillingProfile>) {
  const locality = [profile.city, profile.state_region, profile.postal_code].filter(Boolean).join(" ");
  return [profile.address_line1, profile.address_line2, locality || null, profile.country_code || null].filter(Boolean) as string[];
}

export function checkoutCollectionOptions(hasCustomer: boolean): Pick<
  Stripe.Checkout.SessionCreateParams,
  "billing_address_collection" | "tax_id_collection" | "automatic_tax" | "customer_update"
> {
  return {
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: process.env.HEYY_STRIPE_AUTOMATIC_TAX === "true" },
    ...(hasCustomer ? { customer_update: { name: "auto", address: "auto" } } : {}),
  };
}
