"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  FolderKanban,
  Loader2,
  Megaphone,
  Plus,
  RefreshCcw,
  Search,
  Sofa,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ButtonLink, Eyebrow, GlassCard, PageContainer, StatusPill } from "@/components/ui/heyy";

type Project = {
  id: string;
  name: string;
  studio: "brand" | "architecture" | "interior" | "marketing";
  sourceTable: "brand_projects" | "architecture_projects" | "studio_projects";
  status: string;
  updatedAt: string | null;
};

const PAGE_SIZE = 24;

const studioConfig: Record<Project["studio"], { label: string; accent: string; icon: LucideIcon }> = {
  brand: { label: "Brand", accent: "#a23ce0", icon: WandSparkles },
  marketing: { label: "Marketing", accent: "#eb3d87", icon: Megaphone },
  architecture: { label: "Architecture", accent: "#1676e8", icon: Building2 },
  interior: { label: "Interior", accent: "#d06b14", icon: Sofa },
};

export default function ProjectsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [studio, setStudio] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/account/projects", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) throw new Error(payload.error || "Projects could not be loaded.");
      setProjects(Array.isArray(payload.projects) ? payload.projects : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Projects could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/dashboard/projects")}`;
      return;
    }
    void loadProjects();
  }, [authLoading, user]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, studio]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (studio !== "all" && project.studio !== studio) return false;
      return !query || `${project.name} ${project.status} ${project.studio}`.toLowerCase().includes(query);
    });
  }, [projects, search, studio]);

  const visibleProjects = filtered.slice(0, visibleCount);

  return (
    <main className="heyy-page min-h-screen py-6 sm:py-8">
      <PageContainer>
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--surface),var(--accent-soft))] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <Eyebrow>Workspace · Projects</Eyebrow>
              <h1 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">All your Studio projects</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">Open every Brand, Marketing, Architecture and Interior project from one dedicated workspace.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void loadProjects()} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-black transition hover:border-[var(--accent-border)] disabled:opacity-60">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""}/> Refresh
              </button>
              <ButtonLink href="/#create" size="sm"><Plus size={14}/> New project</ButtonLink>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="All projects" value={projects.length}/>
            {(Object.keys(studioConfig) as Project["studio"][]).map((key) => <Metric key={key} label={studioConfig[key].label} value={projects.filter((project) => project.studio === key).length}/>) }
          </div>
        </section>

        <GlassCard className="mt-5 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <label className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"/>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] pl-11 pr-4 text-sm font-semibold outline-none focus:border-[var(--accent-strong)]"/>
            </label>
            <select value={studio} onChange={(event) => setStudio(event.target.value)} className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm font-bold outline-none focus:border-[var(--accent-strong)]">
              <option value="all">All Studios</option>
              {(Object.keys(studioConfig) as Project["studio"][]).map((key) => <option key={key} value={key}>{studioConfig[key].label}</option>)}
            </select>
          </div>
        </GlassCard>

        {loading ? (
          <State icon={<Loader2 className="animate-spin"/>} title="Loading your projects" text="Collecting every Studio project in your workspace."/>
        ) : error ? (
          <State icon={<FolderKanban/>} title="Projects could not load" text={error} action={<button type="button" onClick={() => void loadProjects()} className="rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-xs font-black text-white">Retry</button>}/>
        ) : visibleProjects.length ? (
          <section className="mt-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleProjects.map((project) => <ProjectCard key={`${project.sourceTable}:${project.id}`} project={project}/>) }
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-bold text-[var(--text-muted)]">Showing {visibleProjects.length} of {filtered.length} projects</p>
              {visibleProjects.length < filtered.length && <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-xs font-black transition hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)]">Load {Math.min(PAGE_SIZE, filtered.length - visibleProjects.length)} more</button>}
            </div>
          </section>
        ) : (
          <State icon={<FolderKanban/>} title={projects.length ? "No projects match these filters" : "No projects yet"} text={projects.length ? "Try another search or Studio filter." : "Start with a Studio and your projects will collect here."} action={!projects.length ? <ButtonLink href="/#create" size="sm">Choose a Studio</ButtonLink> : undefined}/>
        )}
      </PageContainer>
    </main>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const config = studioConfig[project.studio];
  const Icon = config.icon;
  return (
    <Link href={projectHref(project)} className="group rounded-[1.4rem] border p-5 transition hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]" style={{ borderColor: `${config.accent}32`, background: `linear-gradient(145deg,var(--surface-strong),${config.accent}0d)` }}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${config.accent}16`, color: config.accent }}><Icon size={18}/></span>
        <span className="min-w-0 flex-1"><span className="block text-[.58rem] font-black uppercase tracking-[.14em]" style={{ color: config.accent }}>{config.label} Studio</span><strong className="mt-1.5 block truncate text-base font-black">{project.name}</strong></span>
        <ArrowRight size={15} className="mt-1 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--accent-strong)]"/>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3"><StatusPill>{project.status || "Active"}</StatusPill><span className="text-[.64rem] font-bold text-[var(--text-muted)]">Updated {formatDate(project.updatedAt)}</span></div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-[.56rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function State({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="mt-5 grid min-h-[300px] place-items-center rounded-[1.8rem] border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{icon}</span><h2 className="mt-4 text-xl font-black">{title}</h2><p className="mt-2 max-w-md text-sm font-semibold text-[var(--text-secondary)]">{text}</p>{action && <div className="mt-4">{action}</div>}</div></div>;
}

function projectHref(project: Project) {
  if (project.studio === "brand") return `/dashboard/brand/${project.id}`;
  if (project.studio === "architecture") return `/dashboard/architecture/${project.id}`;
  return `/${project.studio === "interior" ? "interior-studio" : "marketing-studio"}?project=${encodeURIComponent(project.id)}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: response.ok ? "The server returned an invalid response." : `Projects request failed (${response.status}).` };
  }
}
