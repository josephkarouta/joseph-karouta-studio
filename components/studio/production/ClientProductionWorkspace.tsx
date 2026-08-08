"use client";

import {
  Activity,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  Files,
  MessageSquareText,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import ClientDeliverablesManager from "@/components/studio/production/ClientDeliverablesManager";
import ClientProductionMessages from "@/components/studio/production/ClientProductionMessages";
import ClientRevisionRequest from "@/components/studio/production/ClientRevisionRequest";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type ClientProductionWorkspaceProps = {
  job: any;
  project: any;
  service: string;
  studioLabel: string;
  status: string;
  timeline: any[];
  deliverableGroups: any[];
  onDownload: (path: string) => void;
  onRefresh: () => void | Promise<void>;
};

type ProductionStage = {
  label: string;
  description: string;
};

const STAGES: ProductionStage[] = [
  { label: "Requested", description: "Scope received" },
  { label: "Paid", description: "Production confirmed" },
  { label: "In production", description: "Studio work" },
  { label: "Review", description: "Feedback & approval" },
  { label: "Delivered", description: "Final files" },
];

export default function ClientProductionWorkspace({
  job,
  project,
  service,
  studioLabel,
  status,
  timeline,
  deliverableGroups,
  onDownload,
  onRefresh,
}: ClientProductionWorkspaceProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [revisionComposerSignal, setRevisionComposerSignal] = useState(0);
  const [revisionCount, setRevisionCount] = useState(0);
  const [approvingDelivery, setApprovingDelivery] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const revisionSectionRef = useRef<HTMLDivElement | null>(null);

  const deliveryApproved = Boolean(
    job?.client_approved_at ||
      String(job?.delivery_status || "").toLowerCase() === "client approved",
  );
  const currentStage = getCurrentStage(status);
  const action = getClientAction(status, deliverableGroups.length, deliveryApproved);
  const activity = useMemo(
    () => [
      {
        id: "production-requested",
        title: "Production requested",
        description: "Your approved concept was sent to Heyy Studio production.",
        created_at: job?.created_at,
      },
      ...(Array.isArray(timeline) ? timeline : []),
    ],
    [job?.created_at, timeline],
  );

  useEffect(() => {
    let active = true;

    async function loadRevisionCount() {
      try {
        const response = await fetch(
          `/api/revisions/list?production_job_id=${encodeURIComponent(job.id)}`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (active && response.ok && payload.success) {
          setRevisionCount(Array.isArray(payload.revisions) ? payload.revisions.length : 0);
        }
      } catch {
        // Revision history is supplementary; the workspace remains usable if this count fails.
      }
    }

    if (job?.id) void loadRevisionCount();
    return () => {
      active = false;
    };
  }, [job?.id, timeline]);

  async function refreshWorkspace() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  function openRevisionComposer() {
    if (!deliverableGroups.length || deliveryApproved) return;
    setRevisionComposerSignal((value) => value + 1);
    window.setTimeout(() => {
      revisionSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  }

  async function approveFinalDelivery() {
    if (approvingDelivery || deliveryApproved) return;

    setApprovingDelivery(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/production/approve-delivery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Could not approve the final delivery.");
      }

      setShowApprovalDialog(false);
      await onRefresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not approve the final delivery.",
      );
    } finally {
      setApprovingDelivery(false);
    }
  }

  const showRevisionWorkspace =
    deliverableGroups.length > 0 &&
    !deliveryApproved &&
    (revisionComposerSignal > 0 || revisionCount > 0);

  const productionFilesSection = deliverableGroups.length > 0 ? (
    <WorkspaceSection
      icon={<Files size={19} strokeWidth={2.15} />}
      eyebrow={deliveryApproved ? "Completed" : "Review files"}
      title={deliveryApproved ? "Approved production files" : "Production files"}
      description={
        deliveryApproved
          ? "Your approved final files stay available here for download."
          : "Download the latest file, request changes if needed, or approve the package once when it is final."
      }
      badge={`${deliverableGroups.length} file group${
        deliverableGroups.length === 1 ? "" : "s"
      }`}
    >
      <ClientDeliverablesManager
        groups={deliverableGroups}
        onDownload={onDownload}
        onRequestRevision={openRevisionComposer}
        onApproveDelivery={() => setShowApprovalDialog(true)}
        approving={approvingDelivery}
        approved={deliveryApproved}
      />
    </WorkspaceSection>
  ) : null;

  return (
    <div className="heyy-client-production-workspace">
      <style>{workspaceStyles}</style>

      <header className="heyy-client-workspace-header">
        <div className="heyy-client-workspace-heading">
          <span className="heyy-client-workspace-mark">
            <Sparkles size={20} strokeWidth={2.2} />
          </span>

          <div className="min-w-0">
            <p className="heyy-client-workspace-eyebrow">
              {studioLabel} production workspace
            </p>
            <h4 className="heyy-client-workspace-title">{service}</h4>
            <p className="heyy-client-workspace-subtitle">
              Messages, revisions, final files and project activity are visible in
              one organised workspace.
            </p>
          </div>
        </div>

        <div className="heyy-client-workspace-header-actions">
          <span className="heyy-client-workspace-status">
            <span className="heyy-client-workspace-status-dot" />
            {status || "Waiting Assignment"}
          </span>

          <button
            type="button"
            onClick={() => void refreshWorkspace()}
            disabled={refreshing}
            className="heyy-client-workspace-refresh"
          >
            <RefreshCw
              size={15}
              strokeWidth={2.2}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="heyy-client-stage-rail" aria-label="Production progress">
        {STAGES.map((stage, index) => {
          const complete = index < currentStage || currentStage === STAGES.length;
          const active = index === currentStage && currentStage < STAGES.length;

          return (
            <div
              key={stage.label}
              className="heyy-client-stage"
              data-complete={complete ? "true" : "false"}
              data-active={active ? "true" : "false"}
            >
              <span className="heyy-client-stage-icon">
                {complete ? (
                  <Check size={15} strokeWidth={2.8} />
                ) : active ? (
                  <Clock3 size={15} strokeWidth={2.4} />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0">
                <strong>{stage.label}</strong>
                <small>{stage.description}</small>
              </span>
            </div>
          );
        })}
      </div>

      <div className="heyy-client-workspace-grid">
        <main className="heyy-client-workspace-main">
          {productionFilesSection}

          <WorkspaceSection
            icon={<MessageSquareText size={19} strokeWidth={2.15} />}
            eyebrow="Communication"
            title="Messages"
            description="Questions, updates and reference files stay together here."
            badge={
              messageCount > 0
                ? `${messageCount} message${messageCount === 1 ? "" : "s"}`
                : "Conversation"
            }
          >
            <ClientProductionMessages
              jobId={job.id}
              onCountChange={setMessageCount}
              embedded
            />
          </WorkspaceSection>

          {showRevisionWorkspace && (
            <div ref={revisionSectionRef} id="production-revisions">
              <WorkspaceSection
                icon={<CheckCircle2 size={19} strokeWidth={2.15} />}
                eyebrow="Feedback"
                title="Revisions"
                description="Revision requests and studio responses are kept here as one clear history."
                badge={revisionCount > 0 ? `${revisionCount} revision${revisionCount === 1 ? "" : "s"}` : "New request"}
              >
                <ClientRevisionRequest
                  productionJobId={job.id}
                  userId={project?.user_id || project?.userId || null}
                  onCreated={onRefresh}
                  openComposerSignal={revisionComposerSignal}
                  onRevisionCountChange={setRevisionCount}
                />
              </WorkspaceSection>
            </div>
          )}
        </main>

        <aside className="heyy-client-workspace-sidebar">
          <section className="heyy-client-action-card">
            <div className="heyy-client-action-icon">
              {status === "Delivered" ? (
                <Download size={21} strokeWidth={2.2} />
              ) : (
                <Sparkles size={21} strokeWidth={2.2} />
              )}
            </div>
            <p className="heyy-client-action-eyebrow">What happens next</p>
            <h5>{action.title}</h5>
            <p>{action.description}</p>

            <div className="heyy-client-action-meta">
              <InfoRow label="Project" value={job?.project_name || "Project"} />
              <InfoRow label="Service" value={service} />
              <InfoRow label="Studio" value={studioLabel} />
            </div>
          </section>

          <section className="heyy-client-activity-card">
            <div className="heyy-client-activity-heading">
              <span className="heyy-client-activity-icon">
                <Activity size={18} strokeWidth={2.2} />
              </span>
              <div>
                <p>Production activity</p>
                <span>
                  {activity.length} update{activity.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="heyy-client-activity-list">
              {activity.map((item, index) => (
                <div key={item.id || `${item.title}-${index}`} className="heyy-client-activity-item">
                  <span className="heyy-client-activity-dot">
                    {index === activity.length - 1 ? (
                      <Clock3 size={12} strokeWidth={2.5} />
                    ) : (
                      <Check size={12} strokeWidth={3} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <strong>{item.title || "Production update"}</strong>
                    {item.description && <p>{item.description}</p>}
                    {item.created_at && (
                      <time>{formatDate(item.created_at)}</time>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="heyy-client-files-summary">
            <span>
              <FileCheck2 size={18} strokeWidth={2.2} />
            </span>
            <div>
              <strong>
                {deliverableGroups.length > 0
                  ? `${deliverableGroups.length} final file group${
                      deliverableGroups.length === 1 ? "" : "s"
                    }`
                  : "Final files pending"}
              </strong>
              <p>
                {deliverableGroups.length > 0
                  ? "Your delivered files remain securely available in this workspace."
                  : "Final files will appear automatically after the studio publishes them."}
              </p>
            </div>
          </section>
        </aside>
      </div>

      {showApprovalDialog && !deliveryApproved && (
        <div className="heyy-production-confirm-backdrop" role="presentation">
          <section
            className="heyy-production-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="production-approval-title"
          >
            <span className="heyy-production-confirm-icon">
              <CheckCircle2 size={24} strokeWidth={2.3} />
            </span>
            <p className="heyy-production-confirm-eyebrow">Final approval</p>
            <h5 id="production-approval-title">Approve and complete this production?</h5>
            <p>
              This accepts the latest delivered file as final and closes the production review. You will still be able to download the approved files afterward.
            </p>
            <div className="heyy-production-confirm-actions">
              <button
                type="button"
                onClick={() => setShowApprovalDialog(false)}
                disabled={approvingDelivery}
                className="heyy-production-confirm-cancel"
              >
                Keep reviewing
              </button>
              <button
                type="button"
                onClick={() => void approveFinalDelivery()}
                disabled={approvingDelivery}
                className="heyy-production-confirm-approve"
              >
                {approvingDelivery ? "Approving..." : "Approve & complete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function WorkspaceSection({
  icon,
  eyebrow,
  title,
  description,
  badge,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <section className="heyy-client-section-card">
      <header className="heyy-client-section-header">
        <div className="heyy-client-section-heading">
          <span className="heyy-client-section-icon">{icon}</span>
          <div>
            <p>{eyebrow}</p>
            <h5>{title}</h5>
            <span>{description}</span>
          </div>
        </div>
        <span className="heyy-client-section-badge">{badge}</span>
      </header>
      <div className="heyy-client-section-body">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="heyy-client-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getCurrentStage(status: string): number {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "delivered" || normalized === "completed") {
    return STAGES.length;
  }
  if (normalized === "approved") return 4;
  if (
    normalized.includes("review") ||
    normalized.includes("revision")
  ) {
    return 3;
  }
  if (
    normalized.includes("assigned") ||
    normalized.includes("progress") ||
    normalized.includes("production")
  ) {
    return 2;
  }
  return 2;
}

function getClientAction(
  status: string,
  fileCount: number,
  deliveryApproved = false,
) {
  const normalized = String(status || "").toLowerCase();

  if (deliveryApproved) {
    return {
      title: "Final delivery approved",
      description:
        "You approved the production package. The delivered files remain available here for future download.",
    };
  }

  if (normalized === "delivered" || normalized === "completed") {
    return {
      title: "Download and keep your final files",
      description:
        fileCount > 0
          ? "Your approved production package is ready in the Production Files section."
          : "The studio has completed production. Final files will appear as soon as publishing finishes.",
    };
  }
  if (normalized === "approved") {
    return {
      title: "Final files are being prepared",
      description:
        "Your latest revision is approved. The studio is organising and publishing the final production package.",
    };
  }
  if (normalized.includes("review") || normalized.includes("revision")) {
    return fileCount > 0
      ? {
          title: "Review your delivered files",
          description:
            "Download the files, send a revision request or approve the production package as complete.",
        }
      : {
          title: "Review the latest studio response",
          description:
            "Open Revisions and Feedback to approve the work or submit a clear change request.",
        };
  }
  if (normalized.includes("progress")) {
    return {
      title: "The studio is producing your files",
      description:
        "You can send a message at any time. A review notification will appear when the next version is ready.",
    };
  }
  if (normalized.includes("assigned")) {
    return {
      title: "Your production team is assigned",
      description:
        "The studio is reviewing the project context and preparing the first production version.",
    };
  }
  return {
    title: "Production setup is underway",
    description:
      "Heyy Studio is assigning the project and confirming the first production milestone.",
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const workspaceStyles = `
  .heyy-client-production-workspace,
  .heyy-client-production-workspace * { box-sizing: border-box; }

  .heyy-client-production-workspace {
    overflow: hidden;
    border: 1px solid #ddd7e8;
    border-radius: 26px;
    background: #f7f7fa;
    color: #17151f;
    box-shadow: 0 22px 46px rgba(32,20,48,.18);
  }

  .heyy-client-workspace-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    border-bottom: 1px solid #e5e1eb;
    background:
      radial-gradient(circle at 100% 0%,var(--production-accent-soft),transparent 34%),
      linear-gradient(135deg,#ffffff 0%,#faf8fd 100%);
    padding: 24px;
  }

  .heyy-client-workspace-heading,
  .heyy-client-section-heading,
  .heyy-client-activity-heading {
    display: flex;
    align-items: flex-start;
    gap: 13px;
  }

  .heyy-client-workspace-mark,
  .heyy-client-section-icon,
  .heyy-client-activity-icon,
  .heyy-client-action-icon {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    background: var(--production-accent);
    color: #fff;
    box-shadow: 0 10px 22px color-mix(in srgb,var(--production-accent) 24%,transparent);
  }

  .heyy-client-workspace-mark {
    width: 46px;
    height: 46px;
    border-radius: 15px;
  }

  .heyy-client-workspace-eyebrow,
  .heyy-client-action-eyebrow,
  .heyy-client-section-heading > div > p {
    margin: 0;
    color: var(--production-accent-strong) !important;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .17em;
    text-transform: uppercase;
  }

  .heyy-client-workspace-title {
    margin: 4px 0 0;
    color: #17151f !important;
    font-size: clamp(21px,2.2vw,30px);
    font-weight: 950;
    letter-spacing: -.04em;
  }

  .heyy-client-workspace-subtitle {
    max-width: 660px;
    margin: 7px 0 0;
    color: #667085 !important;
    font-size: 12px;
    line-height: 1.7;
  }

  .heyy-client-workspace-header-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 9px;
  }

  .heyy-client-workspace-status,
  .heyy-client-workspace-refresh,
  .heyy-client-section-badge {
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .heyy-client-workspace-status {
    border: 1px solid #bdebd2;
    background: #effcf5;
    color: #087542;
    padding: 0 13px;
  }

  .heyy-client-workspace-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #12a964;
    box-shadow: 0 0 0 4px rgba(18,169,100,.12);
  }

  .heyy-client-workspace-refresh {
    border: 1px solid #ded7e8 !important;
    background: #fff !important;
    color: #3c3546 !important;
    padding: 0 13px;
    transition: border-color 160ms ease,color 160ms ease,transform 160ms ease;
  }

  .heyy-client-workspace-refresh:hover:not(:disabled) {
    border-color: var(--production-accent) !important;
    color: var(--production-accent-strong) !important;
    transform: translateY(-1px);
  }

  .heyy-client-stage-rail {
    display: grid;
    grid-template-columns: repeat(5,minmax(0,1fr));
    gap: 0;
    border-bottom: 1px solid #e4dfea;
    background: #fff;
    padding: 16px 22px;
  }

  .heyy-client-stage {
    position: relative;
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
    padding-right: 16px;
  }

  .heyy-client-stage:not(:last-child)::after {
    content: "";
    position: absolute;
    top: 17px;
    right: 4px;
    left: 42px;
    z-index: 0;
    height: 2px;
    background: #e8e4ed;
  }

  .heyy-client-stage[data-complete="true"]:not(:last-child)::after {
    background: var(--production-accent);
  }

  .heyy-client-stage-icon {
    position: relative;
    z-index: 1;
    display: inline-flex;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    align-items: center;
    justify-content: center;
    border: 1px solid #ded8e8;
    border-radius: 11px;
    background: #f8f7fa;
    color: #8b8493;
    font-size: 11px;
    font-weight: 900;
  }

  .heyy-client-stage[data-complete="true"] .heyy-client-stage-icon,
  .heyy-client-stage[data-active="true"] .heyy-client-stage-icon {
    border-color: var(--production-accent);
    background: var(--production-accent);
    color: #fff;
  }

  .heyy-client-stage[data-active="true"] .heyy-client-stage-icon {
    box-shadow: 0 0 0 5px var(--production-accent-soft);
  }

  .heyy-client-stage strong,
  .heyy-client-stage small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .heyy-client-stage strong {
    color: #302b36;
    font-size: 10px;
    font-weight: 900;
  }

  .heyy-client-stage small {
    margin-top: 2px;
    color: #9892a1;
    font-size: 8px;
    font-weight: 700;
  }

  .heyy-client-workspace-grid {
    display: grid;
    grid-template-columns: minmax(0,1.55fr) minmax(300px,.7fr);
    gap: 18px;
    padding: 18px;
  }

  .heyy-client-workspace-main,
  .heyy-client-workspace-sidebar {
    display: grid;
    align-content: start;
    gap: 16px;
    min-width: 0;
  }

  .heyy-client-section-card,
  .heyy-client-action-card,
  .heyy-client-activity-card,
  .heyy-client-files-summary {
    overflow: hidden;
    border: 1px solid #e0dbe6;
    border-radius: 21px;
    background: #fff;
    box-shadow: 0 12px 30px rgba(41,29,56,.06);
  }

  .heyy-client-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    border-bottom: 1px solid #ebe7ef;
    background: linear-gradient(135deg,#fff 0%,#fbf9fd 100%);
    padding: 17px 18px;
  }

  .heyy-client-section-icon,
  .heyy-client-activity-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
  }

  .heyy-client-section-heading h5 {
    margin: 3px 0 0;
    color: #17151f !important;
    font-size: 16px;
    font-weight: 950;
    letter-spacing: -.025em;
  }

  .heyy-client-section-heading > div > span {
    display: block;
    max-width: 610px;
    margin-top: 5px;
    color: #777080 !important;
    font-size: 10px;
    line-height: 1.55;
  }

  .heyy-client-section-badge {
    min-height: 30px;
    border: 1px solid var(--production-accent-border);
    background: var(--production-accent-soft);
    color: var(--production-accent-strong);
    padding: 0 11px;
    white-space: nowrap;
  }

  .heyy-client-section-body { padding: 17px; }

  .heyy-client-section-body button {
    border-color: var(--production-accent) !important;
  }

  .heyy-client-section-body button:hover:not(:disabled) {
    border-color: var(--production-accent-strong) !important;
  }

  .heyy-client-action-card {
    background:
      radial-gradient(circle at 100% 0%,var(--production-accent-soft),transparent 44%),
      #fff;
    padding: 19px;
  }

  .heyy-client-action-icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .heyy-client-action-eyebrow { margin-top: 17px; }

  .heyy-client-action-card h5 {
    margin: 6px 0 0;
    color: #17151f !important;
    font-size: 20px;
    font-weight: 950;
    letter-spacing: -.035em;
  }

  .heyy-client-action-card > p:not(.heyy-client-action-eyebrow) {
    margin: 9px 0 0;
    color: #696270 !important;
    font-size: 11px;
    line-height: 1.75;
  }

  .heyy-client-action-meta {
    display: grid;
    gap: 8px;
    margin-top: 17px;
    border-top: 1px solid #e7e2ec;
    padding-top: 14px;
  }

  .heyy-client-info-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .heyy-client-info-row span {
    color: #9a93a2 !important;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .heyy-client-info-row strong {
    max-width: 65%;
    color: #312b37;
    font-size: 10px;
    font-weight: 900;
    text-align: right;
  }

  .heyy-client-activity-card { padding: 17px; }

  .heyy-client-activity-heading p {
    margin: 1px 0 0;
    color: #24202a !important;
    font-size: 13px;
    font-weight: 950;
  }

  .heyy-client-activity-heading span:not(.heyy-client-activity-icon) {
    display: block;
    margin-top: 3px;
    color: #9992a1 !important;
    font-size: 9px;
    font-weight: 800;
  }

  .heyy-client-activity-list {
    display: grid;
    gap: 0;
    max-height: 520px;
    margin-top: 15px;
    overflow-y: auto;
    padding-right: 3px;
  }

  .heyy-client-activity-item {
    position: relative;
    display: flex;
    gap: 11px;
    padding: 0 0 17px;
  }

  .heyy-client-activity-item:not(:last-child)::after {
    content: "";
    position: absolute;
    top: 25px;
    bottom: 3px;
    left: 11px;
    width: 1px;
    background: #ddd7e4;
  }

  .heyy-client-activity-dot {
    position: relative;
    z-index: 1;
    display: inline-flex;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: var(--production-accent);
    color: #fff;
  }

  .heyy-client-activity-item strong {
    display: block;
    color: #312c36;
    font-size: 10px;
    font-weight: 900;
  }

  .heyy-client-activity-item p {
    margin: 3px 0 0;
    color: #777080 !important;
    font-size: 9px;
    line-height: 1.55;
  }

  .heyy-client-activity-item time {
    display: block;
    margin-top: 4px;
    color: #aaa3b0;
    font-size: 8px;
    font-weight: 700;
  }

  .heyy-client-files-summary {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    border-color: #cfead9;
    background: #f4fbf7;
    padding: 15px;
  }

  .heyy-client-files-summary > span {
    display: inline-flex;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
    background: #12a964;
    color: #fff !important;
  }

  .heyy-client-files-summary strong {
    display: block;
    color: #155d3c;
    font-size: 11px;
    font-weight: 950;
  }

  .heyy-client-files-summary p {
    margin: 4px 0 0;
    color: #587267 !important;
    font-size: 9px;
    line-height: 1.6;
  }

  [data-theme="dark"] .heyy-client-production-workspace {
    border-color: #463d50;
    background: #17131d;
    color: #f5f2f8;
    box-shadow: 0 22px 46px rgba(0,0,0,.34);
  }

  [data-theme="dark"] .heyy-client-workspace-header {
    border-color: #463d50;
    background:
      radial-gradient(circle at 100% 0%,var(--production-accent-soft),transparent 34%),
      linear-gradient(135deg,#27202f 0%,#1d1823 100%);
  }

  [data-theme="dark"] .heyy-client-stage-rail,
  [data-theme="dark"] .heyy-client-section-card,
  [data-theme="dark"] .heyy-client-action-card,
  [data-theme="dark"] .heyy-client-activity-card {
    border-color: #463d50;
    background: #211c28;
  }

  [data-theme="dark"] .heyy-client-section-header {
    border-color: #463d50;
    background: linear-gradient(135deg,#282130 0%,#211c28 100%);
  }

  [data-theme="dark"] .heyy-client-workspace-title,
  [data-theme="dark"] .heyy-client-section-heading h5,
  [data-theme="dark"] .heyy-client-action-card h5,
  [data-theme="dark"] .heyy-client-stage strong,
  [data-theme="dark"] .heyy-client-info-row strong,
  [data-theme="dark"] .heyy-client-activity-heading p,
  [data-theme="dark"] .heyy-client-activity-item strong {
    color: #f5f2f8 !important;
  }

  [data-theme="dark"] .heyy-client-workspace-subtitle,
  [data-theme="dark"] .heyy-client-section-heading > div > span,
  [data-theme="dark"] .heyy-client-action-card > p:not(.heyy-client-action-eyebrow),
  [data-theme="dark"] .heyy-client-activity-item p,
  [data-theme="dark"] .heyy-client-stage small {
    color: #bdb4c7 !important;
  }

  [data-theme="dark"] .heyy-client-workspace-refresh,
  [data-theme="dark"] .heyy-client-stage-icon {
    border-color: #5a4f65 !important;
    background: #17131d !important;
    color: #d8d0df !important;
  }

  [data-theme="dark"] .heyy-client-action-meta,
  [data-theme="dark"] .heyy-client-stage-rail,
  [data-theme="dark"] .heyy-client-section-header {
    border-color: #463d50 !important;
  }

  [data-theme="dark"] .heyy-client-files-summary {
    border-color: #285b44;
    background: #17251f;
  }

  [data-theme="dark"] .heyy-client-files-summary strong {
    color: #8ae3b5 !important;
  }

  [data-theme="dark"] .heyy-client-files-summary p {
    color: #a9cabb !important;
  }


  .heyy-production-confirm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(19,10,28,.56);
    padding: 24px;
    backdrop-filter: blur(8px);
  }

  .heyy-production-confirm-dialog {
    width: min(480px,100%);
    border: 1px solid #d7c0ff;
    border-radius: 24px;
    background: #fff;
    padding: 24px;
    color: #17151f;
    box-shadow: 0 30px 80px rgba(45,13,77,.32);
  }

  .heyy-production-confirm-icon {
    display: inline-flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    background: linear-gradient(135deg,var(--production-accent-strong),var(--production-accent));
    color: #fff;
  }

  .heyy-production-confirm-eyebrow {
    margin: 18px 0 0;
    color: var(--production-accent-strong) !important;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .heyy-production-confirm-dialog h5 {
    margin: 6px 0 0;
    color: #17151f !important;
    font-size: 22px;
    font-weight: 950;
    letter-spacing: -.035em;
  }

  .heyy-production-confirm-dialog > p:not(.heyy-production-confirm-eyebrow) {
    margin: 10px 0 0;
    color: #6d6576 !important;
    font-size: 12px;
    line-height: 1.7;
  }

  .heyy-production-confirm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 22px;
  }

  .heyy-production-confirm-actions button {
    min-height: 46px;
    border-radius: 999px;
    padding: 0 16px;
    font-size: 11px;
    font-weight: 950;
  }

  .heyy-production-confirm-cancel {
    border: 1px solid #d4c8df !important;
    background: #fff !important;
    color: #514759 !important;
  }

  .heyy-production-confirm-approve {
    border: 1px solid #0d9655 !important;
    background: #0d9655 !important;
    color: #fff !important;
  }

  [data-theme="dark"] .heyy-client-production-workspace {
    border-color: #7448a2;
    background: linear-gradient(180deg,#281534 0%,#21112c 100%);
    color: #f8f4fb;
  }

  [data-theme="dark"] .heyy-client-workspace-header {
    border-color: #71439c;
    background:
      radial-gradient(circle at 100% 0%,rgba(166,94,255,.24),transparent 36%),
      linear-gradient(135deg,#3a1f4b 0%,#2b1738 100%);
  }

  [data-theme="dark"] .heyy-client-stage-rail,
  [data-theme="dark"] .heyy-client-section-card,
  [data-theme="dark"] .heyy-client-action-card,
  [data-theme="dark"] .heyy-client-activity-card {
    border-color: #664087;
    background: #2b1838;
  }

  [data-theme="dark"] .heyy-client-section-header {
    border-color: #664087;
    background: linear-gradient(135deg,#351d45 0%,#2a1837 100%);
  }

  [data-theme="dark"] #production-messages > div:first-of-type,
  [data-theme="dark"] #production-messages textarea,
  [data-theme="dark"] #production-messages .bg-white,
  [data-theme="dark"] #production-messages .bg-slate-50 {
    border-color: #644080 !important;
    background: #24132f !important;
    color: #f6effb !important;
  }

  [data-theme="dark"] #production-messages :is(.text-slate-900,.text-slate-800,.text-slate-700,.text-slate-600,.text-slate-500) {
    color: #e5d9ed !important;
  }

  [data-theme="dark"] .heyy-production-confirm-dialog {
    border-color: #7448a2;
    background: #2b1838;
    color: #f8f4fb;
  }

  [data-theme="dark"] .heyy-production-confirm-dialog h5 { color: #fff !important; }
  [data-theme="dark"] .heyy-production-confirm-dialog > p:not(.heyy-production-confirm-eyebrow) { color: #cdbed8 !important; }
  [data-theme="dark"] .heyy-production-confirm-cancel {
    border-color: #704990 !important;
    background: #24132f !important;
    color: #eee4f5 !important;
  }
  @media (max-width: 1080px) {
    .heyy-client-workspace-grid { grid-template-columns: minmax(0,1fr); }
    .heyy-client-workspace-sidebar { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .heyy-client-activity-card { grid-row: span 2; }
  }

  @media (max-width: 760px) {
    .heyy-client-workspace-header { flex-direction: column; padding: 19px; }
    .heyy-client-workspace-header-actions { justify-content: flex-start; }
    .heyy-client-stage-rail {
      grid-template-columns: repeat(5,minmax(96px,1fr));
      overflow-x: auto;
      padding: 14px 16px;
    }
    .heyy-client-stage small { display: none; }
    .heyy-client-workspace-grid { padding: 12px; }
    .heyy-client-workspace-sidebar { grid-template-columns: minmax(0,1fr); }
    .heyy-client-section-header { flex-direction: column; }
    .heyy-client-section-badge { align-self: flex-start; }
  }
`;
