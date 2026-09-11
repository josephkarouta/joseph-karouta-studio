"use client";

import { useState } from "react";
import { LoaderCircle, PlusCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, GlassCard } from "@/components/ui/heyy";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/platform/plans";
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
      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] sm:h-9 sm:w-9">
            <PlusCircle size={16} />
          </span>
          <div>
            <h2 className="text-base font-black tracking-[-0.03em] sm:text-lg">Buy credits</h2>
            <p className="mt-0.5 text-[0.7rem] font-semibold text-[var(--text-muted)] sm:mt-1 sm:text-xs">
              Top up anytime. Purchased credits never expire.
            </p>
          </div>
        </div>

        <div className="p-3.5 sm:p-5">
          {accountLoading ? (
            <div className="grid min-h-24 place-items-center rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] sm:min-h-28">
              <LoaderCircle className="animate-spin text-[var(--accent-strong)]" />
            </div>
          ) : (
            <div className="grid gap-2.5 sm:gap-3 md:grid-cols-3">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className="relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:flex sm:min-h-[170px] sm:flex-col sm:items-stretch sm:p-5"
                >
                  <div className="flex items-baseline gap-2 sm:block">
                    <p className="text-lg font-black tracking-[-0.04em] sm:text-xl">
                      {pack.credits.toLocaleString("en-US")}
                    </p>
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[var(--accent-strong)] sm:mt-0.5 sm:text-[0.62rem]">
                      credits
                    </p>
                  </div>
                  <p className="text-xl font-black tracking-[-0.04em] sm:absolute sm:right-5 sm:top-5 sm:text-2xl">${pack.priceUsd}</p>
                  <p className="col-span-2 hidden text-[0.72rem] font-semibold leading-5 text-[var(--text-secondary)] sm:mt-3 sm:block">
                    {pack.description}
                  </p>
                  <Button
                    className="col-span-2 mt-1 w-full sm:mt-auto"
                    variant="secondary"
                    size="sm"
                    onClick={() => buy(pack.id)}
                    disabled={purchasing !== null}
                  >
                    {purchasing === pack.id && <LoaderCircle size={15} className="animate-spin" />}
                    Buy credits
                  </Button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-sm font-bold text-red-500">{error}</p>}

          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="text-[0.66rem] font-semibold text-[var(--text-muted)] sm:text-[0.7rem]">
              Prices are in US dollars.
            </p>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
