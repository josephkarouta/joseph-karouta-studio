"use client";

import { Check } from "lucide-react";
import PricingAction from "@/components/account/PricingActions";
import { useAuth } from "@/components/auth-provider";
import { CreditPill, GlassCard } from "@/components/ui/heyy";
import { normalizePlan, PLANS } from "@/lib/platform/plans";
import { getCreditExamples } from "@/lib/credits/customer-catalog";

export default function PlanCards() {
  const { plan, user } = useAuth();
  const currentPlan = normalizePlan(plan);

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {PLANS.map((item) => {
        const featured = Boolean(item.highlighted);
        const isCurrent = Boolean(user) && currentPlan === item.id;
        const visibleFeatures = item.features.filter(
          (feature) => !/subscription credits each month/i.test(feature),
        );
        const examples = item.id === "free" ? [] : getCreditExamples(item.monthlyCredits);

        return (
          <GlassCard
            key={item.id}
            className={`relative flex min-h-[500px] flex-col p-7 sm:p-8 ${
              isCurrent
                ? "border-emerald-400/70 bg-[linear-gradient(145deg,rgba(16,185,129,.08),var(--surface-strong)_48%)] shadow-[var(--shadow-card-hover)]"
                : featured
                  ? "border-[var(--accent-border)] bg-[linear-gradient(145deg,var(--accent-soft),var(--surface-strong)_48%)] shadow-[var(--shadow-card-hover)]"
                  : ""
            }`}
          >
            <div className="flex min-h-9 items-start justify-between gap-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                {item.name}
              </p>
              {isCurrent ? (
                <span className="rounded-full bg-emerald-500 px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.13em] text-white shadow-sm">
                  Current plan
                </span>
              ) : featured ? (
                <span className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.13em] text-white shadow-sm">
                  Popular
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-5xl font-black tracking-[-0.06em] text-[var(--text-primary)]">
              ${item.monthlyPriceUsd}
              <span className="ml-1 text-sm font-bold tracking-normal text-[var(--text-muted)]">/month</span>
            </p>
            <p className="mt-5 min-h-12 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
              {item.description}
            </p>

            <div className="my-6 border-t border-[var(--border)]" />
            {item.id === "free" ? (
              <p className="w-fit rounded-full bg-[var(--accent-soft)] px-4 py-2 text-xs font-black text-[var(--accent-strong)]">
                Pay as you go
              </p>
            ) : (
              <CreditPill credits={item.monthlyCredits} label="monthly credits" className="w-fit" />
            )}

            {item.id === "free" ? (
              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
                <p className="text-[.64rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">What can I make?</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">
                  Buy any credit pack and use it across Brand, Marketing and AI tools. Purchased credits never expire.
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
                <p className="text-[.64rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">If used for one action</p>
                <div className="mt-2 space-y-1.5">
                  {examples.map((example) => (
                    <p key={example.id} className="text-xs font-bold text-[var(--text-secondary)]">
                      Up to <span className="font-black text-[var(--text-primary)]">{example.count}</span> {example.label}
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-[.62rem] font-semibold leading-4 text-[var(--text-muted)]">
                  Approximate examples assume the full allowance is used for one action. Most customers mix Studios and tools.
                </p>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {visibleFeatures.map((feature) => (
                <p key={feature} className="flex items-start gap-2.5 text-xs font-bold leading-5 text-[var(--text-secondary)]">
                  <Check size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                  {feature}
                </p>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <PricingAction planId={item.id} current={isCurrent} featured={featured} />
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
