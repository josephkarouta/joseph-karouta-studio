import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { buildHeyyInvoicePdf } from "@/lib/payments/invoice-pdf";

export const runtime = "nodejs";

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;
  try {
    const { id } = await context.params;
    const admin = adminClient();
    const { data, error } = await admin.from("payment_records").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

    const pdf = await buildHeyyInvoicePdf({
      invoiceNumber: data.invoice_number,
      paidAt: data.paid_at,
      description: data.description,
      amountTotal: Number(data.amount_total || 0),
      taxAmount: Number(data.tax_amount || 0),
      currency: data.currency || "usd",
      billingCustomerType: data.billing_customer_type,
      billingName: data.billing_name,
      billingEmail: data.billing_email,
      billingCompanyName: data.billing_company_name,
      billingCompanyNumber: data.billing_company_number,
      billingTaxId: data.billing_tax_id,
      billingAddressLine1: data.billing_address_line1,
      billingAddressLine2: data.billing_address_line2,
      billingCity: data.billing_city,
      billingStateRegion: data.billing_state_region,
      billingPostalCode: data.billing_postal_code,
      billingCountryCode: data.billing_country_code,
    });

    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Heyy-Studio-${data.invoice_number}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Admin invoice download error:", error);
    return NextResponse.json({ error: "Invoice could not be downloaded." }, { status: 500 });
  }
}
