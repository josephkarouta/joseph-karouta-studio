"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, ExternalLink, Eye, FileText, LoaderCircle, Mail, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button, GlassCard, StatusPill } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";

type Application = Record<string, any>;

type Filters = {
  studios: string[];
  statuses: string[];
  availability: string[];
};

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("en-US");
}

function text(value: unknown) {
  return String(value || "").trim();
}

function titleCase(value: unknown) {
  return text(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tone(status: unknown) {
  const value = text(status).toLowerCase();
  if (value === "rejected") return "warning" as const;
  if (value === "shortlisted") return "success" as const;
  return "neutral" as const;
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[.58rem] font-black uppercase tracking-[.13em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-slate-700">{text(value) || "Not added"}</p>
    </div>
  );
}

export default function ExpertApplicationsManager() {
  const [items, setItems] = useState<Application[]>([]);
  const [filters, setFilters] = useState<Filters>({ studios: [], statuses: [], availability: [] });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [studio, setStudio] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");
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
      if (studio !== "all") params.set("studio", studio);
      if (availability !== "all") params.set("availability", availability);
      const response = await fetch(`/api/admin/expert-applications?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Expert applications could not be loaded.");
      setItems(result.items || []);
      setPage(Number(result.page || targetPage));
      setTotal(Number(result.total || 0));
      setTotalPages(Math.max(1, Number(result.totalPages || 1)));
      setFilters({
        studios: Array.isArray(result.filters?.studios) ? result.filters.studios.map(String) : [],
        statuses: Array.isArray(result.filters?.statuses) ? result.filters.statuses.map(String) : [],
        availability: Array.isArray(result.filters?.availability) ? result.filters.availability.map(String) : [],
      });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Expert applications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1); }, [status, studio, availability]);

  useEffect(() => {
    if (initialSearch.current) {
      initialSearch.current = false;
      return;
    }
    const timer = window.setTimeout(() => void load(1), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!items.length) return;
    const applicationId = new URLSearchParams(window.location.search).get("application");
    if (!applicationId) return;
    const match = items.find((item) => String(item.id || "") === applicationId);
    if (match) setSelected(match);
  }, [items]);

  useEffect(() => {
    if (!selected || typeof window === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [selected]);

  async function updateStatus(application: Application, nextStatus: string) {
    setError("");
    const response = await fetch("/api/admin/expert-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: application.id, status: nextStatus }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Application status could not be updated.");
      return;
    }
    await load(page);
  }

  async function deleteApplication(application: Application) {
    if (!application?.id || deletingId) return;
    const confirmed = window.confirm(`Delete ${application.name || "this applicant"}'s Expert Network application? This permanently removes the application and attached CV.`);
    if (!confirmed) return;
    setDeletingId(String(application.id));
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/expert-applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: application.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Application could not be deleted.");
      if (selected?.id === application.id) setSelected(null);
      setNotice("Expert Network application deleted.");
      await load(items.length === 1 && page > 1 ? page - 1 : page);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Application could not be deleted.");
    } finally {
      setDeletingId("");
    }
  }

  async function approveAndInvite() {
    if (!selected?.id || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setActivationUrl("");
    try {
      const response = await fetch("/api/admin/experts/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: selected.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Expert invitation could not be sent.");
      setSelected(null);
      setActivationUrl(String(result.activationUrl || ""));
      const emailAccepted = Boolean(result.emailDelivery?.accepted);
      setNotice(
        result.alreadyActive
          ? "This applicant is already an active Expert."
          : emailAccepted
            ? `Approved and moved to Experts. Invite email accepted for delivery${result.inAppDelivered ? " and an in-app activation notification was added." : "."}`
            : "Approved and moved to Experts. The email provider did not accept the invite, but an in-app activation notification was delivered. You can also copy the activation link below.",
      );
      await load(items.length === 1 && page > 1 ? page - 1 : page);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Expert invitation could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const statusOptions = [
    { value: "open", label: "Open applications" },
    { value: "all", label: "All applications" },
    ...filters.statuses.map((value) => ({ value, label: titleCase(value) })),
  ];
  const studioOptions = [{ value: "all", label: "All Studios" }, ...filters.studios.map((value) => ({ value, label: value }))];
  const availabilityOptions = [{ value: "all", label: "All availability" }, ...filters.availability.map((value) => ({ value, label: titleCase(value) }))];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Talent operations</p>
          <h2 className="mt-2 text-4xl font-black tracking-[-.055em]">Expert Network applications</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500">Review incoming candidates. Approved applicants automatically leave this queue and move to Experts.</p>
        </div>
        <Button variant="secondary" onClick={() => void load(page)}><RefreshCw size={15}/>Refresh</Button>
      </div>

      {notice && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16}/>{notice}</span>
          {activationUrl && (
            <button type="button" className="rounded-full border border-emerald-300 bg-white px-3 py-2 text-xs font-black" onClick={() => void navigator.clipboard.writeText(activationUrl)}>Copy activation link</button>
          )}
        </div>
      )}

      <GlassCard className="mt-6 overflow-hidden border-violet-100 bg-white">
        <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
          <div className="flex min-h-10 items-center gap-3 rounded-2xl border border-slate-200 px-3">
            <Search size={16} className="text-violet-600"/>
            <input className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Search name, email, location or message" value={query} onChange={(event) => setQuery(event.target.value)}/>
          </div>
          <HeyySelect value={status} tone="admin" ariaLabel="Application status filter" options={statusOptions} onChange={setStatus}/>
          <HeyySelect value={studio} tone="admin" ariaLabel="Application Studio filter" options={studioOptions} onChange={setStudio}/>
          <HeyySelect value={availability} tone="admin" ariaLabel="Application availability filter" options={availabilityOptions} onChange={setAvailability}/>
        </div>

        {error && <p className="border-b border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">{error}</p>}
        {loading ? (
          <div className="grid place-items-center p-16"><LoaderCircle className="animate-spin text-violet-600"/></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center"><FileText className="mx-auto text-violet-300"/><p className="mt-3 text-sm font-black text-slate-600">No applications match these filters.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((application) => (
              <article key={application.id} className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={tone(application.status)}>{titleCase(application.status)}</StatusPill>
                    <p className="text-base font-black">{application.name || "Applicant"}</p>
                  </div>
                  <p className="mt-2 text-sm font-black text-violet-600">{application.position_title || "Role unavailable"}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{application.email}{application.location ? ` · ${application.location}` : ""}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[.65rem] font-bold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">Submitted {date(application.created_at)}</span>
                    {application.availability && <span className="rounded-full bg-slate-100 px-2.5 py-1">{titleCase(application.availability)}</span>}
                    {application.years_experience !== null && application.years_experience !== undefined && <span className="rounded-full bg-slate-100 px-2.5 py-1">{application.years_experience} yrs experience</span>}
                    {application.source && <span className="rounded-full bg-slate-100 px-2.5 py-1">Source: {titleCase(application.source)}</span>}
                  </div>
                  {application.message && <p className="mt-3 line-clamp-2 max-w-3xl rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">{application.message}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => { setSelected(application); setActivationUrl(""); }} className="inline-flex h-9 items-center gap-2 rounded-full border border-violet-100 px-3 text-xs font-black text-violet-600 hover:bg-violet-50"><Eye size={14}/>Review</button>
                  {application.resume_url && <a href={`/api/admin/careers/resume?applicationId=${encodeURIComponent(String(application.id))}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border border-violet-100 px-3 text-xs font-black text-violet-600 hover:bg-violet-50"><Download size={14}/>CV</a>}
                  <div className="min-w-[150px]"><HeyySelect value={application.status || "new"} tone="admin" ariaLabel="Application status" options={filters.statuses.map((value) => ({ value, label: titleCase(value) }))} onChange={(value) => void updateStatus(application, value)} triggerClassName="!min-h-9 !rounded-full !px-3 !py-1.5 !text-xs"/></div>
                  <button type="button" onClick={() => void deleteApplication(application)} disabled={deletingId === String(application.id)} className="grid h-9 w-9 place-items-center rounded-full border border-red-100 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50" aria-label={`Delete ${application.name || "application"}`}>{deletingId === String(application.id) ? <LoaderCircle size={14} className="animate-spin"/> : <Trash2 size={14}/>}</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
            <p className="text-xs font-bold text-slate-400">Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, total)} of {total}</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>Previous</Button>
              <span className="px-2 text-xs font-black text-slate-500">Page {page} of {totalPages}</span>
              <Button variant="secondary" disabled={loading || page >= totalPages} onClick={() => void load(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </GlassCard>

      {selected && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[999] flex h-[100dvh] w-screen items-stretch justify-center overflow-hidden overscroll-none bg-slate-950/45 backdrop-blur-sm sm:items-center sm:p-4">
          <GlassCard className="flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden !rounded-none bg-white !p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:!rounded-[var(--radius-card)]">
            <div className="z-20 flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-4 pb-4 pt-4 sm:px-8 sm:pb-5 sm:pt-7">
              <div className="min-w-0">
                <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Expert Network application</p>
                <div className="mt-2 flex flex-wrap items-center gap-2"><h3 className="break-words text-3xl font-black tracking-[-.05em]">{selected.name || "Applicant"}</h3><StatusPill tone={tone(selected.status)}>{titleCase(selected.status)}</StatusPill></div>
                <p className="mt-2 break-words text-sm font-black text-violet-600">{selected.position_title || "Role unavailable"}</p>
              </div>
              <button onClick={() => setSelected(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white hover:bg-slate-50" aria-label="Close"><X size={17}/></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 touch-pan-y sm:px-8 sm:pb-8 sm:pt-6" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Role" value={selected.position_title}/><Detail label="Studio" value={selected.position_department}/>
                <Detail label="Applicant" value={selected.name}/><Detail label="Email" value={selected.email}/>
                <Detail label="Current location" value={selected.location}/><Detail label="Time zone" value={selected.timezone}/>
                <Detail label="Experience" value={selected.years_experience !== null && selected.years_experience !== undefined ? `${selected.years_experience} years` : "Not added"}/><Detail label="Availability" value={titleCase(selected.availability)}/>
                <Detail label="Specialties" value={Array.isArray(selected.specialties) ? selected.specialties.join(", ") : selected.specialties}/><Detail label="Software / tools" value={Array.isArray(selected.software_tools) ? selected.software_tools.join(", ") : selected.software_tools}/>
                <Detail label="Languages" value={Array.isArray(selected.languages) ? selected.languages.join(", ") : selected.languages}/><Detail label="Submitted" value={date(selected.created_at)}/>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-[.6rem] font-black uppercase tracking-[.14em] text-slate-400">Candidate message</p><p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700">{selected.message || "No message provided."}</p></div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => void approveAndInvite()} disabled={busy}>{busy ? <LoaderCircle size={15} className="animate-spin"/> : <Mail size={15}/>}Approve & invite Expert</Button>
                {selected.resume_url && <a href={`/api/admin/careers/resume?applicationId=${encodeURIComponent(String(selected.id))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-black text-white hover:bg-slate-800"><Download size={14}/>Download CV</a>}
                {selected.portfolio_url && <a href={String(selected.portfolio_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-100 px-4 text-xs font-black text-violet-600 hover:bg-violet-50">Portfolio <ExternalLink size={14}/></a>}
                {selected.linkedin_url && <a href={String(selected.linkedin_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-100 px-4 text-xs font-black text-violet-600 hover:bg-violet-50">LinkedIn <ExternalLink size={14}/></a>}
                <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
                <button type="button" onClick={() => void deleteApplication(selected)} disabled={deletingId === String(selected.id)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-100 px-4 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50">{deletingId === String(selected.id) ? <LoaderCircle size={14} className="animate-spin"/> : <Trash2 size={14}/>}Delete application</button>
              </div>
            </div>
          </GlassCard>
        </div>,
        document.body,
      )}
    </>
  );
}
