"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { Button, Eyebrow, GlassCard } from "@/components/ui/heyy";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Project = {
  id: string;
  name: string;
  studio: "brand" | "architecture" | "interior" | "marketing";
  sourceTable: "brand_projects" | "architecture_projects" | "studio_projects";
  status: string;
  updatedAt: string | null;
  hasProductionHistory: boolean;
  canDelete: boolean;
};

async function token() {
  const { data, error } = await createSupabaseBrowserClient().auth.getSession();
  const value = data.session?.access_token;
  if (error || !value) throw new Error("Your session expired. Sign in again.");
  return value;
}

export default function PrivacyDataPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [accountConfirmation, setAccountConfirmation] = useState("");
  const [accountReason, setAccountReason] = useState("");
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const deletableCount = useMemo(
    () => projects.filter((project) => project.canDelete).length,
    [projects],
  );

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const access = await token();
      const response = await fetch("/api/account/projects", {
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Project data could not be loaded.");
      setProjects(data.projects || []);
      setProjectsLoaded(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Project data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function toggleProjects() {
    const nextOpen = !projectsOpen;
    setProjectsOpen(nextOpen);
    if (nextOpen && !projectsLoaded && !loading) {
      void loadProjects();
    }
  }

  async function deleteProject() {
    if (!deleteTarget) return;
    setDeleting(true);
    setMessage("");
    setError("");
    try {
      const access = await token();
      const response = await fetch("/api/account/projects", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: deleteTarget.id,
          sourceTable: deleteTarget.sourceTable,
          confirmation: deleteConfirmation,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Project data could not be deleted.");
      setProjects((current) => current.filter((item) => item.id !== deleteTarget.id));
      setMessage(`${deleteTarget.name} was removed from your personal project data.`);
      setDeleteTarget(null);
      setDeleteConfirmation("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Project data could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  async function requestAccountDeletion() {
    setAccountDeleting(true);
    setMessage("");
    setError("");
    try {
      const access = await token();
      const response = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: accountConfirmation, reason: accountReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Account deletion could not be requested.");
      setMessage(data.message || "Your account deletion request has been recorded.");
      setAccountDeleteOpen(false);
      setAccountConfirmation("");
      setAccountReason("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Account deletion could not be requested.");
    } finally {
      setAccountDeleting(false);
    }
  }

  return (
    <AccountLayout>
      <div>
        <Eyebrow>Account</Eyebrow>
        <h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-5xl">Privacy & data</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
          Manage personal project deletion and account-deletion requests from one place.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-6 flex items-start gap-2 rounded-2xl border border-emerald-300/60 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {message}
        </div>
      )}

      <GlassCard className="mt-7 p-6 sm:p-7">
        <ShieldCheck size={22} className="text-[var(--accent-strong)]" />
        <h2 className="mt-5 text-xl font-black">Your privacy controls</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
          You can remove eligible personal Studio projects below or request deletion of your Heyy Studio account. Some completed billing, production or security records may need to be retained where required for legitimate business or legal reasons.
        </p>
      </GlassCard>

      <GlassCard className="mt-5 overflow-hidden">
        <button
          type="button"
          onClick={toggleProjects}
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-black/[.025] dark:hover:bg-white/[.025] sm:px-7"
          aria-expanded={projectsOpen}
        >
          <div className="min-w-0">
            <p className="text-[.65rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">Personal project data</p>
            <h2 className="mt-1 text-xl font-black">Delete individual projects</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-muted)]">
              Remove eligible Studio projects. Projects with quote or production history stay protected.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {projectsLoaded && !loading && (
              <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[.68rem] font-black text-[var(--text-secondary)] sm:inline-flex">
                {deletableCount} deletable · {projects.length} total
              </span>
            )}
            <ChevronDown
              size={19}
              className={`text-[var(--text-muted)] transition-transform ${projectsOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {projectsOpen && (
          <div className="border-t border-[var(--border)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 sm:px-7">
              <span className="text-xs font-bold text-[var(--text-muted)]">
                {projectsLoaded && !loading
                  ? `${deletableCount} of ${projects.length} projects can be deleted`
                  : "Loading your Studio projects…"}
              </span>
              <Button variant="ghost" onClick={() => void loadProjects()} disabled={loading}>
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
              </Button>
            </div>

            {loading ? (
              <div className="grid min-h-40 place-items-center p-8">
                <LoaderCircle className="animate-spin text-[var(--accent-strong)]" />
              </div>
            ) : projects.length === 0 ? (
              <div className="p-8 text-center text-sm font-bold text-[var(--text-muted)]">No Studio project data was found.</div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {projects.map((project) => (
                  <div key={`${project.sourceTable}:${project.id}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-[var(--text-primary)]">{project.name}</p>
                        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[.6rem] font-black uppercase tracking-[.1em] text-[var(--accent-strong)]">
                          {project.studio}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                        {project.status}{project.updatedAt ? ` · Updated ${new Date(project.updatedAt).toLocaleDateString()}` : ""}
                      </p>
                      {project.hasProductionHistory && (
                        <p className="mt-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          Protected: quote/production history attached.
                        </p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      disabled={!project.canDelete}
                      onClick={() => {
                        setDeleteTarget(project);
                        setDeleteConfirmation("");
                        setError("");
                      }}
                    >
                      <Trash2 size={15} /> Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      <GlassCard className="mt-5 border-red-300/50 p-7">
        <TriangleAlert size={22} className="text-red-500" />
        <h2 className="mt-5 text-xl font-black">Delete Heyy Studio account</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
          Submit an account-deletion request when you want your Heyy Studio identity and personal workspace data removed. Completed financial and production records may need to be retained or anonymised separately where required.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => setAccountDeleteOpen(true)}>
          <Trash2 size={16} /> Request account deletion
        </Button>
      </GlassCard>

      {deleteTarget && (
        <Modal onClose={() => !deleting && setDeleteTarget(null)}>
          <LockKeyhole size={24} className="text-red-500" />
          <h3 className="mt-4 text-2xl font-black">Delete {deleteTarget.name}?</h3>
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            This removes the eligible Studio project, generated project assets and source files from your personal workspace. This cannot be undone.
          </p>
          <label className="mt-5 block text-xs font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Type DELETE</label>
          <input className="heyy-input mt-2 w-full" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoFocus />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="secondary" disabled={deleting || deleteConfirmation !== "DELETE"} onClick={() => void deleteProject()}>
              {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete project
            </Button>
          </div>
        </Modal>
      )}

      {accountDeleteOpen && (
        <Modal onClose={() => !accountDeleting && setAccountDeleteOpen(false)}>
          <ShieldCheck size={24} className="text-red-500" />
          <h3 className="mt-4 text-2xl font-black">Request account deletion</h3>
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            This records a formal deletion request for the signed-in account. We may contact you if additional verification is needed before the request is completed.
          </p>
          <label className="mt-5 block text-xs font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Optional reason</label>
          <textarea className="heyy-input mt-2 min-h-24 w-full resize-y" value={accountReason} onChange={(event) => setAccountReason(event.target.value)} placeholder="Optional" />
          <label className="mt-5 block text-xs font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Type DELETE MY ACCOUNT</label>
          <input className="heyy-input mt-2 w-full" value={accountConfirmation} onChange={(event) => setAccountConfirmation(event.target.value)} />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" disabled={accountDeleting} onClick={() => setAccountDeleteOpen(false)}>Cancel</Button>
            <Button variant="secondary" disabled={accountDeleting || accountConfirmation !== "DELETE MY ACCOUNT"} onClick={() => void requestAccountDeletion()}>
              {accountDeleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Submit deletion request
            </Button>
          </div>
        </Modal>
      )}
    </AccountLayout>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl rounded-[28px] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl sm:p-7">
        {children}
      </div>
    </div>
  );
}
