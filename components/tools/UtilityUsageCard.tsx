"use client";

import Link from "next/link";
import { Crown, Gauge, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/ui/heyy";

export default function UtilityUsageCard({
  unlimited,
  plan,
  freeRemaining,
  dailyLimit,
  creditCost,
  loading,
  error,
}: {
  unlimited: boolean;
  plan: string;
  freeRemaining: number;
  dailyLimit: number;
  creditCost: number;
  loading?: boolean;
  error?: string;
}) {
  const paidPlanPaused = !unlimited && ["starter", "pro"].includes(String(plan || "").toLowerCase());

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            {unlimited ? <Crown size={17} /> : <Gauge size={17} />}
          </span>
          <div>
            <p className="text-sm font-black">
              {loading
                ? "Checking today’s allowance…"
                : unlimited
                  ? "Unlimited with your plan"
                  : paidPlanPaused
                    ? "Plan utilities paused"
                    : `${freeRemaining} of ${dailyLimit} free uses left today`}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">
              {unlimited
                ? "PDF and conversion utilities do not use your subscription credits."
                : paidPlanPaused
                  ? `Your subscription needs attention. The free daily allowance still applies, then each successful operation uses ${creditCost} credit.`
                  : `After the free daily allowance, each successful operation uses ${creditCost} credit.`}
            </p>
          </div>
        </div>
        {!unlimited && !loading && (
          <Link href="/billing" className="text-xs font-black text-[var(--accent-strong)] hover:underline">
            {paidPlanPaused ? "Fix billing" : "Upgrade for unlimited"}
          </Link>
        )}
      </div>
      {error && <p className="mt-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-200">{error}</p>}
      <div className="mt-4 flex items-center gap-2 text-[0.68rem] font-bold text-[var(--text-muted)]">
        <ShieldCheck size={13} /> Source files stay in your browser for this one action and are not uploaded to Projects or the Assets Library.
      </div>
    </GlassCard>
  );
}
