"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
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
    description: "Inspect provider jobs, statuses, credit reservations and failures.",
    search: "Search generation jobs",
    statuses: ["queued", "processing", "succeeded", "failed", "cancelled"],
  },
};

export default function ResourceManager({ resource }: { resource: Resource }) {
  const config = configs[resource];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/platform/${resource}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load records.");
      setRows(result.items || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [resource]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [rows, query]);

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

  async function remove(row: Row) {
    if (!confirm("Delete this record?")) return;
    const id = String(row.id || row.slug || "");
    const response = await fetch(`/api/admin/platform/${resource}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) await load();
    else setError((await response.json()).error || "Unable to delete.");
  }

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
          <span className="text-xs font-black text-slate-400">{filtered.length}</span>
        </div>
        {error && <p className="border-b border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">{error}</p>}
        {loading ? (
          <div className="grid place-items-center p-16"><LoaderCircle className="animate-spin text-violet-600"/></div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-sm font-semibold text-slate-400">No records found.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((row, index) => (
              <div key={String(row.id || row.slug || index)} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black">{String(row.title || row.name || row.email || row.tool || row.slug || "Untitled")}</p>
                    {row.status && <StatusPill tone={row.status === "published" || row.status === "succeeded" || row.status === "hired" ? "success" : row.status === "failed" || row.status === "spam" ? "warning" : "neutral"}>{row.status}</StatusPill>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{String(row.summary || row.message || row.description || row.email || row.provider || row.slug || "")}</p>
                  <p className="mt-2 text-[.65rem] font-bold text-slate-400">{row.created_at ? new Date(row.created_at).toLocaleString("en-US") : String(row.location || row.category || "")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {config.fields && <button onClick={() => openEditor(row)} className="grid h-9 w-9 place-items-center rounded-full border border-violet-100 text-violet-600 hover:bg-violet-50" aria-label="Edit"><Pencil size={15}/></button>}
                  {config.statuses && <div className="min-w-[160px]"><HeyySelect value={String(row.status || config.statuses[0])} tone="admin" ariaLabel="Record status" options={config.statuses} onChange={(value) => void updateStatus(row, value)} triggerClassName="!min-h-9 !rounded-full !px-3 !py-1.5 !text-xs" /></div>}
                  {resource !== "users" && resource !== "generations" && <button onClick={() => void remove(row)} className="grid h-9 w-9 place-items-center rounded-full border border-red-100 text-red-500 hover:bg-red-50" aria-label="Delete"><Trash2 size={15}/></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

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
