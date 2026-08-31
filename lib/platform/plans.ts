export type PlanId = "free" | "starter" | "pro";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  monthlyPriceUsd: number;
  monthlyCredits: number;
  description: string;
  features: string[];
  highlighted?: boolean;
};

/**
 * Phase 7 approved launch commercial catalog.
 *
 * These values are intentionally NOT environment-overridable. Stripe Price IDs
 * belong in environment variables, but the customer price/credit entitlement
 * used by checkout validation, webhooks, billing UI and credit grants must have
 * one deterministic source of truth so a stale local/Netlify env value cannot
 * grant the wrong allowance.
 */
export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    monthlyCredits: 0,
    description: "Create a free account and buy credits whenever you need them.",
    features: [
      "All four specialist Studios",
      "Create and download without cloud storage",
      "Pay-as-you-go credit packs",
      "Purchased credits never expire",
      "Expert production requests",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPriceUsd: 35,
    monthlyCredits: 1500,
    description: "For founders and small teams creating every month.",
    features: [
      "Everything in Free",
      "1,500 subscription credits each month",
      "Buy non-expiring top-ups at any time",
      "Unlimited saved projects & assets (fair use)",
      "Version history and premium exports",
      "Priority standard generation queue",
    ],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceUsd: 99,
    monthlyCredits: 5000,
    description: "For active creative teams and higher-volume production.",
    features: [
      "Everything in Starter",
      "5,000 subscription credits each month",
      "Buy non-expiring top-ups at any time",
      "Unlimited saved projects & assets (fair use)",
      "High-quality image and video modes",
      "Priority support and production intake",
    ],
  },
];

export function normalizePlan(value: unknown): PlanId {
  const plan = String(value || "free").toLowerCase();
  if (plan.includes("pro")) return "pro";
  if (plan.includes("starter")) return "starter";
  return "free";
}

export function getPlan(value: unknown) {
  const id = normalizePlan(value);
  return PLANS.find((plan) => plan.id === id) || PLANS[0];
}

export type CreditPackId = "small" | "medium" | "large";
export type CreditPack = {
  id: CreditPackId;
  name: string;
  credits: number;
  priceUsd: number;
  description: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "small",
    name: "1,000-credit pack",
    credits: 1000,
    priceUsd: 25,
    description: "For a small project or trying a few tools.",
  },
  {
    id: "medium",
    name: "3,000-credit pack",
    credits: 3000,
    priceUsd: 69,
    description: "For a focused campaign, concept set or presentation sprint.",
  },
  {
    id: "large",
    name: "7,500-credit pack",
    credits: 7500,
    priceUsd: 159,
    description: "For larger projects and higher-volume production.",
  },
];

export function getCreditPack(value: unknown) {
  return CREDIT_PACKS.find(
    (pack) => pack.id === String(value).toLowerCase() as CreditPackId,
  );
}
