"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/heyy";

type GenerationJob = {
  id: string;
  projectId: string | null;
  tool: string;
  label: string;
  href: string;
  provider: string | null;
  status: string;
  error: string | null;
  credits: number;
  creditStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
};

const ACTIVE = new Set(["queued", "processing", "finalizing"]);

export default function GenerationActivity() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/account/generation-jobs", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || "Generation activity could not be loaded.");
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Generation activity could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    void load();
    const interval = window.setInterval(() => {
      if (active && document.visibilityState === "visible") void load(true);
    }, 12_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [supabase]);

  const activeCount = jobs.filter((job) => ACTIVE.has(job.status)).length;
  const visibleJobs = jobs.slice(0, 6);

  return (
    <section className="mt-5">
      <GlassCard className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Clock3 size={16}/></span>
            <div>
              <h2 className="text-lg font-black tracking-[-.035em]">Generation activity</h2>
              <p className="text-xs font-semibold text-[var(--text-muted)]">Latest background generation statuses</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 text-[.65rem] font-black text-[var(--accent-strong)]">
                <Loader2 size={14} className="animate-spin" /> {activeCount} in progress
              </span>
            )}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)] disabled:opacity-50"
              aria-label="Refresh generation activity"
            >
              <RefreshCcw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-[58px] animate-pulse rounded-xl bg-[var(--surface-hover)]" />)}
          </div>
        ) : error ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300/60 bg-red-500/10 p-3 text-xs font-bold text-red-700 dark:text-red-200">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-black text-[var(--text-primary)]">Retry</button>
          </div>
        ) : visibleJobs.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleJobs.map((job) => <GenerationRow key={job.id} job={job} />)}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] p-3">
            <Sparkles size={18} className="text-[var(--accent-strong)]" />
            <p className="text-xs font-semibold text-[var(--text-muted)]">Your latest AI jobs will appear here as soon as they start.</p>
          </div>
        )}
      </GlassCard>
    </section>
  );
}

function GenerationRow({ job }: { job: GenerationJob }) {
  const active = ACTIVE.has(job.status);
  const succeeded = job.status === "succeeded";
  const failed = job.status === "failed" || job.status === "cancelled";
  const Icon = active ? Loader2 : succeeded ? CheckCircle2 : failed ? XCircle : Clock3;
  const statusLabel = job.status === "finalizing" ? "Saving result" : humanize(job.status);
  const creditText = job.credits > 0
    ? failed || job.creditStatus === "refunded"
      ? `${job.credits} credits returned`
      : `${job.credits} credits`
    : "No credit charge";

  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : succeeded ? "bg-emerald-500/10 text-emerald-600" : failed ? "bg-red-500/10 text-red-600" : "bg-[var(--surface-hover)] text-[var(--text-muted)]"}`}>
        <Icon size={15} className={active ? "animate-spin" : ""} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <strong className="truncate text-xs font-black">{job.label}</strong>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[.5rem] font-black uppercase tracking-[.08em] ${active ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : succeeded ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : failed ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-[var(--surface-hover)] text-[var(--text-muted)]"}`}>{statusLabel}</span>
        </span>
        <span className="mt-0.5 block truncate text-[.62rem] font-semibold text-[var(--text-muted)]" title={failed && job.error ? job.error : undefined}>
          {creditText} · {formatDate(job.updatedAt || job.createdAt)}
        </span>
      </span>
    </div>
  );
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Generation activity request failed (${response.status}).` };
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
