"use client";

import { Check, Sparkles } from "lucide-react";
import PricingAction from "@/components/account/PricingActions";
import { useAuth } from "@/components/auth-provider";
import { CreditPill, GlassCard } from "@/components/ui/heyy";
import { normalizePlan, PLANS } from "@/lib/platform/plans";

export default function PlanCards({ compactMobile = false }: { compactMobile?: boolean }) {
  const { plan, user } = useAuth();
  const currentPlan = normalizePlan(plan);

  return (
    <div
      className={
        compactMobile
          ? "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:items-stretch md:gap-4 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
          : "grid gap-3.5 md:grid-cols-3 md:items-stretch md:gap-4"
      }
    >
      {PLANS.map((item) => {
        const featured = Boolean(item.highlighted);
        const isCurrent = Boolean(user) && currentPlan === item.id;
        const visibleFeatures = item.features.filter(
          (feature) => !/subscription credits each month/i.test(feature),
        );

        return (
          <GlassCard
            key={item.id}
            className={`relative flex flex-col overflow-hidden p-4 sm:p-5 md:min-h-[385px] ${compactMobile ? "w-[84vw] shrink-0 snap-center sm:w-[70vw] md:w-auto md:shrink" : ""} ${
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
              ${item.monthlyPriceUsd}
              <span className="ml-1.5 text-[0.68rem] font-bold tracking-normal text-[var(--text-muted)]">/month</span>
            </p>
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
              <PricingAction planId={item.id} current={isCurrent} featured={featured} />
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
