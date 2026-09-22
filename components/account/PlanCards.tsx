"use client";

import { useEffect, useState } from "react";
import { Check, Percent, Sparkles } from "lucide-react";
import PricingAction from "@/components/account/PricingActions";
import { useAuth } from "@/components/auth-provider";
import { CreditPill, GlassCard } from "@/components/ui/heyy";
import {
  annualSavingsUsd,
  normalizePlan,
  PLANS,
  type BillingInterval,
} from "@/lib/platform/plans";

export default function PlanCards({ compactMobile = false }: { compactMobile?: boolean }) {
  const { plan, user } = useAuth();
  const currentPlan = normalizePlan(plan);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("year");
  const [desktopPricing, setDesktopPricing] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");

    const syncPricingMode = () => {
      const desktop = media.matches;
      setDesktopPricing(desktop);
      setBillingInterval(desktop ? "month" : "year");
    };

    syncPricingMode();
    media.addEventListener("change", syncPricingMode);
    return () => media.removeEventListener("change", syncPricingMode);
  }, []);

  const orderedPlans = [...PLANS].sort((a, b) => {
    if (desktopPricing) {
      const desktopRank = { free: 0, starter: 1, pro: 2 } as const;
      return desktopRank[a.id] - desktopRank[b.id];
    }

    if (user && currentPlan !== "free") {
      if (a.id === currentPlan) return -1;
      if (b.id === currentPlan) return 1;
    }

    const mobileRank = { starter: 0, pro: 1, free: 2 } as const;
    return mobileRank[a.id] - mobileRank[b.id];
  });

  const billingIntervals: BillingInterval[] = desktopPricing
    ? ["month", "year"]
    : ["year", "month"];

  return (
    <div>
      <div className="mb-4 flex flex-col items-center justify-center gap-2.5 sm:mb-5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8b5cf6] px-3.5 py-2 text-[0.64rem] font-black uppercase tracking-[0.13em] text-white shadow-[0_9px_22px_rgba(139,92,246,.24)]">
            <Percent size={12} strokeWidth={2.7} aria-hidden="true" /> 2 months free
          </span>
          <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--accent-strong)]">Save 17% yearly</span>
        </div>
        <div className="inline-grid grid-cols-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-strong)_88%,transparent)] p-1 shadow-[0_10px_28px_rgba(54,35,82,0.09)] backdrop-blur-xl">
          {billingIntervals.map((interval) => {
            const active = billingInterval === interval;
            return (
              <button
                key={interval}
                type="button"
                onClick={() => setBillingInterval(interval)}
                aria-pressed={active}
                className={`min-w-[102px] cursor-pointer rounded-full px-5 py-2.5 text-xs font-black transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--focus-ring)] sm:min-w-[112px] ${
                  active
                    ? "bg-[var(--text-primary)] text-[var(--surface)] shadow-[0_8px_18px_rgba(20,16,28,0.18)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                }`}
              >
                {interval === "month" ? (
                  "Monthly"
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Percent size={13} strokeWidth={2.5} aria-hidden="true" />
                    Yearly
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={
          compactMobile
            ? "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:items-stretch md:gap-4 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
            : "grid gap-3.5 md:grid-cols-3 md:items-stretch md:gap-4"
        }
      >
        {orderedPlans.map((item) => {
        const featured = Boolean(item.highlighted);
        const isCurrent = Boolean(user) && currentPlan === item.id;
        const visibleFeatures = item.features.filter(
          (feature) => !/subscription credits each month/i.test(feature),
        );
        const annual = billingInterval === "year" && item.id !== "free";
        const displayedPrice = annual ? item.annualPriceUsd : item.monthlyPriceUsd;
        const savings = annual ? annualSavingsUsd(item.id) : 0;

        return (
          <GlassCard
            key={item.id}
            className={`relative flex flex-col overflow-hidden p-4 sm:p-5 md:min-h-[385px] ${compactMobile ? "w-[calc(100vw-3rem)] shrink-0 snap-center sm:w-[70vw] md:w-auto md:shrink" : ""} ${
              featured
                ? "border-2 border-[var(--accent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--accent-soft)_92%,white),var(--surface-strong)_58%)] shadow-[0_24px_70px_color-mix(in_srgb,var(--accent)_22%,transparent)] ring-4 ring-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                : isCurrent
                  ? "border-[var(--accent-border)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--accent-soft)_48%,transparent),var(--surface-strong)_62%)]"
                  : ""
            }`}
          >
            {featured && (
              <div className="-mx-4 -mt-4 mb-4 flex min-h-8 items-center justify-center gap-1.5 bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))] px-3 text-[0.6rem] font-black uppercase tracking-[0.15em] text-white sm:-mx-5 sm:-mt-5 sm:mb-5">
                <Sparkles size={11} /> Most popular
              </div>
            )}

            <div className="flex min-h-7 items-start justify-between gap-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                {item.name}
              </p>
              {isCurrent && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-[0.11em] text-[var(--text-muted)]">
                  Current plan
                </span>
              )}
            </div>

            <p className="mt-1.5 text-[2.25rem] font-black leading-none tracking-[-0.06em] text-[var(--text-primary)] sm:text-[2.45rem] md:text-[2.6rem]">
              ${displayedPrice}
              <span className="ml-1.5 text-[0.68rem] font-bold tracking-normal text-[var(--text-muted)]">
                {item.id === "free" ? "" : annual ? "/year" : "/month"}
              </span>
            </p>
            {annual && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-1 text-[0.62rem] font-black text-[var(--accent-strong)]">
                  Save ${savings}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-1 text-[0.62rem] font-black text-[var(--accent-strong)]">
                  <Sparkles size={10} /> 2 months free
                </span>
              </div>
            )}
            <p className="mt-2.5 text-[0.74rem] font-semibold leading-5 text-[var(--text-secondary)] sm:min-h-10 sm:text-[0.78rem]">
              {item.description}
            </p>

            <div className="my-3 border-t border-[var(--border)] sm:my-4" />
            {item.id === "free" ? (
              <p className="w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[0.64rem] font-black text-[var(--accent-strong)]">
                Pay as you go
              </p>
            ) : (
              <CreditPill credits={item.monthlyCredits} label="monthly credits" className="w-fit" />
            )}

            <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-2.5">
              {visibleFeatures.map((feature) => (
                <p key={feature} className="flex items-start gap-2 text-[0.69rem] font-bold leading-[1.08rem] text-[var(--text-secondary)] sm:text-[0.72rem] sm:leading-[1.18rem]">
                  <Check size={12} className="mt-0.5 shrink-0 text-[var(--green)]" />
                  {feature}
                </p>
              ))}
            </div>

            <div className="mt-auto pt-4 sm:pt-5">
              <PricingAction
                planId={item.id}
                billingInterval={billingInterval}
                current={isCurrent}
                featured={featured}
              />
            </div>
          </GlassCard>
        );
        })}
      </div>
    </div>
  );
}
