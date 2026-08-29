"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileClock,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Eyebrow, GlassCard, PageContainer, StatusPill } from "@/components/ui/heyy";

type Studio = "brand" | "architecture" | "interior" | "marketing" | "production" | "tools" | "other";
type Status = "Draft" | "Approved" | "Final" | "Source";
type LibraryItem = {
  sourceKey: string;
  sourceKind: string;
  sourceId: string;
  studio: Studio;
  projectId: string | null;
  projectName: string;
  projectHref: string | null;
  title: string;
  originalTitle: string;
  assetType: string;
  assetTypeLabel: string;
  status: Status;
  version: number;
  productionReady: boolean;
  archived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  previewUrl: string | null;
  mimeType: string | null;
  locked: boolean;
  reusable: boolean;
  metadata: Record<string, unknown>;
  versionFamilyKey?: string | null;
  versionCount?: number;
};
type ProjectItem = { id: string; name: string; studio: "brand" | "architecture" | "interior" | "marketing"; href: string };
type StorageEntitlement = {
  mode: "active" | "grace" | "paused" | "free" | "expired";
  plan: "free" | "starter" | "pro";
  paidPlan: "starter" | "pro" | null;
  canBrowse: boolean;
  canDownload: boolean;
  canManage: boolean;
  canSave: boolean;
  graceEndsAt: string | null;
  daysRemaining: number | null;
};

const STUDIO_LABELS: Record<Studio, string> = {
  architecture: "Architecture",
  brand: "Brand",
  interior: "Interior",
  marketing: "Marketing",
  other: "Other",
  production: "Production",
  tools: "AI Tools",
};
const STUDIO_ACCENT: Record<Studio, string> = {
  architecture: "#1676e8",
  brand: "#9b38df",
  interior: "#d06b14",
  marketing: "#eb3d87",
  production: "#11a36a",
  tools: "#6f2dff",
  other: "#7c7485",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function previewKind(item: LibraryItem) {
  const mime = String(item.mimeType || "").toLowerCase();
  const url = String(item.previewUrl || "").toLowerCase().split("?")[0];
  if (mime.includes("pdf") || url.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov)$/.test(url)) return "video";
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(url)) return "image";
  return "file";
}

function statusTone(status: Status): "neutral" | "success" | "warning" | "info" {
  return status === "Final" ? "success" : status === "Approved" ? "info" : status === "Source" ? "neutral" : "warning";
}

export default function AssetLibrary() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [storage, setStorage] = useState<StorageEntitlement | null>(null);
  const [search, setSearch] = useState("");
  const [studio, setStudio] = useState("all");
  const [project, setProject] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [active, setActive] = useState<LibraryItem | null>(null);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [reuseStudio, setReuseStudio] = useState<"brand" | "architecture" | "interior" | "marketing">("brand");
  const [reuseProject, setReuseProject] = useState("");
  const [reuseResult, setReuseResult] = useState<{ href: string } | null>(null);

  async function token() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Your session expired. Sign in again.");
    return data.session.access_token;
  }

  async function loadLibrary() {
    setLoading(true);
    setError("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/assets/library", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "Could not load the Assets Library.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setProjects(Array.isArray(payload.projects) ? payload.projects : []);
      setSetupRequired(Boolean(payload.setupRequired));
      setStorage(payload.storage || null);
      const requested = new URLSearchParams(window.location.search).get("asset");
      if (requested) {
        const matched = (payload.items || []).find((item: LibraryItem) => item.sourceKey === requested || item.sourceId === requested);
        if (matched) setActive(matched);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the Assets Library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadLibrary(); }, []);

  const typeOptions = useMemo(() => Array.from(new Map<string, string>(items.map((item) => [item.assetType, item.assetTypeLabel] as [string, string])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [items]);
  const projectOptions = useMemo(() => projects.filter((item) => studio === "all" || item.studio === studio).sort((a, b) => a.name.localeCompare(b.name)), [projects, studio]);

  useEffect(() => {
    if (project !== "all" && !projectOptions.some((item) => item.id === project)) setProject("all");
  }, [project, projectOptions]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!showArchived && item.archived) return false;
      if (studio !== "all" && item.studio !== studio) return false;
      if (project !== "all" && item.projectId !== project) return false;
      if (type !== "all" && item.assetType !== type) return false;
      if (status !== "all" && item.status !== status) return false;
      if (!needle) return true;
      return [item.title, item.assetTypeLabel, item.projectName, STUDIO_LABELS[item.studio], item.status].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [items, project, search, showArchived, status, studio, type]);

  const metrics = useMemo(() => ({
    total: items.filter((item) => !item.archived).length,
    approved: items.filter((item) => !item.archived && (item.status === "Approved" || item.status === "Final")).length,
    ready: items.filter((item) => !item.archived && item.productionReady).length,
    archived: items.filter((item) => item.archived).length,
  }), [items]);

  async function action(actionName: string, body: Record<string, unknown> = {}) {
    if (!active) return null;
    setBusy(actionName);
    setActionError("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/assets/library/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: actionName, sourceKey: active.sourceKey, ...body }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "The asset could not be updated.");
      return payload;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The asset could not be updated.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function saveRename() {
    const payload = await action("rename", { title: renameTitle });
    if (!payload) return;
    setRenameOpen(false);
    setActive((current) => current ? { ...current, title: renameTitle.trim() } : current);
    setItems((current) => current.map((item) => item.sourceKey === active?.sourceKey ? { ...item, title: renameTitle.trim() } : item));
  }

  async function toggleArchive() {
    if (!active) return;
    const next = !active.archived;
    const payload = await action(next ? "archive" : "unarchive");
    if (!payload) return;
    const updated = { ...active, archived: next };
    setActive(updated);
    setItems((current) => current.map((item) => item.sourceKey === updated.sourceKey ? updated : item));
  }

  async function removeFromLibrary() {
    const payload = await action("delete");
    if (!payload || !active) return;
    setItems((current) => current.filter((item) => item.sourceKey !== active.sourceKey));
    setRemoveOpen(false);
    setActive(null);
  }

  async function reuseAsset() {
    const payload = await action("reuse", { targetStudio: reuseStudio, targetProjectId: reuseProject });
    if (!payload) return;
    setReuseResult({ href: payload.href });
    await loadLibrary();
  }

  async function download(item = active) {
    if (!item) return;
    setBusy("download");
    setActionError("");
    try {
      const accessToken = await token();
      const response = await fetch(`/api/assets/library/download?sourceKey=${encodeURIComponent(item.sourceKey)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Could not download this asset.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "heyy-studio-asset";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not download this asset.");
    } finally {
      setBusy("");
    }
  }

  function openRename() {
    if (!active) return;
    setRenameTitle(active.title);
    setRenameOpen(true);
  }

  function openReuse() {
    if (!active) return;
    const firstStudio = (["brand", "architecture", "interior", "marketing"] as const).find((candidate) => candidate !== active.studio) || "brand";
    setReuseStudio(firstStudio);
    setReuseProject("");
    setReuseResult(null);
    setReuseOpen(true);
  }

  const reuseProjects = projects.filter((item) => item.studio === reuseStudio).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="heyy-page heyy-page-grid py-8 sm:py-10">
      <PageContainer>
        <section className="overflow-hidden rounded-[2rem] border border-[var(--accent-border)] bg-[linear-gradient(120deg,rgba(111,45,255,.13),rgba(239,63,180,.08),rgba(46,124,246,.09))] p-6 shadow-[var(--shadow-card)] sm:p-9">
          <div className="grid gap-8 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <Eyebrow>Workspace · Assets Library</Eyebrow>
              <h1 className="mt-4 text-4xl font-black tracking-[-.06em] sm:text-6xl">Everything you create, in one place.</h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">Brand concepts, Architecture drawings and renders, Interior plans and visuals, Marketing creatives and approved production files — connected back to the project that created them.</p>
            </div>
            <button type="button" onClick={() => void loadLibrary()} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-5 text-xs font-black transition hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)]"><RefreshCcw size={14}/> Refresh library</button>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Current assets" value={metrics.total}/><Metric label="Approved / final" value={metrics.approved}/><Metric label="Production ready" value={metrics.ready}/><Metric label="Archived" value={metrics.archived}/>
          </div>
        </section>

        {storage && <StorageAccessNotice storage={storage} />}
        {setupRequired && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">Asset management is temporarily unavailable. Refresh the page or contact support if the problem continues.</div>}

        {storage && !storage.canBrowse ? <StorageGate storage={storage} /> : <>
        <GlassCard className="mt-5 p-4 sm:p-5">
          <div className="grid gap-3 xl:grid-cols-[1.4fr_repeat(4,minmax(0,.75fr))_auto]">
            <label className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets, projects or types" className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] pl-11 pr-4 text-sm font-bold outline-none transition focus:border-[var(--accent-border)]"/></label>
            <FilterSelect value={studio} onChange={setStudio} ariaLabel="Filter by Studio" options={[{ value: "all", label: "All Studios" }, ...Object.entries(STUDIO_LABELS).filter(([key]) => !["other", "production", "tools"].includes(key)).sort((a,b)=>a[1].localeCompare(b[1])).map(([value,label])=>({value,label}))]}/>
            <FilterSelect value={project} onChange={setProject} ariaLabel="Filter by project" options={[{ value: "all", label: "All Projects" }, ...projectOptions.map((item)=>({value:item.id,label:item.name}))]}/>
            <FilterSelect value={type} onChange={setType} ariaLabel="Filter by asset type" options={[{ value: "all", label: "All Asset Types" }, ...typeOptions.map(([value,label])=>({value,label}))]}/>
            <FilterSelect value={status} onChange={setStatus} ariaLabel="Filter by status" options={[{value:"all",label:"All Statuses"},{value:"Approved",label:"Approved"},{value:"Draft",label:"Draft"},{value:"Final",label:"Final"},{value:"Source",label:"Source"}]}/>
            <button type="button" onClick={()=>setShowArchived((value)=>!value)} className={`h-12 rounded-2xl border px-4 text-xs font-black transition ${showArchived ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"}`}>{showArchived ? "Showing archived" : "Show archived"}</button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4"><p className="text-xs font-bold text-[var(--text-muted)]">{filtered.length} asset{filtered.length === 1 ? "" : "s"} shown</p>{(search || studio !== "all" || project !== "all" || type !== "all" || status !== "all") && <button type="button" onClick={()=>{setSearch("");setStudio("all");setProject("all");setType("all");setStatus("all");}} className="text-xs font-black text-[var(--accent-strong)] hover:underline">Clear filters</button>}</div>
        </GlassCard>

        {loading ? <LoadingGrid/> : error ? <ErrorState message={error} retry={()=>void loadLibrary()}/> : filtered.length === 0 ? <EmptyLibrary/> : (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((item)=><AssetCard key={item.sourceKey} item={item} onOpen={()=>{setActionError("");setActive(item);}} onDownload={()=>void download(item)}/>) }
          </section>
        )}
        </>}
      </PageContainer>

      {active && storage?.canBrowse && <AssetModal item={active} readOnly={!storage.canManage} onClose={()=>{setActive(null);setActionError("");}} onDownload={()=>void download()} downloadBusy={busy === "download"} onRename={openRename} onArchive={()=>void toggleArchive()} archiveBusy={busy === "archive" || busy === "unarchive"} onRemove={()=>setRemoveOpen(true)} onReuse={openReuse} actionError={actionError}/>} 
      {renameOpen && active && <SmallDialog title="Rename asset" description="This changes the name shown in Assets Library without changing the source project record." onClose={()=>setRenameOpen(false)}><input autoFocus value={renameTitle} onChange={(event)=>setRenameTitle(event.target.value)} className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold outline-none focus:border-[var(--accent-border)]"/><div className="mt-4 flex justify-end gap-2"><DialogButton onClick={()=>setRenameOpen(false)} secondary>Cancel</DialogButton><DialogButton onClick={()=>void saveRename()} disabled={!renameTitle.trim() || busy === "rename"}>{busy === "rename" ? <Loader2 size={14} className="animate-spin"/> : null}Save name</DialogButton></div></SmallDialog>}
      {removeOpen && active && <SmallDialog title="Remove from Assets Library?" description="The source project and its production history will remain untouched. This only removes the item from your unified Assets Library." onClose={()=>setRemoveOpen(false)}><div className="flex justify-end gap-2"><DialogButton onClick={()=>setRemoveOpen(false)} secondary>Keep asset</DialogButton><DialogButton onClick={()=>void removeFromLibrary()} disabled={busy === "delete"}>{busy === "delete" ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}Remove</DialogButton></div></SmallDialog>}
      {reuseOpen && active && <SmallDialog title="Use in another Studio" description="Heyy Studio will copy this asset into the selected project as a reusable reference. Your original asset stays unchanged." onClose={()=>setReuseOpen(false)}>
        {reuseResult ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-sm font-black text-emerald-800 dark:text-emerald-200">Asset added to the project.</p><Link href={reuseResult.href} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-emerald-700 hover:underline dark:text-emerald-200">Open destination project <ArrowRight size={13}/></Link></div> : <>
          <div className="grid gap-3 sm:grid-cols-2"><FilterSelect value={reuseStudio} onChange={(value)=>{setReuseStudio(value as any);setReuseProject("");}} ariaLabel="Destination Studio" options={[{value:"architecture",label:"Architecture"},{value:"brand",label:"Brand"},{value:"interior",label:"Interior"},{value:"marketing",label:"Marketing"}]}/><FilterSelect value={reuseProject} onChange={setReuseProject} ariaLabel="Destination project" options={[{value:"",label:"Choose Project"}, ...reuseProjects.map((item)=>({value:item.id,label:item.name}))]}/></div>
          {actionError && <p className="mt-3 text-xs font-bold text-red-600">{actionError}</p>}<div className="mt-4 flex justify-end gap-2"><DialogButton onClick={()=>setReuseOpen(false)} secondary>Cancel</DialogButton><DialogButton onClick={()=>void reuseAsset()} disabled={!reuseProject || busy === "reuse"}>{busy === "reuse" ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}Add to project</DialogButton></div>
        </>}
      </SmallDialog>}
    </main>
  );
}

function StorageAccessNotice({ storage }: { storage: StorageEntitlement }) {
  if (storage.mode === "active") {
    return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"><span>Unlimited saved projects & assets with your plan · subject to fair use.</span><span className="rounded-full bg-white/70 px-3 py-1 text-[.62rem] font-black uppercase tracking-[.12em] dark:bg-black/20">Cloud saving on</span></div>;
  }
  if (storage.mode === "grace") {
    return <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"><div><p>30-day download grace period · {storage.daysRemaining || 0} day{storage.daysRemaining === 1 ? "" : "s"} left.</p><p className="mt-1 text-xs font-semibold opacity-80">Your saved work is read-only. Download what you need or resubscribe before the grace period ends.</p></div><Link href="/billing" className="rounded-full bg-amber-900 px-4 py-2 text-xs font-black text-white dark:bg-amber-300 dark:text-amber-950">Manage plan</Link></div>;
  }
  if (storage.mode === "paused") {
    return <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"><div><p>Saved work is temporarily read-only.</p><p className="mt-1 text-xs font-semibold opacity-80">Resolve your billing status to resume cloud saving and version management.</p></div><Link href="/billing" className="rounded-full bg-amber-900 px-4 py-2 text-xs font-black text-white dark:bg-amber-300 dark:text-amber-950">Billing & plan</Link></div>;
  }
  return null;
}

function StorageGate({ storage }: { storage: StorageEntitlement }) {
  const expired = storage.mode === "expired";
  return <div className="mt-5 grid min-h-[320px] place-items-center rounded-[1.8rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center"><div className="max-w-xl"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><FolderOpen size={24}/></span><h3 className="mt-4 text-2xl font-black">{expired ? "Cloud storage grace period ended" : "Cloud saving is included with Starter and Pro"}</h3><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{expired ? "The 30-day download window has ended. Files may no longer be available. Resubscribe to restore workspace storage where your saved work is still retained." : "Free accounts can create and download results, while the Assets Library and Version History are paid-plan workspace features."}</p><Link href={expired ? "/billing" : "/pricing"} className="mt-5 inline-flex h-11 items-center rounded-full bg-[var(--accent-strong)] px-5 text-xs font-black text-white">{expired ? "View billing options" : "View plans"}</Link></div></div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/40 bg-white/55 p-4 backdrop-blur dark:border-white/10 dark:bg-black/10"><p className="text-[.6rem] font-black uppercase tracking-[.16em] text-[var(--text-muted)]">{label}</p><p className="mt-2 text-3xl font-black tracking-[-.05em]">{value}</p></div>; }

function FilterSelect({ value, onChange, options, ariaLabel }: { value: string; onChange: (value:string)=>void; options:{value:string;label:string}[]; ariaLabel:string }) { return <select aria-label={ariaLabel} value={value} onChange={(event)=>onChange(event.target.value)} className="h-12 min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-black outline-none transition focus:border-[var(--accent-border)]">{options.map((option)=><option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}</select>; }

function AssetCard({ item, onOpen, onDownload }: { item:LibraryItem; onOpen:()=>void; onDownload:()=>void }) {
  const kind = previewKind(item); const accent = STUDIO_ACCENT[item.studio];
  return <article className="group overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)]">
    <button type="button" onClick={onOpen} className="block w-full text-left"><div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-[linear-gradient(135deg,var(--surface-hover),var(--accent-soft))]">{item.previewUrl && kind === "image" ? <img src={item.previewUrl} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"/> : item.previewUrl && kind === "video" ? <video src={item.previewUrl} muted preload="none" className="h-full w-full object-cover"/> : <div className="grid place-items-center text-[var(--text-muted)]">{kind === "pdf" ? <File size={34}/> : <FileImage size={34}/>}<span className="mt-2 text-[.62rem] font-black uppercase tracking-[.14em]">{kind === "pdf" ? "PDF" : "Asset"}</span></div>}<div className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[.57rem] font-black uppercase tracking-[.13em] text-white" style={{background:accent}}>{STUDIO_LABELS[item.studio]}</div>{item.archived && <div className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[.57rem] font-black uppercase tracking-[.13em] text-white">Archived</div>}</div>
    <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black">{item.title}</p><p className="mt-1 truncate text-[.66rem] font-bold text-[var(--text-muted)]">{item.projectName}</p></div><MoreHorizontal size={16} className="shrink-0 text-[var(--text-muted)]"/></div><div className="mt-4 flex flex-wrap items-center gap-2"><StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill><span className="rounded-full border border-[var(--border)] px-2 py-1 text-[.58rem] font-black text-[var(--text-muted)]">V{item.version}</span>{item.productionReady && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[.58rem] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 size={10}/> Production ready</span>}</div><p className="mt-4 truncate text-[.62rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">{item.assetTypeLabel}</p></div></button>
    <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3"><span className="text-[.61rem] font-bold text-[var(--text-muted)]">{formatDate(item.updatedAt || item.createdAt)}</span><button type="button" onClick={onDownload} className="inline-flex items-center gap-1.5 text-[.65rem] font-black text-[var(--accent-strong)] hover:underline"><Download size={12}/> Download</button></div>
  </article>;
}

function AssetModal({ item, readOnly, onClose, onDownload, downloadBusy, onRename, onArchive, archiveBusy, onRemove, onReuse, actionError }: { item:LibraryItem; readOnly:boolean; onClose:()=>void; onDownload:()=>void; downloadBusy:boolean; onRename:()=>void; onArchive:()=>void; archiveBusy:boolean; onRemove:()=>void; onReuse:()=>void; actionError:string }) {
  const kind=previewKind(item);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};document.addEventListener("keydown",key);const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.removeEventListener("keydown",key);document.body.style.overflow=previous;};},[onClose]);
  return <div className="fixed inset-0 z-[140] overflow-y-auto bg-black/70 p-3 backdrop-blur-md sm:p-6" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><div className="mx-auto flex min-h-full max-w-7xl items-center justify-center"><div className="w-full overflow-hidden rounded-[1.7rem] border border-white/10 bg-[var(--surface-strong)] shadow-2xl"><div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[color:var(--surface-strong)]/95 px-4 py-3 backdrop-blur sm:px-6"><div className="min-w-0"><p className="text-[.58rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">Asset preview</p><h2 className="mt-1 truncate text-lg font-black">{item.title}</h2></div><div className="flex items-center gap-2"><button onClick={onDownload} disabled={downloadBusy} className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent-strong)] px-4 text-xs font-black text-white disabled:opacity-50">{downloadBusy?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>}Download</button><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)]"><X size={16}/></button></div></div>
      <div className="grid gap-0 xl:grid-cols-[1fr_320px]"><div className="min-h-[55vh] bg-[#0e0d12] p-4 sm:p-6">{item.previewUrl && kind==="image" ? <img src={item.previewUrl} alt={item.title} className="mx-auto max-h-[72vh] max-w-full rounded-xl object-contain"/> : item.previewUrl && kind==="pdf" ? <iframe src={item.previewUrl} title={item.title} className="h-[72vh] w-full rounded-xl bg-white"/> : item.previewUrl && kind==="video" ? <video src={item.previewUrl} controls className="mx-auto max-h-[72vh] max-w-full rounded-xl"/> : <div className="grid h-[60vh] place-items-center text-white/60"><div className="text-center"><File size={42} className="mx-auto"/><p className="mt-3 text-sm font-bold">Preview unavailable</p><p className="mt-1 text-xs">Download the file to inspect it.</p></div></div>}</div>
        <aside className="border-l border-[var(--border)] p-5"><div className="flex flex-wrap gap-2"><StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill><span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[.62rem] font-black">Version {item.version}</span></div><Info label="Studio" value={STUDIO_LABELS[item.studio]}/><Info label="Project" value={item.projectName}/><Info label="Asset type" value={item.assetTypeLabel}/><Info label="Updated" value={formatDate(item.updatedAt || item.createdAt)}/>{item.productionReady && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-black text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 size={14} className="mr-2 inline"/>Production-ready asset</div>}
          {actionError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-200">{actionError}</p>}
          <div className="mt-5 space-y-2">{item.projectHref && <Link href={item.projectHref} className="flex h-11 items-center justify-between rounded-xl border border-[var(--border)] px-3 text-xs font-black hover:border-[var(--accent-border)]">Open source project <ExternalLink size={13}/></Link>}{item.versionFamilyKey && <Link href={`/dashboard/versions?family=${encodeURIComponent(item.versionFamilyKey)}`} className="flex h-11 items-center justify-between rounded-xl border border-[var(--border)] px-3 text-xs font-black hover:border-[var(--accent-border)]">Version history{item.versionCount && item.versionCount > 1 ? ` · ${item.versionCount}` : ""}<FileClock size={13}/></Link>}{readOnly ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">This library is read-only right now. You can preview and download saved work, but changes require an active Starter or Pro plan.</div> : <><ActionButton icon={Pencil} label="Rename in library" onClick={onRename}/><ActionButton icon={item.archived?ArchiveRestore:Archive} label={item.archived?"Restore from archive":"Archive asset"} onClick={onArchive} busy={archiveBusy}/>{item.reusable && <ActionButton icon={Sparkles} label="Use in another Studio" onClick={onReuse}/>}<ActionButton icon={Trash2} label="Remove from library" onClick={onRemove} danger/></>}</div>{item.locked && <p className="mt-4 text-[.66rem] font-semibold leading-5 text-[var(--text-muted)]">Production finals are locked to their delivery history. Removing them from this Library never deletes the delivered production file.</p>}</aside>
      </div></div></div></div>;
}

function Info({label,value}:{label:string;value:string}){return <div className="mt-4 border-b border-[var(--border)] pb-3"><p className="text-[.58rem] font-black uppercase tracking-[.15em] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-xs font-black">{value}</p></div>;}
function ActionButton({icon:Icon,label,onClick,busy=false,danger=false}:{icon:any;label:string;onClick:()=>void;busy?:boolean;danger?:boolean}){return <button type="button" onClick={onClick} disabled={busy} className={`flex h-11 w-full items-center justify-between rounded-xl border px-3 text-xs font-black transition disabled:opacity-50 ${danger?"border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10":"border-[var(--border)] hover:border-[var(--accent-border)]"}`}><span className="inline-flex items-center gap-2">{busy?<Loader2 size={13} className="animate-spin"/>:<Icon size={13}/>} {label}</span><ArrowRight size={12}/></button>;}
function SmallDialog({title,description,onClose,children}:{title:string;description:string;onClose:()=>void;children:ReactNode}){return <div className="fixed inset-0 z-[160] grid place-items-center bg-black/60 p-4 backdrop-blur" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><div className="w-full max-w-lg rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black tracking-[-.03em]">{title}</h3><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{description}</p></div><button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)]"><X size={14}/></button></div><div className="mt-5">{children}</div></div></div>;}
function DialogButton({children,onClick,disabled=false,secondary=false}:{children:ReactNode;onClick:()=>void;disabled?:boolean;secondary?:boolean}){return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-black disabled:opacity-50 ${secondary?"border border-[var(--border)] bg-[var(--surface)]":"bg-[var(--accent-strong)] text-white"}`}>{children}</button>;}
function LoadingGrid(){return <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({length:8}).map((_,index)=><div key={index} className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)]"><div className="aspect-[4/3] animate-pulse bg-[var(--surface-hover)]"/><div className="space-y-2 p-4"><div className="h-4 w-2/3 animate-pulse rounded bg-[var(--surface-hover)]"/><div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface-hover)]"/></div></div>)}</section>;}
function ErrorState({message,retry}:{message:string;retry:()=>void}){return <div className="mt-5 rounded-[1.5rem] border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/20 dark:bg-red-500/10"><p className="font-black text-red-700 dark:text-red-200">Assets Library could not load</p><p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{message}</p><button onClick={retry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-red-600 px-4 text-xs font-black text-white"><RefreshCcw size={13}/>Retry</button></div>;}
function EmptyLibrary(){return <div className="mt-5 rounded-[1.5rem] border border-dashed border-[var(--border-strong)] p-12 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><FolderOpen size={24}/></span><h3 className="mt-4 text-xl font-black">No assets match these filters.</h3><p className="mx-auto mt-2 max-w-lg text-sm font-semibold text-[var(--text-secondary)]">Generate work in a Studio or clear the current filters. New concepts, visuals and delivered files appear here automatically.</p></div>;}
