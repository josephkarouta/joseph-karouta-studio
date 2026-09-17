import "server-only";

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import {
  annualSavingsUsd,
  getPlan,
  normalizePlan,
  type PlanId,
} from "@/lib/platform/plans";
import {
  billingIntervalFromSubscription,
  subscriptionCreditPeriod,
} from "@/lib/billing/stripe";
import { resolveCommunicationTemplate } from "./templates";
import { sendTrackedEmail } from "./send-email";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const record = subscription as unknown as {
    current_period_end?: number | null;
    items?: { data?: Array<{ current_period_end?: number | null }> };
  };
  const value =
    Number(record.current_period_end || 0) ||
    Number(record.items?.data?.[0]?.current_period_end || 0);
  return value > 0 ? new Date(value * 1000) : null;
}

function invoiceBillingReason(invoice: Stripe.Invoice) {
  return String(
    (invoice as unknown as { billing_reason?: string | null }).billing_reason || "",
  ).trim();
}

export async function sendSubscriptionConfirmation({
  invoice,
  subscription,
  userId,
  plan: planValue,
}: {
  invoice: Stripe.Invoice;
  subscription: Stripe.Subscription;
  userId: string;
  plan: PlanId | string;
}) {
  // The dedicated subscription confirmation is for a newly created paid
  // subscription. Normal renewals still receive the payment receipt/invoice,
  // but do not receive another "your plan is active" message every month/year.
  if (invoiceBillingReason(invoice) !== "subscription_create") {
    return { sent: false, duplicate: false, skipped: "not_subscription_create" };
  }

  const planId = normalizePlan(planValue);
  if (planId === "free") {
    return { sent: false, duplicate: false, skipped: "free_plan" };
  }

  const plan = getPlan(planId);
  const interval = billingIntervalFromSubscription(subscription);
  const creditPeriod = subscriptionCreditPeriod(subscription);
  const nextCreditRefresh = dateLabel(creditPeriod?.end || null);
  const nextBillingDate = dateLabel(subscriptionPeriodEnd(subscription));

  const { data } = await adminClient().auth.admin.getUserById(userId);
  const accountEmail = String(data.user?.email || "").trim().toLowerCase();
  const invoiceEmail = String(invoice.customer_email || "").trim().toLowerCase();
  const to = accountEmail || invoiceEmail;
  if (!to) {
    return { sent: false, duplicate: false, skipped: "missing_email" };
  }

  const billingCycle = interval === "year" ? "Yearly" : "Monthly";
  const price = interval === "year" ? plan.annualPriceUsd : plan.monthlyPriceUsd;
  const priceLabel = interval === "year" ? `${usd(price)}/year` : `${usd(price)}/month`;
  const creditsLabel = plan.monthlyCredits.toLocaleString("en-US");
  const annualSaving = interval === "year" ? annualSavingsUsd(plan.id) : 0;

  const resolved = await resolveCommunicationTemplate({
    templateKey: "subscription.confirmed",
    fallback: {
      subject: "Your Heyy Studio {{plan_name}} plan is active",
      preheader: "{{monthly_credits}} subscription credits refresh every month.",
      eyebrow: "Subscription active",
      title: "Welcome to Heyy Studio {{plan_name}}",
      body: "Your {{plan_name}} subscription is active on {{billing_cycle}} billing. You receive {{monthly_credits}} fresh subscription credits each month. Unused subscription credits reset at each monthly refresh, while purchased credits stay separate and never expire.",
      ctaLabel: "Manage your subscription",
    },
    variables: {
      plan_name: plan.name,
      billing_cycle: billingCycle.toLowerCase(),
      monthly_credits: creditsLabel,
      price: priceLabel,
    },
  });

  if (!resolved.enabled) {
    return { sent: false, duplicate: false, skipped: "template_disabled" };
  }

  const details = [
    { label: "Plan", value: `${plan.name} · ${billingCycle}` },
    { label: "Subscription price", value: priceLabel },
    { label: "Credits", value: `${creditsLabel} fresh credits every month` },
    nextCreditRefresh
      ? { label: "Next credit refresh", value: nextCreditRefresh }
      : null,
    nextBillingDate
      ? {
          label: interval === "year" ? "Next yearly billing date" : "Next billing date",
          value: nextBillingDate,
        }
      : null,
    annualSaving > 0
      ? {
          label: "Yearly saving",
          value: `${usd(annualSaving)} · 2 months free`,
        }
      : null,
  ].filter(
    (item): item is { label: string; value: string } =>
      Boolean(item?.value),
  );

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    detailsTitle: "Your subscription",
    details,
    note:
      "Subscription credits do not roll over. At each monthly refresh, unused subscription credits are replaced by the new monthly allowance. Purchased credit packs are separate and never expire.",
    supportingCopy:
      "Your payment confirmation and Heyy Studio invoice are sent separately. You can manage billing, payment methods and subscription status from your account.",
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/billing"),
  };

  return sendTrackedEmail({
    eventKey: `subscription-confirmed:${subscription.id}`,
    userId,
    to,
    templateKey: "subscription.confirmed",
    subject: resolved.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    relatedType: "subscription",
    relatedId: subscription.id,
    metadata: {
      stripe_subscription_id: subscription.id,
      stripe_invoice_id: invoice.id,
      plan: plan.id,
      billing_interval: interval,
      monthly_credits: plan.monthlyCredits,
      next_credit_refresh: creditPeriod?.end || null,
      next_billing_date: nextBillingDate,
    },
  });
}
