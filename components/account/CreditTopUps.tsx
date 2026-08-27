"use client";

import { useState } from "react";
import { LoaderCircle, PlusCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, GlassCard } from "@/components/ui/heyy";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/platform/plans";
import { getCreditExamples } from "@/lib/credits/customer-catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function CreditTopUps() {
  const { user, loading: accountLoading } = useAuth();
  const [purchasing, setPurchasing] = useState<CreditPackId | null>(null);
  const [error, setError] = useState("");

  async function buy(packId: CreditPackId) {
    if (!user) {
      window.location.href = "/login?next=/credits";
      return;
    }

    setPurchasing(packId);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/credits/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packId }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Checkout could not be opened.");
      }

      window.location.href = result.url;
    } catch (value) {
      setError(value instanceof Error ? value.message : "Checkout could not be opened.");
      setPurchasing(null);
    }
  }

  return (
    <section id="buy-credits" className="scroll-mt-28">
      <div className="flex items-center gap-3">
        <PlusCircle size={20} className="text-[var(--accent-strong)]" />
        <div>
          <h2 className="text-xl font-black">Buy credits</h2>
          <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
            Purchased credits never expire and remain separate from subscription credits.
          </p>
        </div>
      </div>

      {accountLoading ? (
        <GlassCard className="mt-4 grid min-h-32 place-items-center p-6">
          <LoaderCircle className="animate-spin text-[var(--accent-strong)]" />
        </GlassCard>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => {
            const examples = getCreditExamples(pack.credits);
            return (
            <GlassCard key={pack.id} className="p-5">
              <p className="text-2xl font-black tracking-[-.045em]">
                {pack.credits.toLocaleString("en-US")}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-[.13em] text-[var(--accent-strong)]">
                credits
              </p>
              <p className="mt-4 text-3xl font-black">${pack.priceUsd}</p>
              <p className="mt-2 min-h-12 text-xs font-semibold leading-5 text-[var(--text-secondary)]">
                {pack.description}
              </p>
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] p-3">
                <p className="text-[.6rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">If used for one action</p>
                <div className="mt-2 space-y-1">
                  {examples.map((example) => (
                    <p key={example.id} className="text-[.66rem] font-bold text-[var(--text-secondary)]">
                      Up to <span className="font-black text-[var(--text-primary)]">{example.count}</span> {example.label}
                    </p>
                  ))}
                </div>
              </div>
              <Button
                className="mt-5 w-full"
                variant="secondary"
                onClick={() => buy(pack.id)}
                disabled={purchasing !== null}
              >
                {purchasing === pack.id && <LoaderCircle size={15} className="animate-spin" />}
                Buy credits
              </Button>
            </GlassCard>
            );
          })}
        </div>
      )}

      {error && <p className="mt-3 text-sm font-bold text-red-500">{error}</p>}
      <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">
        Prices are in US dollars. Purchased credits do not expire.
      </p>
    </section>
  );
}
