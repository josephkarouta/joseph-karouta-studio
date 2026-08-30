import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { buildHeyyInvoicePdf } from "@/lib/payments/invoice-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, admin } = await requireApiUser(request);
    const { id } = await context.params;
    const { data, error } = await admin
      .from("payment_records")
      .select("id,user_id,description,amount_total,tax_amount,currency,invoice_number,billing_name,billing_email,paid_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

    const pdf = await buildHeyyInvoicePdf({
      invoiceNumber: data.invoice_number,
      paidAt: data.paid_at,
      description: data.description,
      amountTotal: Number(data.amount_total || 0),
      taxAmount: Number(data.tax_amount || 0),
      currency: data.currency || "usd",
      billingName: data.billing_name,
      billingEmail: data.billing_email,
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Heyy-Studio-${data.invoice_number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const status = error instanceof ApiAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof ApiAuthError ? error.message : "Invoice could not be downloaded." },
      { status },
    );
  }
}
