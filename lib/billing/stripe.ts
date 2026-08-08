import "server-only";

import Stripe from "stripe";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { normalizePlan, type PlanId } from "@/lib/platform/plans";

export type SubscriptionRow = Record<string, unknown>;

const MANAGED_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

function periodValue(subscription: Stripe.Subscription, key: "current_period_start" | "current_period_end") {
  const record = subscription as unknown as Record<string, unknown>;
  const direct = Number(record[key] || 0);
  if (direct > 0) return direct;

  const item = subscription.items?.data?.[0] as unknown as Record<string, unknown> | undefined;
  return Number(item?.[key] || 0) || null;
}

function isoFromSeconds(value: number | null | undefined) {
  return value && value > 0 ? new Date(value * 1000).toISOString() : null;
}

export function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe is not configured.");
  return new Stripe(secret);
}

export function planFromSubscription(subscription: Stripe.Subscription): PlanId {
  const metadataPlan = subscription.metadata?.plan;
  if (metadataPlan) return normalizePlan(metadataPlan);

  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID_USD) return "pro";
  if (priceId && priceId === process.env.STRIPE_STARTER_PRICE_ID_USD) return "starter";
  return "free";
}

export function subscriptionPayload(subscription: Stripe.Subscription, overridePlan?: unknown) {
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  return {
    plan: normalizePlan(overridePlan || planFromSubscription(subscription)),
    status: subscription.status,
    stripe_customer_id: customerId(subscription.customer),
    stripe_subscription_id: subscription.id,
    stripe_price_id: price?.id || null,
    current_period_start: isoFromSeconds(periodValue(subscription, "current_period_start")),
    current_period_end: isoFromSeconds(periodValue(subscription, "current_period_end")),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: isoFromSeconds(subscription.canceled_at),
    currency: price?.currency || null,
    amount: price?.unit_amount ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function getSubscriptionRow(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as SubscriptionRow | null;
}

export async function syncSubscription(
  admin: SupabaseClient,
  userId: string,
  subscription: Stripe.Subscription,
  overridePlan?: unknown,
) {
  const { data, error } = await admin
    .from("user_subscriptions")
    .upsert(
      {
        user_id: userId,
        ...subscriptionPayload(subscription, overridePlan),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as SubscriptionRow;
}

async function usableCustomer(stripe: Stripe, id: string | null) {
  if (!id) return null;
  try {
    const customer = await stripe.customers.retrieve(id);
    if ("deleted" in customer && customer.deleted) return null;
    return customer as Stripe.Customer;
  } catch {
    return null;
  }
}

async function saveCustomerId(
  admin: SupabaseClient,
  userId: string,
  row: SubscriptionRow | null,
  stripeCustomerId: string,
) {
  const base = {
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
    updated_at: new Date().toISOString(),
  };

  if (row) {
    const { error } = await admin
      .from("user_subscriptions")
      .update(base)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("user_subscriptions").insert({
    ...base,
    plan: "free",
    status: "inactive",
  });
  if (error) throw error;
}

export async function resolveStripeCustomer({
  stripe,
  admin,
  user,
  createIfMissing,
}: {
  stripe: Stripe;
  admin: SupabaseClient;
  user: User;
  createIfMissing: boolean;
}) {
  const row = await getSubscriptionRow(admin, user.id);
  let customer = await usableCustomer(stripe, text(row?.stripe_customer_id));

  if (!customer) {
    const subscriptionId = text(row?.stripe_subscription_id);
    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        customer = await usableCustomer(stripe, customerId(subscription.customer));
      } catch {
        // Continue to email lookup for older records.
      }
    }
  }

  if (!customer && user.email) {
    const matches = await stripe.customers.list({ email: user.email, limit: 100 });
    customer =
      matches.data.find((item) => item.metadata?.user_id === user.id) ||
      matches.data[0] ||
      null;
  }

  if (!customer && createIfMissing) {
    customer = await stripe.customers.create({
      email: user.email || undefined,
      name: text(user.user_metadata?.full_name || user.user_metadata?.name) || undefined,
      metadata: { user_id: user.id },
    });
  }

  if (customer) {
    if (customer.metadata?.user_id !== user.id) {
      customer = await stripe.customers.update(customer.id, {
        metadata: { ...customer.metadata, user_id: user.id },
      });
    }
    if (text(row?.stripe_customer_id) !== customer.id) {
      await saveCustomerId(admin, user.id, row, customer.id);
    }
  }

  return { customer, row };
}

export async function findBestSubscription(stripe: Stripe, stripeCustomerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 100,
  });

  return (
    subscriptions.data
      .slice()
      .sort((a, b) => {
        const activeDifference = Number(MANAGED_STATUSES.has(b.status)) - Number(MANAGED_STATUSES.has(a.status));
        return activeDifference || b.created - a.created;
      })[0] || null
  );
}

export function hasManagedSubscription(subscription: Stripe.Subscription | null | undefined) {
  return Boolean(subscription && MANAGED_STATUSES.has(subscription.status));
}

export async function userIdForSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
) {
  const metadataUserId = text(subscription.metadata?.user_id);
  if (metadataUserId) return metadataUserId;

  const subscriptionId = subscription.id;
  const stripeCustomerId = customerId(subscription.customer);

  const bySubscription = await admin
    .from("user_subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (bySubscription.error) throw bySubscription.error;
  if (bySubscription.data?.user_id) return String(bySubscription.data.user_id);

  if (stripeCustomerId) {
    const byCustomer = await admin
      .from("user_subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (byCustomer.error) throw byCustomer.error;
    if (byCustomer.data?.user_id) return String(byCustomer.data.user_id);
  }

  return null;
}
