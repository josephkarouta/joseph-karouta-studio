"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/components/auth-provider";
import {
  Button,
  ButtonLink,
  CreditPill,
  Eyebrow,
  GlassCard,
  StatusPill,
} from "@/components/ui/heyy";
import { getPlan } from "@/lib/platform/plans";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type BillingDetails = {
  plan: string;
  status: string;
  customerId: string | null;
  subscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  subscriptionStartedAt: string | null;
  cancelAtPeriodEnd: boolean;
  autoRenewal: boolean;
  nextRenewalAt: string | null;
  accessEndsAt: string | null;
  canceledAt: string | null;
  scheduledCancelAt: string | null;
  currency: string | null;
  amount: number | null;
  canManage: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatus(value: string) {
  return String(value || "free")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPlanPrice(
  amount: number | null | undefined,
  currency: string | null | undefined,
  fallbackUsd: number,
) {
  const value = typeof amount === "number" ? amount / 100 : fallbackUsd;
  const normalizedCurrency = String(currency || "usd").toUpperCase();
  try {
    return `${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value)}/month`;
  } catch {
    return `$${value}/month`;
  }
}

function statusTone(status: string): "neutral" | "success" | "warning" | "info" {
  if (["active", "trialing"].includes(status)) return "success";
  if (["past_due", "unpaid", "incomplete"].includes(status)) return "warning";
  if (["cancelled", "canceled", "inactive"].includes(status)) return "neutral";
  return "info";
}

export default function BillingPage() {
  const { user, plan, credits, refreshAccount } = useAuth();
  const [billing, setBilling] = useState<BillingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState("");
  const definition = getPlan(billing?.plan || plan);

  const hasPaidSubscription = Boolean(billing?.subscriptionId);

  const billingLine = useMemo(() => {
    if (!billing?.subscriptionId) {
      return definition.id === "free"
        ? "Free plan — no paid subscription"
        : `${definition.name} access is enabled, but no Stripe subscription is connected`;
    }
    if (billing.cancelAtPeriodEnd) {
      return `Cancels on ${formatDate(billing.scheduledCancelAt || billing.currentPeriodEnd)}`;
    }
    return `Renews on ${formatDate(billing.currentPeriodEnd)}`;
  }, [billing, definition.id, definition.name]);

  async function accessToken() {
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    return token;
  }

  const loadBilling = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const token = await accessToken();
      const response = await fetch("/api/billing/summary", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load billing details.");
      setBilling(result.billing || null);
      await refreshAccount();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to load billing details.");
    } finally {
      setLoading(false);
    }
  }, [refreshAccount, user?.id]);

  async function openPortal() {
    setOpeningPortal(true);
    setError("");
    const portalWindow = window.open("about:blank", "_blank");
    if (portalWindow) {
      portalWindow.opener = null;
      portalWindow.document.title = "Opening Stripe billing…";
      portalWindow.document.body.innerHTML = '<p style="font-family:system-ui;padding:24px">Opening secure Stripe billing…</p>';
    }
    try {
      const token = await accessToken();
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to open billing management.");
      }
      if (portalWindow && !portalWindow.closed) {
        portalWindow.location.href = result.url;
      } else {
        window.location.href = result.url;
        return;
      }
      setOpeningPortal(false);
    } catch (value) {
      if (portalWindow && !portalWindow.closed) portalWindow.close();
      setError(value instanceof Error ? value.message : "Unable to open billing management.");
      setOpeningPortal(false);
    }
  }

  useEffect(() => {
    void loadBilling();
  }, [loadBilling, user?.id]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshAfterPortal = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void loadBilling();
      }, 700);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshAfterPortal();
    };

    window.addEventListener("focus", refreshAfterPortal);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshAfterPortal);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadBilling]);

  return (
    <AccountLayout>
      <Eyebrow>Billing</Eyebrow>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-[-.055em] sm:text-5xl">Plan & billing</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
            Review your plan, credits, renewal details, invoices and payment settings.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={loadBilling} disabled={loading}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-300/60 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="mt-7 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <GlassCard className="p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">
                Current plan
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-4xl font-black tracking-[-.055em]">{definition.name}</h2>
                {loading ? (
                  <LoaderCircle size={18} className="animate-spin text-[var(--text-muted)]" />
                ) : hasPaidSubscription ? (
                  billing?.cancelAtPeriodEnd ? (
                    <StatusPill tone="warning">Cancels at period end</StatusPill>
                  ) : (
                    <StatusPill tone={statusTone(String(billing?.status || "active"))}>
                      {formatStatus(String(billing?.status || "active"))}
                    </StatusPill>
                  )
                ) : definition.id === "free" ? (
                  <StatusPill tone="neutral">Free</StatusPill>
                ) : (
                  <StatusPill tone="info">Access enabled</StatusPill>
                )}
              </div>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
                {definition.description}
              </p>
            </div>
            <CreditPill credits={credits.available} />
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Metric label="Monthly balance" value={credits.monthly} />
            <Metric label="Purchased" value={credits.purchased} />
            <Metric label="Reserved now" value={credits.reserved} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <BillingDetail
              label="Subscription started"
              value={hasPaidSubscription ? formatDate(billing?.subscriptionStartedAt || null) : "Not applicable"}
            />
            <BillingDetail
              label="Current period starts"
              value={hasPaidSubscription ? formatDate(billing?.currentPeriodStart || null) : "Not applicable"}
            />
            <BillingDetail
              label="Current period ends"
              value={hasPaidSubscription ? formatDate(billing?.currentPeriodEnd || null) : "Not applicable"}
            />
            <BillingDetail
              label={billing?.autoRenewal ? "Next renewal" : "Access expiry"}
              value={
                hasPaidSubscription
                  ? billing?.autoRenewal
                    ? formatDate(billing.nextRenewalAt)
                    : formatDate(billing?.accessEndsAt || billing?.currentPeriodEnd || null)
                  : "Not applicable"
              }
            />
            <BillingDetail
              label="Auto-renewal"
              value={hasPaidSubscription ? (billing?.autoRenewal ? "On" : "Off") : "Not applicable"}
              tone={hasPaidSubscription ? (billing?.autoRenewal ? "success" : "warning") : "neutral"}
            />
            <BillingDetail
              label="Plan price"
              value={formatPlanPrice(billing?.amount, billing?.currency, definition.monthlyPriceUsd)}
            />
            <BillingDetail
              label="Subscription status"
              value={hasPaidSubscription ? formatStatus(String(billing?.status || "active")) : "Free"}
              tone={
                hasPaidSubscription && ["active", "trialing"].includes(String(billing?.status || "").toLowerCase())
                  ? "success"
                  : hasPaidSubscription && ["past_due", "unpaid", "incomplete"].includes(String(billing?.status || "").toLowerCase())
                    ? "warning"
                    : "neutral"
              }
            />
            {billing?.canceledAt && (
              <BillingDetail
                label="Cancellation recorded"
                value={formatDate(billing.canceledAt)}
                tone="warning"
              />
            )}
          </div>

          <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <CalendarDays size={19} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-muted)]">
                    Subscription schedule
                  </p>
                  <p className="mt-1 text-sm font-black">{loading ? "Loading billing status…" : billingLine}</p>
                  {!loading && !hasPaidSubscription && definition.id !== "free" && (
                    <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-muted)]">
                      This is currently test or manually assigned access. Manage Billing appears after a subscription is completed through Stripe Checkout.
                    </p>
                  )}
                  {billing?.cancelAtPeriodEnd && (
                    <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
                      Your paid access remains active until the end of the current billing period.
                    </p>
                  )}
                </div>
              </div>
              {billing?.canManage ? (
                <Button type="button" onClick={openPortal} disabled={openingPortal}>
                  {openingPortal ? <LoaderCircle size={16} className="animate-spin" /> : <Settings2 size={16} />}
                  Manage billing
                </Button>
              ) : (
                <ButtonLink href="/pricing">
                  View subscription plans <ExternalLink size={15} />
                </ButtonLink>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/credits#buy-credits" variant="secondary">
              <PlusCircle size={15} />
              Buy or manage credits
            </ButtonLink>
          </div>
        </GlassCard>

        <div className="grid gap-4">
          <GlassCard className="p-7">
            <ReceiptText size={22} className="text-[var(--accent-strong)]" />
            <h2 className="mt-5 text-xl font-black">Subscription management</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">
              Use the secure Stripe billing portal to update payment details, view invoices, change an available plan or cancel a subscription.
              It opens in a new tab, so this Billing page stays available and refreshes automatically when you return.
            </p>
            {billing?.canManage ? (
              <Button type="button" variant="secondary" className="mt-6 w-full" onClick={openPortal} disabled={openingPortal}>
                {openingPortal ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />}
                Open secure billing portal
              </Button>
            ) : (
              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--text-muted)]">
                No Stripe billing account is connected yet. Complete a Starter or Pro subscription through the Pricing page to enable invoices, payment-method updates, plan switching and cancellation.
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-7">
            <CreditCard size={22} className="text-[var(--accent-strong)]" />
            <h2 className="mt-5 text-xl font-black">How billing works</h2>
            <ul className="mt-5 space-y-4">
              {[
                "Subscription payments and expert project quotes remain separate.",
                "Credits are reserved before generation, committed after success and released after failure.",
                "Viewing saved work never consumes credits.",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/contact" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[var(--accent-strong)]">
              Billing support <Sparkles size={15} />
            </Link>
          </GlassCard>
        </div>
      </div>
    </AccountLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[.62rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString("en-US")}</p>
    </div>
  );
}


function BillingDetail({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-300"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-300"
        : "text-[var(--text-primary)]";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[.62rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-sm font-black ${valueClass}`}>{value}</p>
    </div>
  );
}
