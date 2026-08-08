"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ProductionDeliverables from "@/components/production/admin/ProductionDeliverables";
import ProductionInternalNotes from "@/components/production/admin/ProductionInternalNotes";
import ProductionMessages from "@/components/production/admin/ProductionMessages";
import ProductionRevisions from "@/components/production/admin/ProductionRevisions";
import ProductionChecklist from "@/components/production/shared/ProductionChecklist";
import { VISIBLE_STUDIOS } from "../../../../lib/platform/platform-registry";
import HeyySelect from "@/components/ui/heyy-select";

type ProductionJob = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  user_id: string | null;
  studio: string | null;
  service: string | null;
  status: string | null;
  priority: string | null;
  delivery_status: string | null;
  preview_image: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  assigned_studio: string | null;
  notes: string | null;
  internal_notes: string | null;
  deliverables: any;
  metadata: any;
  created_at: string;
  updated_at: string;
  unread_client_messages?: number;
};

type WorkspaceTab = "Workbench" | "Communication" | "Project Context";

type CommunicationView = "Client Messages" | "Internal Notes";

const TABS: WorkspaceTab[] = ["Workbench", "Communication", "Project Context"];

const LEGACY_TAB_MAP: Record<string, WorkspaceTab> = {
  Overview: "Workbench",
  Deliverables: "Workbench",
  Revisions: "Workbench",
  Timeline: "Workbench",
  Messages: "Communication",
  "Internal Notes": "Communication",
  "Brand System": "Project Context",
  "Brand Book": "Project Context",
};

const STATUS_OPTIONS = [
  "Waiting Assignment",
  "Assigned",
  "In Progress",
  "Ready For Review",
  "Client Reviewing",
  "Approved",
  "Delivered",
];

const PRIORITY_OPTIONS = ["Low", "Normal", "High", "Urgent"];

const STUDIO_OPTIONS = VISIBLE_STUDIOS.map((studio) => ({
  id: studio.id,
  label: studio.label,
}));

export default function ProductionWorkspace() {
  const router = useRouter();
  const routeParams = useParams();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedStudio, setAssignedStudio] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0);
  const [communicationView, setCommunicationView] =
    useState<CommunicationView>("Client Messages");

  const jobId = String(routeParams.id || "");
  const rawTab = searchParams.get("tab") || "Workbench";
  const activeTab = (LEGACY_TAB_MAP[rawTab] ||
    (TABS.includes(rawTab as WorkspaceTab)
      ? rawTab
      : "Workbench")) as WorkspaceTab;

  async function loadTimeline(id: string) {
    try {
      const response = await fetch(
        `/api/admin/production-timeline?jobId=${encodeURIComponent(id)}`,
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setTimeline(data.timeline || []);
      }
    } catch (error) {
      console.error("Timeline load error:", error);
    }
  }

  async function loadJob(options: { silent?: boolean } = {}) {
    if (!jobId) return;

    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);

    try {
      const response = await fetch(
        `/api/admin/production-job?id=${encodeURIComponent(jobId)}`,
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load production job");
      }

      const loadedJob = data.job as ProductionJob;

      setJob(loadedJob);
      setStatus(loadedJob.status || "Waiting Assignment");
      setPriority(loadedJob.priority || "Normal");
      setAssignedStudio(loadedJob.assigned_studio || loadedJob.studio || "");
      setInternalNotes(loadedJob.internal_notes || "");
      setChecklistRefreshKey((value) => value + 1);

      await loadTimeline(loadedJob.id);
    } catch (error) {
      console.error("Production job load error:", error);
      if (!silent) setJob(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadJob();
  }, [jobId]);

  async function saveInternalNotes() {
    if (!job || notesSaving) return;

    setNotesSaving(true);
    setNotesSaved(false);

    try {
      const response = await fetch("/api/admin/update-production-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: job.id,
          internal_notes: internalNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not save internal notes");
      }

      setJob(data.job);
      setInternalNotes(data.job.internal_notes || "");
      setNotesSaved(true);
      window.setTimeout(() => setNotesSaved(false), 2200);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save internal notes",
      );
    } finally {
      setNotesSaving(false);
    }
  }

  async function saveJob() {
    if (!job) return;

    setSaving(true);

    try {
      const response = await fetch("/api/admin/update-production-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: job.id,
          status,
          priority,
          assigned_studio: assignedStudio,
          internal_notes: internalNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not save production job");
      }

      setJob(data.job);
      setChecklistRefreshKey((value) => value + 1);
      await loadTimeline(data.job.id);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save production job",
      );
    } finally {
      setSaving(false);
    }
  }

  function changeTab(tab: WorkspaceTab) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tab);
    router.replace(`${window.location.pathname}?${nextParams.toString()}`, {
      scroll: false,
    });
  }

  const metadata = useMemo(() => job?.metadata || {}, [job]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f7fb] text-sm font-black text-violet-700">
        Loading Production Workspace...
      </main>
    );
  }

  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f7fb] text-sm font-black text-violet-700">
        Production job not found.
      </main>
    );
  }

  return (
    <main
      className="heyy-production-v2 min-h-screen"
      style={{
        backgroundColor: "#f8f7fb",
        color: "#17151f",
        colorScheme: "light",
      }}
    >
      <style>{`
        .heyy-production-v2 {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: clip;
        }

        .heyy-production-v2,
        .heyy-production-v2 * { box-sizing: border-box; }

        .heyy-production-v2 button,
        .heyy-production-v2 input,
        .heyy-production-v2 textarea,
        .heyy-production-v2 select { font: inherit; }

        .heyy-production-v2 button { -webkit-tap-highlight-color: transparent; }

        .heyy-prod-shell {
          width: 100%;
          max-width: 1600px;
          min-width: 0;
          margin: 0 auto;
          padding: 16px 24px 44px;
        }

        .heyy-prod-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid #ddd0f4 !important;
          border-radius: 28px !important;
          background: linear-gradient(135deg,#ffffff 0%,#f6f0ff 55%,#eadcff 100%) !important;
          color: #17151f !important;
          padding: 28px 32px !important;
          box-shadow: 0 18px 42px rgba(73,35,116,.10) !important;
        }

        .heyy-prod-hero::after {
          content: "/";
          position: absolute;
          right: 28px;
          top: 50%;
          transform: translateY(-50%) rotate(20deg);
          font-size: 180px;
          line-height: 1;
          font-weight: 900;
          color: rgba(255,255,255,.76);
          pointer-events: none;
        }

        .heyy-prod-hero-inner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 24px;
        }

        .heyy-prod-back {
          border: 0 !important;
          background: transparent !important;
          color: #5e5667 !important;
          cursor: pointer !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          padding: 0 !important;
          transition: color 180ms ease !important;
        }

        .heyy-prod-back:hover { color: #6c00ff !important; }

        .heyy-prod-tabs-wrap {
          position: sticky;
          top: 0;
          z-index: 70;
          margin: 12px -24px 0;
          padding: 12px 24px;
          background: #f8f7fb;
          box-shadow: 0 12px 28px rgba(71,45,103,.10);
        }

        .heyy-prod-tabs {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 8px;
          border: 1px solid #ddd6e8 !important;
          border-radius: 22px !important;
          background: #fff !important;
          padding: 7px !important;
        }

        .heyy-prod-tab {
          min-height: 72px;
          border: 1px solid transparent !important;
          border-radius: 16px !important;
          background: #f8f7fb !important;
          color: #51495a !important;
          padding: 13px 16px !important;
          text-align: left !important;
          cursor: pointer !important;
          transition: all 200ms ease !important;
        }

        .heyy-prod-tab:hover {
          transform: translateY(-2px);
          border-color: #9b63ff !important;
          background: #f2e9ff !important;
          color: #5b00d6 !important;
        }

        .heyy-prod-tab[data-active="true"] {
          border-color: #6c00ff !important;
          background: #6c00ff !important;
          color: #fff !important;
          box-shadow: 0 12px 28px rgba(108,0,255,.22) !important;
        }

        .heyy-prod-layout {
          display: grid;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          grid-template-columns: minmax(0,1fr) minmax(280px,320px);
          align-items: start;
          gap: 16px;
          margin-top: 18px;
        }

        .heyy-prod-main {
          display: grid;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          gap: 18px;
        }

        .heyy-prod-sidebar {
          position: sticky;
          top: 112px;
          display: grid;
          width: 100%;
          max-width: 320px;
          min-width: 0;
          justify-self: end;
          gap: 14px;
        }

        .heyy-prod-main > *,
        .heyy-prod-sidebar > * {
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        .heyy-prod-card {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-wrap: anywhere;
          border: 1px solid #ddd6e8 !important;
          border-radius: 24px !important;
          background: #fff !important;
          color: #17151f !important;
          box-shadow: 0 10px 28px rgba(30,20,45,.055) !important;
          transition: transform 210ms ease,border-color 210ms ease,box-shadow 210ms ease !important;
        }

        .heyy-prod-card:hover {
          transform: translateY(-2px);
          border-color: #8d4dff !important;
          box-shadow: 0 17px 36px rgba(108,0,255,.11) !important;
        }

        .heyy-prod-overview {
          display: grid;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          grid-template-columns: minmax(0,1.1fr) minmax(320px,.9fr);
          overflow: hidden;
        }

        .heyy-prod-overview-main {
          padding: 26px;
          background: linear-gradient(135deg,#fff 0%,#f7f1ff 100%);
        }

        .heyy-prod-overview-side {
          padding: 26px;
          border-left: 1px solid #dbeafe;
          background: linear-gradient(135deg,#eff7ff 0%,#fff 100%);
        }

        .heyy-prod-info-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 10px;
          margin-top: 18px;
        }

        .heyy-prod-info {
          min-width: 0;
          border: 1px solid #e3deea !important;
          border-radius: 15px !important;
          background: rgba(255,255,255,.85) !important;
          color: #17151f !important;
          padding: 12px 13px !important;
        }

        .heyy-prod-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 24px 0;
        }

        .heyy-prod-section-body { padding: 18px 20px 20px; }

        .heyy-workflow-section {
          overflow: hidden;
          border-radius: 24px !important;
          transition: transform 210ms ease, box-shadow 210ms ease !important;
        }

        .heyy-workflow-section:hover {
          transform: translateY(-2px);
        }

        .heyy-revision-section {
          border-color: #b884ff !important;
          background: #fbf8ff !important;
          box-shadow: 0 13px 30px rgba(108,0,255,.08) !important;
        }

        .heyy-revision-section .heyy-prod-section-head {
          padding: 20px 22px;
          background: linear-gradient(135deg,#efe3ff 0%,#fbf8ff 72%);
          border-bottom: 1px solid #d9c0ff;
        }

        .heyy-revision-section .heyy-prod-section-body {
          background: #fbf8ff;
        }

        .heyy-deliverables-section {
          border-color: #9ddfbb !important;
          background: #f7fff9 !important;
          box-shadow: 0 13px 30px rgba(20,145,78,.075) !important;
        }

        .heyy-deliverables-section .heyy-prod-section-head {
          padding: 20px 22px;
          background: linear-gradient(135deg,#ddf8e8 0%,#f8fff9 72%);
          border-bottom: 1px solid #bfe7d0;
        }

        .heyy-deliverables-section .heyy-prod-section-body {
          background: #f8fff9;
        }

        .heyy-workflow-head {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .heyy-workflow-icon {
          display: flex;
          width: 48px;
          height: 48px;
          flex: 0 0 48px;
          align-items: center;
          justify-content: center;
          border-radius: 15px;
          font-size: 21px;
          font-weight: 900;
        }

        .heyy-revision-section .heyy-workflow-icon {
          background: #6c00ff;
          color: #fff;
        }

        .heyy-deliverables-section .heyy-workflow-icon {
          background: #179657;
          color: #fff;
        }

        .heyy-prod-preview {
          width: 82px !important;
          height: 82px !important;
          min-width: 82px !important;
          max-width: 82px !important;
          max-height: 82px !important;
          overflow: hidden !important;
          border: 1px solid #d9c8f3 !important;
          border-radius: 19px !important;
          background: linear-gradient(135deg,#efe3ff,#fff) !important;
        }

        .heyy-prod-preview img {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: 82px !important;
          max-height: 82px !important;
          object-fit: cover !important;
        }

        .heyy-prod-field {
          display: block;
          margin-top: 14px;
        }

        .heyy-prod-label {
          display: block;
          margin-bottom: 7px;
          color: #5a5263;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .17em;
          text-transform: uppercase;
        }

        .heyy-prod-select,
        .heyy-prod-textarea {
          width: 100% !important;
          border: 1px solid #ded8e6 !important;
          border-radius: 14px !important;
          background: #f9f8fb !important;
          color: #17151f !important;
          outline: none !important;
          transition: all 180ms ease !important;
        }

        .heyy-prod-select {
          min-height: 46px !important;
          padding: 0 13px !important;
        }

        .heyy-prod-textarea {
          min-height: 220px !important;
          padding: 14px !important;
          resize: vertical !important;
        }

        .heyy-prod-select:focus,
        .heyy-prod-textarea:focus {
          border-color: #7c2cff !important;
          background: #fff !important;
          box-shadow: 0 0 0 4px rgba(124,44,255,.12) !important;
        }

        .heyy-priority-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 8px;
        }

        .heyy-priority-button {
          border: 1px solid #ded8e6 !important;
          border-radius: 12px !important;
          background: #f9f8fb !important;
          color: #5c5465 !important;
          padding: 10px !important;
          cursor: pointer !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          transition: all 180ms ease !important;
        }

        .heyy-priority-button:hover {
          border-color: #9b63ff !important;
          background: #f2e9ff !important;
          color: #5b00d6 !important;
        }

        .heyy-priority-button[data-active="true"] {
          border-color: #6c00ff !important;
          background: #6c00ff !important;
          color: #fff !important;
          box-shadow: 0 9px 22px rgba(108,0,255,.21) !important;
        }

        .heyy-prod-save {
          width: 100%;
          min-height: 49px;
          margin-top: 16px;
          border: 1px solid #17151f !important;
          border-radius: 14px !important;
          background: #17151f !important;
          color: #fff !important;
          cursor: pointer !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          transition: all 200ms ease !important;
        }

        .heyy-prod-save:hover {
          transform: translateY(-2px);
          border-color: #6c00ff !important;
          background: #6c00ff !important;
          box-shadow: 0 12px 28px rgba(108,0,255,.25) !important;
        }

        .heyy-prod-save:disabled { cursor: wait !important; opacity: .55 !important; }

        .heyy-communication-toggle {
          display: inline-flex;
          gap: 5px;
          border: 1px solid #dbeafe;
          border-radius: 15px;
          background: #fff;
          padding: 5px;
        }

        .heyy-communication-toggle button {
          border: 0 !important;
          border-radius: 11px !important;
          background: transparent !important;
          color: #64748b !important;
          padding: 9px 12px !important;
          cursor: pointer !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }

        .heyy-communication-toggle button[data-active="true"] {
          background: #6c00ff !important;
          color: #fff !important;
          box-shadow: 0 8px 20px rgba(108,0,255,.20) !important;
        }

        .heyy-timeline-item {
          display: flex;
          gap: 13px;
          border: 1px solid #e3deea;
          border-radius: 16px;
          background: #faf9fc;
          padding: 14px;
        }

        .heyy-timeline-dot {
          width: 10px;
          height: 10px;
          min-width: 10px;
          margin-top: 5px;
          border-radius: 999px;
          background: #6c00ff;
        }

        .heyy-context-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 14px;
        }

        .heyy-legacy-module,
        .heyy-legacy-module * { color-scheme: light !important; }

        .heyy-legacy-module [class*="bg-black"],
        .heyy-legacy-module [class*="bg-[#"],
        .heyy-legacy-module [class*="from-[#"],
        .heyy-legacy-module [class*="to-[#"] { background: #fff !important; }

        .heyy-legacy-module [class*="text-white"] { color: #554e5e !important; }
        .heyy-legacy-module [class*="border-white"] { border-color: #ded8e6 !important; }
        .heyy-legacy-module input,
        .heyy-legacy-module textarea,
        .heyy-legacy-module select {
          background: #fff !important;
          color: #17151f !important;
          border-color: #ded8e6 !important;
        }

        @media (max-width: 1240px) {
          .heyy-prod-layout { grid-template-columns: minmax(0,1fr); }
          .heyy-prod-sidebar {
            position: static;
            max-width: none;
            justify-self: stretch;
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
          .heyy-prod-sidebar > *:last-child { grid-column: 1 / -1; }
        }

        @media (max-width: 820px) {
          .heyy-prod-overview { grid-template-columns: minmax(0,1fr); }
          .heyy-prod-overview-side { border-top: 1px solid #dbeafe; border-left: 0; }
          .heyy-context-grid { grid-template-columns: minmax(0,1fr); }
        }

        @media (max-width: 640px) {
          .heyy-prod-shell { padding: 12px 12px 30px; }
          .heyy-prod-hero { padding: 23px 19px !important; }
          .heyy-prod-hero::after { display: none; }
          .heyy-prod-tabs-wrap { margin-left: -12px; margin-right: -12px; padding-left: 12px; padding-right: 12px; }
          .heyy-prod-tabs { grid-template-columns: minmax(0,1fr); }
          .heyy-prod-tab { min-height: 58px; }
          .heyy-prod-info-grid { grid-template-columns: minmax(0,1fr); }
          .heyy-prod-sidebar { grid-template-columns: minmax(0,1fr); }
          .heyy-prod-sidebar > *:last-child { grid-column: auto; }
        }
      `}</style>

      <div className="heyy-prod-shell">
        <header className="heyy-prod-hero">
          <div className="heyy-prod-hero-inner">
            <div>
              <button
                type="button"
                onClick={() => router.push("/admin?tab=production")}
                className="heyy-prod-back"
              >
                ← Back to Production Queue
              </button>

              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-violet-600">
                Production Workspace
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-slate-950 md:text-6xl">
                {job.project_name || "Untitled Project"}
              </h1>

              <p className="mt-2 text-sm font-bold text-slate-500 md:text-base">
                {job.service || "Production"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={status} />
              <PriorityBadge value={priority || "Normal"} />
            </div>
          </div>
        </header>

        <div className="heyy-prod-tabs-wrap">
          <nav
            className="heyy-prod-tabs"
            aria-label="Production workspace sections"
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                data-active={activeTab === tab ? "true" : "false"}
                onClick={() => changeTab(tab)}
                className="heyy-prod-tab"
              >
                <span className="flex items-center gap-2 text-sm font-black">
                  {tab}
                  {tab === "Communication" &&
                    Number(job.unread_client_messages || 0) > 0 && (
                      <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[9px] font-black text-white">
                        {Number(job.unread_client_messages) > 99
                          ? "99+"
                          : Number(job.unread_client_messages)}
                      </span>
                    )}
                </span>
                <span className="mt-1 block text-[11px] opacity-70">
                  {tabDescription(tab)}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="heyy-prod-layout">
          <section className="heyy-prod-main">
            {activeTab === "Workbench" && (
              <Workbench
                job={job}
                metadata={metadata}
                status={status}
                timeline={timeline}
                onReload={() => loadJob({ silent: true })}
              />
            )}

            {activeTab === "Communication" && (
              <section className="heyy-prod-card overflow-hidden">
                <div className="heyy-prod-section-head">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                      Communication
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">
                      Conversations & private notes
                    </h2>
                  </div>

                  <div className="heyy-communication-toggle">
                    {(["Client Messages", "Internal Notes"] as const).map(
                      (view) => (
                        <button
                          key={view}
                          type="button"
                          data-active={
                            communicationView === view ? "true" : "false"
                          }
                          onClick={() => setCommunicationView(view)}
                        >
                          {view}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="heyy-prod-section-body heyy-legacy-module">
                  {communicationView === "Client Messages" ? (
                    <ProductionMessages
                      jobId={job.id}
                      onRead={() =>
                        setJob((current) =>
                          current
                            ? { ...current, unread_client_messages: 0 }
                            : current,
                        )
                      }
                    />
                  ) : (
                    <ProductionInternalNotes
                      value={internalNotes}
                      onChange={(value) => {
                        setInternalNotes(value);
                        setNotesSaved(false);
                      }}
                      onSave={saveInternalNotes}
                      saving={notesSaving}
                      saved={notesSaved}
                    />
                  )}
                </div>
              </section>
            )}

            {activeTab === "Project Context" && (
              <ProjectContext job={job} metadata={metadata} />
            )}
          </section>

          <aside className="heyy-prod-sidebar">
            <JobSummary job={job} metadata={metadata} />

            <JobControl
              status={status}
              priority={priority}
              assignedStudio={assignedStudio}
              saving={saving}
              onStatusChange={setStatus}
              onPriorityChange={setPriority}
              onAssignedStudioChange={setAssignedStudio}
              onSave={saveJob}
            />

            <details className="heyy-prod-card overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">
                    Progress
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">
                    Production Checklist
                  </h3>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                  ↓
                </span>
              </summary>

              <div className="heyy-legacy-module border-t border-slate-200 p-4">
                <ProductionChecklist
                  jobId={job.id}
                  refreshKey={checklistRefreshKey}
                />
              </div>
            </details>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Workbench({
  job,
  metadata,
  status,
  timeline,
  onReload,
}: {
  job: ProductionJob;
  metadata: any;
  status: string;
  timeline: any[];
  onReload: () => Promise<void>;
}) {
  const action = nextAction(status);
  const brief =
    metadata.selected_application?.description ||
    metadata.description ||
    job.notes ||
    "No production brief was attached.";

  return (
    <>
      <section className="heyy-prod-card heyy-prod-overview">
        <div className="heyy-prod-overview-main">
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={status} />
            <SmallBadge value={job.delivery_status || "Pending"} />
            <PriorityBadge value={job.priority || "Normal"} />
          </div>

          <p className="mt-7 text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
            Current Action
          </p>
          <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.04em] text-slate-950">
            {action.title}
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            {action.description}
          </p>
        </div>

        <div className="heyy-prod-overview-side">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
            Production Brief
          </p>
          <p className="mt-3 line-clamp-6 text-sm leading-7 text-slate-600">
            {brief}
          </p>

          <div className="heyy-prod-info-grid">
            <InfoTile label="Project" value={job.project_name || "-"} />
            <InfoTile label="Service" value={job.service || "-"} />
            <InfoTile label="Studio" value={job.studio || "-"} />
            <InfoTile
              label="Assigned"
              value={job.assigned_studio || "Unassigned"}
            />
          </div>
        </div>
      </section>

      <section className="heyy-prod-card heyy-workflow-section heyy-revision-section">
        <div className="heyy-prod-section-head">
          <div className="heyy-workflow-head">
            <span className="heyy-workflow-icon">↔</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
                Client Conversation
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
                Revision Workspace
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Feedback, studio replies and revised files in one conversation.
              </p>
            </div>
          </div>
        </div>
        <div className="heyy-prod-section-body">
          <ProductionRevisions job={job} />
        </div>
      </section>

      <section className="heyy-prod-card heyy-workflow-section heyy-deliverables-section">
        <div className="heyy-prod-section-head">
          <div className="heyy-workflow-head">
            <span className="heyy-workflow-icon">↓</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                Final Handoff
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
                Production Deliverables
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Manage versions, select finals and publish approved files to the
                client.
              </p>
            </div>
          </div>
        </div>
        <div className="heyy-prod-section-body">
          <ProductionDeliverables job={job} onUploaded={onReload} />
        </div>
      </section>

      <details className="heyy-prod-card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-600">
              Activity
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-950">
              Production Timeline
            </h3>
          </div>
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700">
            ↓
          </span>
        </summary>

        <div className="space-y-3 border-t border-slate-200 p-5">
          <TimelineItem
            title="Production Requested"
            description="The client submitted this production request."
            date={job.created_at}
          />
          {timeline.map((item) => (
            <TimelineItem
              key={item.id}
              title={item.title}
              description={item.description}
              date={item.created_at}
            />
          ))}
        </div>
      </details>
    </>
  );
}

function JobSummary({ job, metadata }: { job: ProductionJob; metadata: any }) {
  const clientName =
    job.client_name || metadata.client_name || "Logged-in User";
  const clientEmail =
    job.client_email || metadata.client_email || "No email attached";

  return (
    <section className="heyy-prod-card p-5">
      <div className="flex gap-4">
        <div className="heyy-prod-preview">
          {job.preview_image ? (
            <img src={job.preview_image} alt={job.service || "Preview"} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-violet-500">
              HEYY
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
            Job Summary
          </p>
          <h2 className="mt-2 truncate text-xl font-black text-slate-950">
            {job.service || "Production"}
          </h2>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
            {metadata.description ||
              metadata.selected_application?.description ||
              "No description attached."}
          </p>
        </div>
      </div>

      <div className="heyy-prod-info-grid">
        <InfoTile label="Client" value={clientName} />
        <InfoTile label="Requested" value={formatDate(job.created_at)} />
        <InfoTile label="Studio" value={job.studio || "-"} />
        <InfoTile label="Delivery" value={job.delivery_status || "Pending"} />
      </div>

      <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.17em] text-blue-600">
          Client Email
        </p>
        <p className="mt-2 break-all text-xs font-bold text-slate-700">
          {clientEmail}
        </p>
      </div>
    </section>
  );
}

function JobControl({
  status,
  priority,
  assignedStudio,
  saving,
  onStatusChange,
  onPriorityChange,
  onAssignedStudioChange,
  onSave,
}: {
  status: string;
  priority: string;
  assignedStudio: string;
  saving: boolean;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onAssignedStudioChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="heyy-prod-card p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
        Job Control
      </p>
      <h3 className="mt-2 text-xl font-black text-slate-950">
        Production settings
      </h3>

      <label className="heyy-prod-field">
        <span className="heyy-prod-label">Status</span>
        <div className="mt-3"><HeyySelect value={status} tone="admin" ariaLabel="Production status" options={STATUS_OPTIONS} onChange={onStatusChange} /></div>
      </label>

      <div className="heyy-prod-field">
        <span className="heyy-prod-label">Priority</span>
        <div className="heyy-priority-grid">
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              data-active={priority === option ? "true" : "false"}
              onClick={() => onPriorityChange(option)}
              className="heyy-priority-button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <label className="heyy-prod-field">
        <span className="heyy-prod-label">Assigned Studio</span>
        <div className="mt-3"><HeyySelect value={assignedStudio} tone="admin" ariaLabel="Assigned Studio" placeholder="Unassigned" options={STUDIO_OPTIONS.map((studio) => ({ value: studio.id, label: studio.label }))} onChange={onAssignedStudioChange} /></div>
      </label>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="heyy-prod-save"
      >
        {saving ? "Saving Changes..." : "Save Job Changes"}
      </button>
    </section>
  );
}

function ProjectContext({
  job,
  metadata,
}: {
  job: ProductionJob;
  metadata: any;
}) {
  const selectedApplication = metadata.selected_application || {};
  const brief =
    selectedApplication.description || metadata.description || job.notes || "";
  const usage = selectedApplication.usage || metadata.usage || "";
  const expertNote =
    selectedApplication.expertNote ||
    metadata.expertNote ||
    metadata.expert_note ||
    "";
  const generatedAssets = Array.isArray(metadata.generated_assets)
    ? metadata.generated_assets
    : Array.isArray(metadata.project_context?.all_generated_outputs)
      ? metadata.project_context.all_generated_outputs
      : [];

  const contextObjects = [
    metadata.brand_system,
    metadata.brandSystem,
    metadata.brand,
    metadata.brand_book,
    metadata.brandBook,
  ].filter(
    (value) =>
      value && typeof value === "object" && Object.keys(value).length > 0,
  );

  return (
    <>
      <section className="heyy-prod-card p-6 md:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
          Project Context
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
          Brief, brand and source material
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Reference information attached to this production request.
        </p>
      </section>

      <div className="heyy-context-grid">
        {brief && (
          <ContextCard title="Application Brief" value={brief} tone="violet" />
        )}
        {usage && (
          <ContextCard title="Best Used For" value={usage} tone="blue" />
        )}
        {job.notes && job.notes !== brief && (
          <ContextCard
            title="Client Production Notes"
            value={job.notes}
            tone="emerald"
          />
        )}
        {expertNote && (
          <ContextCard
            title="Expert Production Note"
            value={expertNote}
            tone="amber"
          />
        )}
      </div>

      <ProductionGeneratedAssets assets={generatedAssets} />

      {contextObjects.length > 0 ? (
        contextObjects.map((context, index) => (
          <section key={index} className="heyy-prod-card p-6">
            <h3 className="text-2xl font-black text-slate-950">
              {index === 0 ? "Brand Context" : `Brand Context ${index + 1}`}
            </h3>
            <StructuredContext value={context} />
          </section>
        ))
      ) : (
        <section className="heyy-prod-card p-6">
          <h3 className="text-2xl font-black text-slate-950">Brand Context</h3>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            No structured brand system was attached to this production request.
          </p>
        </section>
      )}
    </>
  );
}

function productionAssetRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function productionAssetImage(asset: any) {
  return [
    asset?.image_url,
    productionAssetRecord(asset?.final_assets).preview_url,
    productionAssetRecord(asset?.rendered_final_assets).preview_url,
    productionAssetRecord(asset?.preview_assets).preview_url,
    productionAssetRecord(asset?.rendered_preview_assets).preview_url,
    productionAssetRecord(asset?.technical_assets).preview_url,
  ].find((value) => typeof value === "string" && value.length > 0) as string | undefined;
}

function productionAssetPath(asset: any) {
  return [
    asset?.storage_path,
    productionAssetRecord(asset?.final_assets).master_storage_path,
    productionAssetRecord(asset?.rendered_final_assets).master_storage_path,
    productionAssetRecord(asset?.preview_assets).master_storage_path,
    productionAssetRecord(asset?.rendered_preview_assets).master_storage_path,
    productionAssetRecord(asset?.technical_assets).master_storage_path,
  ].find((value) => typeof value === "string" && value.length > 0) as string | undefined;
}

function ProductionGeneratedAssets({ assets }: { assets: any[] }) {
  if (!assets.length) return null;
  return (
    <section className="heyy-prod-card p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Generated Project Package</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Directions, concepts, plans, sections, visuals and tour views</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">The complete generated package, design context and storage references captured when the client requested production.</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-blue-700">{assets.length} outputs</span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset, index) => {
          const imageUrl = productionAssetImage(asset);
          const storagePath = productionAssetPath(asset);
          const title = asset?.title || String(asset?.visual_type || `Output ${index + 1}`).replace(/_/g, " ");
          return (
            <article key={asset?.id || `${asset?.visual_type}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {imageUrl ? (
                <a href={imageUrl} target="_blank" rel="noreferrer" className="block bg-slate-100">
                  <img src={imageUrl} alt={title} className="h-44 w-full object-contain" />
                </a>
              ) : (
                <div className="grid h-44 place-items-center bg-slate-50 px-5 text-center text-xs font-bold text-slate-400">Stored project output</div>
              )}
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-blue-700">{String(asset?.group || "output").replace(/_/g, " ")}</span>
                  {asset?.is_approved && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-emerald-700">Approved</span>}
                </div>
                <h4 className="mt-3 text-sm font-black capitalize text-slate-900">{title}</h4>
                {storagePath && <p className="mt-3 break-all rounded-xl bg-slate-50 p-2 text-[9px] leading-4 text-slate-400">{storagePath}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StructuredContext({ value }: { value: any }) {
  const entries = Object.entries(value || {}).filter(
    ([key, item]) =>
      ![
        "id",
        "project_id",
        "user_id",
        "created_at",
        "updated_at",
        "preview_image",
      ].includes(key) &&
      item !== null &&
      item !== undefined &&
      item !== "",
  );

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {entries.slice(0, 20).map(([key, item]) => (
        <div
          key={key}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
            {formatLabel(key)}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
            {formatContextValue(item)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ContextCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "violet" | "blue" | "emerald" | "amber";
}) {
  const classes = {
    violet: "border-violet-200 bg-violet-50",
    blue: "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
  }[tone];

  return (
    <section className={`heyy-prod-card p-6 ${classes}`}>
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
        {value}
      </p>
    </section>
  );
}

function TimelineItem({
  title,
  description,
  date,
}: {
  title: string;
  description?: string;
  date: string;
}) {
  return (
    <div className="heyy-timeline-item">
      <span className="heyy-timeline-dot" />
      <div>
        <h4 className="font-black text-slate-900">{title}</h4>
        {description && (
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        )}
        <p className="mt-2 text-xs text-slate-400">{formatDateTime(date)}</p>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="heyy-prod-info">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 truncate text-xs font-bold text-slate-700">{value}</p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-violet-200 bg-violet-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-violet-700">
      {value}
    </span>
  );
}

function SmallBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
      {value}
    </span>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const normalized = String(value || "Normal").toLowerCase();
  let classes = "border-slate-200 bg-white text-slate-600";

  if (normalized === "urgent") {
    classes = "border-rose-200 bg-rose-100 text-rose-700";
  } else if (normalized === "high") {
    classes = "border-orange-200 bg-orange-100 text-orange-700";
  } else if (normalized === "low") {
    classes = "border-blue-200 bg-blue-100 text-blue-700";
  }

  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] ${classes}`}
    >
      {value || "Normal"}
    </span>
  );
}

function tabDescription(tab: WorkspaceTab) {
  if (tab === "Workbench") return "Revisions, deliverables and timeline";
  if (tab === "Communication") return "Client messages and private notes";
  return "Brief, brand and source material";
}

function nextAction(status: string) {
  switch (status) {
    case "Waiting Assignment":
      return {
        title: "Assign the job and confirm the production owner.",
        description:
          "Review the brief, select the responsible studio and move the job to Assigned.",
      };
    case "Assigned":
      return {
        title: "Start production when the team is ready.",
        description:
          "Confirm the brief and source material, then move the job to In Progress.",
      };
    case "In Progress":
      return {
        title: "Complete the active work and prepare files.",
        description:
          "Respond to revisions or prepare final production files for client delivery.",
      };
    case "Ready For Review":
    case "Client Reviewing":
      return {
        title: "Client review is the next required action.",
        description:
          "Monitor feedback and use the revision workspace when changes are requested.",
      };
    case "Approved":
      return {
        title: "Prepare the approved work for final delivery.",
        description:
          "Upload the production-ready file, mark one version Final and deliver it to the client.",
      };
    case "Delivered":
      return {
        title: "This delivery is complete.",
        description:
          "New uploads remain private until a new final version is selected and delivered.",
      };
    default:
      return {
        title: "Review the job and choose the next production step.",
        description:
          "Use Job Control to update status, priority and assigned studio.",
      };
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return "-";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}/${date.getUTCFullYear()} ${String(
    date.getUTCHours(),
  ).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatContextValue(value: any) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 10)
      .map((item) =>
        typeof item === "object"
          ? Object.values(item || {})
              .filter(Boolean)
              .join(" · ")
          : String(item),
      )
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .slice(0, 10)
      .map(([key, item]) => `${formatLabel(key)}: ${String(item)}`)
      .join("\n");
  }

  return "-";
}
