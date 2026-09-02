"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ExternalLink, Eye, LoaderCircle, Mail, Paperclip, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button, GlassCard, StatusPill } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";

type Resource = "careers" | "pages" | "help" | "contact" | "applications" | "users" | "generations";
type Row = Record<string, unknown> & {
  id?: string;
  slug?: string;
  status?: string;
  title?: string;
  name?: string;
  email?: string;
  role?: string;
  created_at?: string;
};
type Field = { key: string; label: string; placeholder: string; multiline?: boolean };
type Config = {
  title: string;
  description: string;
  search: string;
  fields?: Field[];
  statuses?: string[];
};
type GenerationFacets = {
  tools: string[];
  providers: string[];
  statuses: string[];
};
type LoadOptions = {
  page?: number;
  query?: string;
  tool?: string;
  provider?: string;
  status?: string;
  date?: string;
};

const configs: Record<Resource, Config> = {
  careers: {
    title: "Career positions",
    description: "Create, edit, publish and close the roles shown on the Careers page.",
    search: "Search positions",
    fields: [
      { key: "title", label: "Position title", placeholder: "Senior Brand Designer" },
      { key: "department", label: "Department", placeholder: "Creative" },
      { key: "location", label: "Location", placeholder: "Remote / Worldwide" },
      { key: "employment_type", label: "Employment type", placeholder: "Contract" },
      { key: "summary", label: "Summary", placeholder: "What this role will own", multiline: true },
      { key: "body", label: "Role details", placeholder: "Add responsibilities, experience and application notes. Use one paragraph per line.", multiline: true },
    ],
    statuses: ["draft", "published", "closed"],
  },
  pages: {
    title: "Public pages",
    description: "Edit public-page headlines, summaries, body content and publication state without rebuilding routes.",
    search: "Search public pages",
    fields: [
      { key: "slug", label: "Slug", placeholder: "new-page" },
      { key: "title", label: "Title", placeholder: "Page title" },
      { key: "eyebrow", label: "Eyebrow", placeholder: "About" },
      { key: "summary", label: "Summary", placeholder: "Short page summary", multiline: true },
      { key: "body", label: "Page body", placeholder: "Use one paragraph per line. Existing structured content remains until this field is saved.", multiline: true },
    ],
    statuses: ["draft", "published", "archived"],
  },
  help: {
    title: "Help center articles",
    description: "Create, edit and publish support content for users.",
    search: "Search help articles",
    fields: [
      { key: "slug", label: "Slug", placeholder: "getting-started" },
      { key: "title", label: "Title", placeholder: "Getting started" },
      { key: "category", label: "Category", placeholder: "Getting started" },
      { key: "summary", label: "Summary", placeholder: "Short answer", multiline: true },
      { key: "body", label: "Article body", placeholder: "Use one paragraph per line.", multiline: true },
    ],
    statuses: ["draft", "published", "archived"],
  },
  contact: {
    title: "Contact submissions",
    description: "Review messages received from the public Contact page.",
    search: "Search messages",
    statuses: ["new", "reviewing", "replied", "closed", "spam"],
  },
  applications: {
    title: "Career applications",
    description: "Review people who applied through Careers.",
    search: "Search applicants",
    statuses: ["new", "reviewing", "shortlisted", "rejected", "hired"],
  },
  users: {
    title: "Users & credit oversight",
    description: "Review account identity, plan and available credit balances.",
    search: "Search users",
  },
  generations: {
    title: "Generation monitoring",
    description: "Trace AI jobs back to the user, project, provider, model, credit reservation and failure details.",
    search: "Search user, email, project, tool or provider",
  },
};

function text(value: unknown) {
  return String(value || "").trim();
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function humanize(value: unknown) {
  return text(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function providerLabel(value: unknown) {
  const provider = text(value).toLowerCase();
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini";
  if (provider === "google") return "Google";
  if (provider === "topaz") return "Topaz";
  if (provider === "fal" || provider === "fal.ai") return "fal.ai";
  return humanize(value) || "Not recorded";
}

function formatDate(value: unknown) {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-US");
}

function formatFileSize(value: unknown) {
  const bytes = numberValue(value);
  if (bytes === null || bytes <= 0) return "Size not recorded";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function contactAttachments(row: Row) {
  const value = row.contact_attachments;
  return Array.isArray(value) ? value.map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {}) : [];
}

function contactReplies(row: Row) {
  const value = row.contact_admin_replies;
  return Array.isArray(value) ? value.map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {}) : [];
}

function formatDuration(value: unknown) {
  const milliseconds = numberValue(value);
  if (milliseconds === null) return "Not recorded";
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatCredits(row: Row) {
  const used = numberValue(row.credits_used);
  const reserved = numberValue(row.credits_reserved);
  const value = used ?? reserved;
  if (value === null) return "Not recorded";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} credit${value === 1 ? "" : "s"}`;
}

function statusTone(status: unknown) {
  const value = text(status).toLowerCase();
  if (["published", "succeeded", "hired", "completed", "paid"].includes(value)) return "success" as const;
  if (["failed", "spam", "cancelled", "rejected"].includes(value)) return "warning" as const;
  return "neutral" as const;
}

function GenerationDetail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[.6rem] font-black uppercase tracking-[.14em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-slate-700">{text(value) || "Not recorded"}</p>
    </div>
  );
}

export default function ResourceManager({ resource }: { resource: Resource }) {
  const config = configs[resource];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [generationFacets, setGenerationFacets] = useState<GenerationFacets>({ tools: [], providers: [], statuses: [] });
  const [toolFilter, setToolFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedGeneration, setSelectedGeneration] = useState<Row | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Row | null>(null);
  const [selectedContact, setSelectedContact] = useState<Row | null>(null);
  const [contactReply, setContactReply] = useState("");
  const [contactReplyStatus, setContactReplyStatus] = useState("");
  const [sendingContactReply, setSendingContactReply] = useState(false);
  const initialGenerationSearch = useRef(true);
  const applicationDeepLinkHandled = useRef(false);
  const contactDeepLinkHandled = useRef(false);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  async function load(options?: LoadOptions) {
    setLoading(true);
    setError("");
    try {
      const targetPage = resource === "generations" ? Math.max(1, options?.page ?? page) : 1;
      const targetQuery = resource === "generations" ? (options?.query ?? query).trim() : "";
      const targetTool = options?.tool ?? toolFilter;
      const targetProvider = options?.provider ?? providerFilter;
      const targetStatus = options?.status ?? statusFilter;
      const targetDate = options?.date ?? dateFilter;
      const params = new URLSearchParams();
      if (resource === "generations") {
        params.set("page", String(targetPage));
        params.set("pageSize", "25");
        if (targetQuery) params.set("q", targetQuery);
        if (targetTool !== "all") params.set("tool", targetTool);
        if (targetProvider !== "all") params.set("provider", targetProvider);
        if (targetStatus !== "all") params.set("status", targetStatus);
        if (targetDate !== "all") params.set("date", targetDate);
      }
      const suffix = params.size ? `?${params.toString()}` : "";
      const response = await fetch(`/api/admin/platform/${resource}${suffix}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load records.");
      setRows(result.items || []);
      if (resource === "generations") {
        setPage(Number(result.page || targetPage));
        setTotal(Number(result.total || 0));
        setTotalPages(Math.max(1, Number(result.totalPages || 1)));
        setGenerationFacets({
          tools: Array.isArray(result.filters?.tools) ? result.filters.tools.map(String) : [],
          providers: Array.isArray(result.filters?.providers) ? result.filters.providers.map(String) : [],
          statuses: Array.isArray(result.filters?.statuses) ? result.filters.statuses.map(String) : [],
        });
      } else {
        setPage(1);
        setTotal(Number((result.items || []).length));
        setTotalPages(1);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initialGenerationSearch.current = true;
    applicationDeepLinkHandled.current = false;
    contactDeepLinkHandled.current = false;
    setPage(1);
    setQuery("");
    setToolFilter("all");
    setProviderFilter("all");
    setStatusFilter("all");
    setDateFilter("all");
    setSelectedGeneration(null);
    setSelectedApplication(null);
    setSelectedContact(null);
    setContactReply("");
    setContactReplyStatus("");
    void load({ page: 1, query: "", tool: "all", provider: "all", status: "all", date: "all" });
  }, [resource]);

  useEffect(() => {
    if (resource !== "applications" || applicationDeepLinkHandled.current || rows.length === 0) return;
    const applicationId = new URLSearchParams(window.location.search).get("application");
    if (!applicationId) {
      applicationDeepLinkHandled.current = true;
      return;
    }
    const matchingApplication = rows.find((row) => String(row.id || "") === applicationId);
    if (matchingApplication) setSelectedApplication(matchingApplication);
    applicationDeepLinkHandled.current = true;
  }, [resource, rows]);

  useEffect(() => {
    if (resource !== "contact" || contactDeepLinkHandled.current || rows.length === 0) return;
    const contactId = new URLSearchParams(window.location.search).get("contact");
    if (!contactId) {
      contactDeepLinkHandled.current = true;
      return;
    }
    const matchingContact = rows.find((row) => String(row.id || "") === contactId);
    if (matchingContact) setSelectedContact(matchingContact);
    contactDeepLinkHandled.current = true;
  }, [resource, rows]);

  useEffect(() => {
    if (resource !== "generations") return;
    if (initialGenerationSearch.current) {
      initialGenerationSearch.current = false;
      return;
    }
    const timer = window.setTimeout(() => { void load({ page: 1, query }); }, 300);
    return () => window.clearTimeout(timer);
  }, [query, resource]);

  const filtered = useMemo(() => {
    if (resource === "generations") return rows;
    const needle = query.toLowerCase();
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [rows, query, resource]);

  function openEditor(row: Row | "new") {
    setEditing(row);
    if (row === "new") {
      setForm({});
      return;
    }
    const next: Record<string, string> = {};
    config.fields?.forEach((field) => {
      const value = row[field.key];
      next[field.key] = value === null || value === undefined ? "" : String(value);
    });
    setForm(next);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const isNew = editing === "new";
      const id = isNew ? undefined : String((editing as Row)?.id || (editing as Row)?.slug || "");
      const response = await fetch(`/api/admin/platform/${resource}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? form : { id, ...form }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save the record.");
      setEditing(null);
      setForm({});
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to save the record.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(row: Row, value: string) {
    const id = String(row.id || row.slug || "");
    const response = await fetch(`/api/admin/platform/${resource}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: value }),
    });
    if (!response.ok) {
      setError((await response.json()).error || "Unable to update.");
      return;
    }
    await load();
  }

  async function sendContactReply() {
    if (!selectedContact) return;
    const message = contactReply.trim();
    if (message.length < 2) {
      setContactReplyStatus("Write a reply before sending.");
      return;
    }

    setSendingContactReply(true);
    setContactReplyStatus("");
    try {
      const response = await fetch("/api/admin/platform/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", id: String(selectedContact.id || ""), message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Reply could not be sent.");
      setSelectedContact(result.item || { ...selectedContact, status: "replied" });
      setContactReply("");
      setContactReplyStatus("Reply sent to the customer.");
      await load();
    } catch (value) {
      setContactReplyStatus(value instanceof Error ? value.message : "Reply could not be sent.");
    } finally {
      setSendingContactReply(false);
    }
  }

  async function updateRole(row: Row, role: string) {
    const id = String(row.id || "");
    const response = await fetch(`/api/admin/platform/${resource}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    if (!response.ok) {
      setError((await response.json()).error || "Unable to update Admin role.");
      return;
    }
    await load();
  }

  async function remove(row: Row) {
    if (!confirm("Delete this record?")) return;
    const id = String(row.id || row.slug || "");
    const response = await fetch(`/api/admin/platform/${resource}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) await load();
    else setError((await response.json()).error || "Unable to delete.");
  }

  const toolOptions = [{ value: "all", label: "All tools" }, ...generationFacets.tools.map((value) => ({ value, label: humanize(value) }))];
  const providerOptions = [{ value: "all", label: "All providers" }, ...generationFacets.providers.map((value) => ({ value, label: providerLabel(value) }))];
  const statusOptions = [{ value: "all", label: "All statuses" }, ...generationFacets.statuses.map((value) => ({ value, label: humanize(value) }))];
  const dateOptions = [
    { value: "all", label: "All time" },
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Platform controls</p>
          <h2 className="mt-2 text-4xl font-black tracking-[-.055em]">{config.title}</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{config.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void load()}><RefreshCw size={15}/>Refresh</Button>
          {config.fields && <Button onClick={() => openEditor("new")}><Plus size={15}/>New</Button>}
        </div>
      </div>

      <GlassCard className="mt-6 overflow-hidden border-violet-100 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <Search size={17} className="text-violet-600"/>
          <input className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" placeholder={config.search} value={query} onChange={(event) => setQuery(event.target.value)}/>
          <span className="text-xs font-black text-slate-400">{resource === "generations" ? total : filtered.length}</span>
        </div>

        {resource === "generations" && (
          <div className="grid gap-3 border-b border-slate-100 bg-slate-50/55 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="mb-2 block text-[.58rem] font-black uppercase tracking-[.13em] text-slate-400">Tool</span>
              <HeyySelect
                value={toolFilter}
                tone="admin"
                ariaLabel="Filter generations by tool"
                options={toolOptions}
                onChange={(value) => { setToolFilter(value); void load({ page: 1, tool: value }); }}
              />
            </label>
            <label>
              <span className="mb-2 block text-[.58rem] font-black uppercase tracking-[.13em] text-slate-400">Provider</span>
              <HeyySelect
                value={providerFilter}
                tone="admin"
                ariaLabel="Filter generations by provider"
                options={providerOptions}
                onChange={(value) => { setProviderFilter(value); void load({ page: 1, provider: value }); }}
              />
            </label>
            <label>
              <span className="mb-2 block text-[.58rem] font-black uppercase tracking-[.13em] text-slate-400">Status</span>
              <HeyySelect
                value={statusFilter}
                tone="admin"
                ariaLabel="Filter generations by status"
                options={statusOptions}
                onChange={(value) => { setStatusFilter(value); void load({ page: 1, status: value }); }}
              />
            </label>
            <label>
              <span className="mb-2 block text-[.58rem] font-black uppercase tracking-[.13em] text-slate-400">Date</span>
              <HeyySelect
                value={dateFilter}
                tone="admin"
                ariaLabel="Filter generations by date"
                options={dateOptions}
                onChange={(value) => { setDateFilter(value); void load({ page: 1, date: value }); }}
              />
            </label>
          </div>
        )}

        {error && <p className="border-b border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">{error}</p>}
        {loading ? (
          <div className="grid place-items-center p-16"><LoaderCircle className="animate-spin text-violet-600"/></div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-sm font-semibold text-slate-400">No records found.</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {filtered.map((row, index) => resource === "generations" ? (
                <div key={String(row.id || index)} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black">{humanize(row.tool) || "Generation job"}</p>
                        {row.status && <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{formatDate(row.created_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGeneration(row)}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-violet-100 px-3 text-xs font-black text-violet-600 transition hover:bg-violet-50"
                    >
                      <Eye size={14}/>Details
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50/75 p-3">
                      <p className="text-[.56rem] font-black uppercase tracking-[.12em] text-slate-400">User</p>
                      <p className="mt-1 truncate text-xs font-black text-slate-700">{text(row.user_name) || "Unknown user"}</p>
                      <p className="mt-1 truncate text-[.68rem] font-semibold text-slate-400">{text(row.user_email) || text(row.user_id) || "No user ID"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50/75 p-3">
                      <p className="text-[.56rem] font-black uppercase tracking-[.12em] text-slate-400">Project</p>
                      <p className="mt-1 truncate text-xs font-black text-slate-700">{text(row.project_name) || "Quick Tool / no project"}</p>
                      <p className="mt-1 truncate text-[.68rem] font-semibold text-slate-400">{text(row.project_studio) || text(row.project_id) || "No linked project"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50/75 p-3">
                      <p className="text-[.56rem] font-black uppercase tracking-[.12em] text-slate-400">Provider / model</p>
                      <p className="mt-1 truncate text-xs font-black text-slate-700">{providerLabel(row.provider)}</p>
                      <p className="mt-1 truncate text-[.68rem] font-semibold text-slate-400">{text(row.model_name) || "Model not recorded"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50/75 p-3">
                      <p className="text-[.56rem] font-black uppercase tracking-[.12em] text-slate-400">Credits / duration</p>
                      <p className="mt-1 truncate text-xs font-black text-slate-700">{formatCredits(row)}</p>
                      <p className="mt-1 truncate text-[.68rem] font-semibold text-slate-400">{formatDuration(row.duration_ms)}</p>
                    </div>
                  </div>

                  {text(row.error) && (
                    <p className="mt-3 line-clamp-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{text(row.error)}</p>
                  )}
                </div>
              ) : (
                <div key={String(row.id || row.slug || index)} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black">{String(row.title || row.name || row.email || row.tool || row.slug || "Untitled")}</p>
                      {row.status && <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>}
                    </div>
                    {resource === "applications" ? (
                      <>
                        <p className="mt-2 text-xs font-black text-violet-600">{String(row.position_title || "Role unavailable")}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{String(row.email || "")}{row.location ? ` · ${String(row.location)}` : ""}</p>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{String(row.message || "")}</p>
                      </>
                    ) : resource === "contact" ? (
                      <>
                        <p className="mt-2 text-xs font-black text-violet-600">{String(row.topic || "Contact request")}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{String(row.email || "")}{row.contact_subject ? ` · ${String(row.contact_subject)}` : ""}</p>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{String(row.message || "")}</p>
                      </>
                    ) : (
                      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{String(row.summary || row.message || row.description || row.email || row.provider || row.slug || "")}</p>
                    )}
                    {resource === "users" && <p className="mt-1 text-[.65rem] font-black uppercase tracking-[.12em] text-violet-500">{String(row.role || "customer").replace(/_/g, " ")}</p>}
                    <p className="mt-2 text-[.65rem] font-bold text-slate-400">{row.created_at ? new Date(row.created_at).toLocaleString("en-US") : String(row.location || row.category || "")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {resource === "users" && <div className="min-w-[170px]"><HeyySelect value={String(row.role || "customer")} tone="admin" ariaLabel="Admin role" options={[{value:"customer",label:"Customer"},{value:"business_admin",label:"Business admin"},{value:"admin",label:"Full admin"}]} onChange={(value) => void updateRole(row, value)} triggerClassName="!min-h-9 !rounded-full !px-3 !py-1.5 !text-xs" /></div>}
                    {resource === "contact" && (
                      <button type="button" onClick={() => { setSelectedContact(row); setContactReply(""); setContactReplyStatus(""); }} className="inline-flex h-9 items-center gap-2 rounded-full border border-violet-100 px-3 text-xs font-black text-violet-600 transition hover:bg-violet-50">
                        <Eye size={14}/>Review
                      </button>
                    )}
                    {resource === "applications" && (
                      <button type="button" onClick={() => setSelectedApplication(row)} className="inline-flex h-9 items-center gap-2 rounded-full border border-violet-100 px-3 text-xs font-black text-violet-600 transition hover:bg-violet-50">
                        <Eye size={14}/>Review
                      </button>
                    )}
                    {resource === "applications" && Boolean(row.resume_url) && (
                      <a href={`/api/admin/careers/resume?applicationId=${encodeURIComponent(String(row.id || ""))}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border border-violet-100 px-3 text-xs font-black text-violet-600 transition hover:bg-violet-50">
                        <Download size={14}/> CV
                      </a>
                    )}
                    {resource === "applications" && Boolean(row.portfolio_url) && (
                      <a href={String(row.portfolio_url)} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-violet-100 text-violet-600 hover:bg-violet-50" aria-label="Open portfolio"><ExternalLink size={14}/></a>
                    )}
                    {resource === "applications" && Boolean(row.linkedin_url) && (
                      <a href={String(row.linkedin_url)} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-violet-100 text-violet-600 hover:bg-violet-50" aria-label="Open LinkedIn"><ExternalLink size={14}/></a>
                    )}
                    {config.fields && <button onClick={() => openEditor(row)} className="grid h-9 w-9 place-items-center rounded-full border border-violet-100 text-violet-600 hover:bg-violet-50" aria-label="Edit"><Pencil size={15}/></button>}
                    {config.statuses && <div className="min-w-[160px]"><HeyySelect value={String(row.status || config.statuses[0])} tone="admin" ariaLabel="Record status" options={config.statuses} onChange={(value) => void updateStatus(row, value)} triggerClassName="!min-h-9 !rounded-full !px-3 !py-1.5 !text-xs" /></div>}
                    {resource !== "users" && <button onClick={() => void remove(row)} className="grid h-9 w-9 place-items-center rounded-full border border-red-100 text-red-500 hover:bg-red-50" aria-label="Delete"><Trash2 size={15}/></button>}
                  </div>
                </div>
              ))}
            </div>
            {resource === "generations" && total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
                <p className="text-xs font-bold text-slate-400">
                  Showing {(page - 1) * 25 + 1}-{Math.min(page * 25, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" disabled={loading || page <= 1} onClick={() => void load({ page: page - 1, query })}>Previous</Button>
                  <span className="px-2 text-xs font-black text-slate-500">Page {page} of {totalPages}</span>
                  <Button variant="secondary" disabled={loading || page >= totalPages} onClick={() => void load({ page: page + 1, query })}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </GlassCard>

      {selectedGeneration && resource === "generations" && (
        <div className="fixed inset-0 z-[125] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
          <GlassCard className="my-8 w-full max-w-4xl bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Generation details</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-3xl font-black tracking-[-.05em]">{humanize(selectedGeneration.tool) || "Generation job"}</h3>
                  {selectedGeneration.status && <StatusPill tone={statusTone(selectedGeneration.status)}>{selectedGeneration.status}</StatusPill>}
                </div>
              </div>
              <button onClick={() => setSelectedGeneration(null)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 hover:bg-slate-50" aria-label="Close"><X size={17}/></button>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <GenerationDetail label="User" value={selectedGeneration.user_name}/>
              <GenerationDetail label="User email" value={selectedGeneration.user_email}/>
              <GenerationDetail label="User ID" value={selectedGeneration.user_id}/>
              <GenerationDetail label="Project" value={selectedGeneration.project_name}/>
              <GenerationDetail label="Studio" value={selectedGeneration.project_studio}/>
              <GenerationDetail label="Project ID" value={selectedGeneration.project_id}/>
              <GenerationDetail label="Provider" value={providerLabel(selectedGeneration.provider)}/>
              <GenerationDetail label="Model" value={selectedGeneration.model_name}/>
              <GenerationDetail label="Credits" value={formatCredits(selectedGeneration)}/>
              <GenerationDetail label="Duration" value={formatDuration(selectedGeneration.duration_ms)}/>
              <GenerationDetail label="Started" value={formatDate(selectedGeneration.created_at)}/>
              <GenerationDetail label="Completed" value={formatDate(selectedGeneration.completed_at)}/>
              <GenerationDetail label="Generation ID" value={selectedGeneration.id}/>
              <GenerationDetail label="Credit reservation ID" value={selectedGeneration.credit_reservation_id}/>
              <GenerationDetail label="Provider job ID" value={selectedGeneration.provider_job_id}/>
              <GenerationDetail label="Request key" value={selectedGeneration.request_key}/>
              <GenerationDetail label="Asset ID" value={selectedGeneration.asset_id}/>
            </div>

            {text(selectedGeneration.error) && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-[.6rem] font-black uppercase tracking-[.14em] text-red-400">Failure / provider error</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-red-700">{text(selectedGeneration.error)}</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {text(selectedGeneration.project_href) && (
                <a href={text(selectedGeneration.project_href)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-black text-white hover:bg-slate-800">
                  Open project <ExternalLink size={14}/>
                </a>
              )}
              {text(selectedGeneration.asset_url) && (
                <a href={text(selectedGeneration.asset_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-100 px-4 text-xs font-black text-violet-600 hover:bg-violet-50">
                  View asset <ExternalLink size={14}/>
                </a>
              )}
              <Button variant="ghost" onClick={() => setSelectedGeneration(null)}>Close</Button>
            </div>
          </GlassCard>
        </div>
      )}

      {selectedContact && resource === "contact" && (
        <div className="fixed inset-0 z-[125] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
          <GlassCard className="my-8 w-full max-w-4xl bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Contact request</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-3xl font-black tracking-[-.05em]">{String(selectedContact.name || "Contact")}</h3>
                  {selectedContact.status && <StatusPill tone={statusTone(selectedContact.status)}>{selectedContact.status}</StatusPill>}
                </div>
                <p className="mt-2 text-sm font-black text-violet-600">{String(selectedContact.topic || "Contact request")}</p>
              </div>
              <button onClick={() => { setSelectedContact(null); setContactReply(""); setContactReplyStatus(""); }} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 hover:bg-slate-50" aria-label="Close"><X size={17}/></button>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <GenerationDetail label="Name" value={selectedContact.name}/>
              <GenerationDetail label="Email" value={selectedContact.email}/>
              <GenerationDetail label="Company" value={selectedContact.contact_company}/>
              <GenerationDetail label="Inquiry type" value={selectedContact.topic}/>
              <GenerationDetail label="Subject" value={selectedContact.contact_subject}/>
              <GenerationDetail label="Submitted" value={formatDate(selectedContact.created_at)}/>
              <GenerationDetail label="Reference" value={text(selectedContact.id).slice(0, 8).toUpperCase()}/>
              <GenerationDetail label="Submission ID" value={selectedContact.id}/>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-[.6rem] font-black uppercase tracking-[.14em] text-slate-400">Message</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700">{text(selectedContact.message) || "No message provided."}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex items-center gap-2">
                <Paperclip size={15} className="text-violet-600"/>
                <p className="text-[.6rem] font-black uppercase tracking-[.14em] text-slate-400">Attachments</p>
              </div>
              {contactAttachments(selectedContact).length ? (
                <div className="mt-3 grid gap-2">
                  {contactAttachments(selectedContact).map((attachment, index) => {
                    const url = text(attachment.url);
                    return url ? (
                      <a key={`${text(attachment.name)}-${index}`} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/45 px-3 py-2.5 text-xs font-black text-violet-700 transition hover:bg-violet-50">
                        <span className="min-w-0 truncate">{text(attachment.name) || `Attachment ${index + 1}`}</span>
                        <span className="flex shrink-0 items-center gap-2 text-[.65rem] text-violet-500">{formatFileSize(attachment.size)} <Download size={13}/></span>
                      </a>
                    ) : (
                      <div key={`${text(attachment.name)}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500">
                        <span className="font-black text-slate-700">{text(attachment.name) || `Attachment ${index + 1}`}</span>
                        <span className="ml-2">This older submission was received before private Admin attachment storage was enabled.</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs font-semibold text-slate-500">No attachments were submitted.</p>
              )}
            </div>

            {contactReplies(selectedContact).length > 0 && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/45 p-4">
                <p className="text-[.6rem] font-black uppercase tracking-[.14em] text-emerald-600">Previous Admin replies</p>
                <div className="mt-3 grid gap-3">
                  {contactReplies(selectedContact).map((reply, index) => (
                    <div key={`${text(reply.sent_at)}-${index}`} className="rounded-xl bg-white/80 p-3">
                      <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{text(reply.message)}</p>
                      <p className="mt-2 text-[.65rem] font-bold text-slate-400">{formatDate(reply.sent_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/35 p-4">
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-violet-600"/>
                <p className="text-[.62rem] font-black uppercase tracking-[.14em] text-violet-600">Reply to customer</p>
              </div>
              <textarea
                value={contactReply}
                onChange={(event) => { setContactReply(event.target.value); setContactReplyStatus(""); }}
                rows={5}
                className="heyy-input mt-3 w-full resize-y"
                placeholder="Write your reply. It will be sent to the customer using the Heyy Studio email template."
              />
              {contactReplyStatus && (
                <p className={`mt-2 text-xs font-bold ${contactReplyStatus.startsWith("Reply sent") ? "text-emerald-600" : "text-red-500"}`}>{contactReplyStatus}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void sendContactReply()} disabled={sendingContactReply || contactReply.trim().length < 2}>
                  {sendingContactReply ? <LoaderCircle size={15} className="animate-spin"/> : <Mail size={15}/>}Send reply
                </Button>
                {text(selectedContact.email) && (
                  <a href={`mailto:${text(selectedContact.email)}?subject=${encodeURIComponent(`Re: ${text(selectedContact.contact_subject) || "Heyy Studio request"}`)}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-100 px-4 text-xs font-black text-violet-600 hover:bg-violet-50">
                    Open in email <ExternalLink size={13}/>
                  </a>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => { setSelectedContact(null); setContactReply(""); setContactReplyStatus(""); }}>Close</Button>
            </div>
          </GlassCard>
        </div>
      )}

      {selectedApplication && resource === "applications" && (
        <div className="fixed inset-0 z-[125] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
          <GlassCard className="my-8 w-full max-w-3xl bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">Career application</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-3xl font-black tracking-[-.05em]">{String(selectedApplication.name || "Applicant")}</h3>
                  {selectedApplication.status && <StatusPill tone={statusTone(selectedApplication.status)}>{selectedApplication.status}</StatusPill>}
                </div>
                <p className="mt-2 text-sm font-black text-violet-600">{String(selectedApplication.position_title || "Role unavailable")}</p>
              </div>
              <button onClick={() => setSelectedApplication(null)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 hover:bg-slate-50" aria-label="Close"><X size={17}/></button>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <GenerationDetail label="Role" value={selectedApplication.position_title}/>
              <GenerationDetail label="Department" value={selectedApplication.position_department}/>
              <GenerationDetail label="Applicant" value={selectedApplication.name}/>
              <GenerationDetail label="Email" value={selectedApplication.email}/>
              <GenerationDetail label="Current location" value={selectedApplication.location}/>
              <GenerationDetail label="Role location" value={selectedApplication.position_location}/>
              <GenerationDetail label="Submitted" value={formatDate(selectedApplication.created_at)}/>
              <GenerationDetail label="Application ID" value={selectedApplication.id}/>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-[.6rem] font-black uppercase tracking-[.14em] text-slate-400">Candidate message</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700">{text(selectedApplication.message) || "No message provided."}</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {Boolean(selectedApplication.resume_url) && (
                <a href={`/api/admin/careers/resume?applicationId=${encodeURIComponent(String(selectedApplication.id || ""))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-black text-white hover:bg-slate-800">
                  <Download size={14}/>Download CV
                </a>
              )}
              {Boolean(selectedApplication.portfolio_url) && (
                <a href={String(selectedApplication.portfolio_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-100 px-4 text-xs font-black text-violet-600 hover:bg-violet-50">
                  Portfolio <ExternalLink size={14}/>
                </a>
              )}
              {Boolean(selectedApplication.linkedin_url) && (
                <a href={String(selectedApplication.linkedin_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-100 px-4 text-xs font-black text-violet-600 hover:bg-violet-50">
                  LinkedIn <ExternalLink size={14}/>
                </a>
              )}
              <Button variant="ghost" onClick={() => setSelectedApplication(null)}>Close</Button>
            </div>
          </GlassCard>
        </div>
      )}

      {editing && config.fields && (
        <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
          <GlassCard className="my-8 w-full max-w-3xl bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-violet-600">{editing === "new" ? "Create draft" : "Edit content"}</p>
                <h3 className="mt-2 text-3xl font-black tracking-[-.05em]">{config.title}</h3>
              </div>
              <button onClick={() => setEditing(null)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 hover:bg-slate-50" aria-label="Close"><X size={17}/></button>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {config.fields.map((field) => (
                <label key={field.key} className={field.multiline ? "md:col-span-2" : ""}>
                  <span className="mb-2 block text-[.62rem] font-black uppercase tracking-[.14em] text-slate-500">{field.label}</span>
                  {field.multiline ? (
                    <textarea className="heyy-input min-h-28 w-full resize-y" placeholder={field.placeholder} value={form[field.key] || ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}/>
                  ) : (
                    <input className="heyy-input w-full" placeholder={field.placeholder} value={form[field.key] || ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}/>
                  )}
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle size={15} className="animate-spin"/> : <Check size={15}/>}Save</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  );
}
