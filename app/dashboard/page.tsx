"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Blocks,
  Building2,
  CheckCircle2,
  Clock3,
  FileImage,
  FolderKanban,
  ImageIcon,
  Megaphone,
  Plus,
  Sofa,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ButtonLink, CreditPill, Eyebrow, GlassCard, PageContainer, StatusPill } from "@/components/ui/heyy";
import { PLATFORM_TOOLS, VISIBLE_STUDIOS } from "@/lib/platform/platform-registry";

type ProjectItem = {
  id: string;
  name: string;
  studio: "brand" | "architecture" | "interior" | "marketing";
  href: string;
  updatedAt?: string;
  status?: string;
  progress?: number;
  subtitle?: string;
};

type ProductionJob = {
  id: string;
  project_name?: string;
  project_id?: string;
  studio?: string;
  service?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
};

type AssetItem = {
  id: string;
  title?: string;
  file_url?: string;
  thumbnail_url?: string;
  asset_type?: string;
  created_at?: string;
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  read_at?: string | null;
  created_at?: string;
  href?: string;
};

const studioIcons: Record<ProjectItem["studio"], LucideIcon> = {
  brand: WandSparkles,
  architecture: Building2,
  interior: Sofa,
  marketing: Megaphone,
};

const studioAccent: Record<ProjectItem["studio"], string> = {
  brand: "#a23ce0",
  architecture: "#1676e8",
  interior: "#d06b14",
  marketing: "#eb3d87",
};

export default function DashboardPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, loading: authLoading, plan, credits } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout_success") === "true") {
      const redirect = window.localStorage.getItem("afterSubscribeRedirect");
      if (redirect) {
        window.localStorage.removeItem("afterSubscribeRedirect");
        window.location.href = redirect;
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/dashboard")}`;
      return;
    }

    let active = true;
    const userId = user.id;

    async function loadProjects() {
      setProjectsLoading(true);
      const [brands, architecture, generic] = await Promise.allSettled([
        supabase.from("brand_projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
        supabase.from("architecture_projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
        supabase.from("studio_projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(30),
      ]);

      if (!active) return;
      const brandRows = settledRows<any>(brands);
      const architectureRows = settledRows<any>(architecture);
      const genericRows = settledRows<any>(generic);
      const mapped: ProjectItem[] = [
        ...brandRows.map((item) => ({
          id: String(item.id),
          name: item.business_name || item.project_name || item.name || "Untitled brand",
          studio: "brand" as const,
          href: `/dashboard/brand/${item.id}`,
          updatedAt: item.updated_at || item.created_at,
          status: item.status || "Active",
          progress: numberOr(item.progress, item.brand_system ? 72 : 32),
          subtitle: item.industry || "Brand system",
        })),
        ...architectureRows.map((item) => ({
          id: String(item.id),
          name: item.project_name || item.name || "Untitled architecture project",
          studio: "architecture" as const,
          href: `/dashboard/architecture/${item.id}`,
          updatedAt: item.updated_at || item.created_at,
          status: item.status || item.current_stage || "Active",
          progress: numberOr(item.progress, item.stage_progress || 40),
          subtitle: item.project_type || item.city || "Architecture concept",
        })),
        ...genericRows.map((item) => {
          const studio = normalizeStudio(item.studio);
          return {
            id: String(item.id),
            name: item.project_name || item.name || `Untitled ${studio} project`,
            studio,
            href: `/${studio === "interior" ? "interior-studio" : "marketing-studio"}?project=${item.id}`,
            updatedAt: item.updated_at || item.created_at,
            status: item.status || "Active",
            progress: numberOr(item.progress, item.output ? 70 : 30),
            subtitle: item.project_type || item.summary || `${capitalize(studio)} project`,
          };
        }),
      ].sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));

      setProjects(mapped);
      setProjectsLoading(false);
    }

    async function loadActivity() {
      setActivityLoading(true);
      const [production, assetRows, notificationRows] = await Promise.allSettled([
        supabase.from("production_jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("project_assets").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
        supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
      ]);

      if (!active) return;
      setJobs(settledRows<ProductionJob>(production));
      setAssets(settledRows<AssetItem>(assetRows));
      setNotifications(settledRows<NotificationItem>(notificationRows));
      setActivityLoading(false);
    }

    void loadProjects();
    void loadActivity();

    return () => {
      active = false;
    };
  }, [authLoading, supabase, user]);

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Creator";
  const activeJobs = jobs.filter((job) => !["delivered", "completed", "cancelled"].includes(String(job.status || "").toLowerCase()));
  const unreadNotifications = notifications.filter((item) => !item.read_at);
  const attentionItems = [
    ...unreadNotifications.slice(0, 2).map((item) => ({
      id: `notification-${item.id}`,
      title: item.title || "New update",
      description: item.message || "A project update needs your attention.",
      href: item.href || "/notifications",
      label: "View update",
      icon: Bell,
    })),
    ...jobs.filter((job) => /review|revision|quote|payment/i.test(String(job.status))).slice(0, 3).map((job) => ({
      id: `job-${job.id}`,
      title: job.project_name || "Production update",
      description: `${job.service || "Production"} · ${job.status || "Update available"}`,
      href: "/dashboard#production",
      label: "Open project",
      icon: Blocks,
    })),
  ].slice(0, 4);

  if (authLoading || !user) return <DashboardLoading />;

  return (
    <main className="heyy-page heyy-page-grid py-8 sm:py-10">
      <PageContainer>
        <section className="relative overflow-hidden rounded-[2rem] border border-[var(--accent-border)] bg-[linear-gradient(118deg,rgba(111,45,255,.12),rgba(239,63,180,.09),rgba(46,124,246,.11))] p-6 shadow-[var(--shadow-card)] sm:p-9">
          <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[34px] border-white/20" />
          <div className="relative grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <Eyebrow>Heyy Studio Dashboard</Eyebrow>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">
                Welcome back, {displayName}.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
                Continue a project, see what needs attention and move your strongest ideas toward delivery.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink href="/brand-studio"><Plus size={15} /> New brand project</ButtonLink>
                <ButtonLink href="/architecture-studio" variant="secondary"><Building2 size={15} /> New architecture project</ButtonLink>
              </div>
            </div>
            <GlassCard className="w-full min-w-[290px] p-5 lg:w-[330px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[.6rem] font-black uppercase tracking-[.17em] text-[var(--accent-strong)]">Your account</p>
                  <p className="mt-2 truncate text-sm font-black">{user?.email}</p>
                </div>
                <StatusPill tone="info">{plan}</StatusPill>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Projects" value={projectsLoading ? "—" : projects.length} />
                <Metric label="Active jobs" value={activityLoading ? "—" : activeJobs.length} />
                <Metric label="Assets" value={activityLoading ? "—" : assets.length} />
                <Metric label="Credits" value={credits.available} accent />
              </div>
            </GlassCard>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div><Eyebrow>Continue working</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-[-.045em]">Pick up where you left off</h2></div>
              <Link href="#projects" className="text-xs font-black text-[var(--accent-strong)] hover:underline">All projects</Link>
            </div>
            {projectsLoading ? <DashboardCardSkeleton className="mt-5 h-48" /> : projects[0] ? <ContinueProject project={projects[0]} /> : <EmptyState title="Your first project starts here" description="Choose a specialist Studio and create a structured project that stays in your workspace." href="/#studios" action="Explore Studios" />}
          </GlassCard>

          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4"><div><Eyebrow>Action center</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-[-.045em]">Needs your attention</h2></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-strong)]">{attentionItems.length}</span></div>
            <div className="mt-5 space-y-2">
              {activityLoading ? (
                <div className="grid gap-2">
                  {[1, 2, 3].map((item) => <DashboardCardSkeleton key={item} className="h-[68px]" />)}
                </div>
              ) : attentionItems.length ? attentionItems.map((item) => {
                const Icon = item.icon;
                return <Link key={item.id} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)] text-[var(--accent-strong)]"><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{item.title}</span><span className="mt-0.5 block truncate text-xs font-semibold text-[var(--text-muted)]">{item.description}</span></span><ArrowRight size={15} className="text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--accent-strong)]" /></Link>;
              }) : <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-6 text-center"><CheckCircle2 className="mx-auto text-[var(--green)]" size={24}/><p className="mt-3 text-sm font-black">You’re all caught up</p><p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">New quotes, revisions and delivery updates will appear here.</p></div>}
            </div>
          </GlassCard>
        </section>

        <section id="projects" className="mt-5 scroll-mt-28">
          <GlassCard className="p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><Eyebrow>Recent work</Eyebrow><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Your projects</h2><p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">Brand, architecture, interior and marketing projects in one view.</p></div>
              <Link href="/#studios" className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2.5 text-xs font-black transition hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)]"><Plus size={14}/> New project</Link>
            </div>
            {projectsLoading ? (
              <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((item) => <DashboardCardSkeleton key={item} className="h-40" />)}
              </div>
            ) : projects.length ? (
              <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {projects.slice(0, 9).map((project) => <ProjectCard key={`${project.studio}-${project.id}`} project={project} />)}
              </div>
            ) : <div className="mt-7"><EmptyState title="No projects yet" description="Start with a Studio and your project will appear here automatically." href="/#studios" action="Choose a Studio" /></div>}
          </GlassCard>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <GlassCard id="production" className="scroll-mt-28 p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4"><div><Eyebrow>Expert production</Eyebrow><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Production status</h2></div><Link href="/contact?topic=expert-production" className="text-xs font-black text-[var(--accent-strong)] hover:underline">Request production</Link></div>
            <div className="mt-6 space-y-2">
              {activityLoading ? [1, 2, 3].map((item) => <DashboardCardSkeleton key={item} className="h-[68px]" />) : jobs.length ? jobs.slice(0, 6).map((job) => <ProductionRow key={job.id} job={job} />) : <EmptyState title="No production jobs" description="When you approve a quote and pay, the project will enter production here." href="/contact?topic=expert-production" action="Learn about production" compact />}
            </div>
          </GlassCard>

          <GlassCard id="assets" className="scroll-mt-28 p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4"><div><Eyebrow>Saved outputs</Eyebrow><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Recent assets</h2></div><span className="text-xs font-black text-[var(--text-muted)]">{assets.length} recent</span></div>
            {activityLoading ? <div className="mt-6 grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((item) => <DashboardCardSkeleton key={item} className="aspect-[4/3]" />)}</div> : assets.length ? <div className="mt-6 grid grid-cols-2 gap-3">{assets.slice(0, 6).map((asset) => <AssetCard key={asset.id} asset={asset} />)}</div> : <div className="mt-6"><EmptyState title="No saved assets yet" description="Generated images, presentation files and production deliverables will collect here." href="/tools/text-to-image" action="Create an image" compact /></div>}
          </GlassCard>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <GlassCard className="p-5 sm:p-6">
            <Eyebrow>Credit overview</Eyebrow>
            <div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-5xl font-black tracking-[-.06em]">{credits.available}</p><p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">credits available</p></div><CreditPill credits={plan} label="plan" /></div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#6f2dff,#ef3fb4)]" style={{ width: `${Math.min(100, credits.monthly ? (credits.available / credits.monthly) * 100 : 0)}%` }} /></div>
            <div className="mt-5 flex flex-wrap gap-2"><ButtonLink href="/credits" variant="secondary" size="sm">View history</ButtonLink><ButtonLink href="/billing" variant="ghost" size="sm">Manage plan</ButtonLink></div>
          </GlassCard>

          <GlassCard className="p-5 sm:p-6">
            <Eyebrow>Recommended next actions</Eyebrow>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {VISIBLE_STUDIOS.slice(2).map((studio) => <Link key={studio.id} href={studio.href || "/dashboard"} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent-border)]"><p className="text-xs font-black" style={{ color: studio.accent }}>{studio.label}</p><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{studio.description}</p><span className="mt-4 flex items-center gap-2 text-[.68rem] font-black text-[var(--text-primary)]">Start project <ArrowRight size={13} className="transition group-hover:translate-x-1"/></span></Link>)}
              {PLATFORM_TOOLS.slice(0, 2).map((tool) => <Link key={tool.id} href={tool.href} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent-border)]"><p className="text-xs font-black" style={{ color: tool.accent }}>{tool.label}</p><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{tool.description}</p><span className="mt-4 flex items-center gap-2 text-[.68rem] font-black text-[var(--text-primary)]">Open tool <ArrowRight size={13} className="transition group-hover:translate-x-1"/></span></Link>)}
            </div>
          </GlassCard>
        </section>
      </PageContainer>
    </main>
  );
}

function ContinueProject({ project }: { project: ProjectItem }) {
  const Icon = studioIcons[project.studio];
  const accent = studioAccent[project.studio];
  return (
    <Link href={project.href} className="group mt-5 block overflow-hidden rounded-[1.45rem] border p-5 transition sm:p-6" style={{ borderColor: `${accent}36`, background: `linear-gradient(120deg,var(--surface-strong),${accent}12)` }}>
      <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${accent}16`, color: accent }}><Icon size={20}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusPill tone="info">{capitalize(project.studio)}</StatusPill><StatusPill>{project.status || "Active"}</StatusPill></div><h3 className="mt-3 truncate text-2xl font-black tracking-[-.045em]">{project.name}</h3><p className="mt-1 truncate text-xs font-semibold text-[var(--text-muted)]">{project.subtitle}</p></div><ArrowRight size={19} className="mt-1 text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--accent-strong)]"/></div>
      <div className="mt-6 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className="h-full rounded-full" style={{ width: `${project.progress || 0}%`, background: `linear-gradient(90deg,${accent},#6f2dff)` }}/></div><span className="text-[.65rem] font-black text-[var(--text-muted)]">{project.progress || 0}%</span></div>
      <p className="mt-3 text-[.65rem] font-bold text-[var(--text-muted)]">Updated {formatDate(project.updatedAt)}</p>
    </Link>
  );
}

function ProjectCard({ project }: { project: ProjectItem }) {
  const Icon = studioIcons[project.studio];
  const accent = studioAccent[project.studio];
  return <Link href={project.href} data-studio={project.studio} className="group rounded-[1.35rem] border p-4 transition hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]" style={{ borderColor: `${accent}32`, background: `linear-gradient(145deg,var(--surface-strong),${accent}0d)` }}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}16`, color: accent }}><Icon size={17}/></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-black">{project.name}</p><ArrowRight size={13} className="shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-1"/></div><p className="mt-1 truncate text-[.66rem] font-semibold text-[var(--text-muted)]">{project.subtitle}</p></div></div><div className="mt-5 flex items-center justify-between gap-3"><StatusPill tone={project.studio === "architecture" ? "info" : "neutral"}>{project.status || "Active"}</StatusPill><span className="text-[.62rem] font-bold text-[var(--text-muted)]">{formatDate(project.updatedAt)}</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className="h-full rounded-full" style={{ width: `${project.progress || 0}%`, background: accent }}/></div></Link>;
}

function ProductionRow({ job }: { job: ProductionJob }) {
  const status = String(job.status || "Assigned");
  const tone = /delivered|complete/i.test(status) ? "success" : /review|revision/i.test(status) ? "warning" : "info";
  return <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Blocks size={17}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{job.project_name || "Production project"}</p><p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-muted)]">{job.service || capitalize(String(job.studio || "Production"))}</p></div><div className="text-right"><StatusPill tone={tone}>{status}</StatusPill><p className="mt-1 text-[.58rem] font-bold text-[var(--text-muted)]">{formatDate(job.updated_at || job.created_at)}</p></div></div>;
}

function AssetCard({ asset }: { asset: AssetItem }) {
  const src = asset.thumbnail_url || asset.file_url;
  return <a href={asset.file_url || "#"} target={asset.file_url ? "_blank" : undefined} rel="noreferrer" className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--accent-border)]"><div className="grid aspect-[4/3] place-items-center overflow-hidden bg-[linear-gradient(135deg,var(--accent-soft),rgba(46,124,246,.1))]">{src ? <img src={src} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/> : <FileImage size={24} className="text-[var(--accent-strong)]"/>}</div><div className="p-3"><p className="truncate text-xs font-black">{asset.title || "Saved asset"}</p><p className="mt-1 text-[.6rem] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]">{asset.asset_type || "Asset"}</p></div></a>;
}

function EmptyState({ title, description, href, action, compact = false }: { title: string; description: string; href: string; action: string; compact?: boolean }) {
  return <div className={`rounded-2xl border border-dashed border-[var(--border-strong)] text-center ${compact ? "p-5" : "p-8"}`}><Sparkles size={compact ? 20 : 25} className="mx-auto text-[var(--accent-strong)]"/><h3 className="mt-3 text-sm font-black">{title}</h3><p className="mx-auto mt-2 max-w-md text-xs font-semibold leading-5 text-[var(--text-muted)]">{description}</p><Link href={href} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[var(--accent-strong)] hover:underline">{action}<ArrowRight size={13}/></Link></div>;
}

function Metric({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{label}</p><p className={`mt-2 text-2xl font-black ${accent ? "text-[var(--accent-strong)]" : ""}`}>{value}</p></div>;
}


function DashboardCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] ${className}`}
      aria-hidden="true"
    />
  );
}

function DashboardLoading() {
  return <main className="heyy-page flex min-h-[calc(100vh-var(--header-height))] items-center justify-center p-6"><GlassCard className="w-full max-w-xl p-8"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6f2dff,#ef3fb4)] text-white"><Sparkles size={19}/></span><div><Eyebrow>Heyy Studio Workspace</Eyebrow><h1 className="mt-2 text-2xl font-black">Preparing your dashboard</h1></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{[1,2,3,4].map((item)=><span key={item} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-hover)]"/>)}</div></GlassCard></main>;
}


function settledRows<T>(result: PromiseSettledResult<{ data: T[] | null }>): T[] {
  return result.status === "fulfilled" ? result.value.data || [] : [];
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}
function timestamp(value?: string) { const time = value ? new Date(value).getTime() : 0; return Number.isFinite(time) ? time : 0; }
function numberOr(value: unknown, fallback: number) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback; }
function normalizeStudio(value: unknown): "interior" | "marketing" { return String(value || "").includes("marketing") ? "marketing" : "interior"; }
function capitalize(value: string) { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
