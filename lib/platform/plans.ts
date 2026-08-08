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

function envNumber(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Testing defaults only. The product owner will finalize pricing and credit
 * allocations after real generation-cost testing. Every number is centralized
 * here so launch pricing can be changed without editing UI components.
 */
export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    monthlyCredits: envNumber("HEYY_FREE_MONTHLY_CREDITS", 40),
    description: "Explore the platform and build your first creative direction.",
    features: [
      "All four specialist Studios",
      "Project workspace and saved outputs",
      "Testing credit allowance",
      "Expert production requests",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPriceUsd: envNumber("HEYY_STARTER_PRICE_USD", 29),
    monthlyCredits: envNumber("HEYY_STARTER_MONTHLY_CREDITS", 300),
    description: "For founders and small teams creating every month.",
    features: [
      "Everything in Free",
      "Higher monthly credit allowance",
      "Premium exports and generation history",
      "Priority standard generation queue",
    ],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceUsd: envNumber("HEYY_PRO_PRICE_USD", 79),
    monthlyCredits: envNumber("HEYY_PRO_MONTHLY_CREDITS", 1200),
    description: "For active creative teams and higher-volume production.",
    features: [
      "Everything in Starter",
      "Largest monthly credit allowance",
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
export type CreditPack = { id: CreditPackId; name: string; credits: number; priceUsd: number; description: string };

export const CREDIT_PACKS: CreditPack[] = [
  { id: "small", name: "100-credit top-up", credits: envNumber("HEYY_CREDIT_PACK_SMALL_CREDITS", 100), priceUsd: envNumber("HEYY_CREDIT_PACK_SMALL_PRICE_USD", 10), description: "For a few additional images, exports or upscale jobs." },
  { id: "medium", name: "300-credit top-up", credits: envNumber("HEYY_CREDIT_PACK_MEDIUM_CREDITS", 300), priceUsd: envNumber("HEYY_CREDIT_PACK_MEDIUM_PRICE_USD", 25), description: "For a focused campaign, concept set or presentation sprint." },
  { id: "large", name: "800-credit top-up", credits: envNumber("HEYY_CREDIT_PACK_LARGE_CREDITS", 800), priceUsd: envNumber("HEYY_CREDIT_PACK_LARGE_PRICE_USD", 60), description: "For higher-volume generation without changing plan." },
];

export function getCreditPack(value: unknown) {
  return CREDIT_PACKS.find((pack) => pack.id === String(value).toLowerCase() as CreditPackId);
}
