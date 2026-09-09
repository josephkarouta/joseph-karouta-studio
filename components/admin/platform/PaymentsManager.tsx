"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, CircleDollarSign, Download, ReceiptText, Search, WalletCards } from "lucide-react";
import HeyySelect from "@/components/ui/heyy-select";

export type AdminClientPayment = {
  id: string;
  invoiceNumber: string;
  description: string;
  paymentType: string;
  amountTotal: number;
  taxAmount: number;
  currency: string;
  status: string;
  billingName: string | null;
  billingEmail: string | null;
  paidAt: string | null;
  relatedId: string | null;
};

export type AdminExpertPayout = {
  id: string;
  jobId: string;
  projectName: string;
  studio: string | null;
  expertName: string;
  expertEmail: string | null;
  agreedFeeCents: number;
  currency: string;
  status: string;
  paidAt: string | null;
  eligibleAt: string | null;
  paymentReference: string | null;
  clientApproved: boolean;
};

const PAGE_SIZE = 12;

export default function PaymentsManager({ payments, payouts }: { payments: AdminClientPayment[]; payouts: AdminExpertPayout[] }) {
  const [view, setView] = useState<"clients" | "experts">("clients");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);

  const clientRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((row) => {
      if (status !== "all" && row.status.toLowerCase() !== status) return false;
      if (type !== "all" && row.paymentType !== type) return false;
      if (!q) return true;
      return [row.invoiceNumber, row.description, row.billingName, row.billingEmail, row.paymentType].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [payments, search, status, type]);

  const payoutRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payouts.filter((row) => {
      if (status !== "all" && row.status.toLowerCase() !== status) return false;
      if (!q) return true;
      return [row.projectName, row.expertName, row.expertEmail, row.studio, row.paymentReference].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [payouts, search, status]);

  const rows = view === "clients" ? clientRows : payoutRows;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function switchView(next: "clients" | "experts") {
    setView(next);
    setStatus("all");
    setType("all");
    setPage(1);
  }

  function money(cents: number, currency: string) {
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents || 0) / 100); }
    catch { return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`; }
  }

  function groupedTotal<T>(items: T[], cents: (item: T) => number, currency: (item: T) => string) {
    const totals = new Map<string, number>();
    items.forEach((item) => totals.set(currency(item), (totals.get(currency(item)) || 0) + cents(item)));
    return Array.from(totals.entries()).map(([code, value]) => money(value, code)).join(" · ") || "—";
  }

  const paidClient = payments.filter((row) => ["paid", "succeeded", "completed"].includes(row.status.toLowerCase()));
  const readyPayouts = payouts.filter((row) => ["eligible", "pending", "held"].includes(row.status.toLowerCase()));

  return (
    <div>
      <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Finance operations</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-4xl font-black tracking-[-.05em]">Payments & payouts</h2><p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Client receipts and invoices live beside the manual Expert payout ledger, without exposing Heyy Studio margin to Experts.</p></div>
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Summary icon={ReceiptText} label="Client payments received" value={groupedTotal(paidClient, (row) => row.amountTotal, (row) => row.currency)} detail={`${paidClient.length} recorded payment${paidClient.length === 1 ? "" : "s"}`} />
        <Summary icon={CircleDollarSign} label="Tax recorded" value={groupedTotal(paidClient, (row) => row.taxAmount, (row) => row.currency)} detail="From client payment records" />
        <Summary icon={Banknote} label="Expert fees" value={groupedTotal(payouts, (row) => row.agreedFeeCents, (row) => row.currency)} detail={`${payouts.length} production assignment${payouts.length === 1 ? "" : "s"}`} />
        <Summary icon={WalletCards} label="To reconcile / pay" value={groupedTotal(readyPayouts, (row) => row.agreedFeeCents, (row) => row.currency)} detail={`${readyPayouts.length} not marked paid`} />
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => switchView("clients")} className={`rounded-2xl px-4 py-2 text-xs font-black transition ${view === "clients" ? "bg-violet-600 text-white shadow" : "bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-700"}`}>Client payments & invoices</button>
            <button type="button" onClick={() => switchView("experts")} className={`rounded-2xl px-4 py-2 text-xs font-black transition ${view === "experts" ? "bg-violet-600 text-white shadow" : "bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-700"}`}>Expert payouts</button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_190px_190px]">
            <label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500"/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-11 w-full rounded-2xl border border-violet-100 pl-10 pr-3 text-sm font-semibold outline-none focus:border-violet-400" placeholder={view === "clients" ? "Search invoice, client or payment…" : "Search Expert, project or reference…"}/></label>
            <HeyySelect tone="admin" value={status} ariaLabel="Payment status" onChange={(value) => { setStatus(value); setPage(1); }} options={view === "clients" ? [{value:"all",label:"All statuses"},{value:"paid",label:"Paid"},{value:"succeeded",label:"Succeeded"},{value:"completed",label:"Completed"}] : [{value:"all",label:"All payout statuses"},{value:"pending",label:"Pending"},{value:"eligible",label:"Ready for payout"},{value:"held",label:"On hold"},{value:"paid",label:"Paid"}]} />
            {view === "clients" ? <HeyySelect tone="admin" value={type} ariaLabel="Payment type" onChange={(value) => { setType(value); setPage(1); }} options={[{value:"all",label:"All payment types"},{value:"subscription",label:"Subscriptions"},{value:"credit_pack",label:"Credit packs"},{value:"production",label:"Production"},{value:"other",label:"Other"}]} /> : <div className="hidden lg:block"/>}
          </div>
        </div>

        {view === "clients" ? (
          <div className="divide-y divide-slate-100">
            {(pageRows as AdminClientPayment[]).map((row) => <div key={row.id} className="grid gap-3 p-4 md:grid-cols-[1.3fr_.8fr_.8fr_auto] md:items-center"><div><p className="text-sm font-black text-slate-950">{row.description}</p><p className="mt-1 text-xs font-semibold text-slate-500">{row.billingName || row.billingEmail || "Client"} · {row.invoiceNumber}</p></div><div><p className="text-sm font-black">{money(row.amountTotal,row.currency)}</p><p className="text-[.68rem] font-bold uppercase tracking-wider text-slate-400">Tax {money(row.taxAmount,row.currency)}</p></div><div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[.65rem] font-black uppercase tracking-wider text-emerald-700">{row.status}</span><p className="mt-1 text-xs font-semibold text-slate-400">{formatDate(row.paidAt)}</p></div><a className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-50" href={`/api/admin/payments/${encodeURIComponent(row.id)}/invoice`}><Download size={13}/> Invoice</a></div>)}
            {!pageRows.length && <Empty text="No client payments match these filters."/>}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(pageRows as AdminExpertPayout[]).map((row) => <div key={row.id} className="grid gap-3 p-4 md:grid-cols-[1.3fr_.8fr_.8fr_auto] md:items-center"><div><p className="text-sm font-black text-slate-950">{row.projectName}</p><p className="mt-1 text-xs font-semibold text-slate-500">{row.expertName}{row.expertEmail ? ` · ${row.expertEmail}` : ""}</p></div><div><p className="text-sm font-black">{money(row.agreedFeeCents,row.currency)}</p><p className="text-[.68rem] font-bold uppercase tracking-wider text-slate-400">Total Expert fee</p></div><div><span className={`rounded-full px-2.5 py-1 text-[.65rem] font-black uppercase tracking-wider ${row.status === "paid" ? "bg-emerald-50 text-emerald-700" : row.status === "eligible" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-700"}`}>{row.status === "eligible" ? "Ready for payout" : row.status.replace(/_/g," ")}</span><p className="mt-1 text-xs font-semibold text-slate-400">{row.paidAt ? `Paid ${formatDate(row.paidAt)}` : row.paymentReference || "Manual payout"}</p></div><div className="flex flex-wrap justify-end gap-2">{row.status === "paid" && <a className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-50" href={`/api/admin/expert-payouts/${encodeURIComponent(row.id)}/statement`}><Download size={13}/> Statement</a>}<Link className="inline-flex items-center justify-center rounded-xl border border-violet-200 px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-50" href={`/admin/production/${encodeURIComponent(row.jobId)}?tab=Expert&expertView=payout`}>Open payout →</Link></div></div>)}
            {!pageRows.length && <Empty text="No Expert payouts match these filters."/>}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-500"><span>{rows.length} record{rows.length === 1 ? "" : "s"}</span><div className="flex items-center gap-2"><button disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1,current-1))} className="rounded-xl border px-3 py-2 disabled:opacity-40">Previous</button><span>Page {safePage} of {pageCount}</span><button disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount,current+1))} className="rounded-xl border px-3 py-2 disabled:opacity-40">Next</button></div></div>
      </div>
    </div>
  );
}

function Summary({ icon: Icon, label, value, detail }: { icon: typeof ReceiptText; label: string; value: string; detail: string }) { return <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm"><Icon size={18} className="text-violet-600"/><p className="mt-4 text-[.65rem] font-black uppercase tracking-[.15em] text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm font-bold text-slate-400">{text}</div>; }
function formatDate(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { dateStyle:"medium", timeStyle:"short" }).format(date); }
