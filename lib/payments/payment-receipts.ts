import "server-only";

import { createHash } from "crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import { resolveCommunicationTemplate } from "@/lib/communications/templates";
import { sendTrackedEmail } from "@/lib/communications/send-email";
import { buildHeyyInvoicePdf } from "./invoice-pdf";
import { loadBillingProfile, type BillingProfile } from "@/lib/billing/profile";

export type PaymentType = "subscription" | "credit_pack" | "production" | "other";

export type PaymentReceiptInput = {
  paymentKey: string;
  userId?: string | null;
  externalPaymentId?: string | null;
  externalInvoiceId?: string | null;
  paymentType: PaymentType;
  description: string;
  amountTotal: number;
  taxAmount?: number;
  currency?: string | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingAddress?: Stripe.Address | null;
  billingTaxId?: string | null;
  relatedId?: string | null;
  paidAt?: string | null;
  metadata?: Record<string, unknown>;
  sendEmail?: boolean;
};

type PaymentRecord = {
  id: string;
  payment_key: string;
  user_id: string | null;
  payment_type: PaymentType;
  description: string;
  amount_total: number;
  tax_amount: number;
  currency: string;
  status: string;
  invoice_number: string;
  billing_name: string | null;
  billing_email: string | null;
  billing_customer_type: "personal" | "business" | null;
  billing_company_name: string | null;
  billing_company_number: string | null;
  billing_tax_id: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state_region: string | null;
  billing_postal_code: string | null;
  billing_country_code: string | null;
  related_id: string | null;
  paid_at: string;
  metadata: Record<string, unknown>;
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function invoiceNumber(paymentKey: string, paidAt: string) {
  const year = new Date(paidAt).getUTCFullYear();
  const suffix = createHash("sha256").update(paymentKey).digest("hex").slice(0, 8).toUpperCase();
  return `HS-${year}-${suffix}`;
}

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

async function receiptBillingProfile(admin: ReturnType<typeof adminClient>, userId?: string | null) {
  if (!userId) return null;
  try {
    return await loadBillingProfile(admin, userId);
  } catch (error) {
    console.warn("Billing profile could not be loaded for payment receipt:", error);
    return null;
  }
}

function billingSnapshot(profile: BillingProfile | null, fallbackName: string | null | undefined, fallbackEmail: string | null | undefined, fallbackAddress?: Stripe.Address | null, fallbackTaxId?: string | null) {
  return {
    billing_name: profile?.legal_name || fallbackName || null,
    billing_email: profile?.email || fallbackEmail?.trim().toLowerCase() || null,
    billing_customer_type: profile?.customer_type || "personal",
    billing_company_name: profile?.company_name || null,
    billing_company_number: profile?.company_number || null,
    billing_tax_id: profile?.tax_id || String(fallbackTaxId || "").trim() || null,
    billing_address_line1: profile?.address_line1 || fallbackAddress?.line1 || null,
    billing_address_line2: profile?.address_line2 || fallbackAddress?.line2 || null,
    billing_city: profile?.city || fallbackAddress?.city || null,
    billing_state_region: profile?.state_region || fallbackAddress?.state || null,
    billing_postal_code: profile?.postal_code || fallbackAddress?.postal_code || null,
    billing_country_code: profile?.country_code || fallbackAddress?.country || null,
  };
}

export async function recordAndSendPaymentReceipt(input: PaymentReceiptInput) {
  const admin = adminClient();
  const paidAt = input.paidAt || new Date().toISOString();
  const currency = String(input.currency || "usd").toLowerCase();
  const taxAmount = Math.max(0, Number(input.taxAmount || 0));
  const profile = await receiptBillingProfile(admin, input.userId);
  const snapshot = billingSnapshot(profile, input.billingName, input.billingEmail, input.billingAddress, input.billingTaxId);
  const row = {
    payment_key: input.paymentKey,
    user_id: input.userId || null,
    external_payment_id: input.externalPaymentId || null,
    external_invoice_id: input.externalInvoiceId || null,
    payment_type: input.paymentType,
    description: input.description,
    amount_total: Math.max(0, Math.round(input.amountTotal)),
    tax_amount: taxAmount,
    currency,
    status: "paid",
    invoice_number: invoiceNumber(input.paymentKey, paidAt),
    ...snapshot,
    related_id: input.relatedId || null,
    paid_at: paidAt,
    metadata: input.metadata || {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("payment_records")
    .upsert(row, { onConflict: "payment_key" })
    .select("id,payment_key,user_id,payment_type,description,amount_total,tax_amount,currency,status,invoice_number,billing_name,billing_email,billing_customer_type,billing_company_name,billing_company_number,billing_tax_id,billing_address_line1,billing_address_line2,billing_city,billing_state_region,billing_postal_code,billing_country_code,related_id,paid_at,metadata")
    .single();
  if (error) throw error;

  const record = data as PaymentRecord;
  if (input.sendEmail === false || !record.billing_email) return record;

  const amount = money(record.amount_total, record.currency);
  const resolved = await resolveCommunicationTemplate({
    templateKey: "payment.receipt",
    fallback: {
      subject: "Payment received — {{description}}",
      preheader: "Your payment was successful and your invoice is attached.",
      eyebrow: "Payment confirmed",
      title: "Thanks — your payment is complete",
      body: "We received your payment for {{description}}. Your Heyy Studio invoice is attached to this email and is also available from Payment history in your account.",
      ctaLabel: "View payment history",
    },
    variables: {
      description: record.description,
      amount,
      invoice_number: record.invoice_number,
    },
  });

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    amount,
    detailsTitle: "Payment details",
    details: [
      { label: "Invoice", value: record.invoice_number },
      { label: "Payment status", value: "Paid" },
    ],
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/account/payments"),
  };

  const pdf = await buildHeyyInvoicePdf({
    invoiceNumber: record.invoice_number,
    paidAt: record.paid_at,
    description: record.description,
    amountTotal: record.amount_total,
    taxAmount: record.tax_amount,
    currency: record.currency,
    billingCustomerType: record.billing_customer_type,
    billingName: record.billing_name,
    billingEmail: record.billing_email,
    billingCompanyName: record.billing_company_name,
    billingCompanyNumber: record.billing_company_number,
    billingTaxId: record.billing_tax_id,
    billingAddressLine1: record.billing_address_line1,
    billingAddressLine2: record.billing_address_line2,
    billingCity: record.billing_city,
    billingStateRegion: record.billing_state_region,
    billingPostalCode: record.billing_postal_code,
    billingCountryCode: record.billing_country_code,
  });

  await sendTrackedEmail({
    eventKey: `payment-receipt:${record.payment_key}`,
    userId: record.user_id,
    to: record.billing_email,
    templateKey: "payment.receipt",
    subject: resolved.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    attachments: [
      {
        filename: `Heyy-Studio-${record.invoice_number}.pdf`,
        content: pdf,
      },
    ],
    relatedType: "payment",
    relatedId: record.id,
    metadata: {
      payment_type: record.payment_type,
      invoice_number: record.invoice_number,
    },
  });

  return record;
}

export async function recordSubscriptionInvoice({
  invoice,
  userId,
  plan,
}: {
  invoice: Stripe.Invoice;
  userId: string;
  plan: string;
}) {
  if (invoice.status !== "paid" || Number(invoice.amount_paid || 0) <= 0) return null;
  const firstLine = invoice.lines?.data?.[0];
  let customerName = String((invoice as unknown as { customer_name?: string | null }).customer_name || "").trim() || null;
  let customerEmail = String(invoice.customer_email || "").trim() || null;
  if (!customerEmail || !customerName) {
    const { data } = await adminClient().auth.admin.getUserById(userId);
    customerEmail = customerEmail || data.user?.email || null;
    customerName = customerName || data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || null;
  }
  const taxAmount = (invoice.total_taxes || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const description = firstLine?.description || `Heyy Studio ${plan === "pro" ? "Pro" : "Starter"}`;

  return recordAndSendPaymentReceipt({
    paymentKey: `invoice:${invoice.id}`,
    userId,
    externalInvoiceId: invoice.id,
    externalPaymentId:
      typeof (invoice as unknown as { payment_intent?: unknown }).payment_intent === "string"
        ? String((invoice as unknown as { payment_intent?: string }).payment_intent)
        : null,
    paymentType: "subscription",
    description,
    amountTotal: Number(invoice.amount_paid || invoice.total || 0),
    taxAmount,
    currency: invoice.currency,
    billingName: customerName,
    billingEmail: customerEmail,
    billingAddress: (invoice as unknown as { customer_address?: Stripe.Address | null }).customer_address || null,
    billingTaxId: ((invoice as unknown as { customer_tax_ids?: Array<{ value?: string | null }> }).customer_tax_ids || [])[0]?.value || null,
    relatedId: typeof (invoice as unknown as { subscription?: unknown }).subscription === "string"
      ? String((invoice as unknown as { subscription?: string }).subscription)
      : null,
    paidAt: new Date(Number(invoice.status_transitions?.paid_at || invoice.created) * 1000).toISOString(),
    metadata: { plan },
  });
}


function checkoutTaxId(session: Stripe.Checkout.Session) {
  const details = session.customer_details as unknown as { tax_ids?: Array<{ value?: string | null }> } | null | undefined;
  return details?.tax_ids?.[0]?.value || null;
}

export async function recordCheckoutPayment({
  session,
  userId,
  paymentType,
  description,
  relatedId,
  metadata = {},
}: {
  session: Stripe.Checkout.Session;
  userId: string;
  paymentType: Exclude<PaymentType, "subscription">;
  description: string;
  relatedId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (session.payment_status !== "paid") return null;
  const admin = adminClient();
  let email = session.customer_details?.email || session.customer_email || null;
  let name = session.customer_details?.name || null;

  if (!email) {
    const { data } = await admin.auth.admin.getUserById(userId);
    email = data.user?.email || null;
    name = name || data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || null;
  }

  return recordAndSendPaymentReceipt({
    paymentKey: `checkout:${session.id}`,
    userId,
    externalPaymentId:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    paymentType,
    description,
    amountTotal: Number(session.amount_total || 0),
    taxAmount: Number(session.total_details?.amount_tax || 0),
    currency: session.currency,
    billingName: name,
    billingEmail: email,
    billingAddress: session.customer_details?.address || null,
    billingTaxId: checkoutTaxId(session),
    relatedId,
    paidAt: new Date(Number(session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    metadata,
  });
}

export async function recordProductionCheckoutReceipt({
  session,
  quoteId,
}: {
  session: Stripe.Checkout.Session;
  quoteId: string;
}) {
  const admin = adminClient();
  const { data: quote, error: quoteError } = await admin
    .from("workspace_quotes")
    .select("id,title,amount,currency,studio_request_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (quoteError) throw quoteError;
  if (!quote?.studio_request_id) return null;

  const { data: requestRow, error: requestError } = await admin
    .from("studio_requests")
    .select("user_id,project_name")
    .eq("id", quote.studio_request_id)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!requestRow?.user_id) return null;

  return recordCheckoutPayment({
    session,
    userId: requestRow.user_id,
    paymentType: "production",
    description: quote.title || requestRow.project_name || "Heyy Studio expert production",
    relatedId: quote.id,
    metadata: { quote_id: quote.id },
  });
}

export async function backfillPaymentHistory({
  userId,
  userEmail,
  stripeCustomerId,
}: {
  userId: string;
  userEmail?: string | null;
  stripeCustomerId?: string | null;
}) {
  const admin = adminClient();
  if (stripeCustomerId) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const [invoices, sessions] = await Promise.all([
      stripe.invoices.list({ customer: stripeCustomerId, status: "paid", limit: 100 }),
      stripe.checkout.sessions.list({ customer: stripeCustomerId, limit: 100 }),
    ]);

    for (const invoice of invoices.data) {
      if (Number(invoice.amount_paid || 0) <= 0) continue;
      const taxAmount = (invoice.total_taxes || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const firstLine = invoice.lines?.data?.[0];
      await recordAndSendPaymentReceipt({
        paymentKey: `invoice:${invoice.id}`,
        userId,
        externalInvoiceId: invoice.id,
        paymentType: "subscription",
        description: firstLine?.description || "Heyy Studio subscription",
        amountTotal: Number(invoice.amount_paid || 0),
        taxAmount,
        currency: invoice.currency,
        billingName: String((invoice as unknown as { customer_name?: string | null }).customer_name || "") || null,
        billingEmail: invoice.customer_email || userEmail || null,
        billingAddress: (invoice as unknown as { customer_address?: Stripe.Address | null }).customer_address || null,
    billingTaxId: ((invoice as unknown as { customer_tax_ids?: Array<{ value?: string | null }> }).customer_tax_ids || [])[0]?.value || null,
        paidAt: new Date(Number(invoice.status_transitions?.paid_at || invoice.created) * 1000).toISOString(),
        sendEmail: false,
        metadata: { backfilled: true },
      });
    }

    for (const session of sessions.data) {
      if (session.mode !== "payment" || session.payment_status !== "paid") continue;
      if (session.metadata?.type !== "credit_top_up") continue;
      await recordAndSendPaymentReceipt({
        paymentKey: `checkout:${session.id}`,
        userId,
        externalPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        paymentType: "credit_pack",
        description: `Heyy Studio credit pack${session.metadata?.credits ? ` — ${session.metadata.credits} credits` : ""}`,
        amountTotal: Number(session.amount_total || 0),
        taxAmount: Number(session.total_details?.amount_tax || 0),
        currency: session.currency,
        billingName: session.customer_details?.name || null,
        billingEmail: session.customer_details?.email || userEmail || null,
        billingAddress: session.customer_details?.address || null,
        billingTaxId: checkoutTaxId(session),
        relatedId: session.metadata?.pack_id || null,
        paidAt: new Date(Number(session.created || 0) * 1000).toISOString(),
        sendEmail: false,
        metadata: { backfilled: true },
      });
    }
  }

  const { data: requests } = await admin
    .from("studio_requests")
    .select("id")
    .eq("user_id", userId)
    .limit(500);
  const requestIds = (requests || []).map((item) => item.id).filter(Boolean);
  if (!requestIds.length) return;

  const { data: quotes } = await admin
    .from("workspace_quotes")
    .select("id,title,amount,currency,paid_at,studio_request_id")
    .in("studio_request_id", requestIds)
    .eq("status", "Paid")
    .limit(500);

  for (const quote of quotes || []) {
    await recordAndSendPaymentReceipt({
      paymentKey: `production-quote:${quote.id}`,
      userId,
      paymentType: "production",
      description: quote.title || "Heyy Studio expert production",
      amountTotal: Math.round(Number(quote.amount || 0) * 100),
      taxAmount: 0,
      currency: quote.currency || "usd",
      billingEmail: userEmail || null,
      relatedId: quote.id,
      paidAt: quote.paid_at || new Date().toISOString(),
      sendEmail: false,
      metadata: { backfilled: true },
    });
  }
}
