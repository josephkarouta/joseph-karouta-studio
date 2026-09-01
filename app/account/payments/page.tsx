"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, LoaderCircle, ReceiptText, RefreshCw } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/components/auth-provider";
import { Button, Eyebrow, GlassCard, StatusPill } from "@/components/ui/heyy";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Payment = {
  id: string;
  payment_type: "subscription" | "credit_pack" | "production" | "other";
  description: string;
  amount_total: number;
  tax_amount: number;
  currency: string;
  status: string;
  invoice_number: string;
  paid_at: string;
  billing_country_code?: string | null;
};

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export default function PaymentHistoryPage() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const [items, setItems] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (sync = false) => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch(`/api/account/payments?page=${page}${sync ? "&sync=1" : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load payment history.");
      setItems(result.payments || []);
      setTotalPages(Math.max(1, Number(result.totalPages || 1)));
      setTotal(Number(result.total || 0));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to load payment history.");
    } finally {
      setLoading(false);
    }
  }, [page, userId]);

  useEffect(() => void load(false), [load]);

  async function downloadInvoice(payment: Payment) {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const response = await fetch(`/api/account/payments/${payment.id}/invoice`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      setError("Invoice could not be downloaded.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Heyy-Studio-${payment.invoice_number}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AccountLayout>
      <Eyebrow>Payments</Eyebrow>
      <h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-5xl">Payment history</h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
        Review subscriptions, credit purchases and expert-production payments. Heyy Studio invoices stay available here for your records.
      </p>

      {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}

      <GlassCard className="mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-6">
          <div className="flex items-center gap-3">
            <ReceiptText size={20} className="text-[var(--accent-strong)]" />
            <div>
              <h2 className="text-xl font-black">Purchases & invoices</h2>
              <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">10 payments per page.</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load(true)} disabled={loading}>
            {loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
        </div>

        {loading ? (
          <div className="grid place-items-center p-16"><LoaderCircle className="animate-spin text-[var(--accent-strong)]" /></div>
        ) : items.length === 0 ? (
          <p className="p-10 text-sm font-semibold text-[var(--text-muted)]">No Heyy Studio payment records yet.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {items.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black">{payment.description}</p>
                    <StatusPill tone="success">Paid</StatusPill>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                    {new Date(payment.paid_at).toLocaleString("en-AU")} · {payment.invoice_number}
                  </p>
                  <p className="mt-1 text-[.68rem] font-black uppercase tracking-[.11em] text-[var(--text-muted)]">{payment.payment_type.replaceAll("_", " ")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-base font-black">{money(payment.amount_total, payment.currency)}</p>
                    {payment.tax_amount > 0 && (
                      <p className="mt-1 text-[.68rem] font-black uppercase tracking-[.09em] text-[var(--text-muted)]">
                        {String(payment.billing_country_code || "").toUpperCase() === "AU" ? "GST" : "Tax"} {money(payment.tax_amount, payment.currency)}
                      </p>
                    )}
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void downloadInvoice(payment)}>
                    <Download size={14} /> Download invoice
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
            <p className="text-xs font-bold text-[var(--text-muted)]">Page {page} of {totalPages} · {total} payment{total === 1 ? "" : "s"}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] disabled:opacity-35" aria-label="Previous payment page"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] disabled:opacity-35" aria-label="Next payment page"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </GlassCard>
    </AccountLayout>
  );
}
