"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Mail, RefreshCw, Search, Trash2, UserRoundCheck } from "lucide-react";
import { Button, GlassCard, StatusPill } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";

type Expert = Record<string, any>;

type Filters = { statuses: string[]; availability: string[]; studios: string[] };

function studioLabel(value: unknown) {
  const studio = String(value || "");
  if (studio === "brand_studio") return "Brand Studio";
  if (studio === "marketing_studio") return "Marketing Studio";
  if (studio === "architecture_studio") return "Architecture Studio";
  if (studio === "interior_studio") return "Interior Studio";
  return studio || "Heyy Studio";
}
function titleCase(value: unknown) { return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function date(value: unknown) { if (!value) return "—"; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("en-US"); }

export default function ExpertManager() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [filters, setFilters] = useState<Filters>({ statuses: [], availability: [], studios: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [studio, setStudio] = useState("all");
  const [busy, setBusy] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [notice, setNotice] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const initialSearch = useRef(true);

  async function load(targetPage = page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(Math.max(1, targetPage)), pageSize: "10" });
      if (query.trim()) params.set("q", query.trim());
      if (status !== "all") params.set("status", status);
      if (availability !== "all") params.set("availability", availability);
      if (studio !== "all") params.set("studio", studio);
      const response = await fetch(`/api/admin/experts?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Experts could not be loaded.");
      setExperts(result.experts || []);
      setPage(Number(result.page || targetPage));
      setTotal(Number(result.total || 0));
      setTotalPages(Math.max(1, Number(result.totalPages || 1)));
      setFilters({
        statuses: Array.isArray(result.filters?.statuses) ? result.filters.statuses.map(String) : [],
        availability: Array.isArray(result.filters?.availability) ? result.filters.availability.map(String) : [],
        studios: Array.isArray(result.filters?.studios) ? result.filters.studios.map(String) : [],
      });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Experts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1); }, [status, availability, studio]);
  useEffect(() => {
    if (initialSearch.current) { initialSearch.current = false; return; }
    const timer = window.setTimeout(() => void load(1), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function patch(expert: Expert, body: Record<string, unknown>) {
    setBusy(String(expert.id)); setError("");
    try {
      const response = await fetch("/api/admin/experts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: expert.id, ...body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Expert could not be updated.");
      await load(page);
    } catch (value) { setError(value instanceof Error ? value.message : "Expert could not be updated."); }
    finally { setBusy(""); }
  }

  async function deleteExpert(expert: Expert) {
    if (!expert?.id || busy) return;
    const confirmed = window.confirm(`Delete ${expert.full_name || "this Expert"} from the Expert Network? Experts with project history cannot be permanently deleted and should be set to Inactive instead.`);
    if (!confirmed) return;
    setBusy(String(expert.id)); setError(""); setNotice(""); setActivationUrl("");
    try {
      const response = await fetch("/api/admin/experts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: expert.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Expert could not be deleted.");
      setNotice("Expert profile deleted.");
      await load(experts.length === 1 && page > 1 ? page - 1 : page);
    } catch (value) { setError(value instanceof Error ? value.message : "Expert could not be deleted."); }
    finally { setBusy(""); }
  }

  async function resend(expert: Expert) {
    setBusy(String(expert.id)); setError(""); setNotice(""); setActivationUrl("");
    try {
      const response = await fetch("/api/admin/experts/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: expert.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invitation could not be sent.");
      setActivationUrl(String(result.activationUrl || ""));
      setNotice(
        result.emailDelivery?.accepted
          ? `Invitation email accepted for delivery to ${expert.email}${result.inAppDelivered ? " and an in-app activation notification was added." : "."}`
          : `The email provider did not accept the invite to ${expert.email}, but an in-app activation notification was delivered. You can also copy the activation link.`,
      );
      await load(page);
    } catch (value) { setError(value instanceof Error ? value.message : "Invitation could not be sent."); }
    finally { setBusy(""); }
  }

  return <>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Talent operations</p><h2 className="mt-2 text-4xl font-black tracking-[-.055em]">Experts</h2><p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500">Approved Expert Network members, activation state and availability.</p></div>
      <Button variant="secondary" onClick={() => void load(page)}><RefreshCw size={15}/>Refresh</Button>
    </div>

    {notice && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><span className="inline-flex items-center gap-2"><CheckCircle2 size={16}/>{notice}</span>{activationUrl && <button type="button" className="rounded-full border border-emerald-300 bg-white px-3 py-2 text-xs font-black" onClick={() => void navigator.clipboard.writeText(activationUrl)}>Copy activation link</button>}</div>}

    <GlassCard className="mt-6 overflow-hidden border-violet-100 bg-white">
      <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[minmax(0,1fr)_170px_170px_170px]">
        <div className="flex min-h-10 items-center gap-3 rounded-2xl border border-slate-200 px-3"><Search size={16} className="text-violet-600"/><input className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Search name, email, role or location" value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        <HeyySelect value={studio} tone="admin" ariaLabel="Expert Studio filter" options={[{ value: "all", label: "All Studios" }, ...filters.studios.map((value) => ({ value, label: studioLabel(value) }))]} onChange={setStudio}/>
        <HeyySelect value={availability} tone="admin" ariaLabel="Expert availability filter" options={[{ value: "all", label: "All availability" }, ...filters.availability.map((value) => ({ value, label: titleCase(value) }))]} onChange={setAvailability}/>
        <HeyySelect value={status} tone="admin" ariaLabel="Expert status filter" options={[{ value: "all", label: "All statuses" }, ...filters.statuses.map((value) => ({ value, label: titleCase(value) }))]} onChange={setStatus}/>
      </div>
      {error && <p className="border-b border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">{error}</p>}
      {loading ? <p className="p-12 text-center text-sm font-bold text-slate-400">Loading experts…</p> : experts.length === 0 ? <p className="p-12 text-center text-sm font-bold text-slate-400">No Experts match these filters.</p> : <div className="divide-y divide-slate-100">{experts.map((expert) => <div key={expert.id} className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><UserRoundCheck size={17} className="text-violet-600"/><p className="font-black">{expert.full_name}</p><StatusPill tone={expert.status === "active" ? "success" : "neutral"}>{titleCase(expert.status)}</StatusPill></div><p className="mt-1 text-xs font-black text-violet-600">{expert.role_title || studioLabel(expert.studio)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{expert.email}{expert.location ? ` · ${expert.location}` : ""}</p><p className="mt-2 text-[.65rem] font-bold text-slate-400">{studioLabel(expert.studio)} · invited {date(expert.invited_at)}{expert.activated_at ? ` · activated ${date(expert.activated_at)}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><div className="min-w-[145px]"><HeyySelect value={expert.availability || "available"} tone="admin" ariaLabel="Expert availability" options={filters.availability.map((value) => ({ value, label: titleCase(value) }))} onChange={(value) => void patch(expert, { availability: value })} disabled={busy === String(expert.id)} triggerClassName="!min-h-9 !rounded-full !px-3 !py-1.5 !text-xs"/></div><div className="min-w-[130px]"><HeyySelect value={expert.status || "invited"} tone="admin" ariaLabel="Expert status" options={filters.statuses.map((value) => ({ value, label: titleCase(value) }))} onChange={(value) => void patch(expert, { status: value })} disabled={busy === String(expert.id)} triggerClassName="!min-h-9 !rounded-full !px-3 !py-1.5 !text-xs"/></div>{expert.status !== "active" && <button type="button" onClick={() => void resend(expert)} disabled={busy === String(expert.id)} className="inline-flex h-9 items-center gap-2 rounded-full border border-violet-100 px-3 text-xs font-black text-violet-600 hover:bg-violet-50 disabled:opacity-50"><Mail size={14}/>Resend invite</button>}<button type="button" onClick={() => void deleteExpert(expert)} disabled={busy === String(expert.id)} className="grid h-9 w-9 place-items-center rounded-full border border-red-100 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50" aria-label={`Delete ${expert.full_name || "Expert"}`}>{busy === String(expert.id) ? <LoaderCircle size={14} className="animate-spin"/> : <Trash2 size={14}/>}</button></div></div>)}</div>}
      {total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4"><p className="text-xs font-bold text-slate-400">Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, total)} of {total}</p><div className="flex items-center gap-2"><Button variant="secondary" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>Previous</Button><span className="px-2 text-xs font-black text-slate-500">Page {page} of {totalPages}</span><Button variant="secondary" disabled={loading || page >= totalPages} onClick={() => void load(page + 1)}>Next</Button></div></div>}
    </GlassCard>
  </>;
}
