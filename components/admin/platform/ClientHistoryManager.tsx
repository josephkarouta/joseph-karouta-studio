"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Download,
  FileText,
  Layers3,
  Search,
  UserRoundSearch,
} from "lucide-react";
import HeyySelect from "@/components/ui/heyy-select";

export type AdminClientActivity = {
  type: "project" | "request" | "quote" | "production" | "payment";
  title: string;
  detail: string;
  createdAt: string | null;
  href: string | null;
};

export type AdminClientHistory = {
  id: string;
  name: string;
  email: string;
  plan: string;
  subscriptionStatus: string;
  availableCredits: number;
  projectCount: number;
  requestCount: number;
  quoteCount: number;
  productionCount: number;
  paidRevenue: number;
  outstandingQuoteValue: number;
  joinedAt: string | null;
  lastActivityAt: string | null;
  activities: AdminClientActivity[];
};

const PLAN_OPTIONS = [
  { value: "all", label: "All plans" },
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
];

export default function ClientHistoryManager({ clients }: { clients: AdminClientHistory[] }) {
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesPlan = plan === "all" || client.plan === plan;
      const matchesSearch =
        !needle ||
        `${client.name} ${client.email}`.toLowerCase().includes(needle) ||
        client.activities.some((item) => `${item.title} ${item.detail}`.toLowerCase().includes(needle));
      return matchesPlan && matchesSearch;
    });
  }, [clients, plan, query]);

  const totals = useMemo(() => ({
    clients: clients.length,
    paidRevenue: clients.reduce((sum, item) => sum + item.paidRevenue, 0),
    outstanding: clients.reduce((sum, item) => sum + item.outstandingQuoteValue, 0),
    production: clients.reduce((sum, item) => sum + item.productionCount, 0),
  }), [clients]);

  function downloadClient(client: AdminClientHistory) {
    const rows = [
      ["Client", client.name],
      ["Email", client.email],
      ["Plan", client.plan.toUpperCase()],
      ["Subscription status", client.subscriptionStatus],
      ["Available credits", String(client.availableCredits)],
      ["Projects", String(client.projectCount)],
      ["Production requests", String(client.requestCount)],
      ["Quotes", String(client.quoteCount)],
      ["Production jobs", String(client.productionCount)],
      ["Paid production revenue", money(client.paidRevenue)],
      ["Outstanding quote value", money(client.outstandingQuoteValue)],
      [],
      ["Activity date", "Type", "Title", "Details"],
      ...client.activities.map((item) => [
        item.createdAt ? new Date(item.createdAt).toLocaleString("en-US") : "",
        item.type,
        item.title,
        item.detail,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `heyy-studio-client-${client.email.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Client operations</p>
          <h2 className="mt-2 text-4xl font-black tracking-[-.055em]">Client history</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
            One view of each client’s account, projects, expert-production requests, quotes, payments and production history.
          </p>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UserRoundSearch} label="Registered clients" value={String(totals.clients)} />
        <Metric icon={CircleDollarSign} label="Paid production" value={money(totals.paidRevenue)} />
        <Metric icon={FileText} label="Outstanding quotes" value={money(totals.outstanding)} />
        <Metric icon={Layers3} label="Production jobs" value={String(totals.production)} />
      </section>

      <div className="mt-6 rounded-3xl border border-violet-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <label className="flex min-w-[260px] flex-1 items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5">
            <Search size={16} className="text-violet-600" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client, email, project or service"
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="min-w-[180px]">
            <HeyySelect value={plan} options={PLAN_OPTIONS} onChange={setPlan} ariaLabel="Filter clients by plan" tone="admin" />
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-2 text-xs font-black text-violet-700">{filtered.length} clients</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((client) => {
            const open = expanded === client.id;
            return (
              <article key={client.id} className="p-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(100px,.45fr))_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black">{client.name}</h3>
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[.62rem] font-black uppercase tracking-[.08em] text-violet-700">{client.plan}</span>
                      {client.subscriptionStatus !== "active" && client.subscriptionStatus !== "free" && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[.62rem] font-black uppercase tracking-[.08em] text-amber-700">{client.subscriptionStatus.replaceAll("_", " ")}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">{client.email}</p>
                    <p className="mt-2 text-[.68rem] font-bold text-slate-400">Last activity {date(client.lastActivityAt)}</p>
                  </div>
                  <Mini label="Projects" value={client.projectCount} />
                  <Mini label="Requests" value={client.requestCount} />
                  <Mini label="Paid revenue" value={money(client.paidRevenue)} />
                  <Mini label="Credits" value={client.availableCredits} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => downloadClient(client)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700" title="Download client summary" aria-label="Download client summary"><Download size={16}/></button>
                    <button onClick={() => setExpanded(open ? null : client.id)} className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-black text-white hover:bg-violet-700">
                      History {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-5 rounded-3xl bg-slate-50 p-4 sm:p-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Summary label="Quotes" value={String(client.quoteCount)} />
                      <Summary label="Production jobs" value={String(client.productionCount)} />
                      <Summary label="Outstanding quotes" value={money(client.outstandingQuoteValue)} />
                    </div>
                    <div className="mt-5 grid gap-2">
                      {client.activities.length ? client.activities.map((item, index) => (
                        item.href ? (
                          <Link key={`${item.type}-${index}`} href={item.href} className="group grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-violet-300 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center">
                            <Activity item={item}/><ArrowRight size={15} className="text-slate-300 group-hover:text-violet-600"/>
                          </Link>
                        ) : (
                          <div key={`${item.type}-${index}`} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[110px_minmax(0,1fr)] sm:items-center"><Activity item={item}/></div>
                        )
                      )) : <p className="py-5 text-center text-sm font-semibold text-slate-400">No client activity recorded yet.</p>}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {!filtered.length && <p className="p-10 text-center text-sm font-semibold text-slate-400">No clients match these filters.</p>}
        </div>
      </div>
    </>
  );
}

function Activity({ item }: { item: AdminClientActivity }) {
  const Icon = item.type === "payment" ? CircleDollarSign : item.type === "production" ? Layers3 : item.type === "quote" ? FileText : item.type === "request" ? BriefcaseBusiness : UserRoundSearch;
  return <><span className="text-[.65rem] font-black uppercase tracking-[.08em] text-slate-400">{date(item.createdAt)}</span><div className="min-w-0"><div className="flex items-center gap-2"><Icon size={14} className="shrink-0 text-violet-600"/><strong className="truncate text-sm">{item.title}</strong></div><p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.detail}</p></div></>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof UserRoundSearch; label: string; value: string }) { return <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm"><Icon size={18} className="text-violet-600"/><p className="mt-5 text-[.62rem] font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-black tracking-[-.04em]">{value}</p></div>; }
function Mini({ label, value }: { label: string; value: string | number }) { return <div><p className="text-[.58rem] font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><p className="text-[.58rem] font-black uppercase tracking-[.1em] text-slate-400">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0); }
function date(value: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }); }
function csvCell(value: unknown) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
