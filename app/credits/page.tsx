"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  LoaderCircle,
} from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/components/auth-provider";
import { ButtonLink, CreditPill, Eyebrow, GlassCard, StatusPill } from "@/components/ui/heyy";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import CreditTopUps from "@/components/account/CreditTopUps";

type Event = {
  id: string;
  event_type: string;
  action: string;
  amount: number;
  available_balance: number | null;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export default function CreditsPage() {
  const { user, credits, refreshAccount } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [topUpMessage, setTopUpMessage] = useState("");
  const [topUpError, setTopUpError] = useState("");

  const loadHistory = useCallback(async (token: string, page: number) => {
    const response = await fetch(`/api/account/credit-history?page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (response.ok) {
      const result = await response.json();
      setEvents(result.events || []);
      setHistoryPages(Math.max(1, Number(result.totalPages || 1)));
      setHistoryTotal(Number(result.total || 0));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setTopUpError("");

      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const topUpStatus = params.get("topup");
      const sessionId = params.get("session_id");

      if (topUpStatus === "success" && sessionId) {
        try {
          const response = await fetch("/api/credits/verify-session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionId }),
          });
          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || "The payment could not be verified.");
          }

          if (!cancelled) {
            setTopUpMessage(`${Number(result.creditsAdded || 0).toLocaleString("en-US")} credits added.`);
            window.history.replaceState({}, "", "/credits?topup=confirmed");
            window.dispatchEvent(new Event("heyy:credits-changed"));
            setHistoryPage(1);
            await refreshAccount();
          }
        } catch (error) {
          if (!cancelled) {
            setTopUpError(
              error instanceof Error ? error.message : "The top-up could not be confirmed.",
            );
          }
        }
      } else if (topUpStatus === "cancelled") {
        setTopUpError("Credit purchase cancelled. No credits were added.");
      }

      await loadHistory(token, historyPage);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [historyPage, loadHistory, refreshAccount, user]);

  return (
    <AccountLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Credits</Eyebrow>
          <h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-5xl">
            Credits
          </h1>
          <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">
            Review your balance, purchase top-ups and track every credit movement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/credit-guide" variant="secondary" size="sm">Credit guide</ButtonLink>
          <CreditPill credits={credits.available} />
        </div>
      </div>

      {topUpMessage && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={18} />
          {topUpMessage}
        </div>
      )}
      {topUpError && (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-300">
          {topUpError}
        </div>
      )}

      <GlassCard className="mt-7 grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <CreditMetric label="Available now" value={credits.available} accent />
        <CreditMetric label="Subscription credits" value={credits.monthly} />
        <CreditMetric label="Purchased — no expiry" value={credits.purchased} />
        <CreditMetric label="Reserved now" value={credits.reserved} />
      </GlassCard>

      <div className="mt-8">
        <CreditTopUps />
      </div>

      <GlassCard className="mt-9 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--border)] p-6">
          <History size={20} className="text-[var(--accent-strong)]" />
          <div>
            <h2 className="text-xl font-black">Credit history</h2>
            <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
              Reservations, successful charges, refunds, renewals and purchases.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center p-16">
            <LoaderCircle className="animate-spin text-[var(--accent-strong)]" />
          </div>
        ) : events.length === 0 ? (
          <p className="p-10 text-sm font-semibold text-[var(--text-muted)]">
            No credit activity yet. Your first generation will appear here.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {events.map((event) => {
              const positive =
                event.event_type === "top_up" ||
                event.event_type === "monthly_grant" ||
                event.event_type === "refunded";

              return (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-2xl ${
                        positive
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      }`}
                    >
                      {positive ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </span>
                    <div>
                      <p className="text-sm font-black capitalize">
                        {event.action.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                        {new Date(event.created_at).toLocaleString("en-US")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusPill
                      tone={
                        event.event_type === "committed"
                          ? "info"
                          : event.event_type === "refunded"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {event.event_type}
                    </StatusPill>
                    <p className="min-w-16 text-right text-sm font-black">
                      {event.amount > 0 ? "+" : ""}
                      {event.amount}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && historyTotal > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
            <p className="text-xs font-bold text-[var(--text-muted)]">
              Showing {(historyPage - 1) * 10 + 1}–{Math.min(historyPage * 10, historyTotal)} of {historyTotal}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                disabled={historyPage <= 1}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Previous credit history page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: historyPages }, (_, index) => index + 1)
                .filter((page) => historyPages <= 7 || page === 1 || page === historyPages || Math.abs(page - historyPage) <= 1)
                .map((page, index, pages) => {
                  const previous = pages[index - 1];
                  return (
                    <span key={page} className="flex items-center gap-2">
                      {previous && page - previous > 1 && <span className="px-1 text-xs font-black text-[var(--text-muted)]">…</span>}
                      <button
                        type="button"
                        onClick={() => setHistoryPage(page)}
                        className={`min-w-9 rounded-xl border px-3 py-2 text-xs font-black transition ${
                          page === historyPage
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)]"
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  );
                })}
              <button
                type="button"
                onClick={() => setHistoryPage((page) => Math.min(historyPages, page + 1))}
                disabled={historyPage >= historyPages}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Next credit history page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </AccountLayout>
  );
}

function CreditMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <p className="text-[.62rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString("en-US")}</p>
    </div>
  );
}
