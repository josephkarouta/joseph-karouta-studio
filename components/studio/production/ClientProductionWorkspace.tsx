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
import { useSearchParams } from "next/navigation";

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

type RevisionPolicy = {
  enforced: boolean;
  included: number | null;
  purchasedExtraRevisions?: number;
  totalAllowance?: number | null;
  used: number;
  remaining: number | null;
  extraRevisionFee: number | null;
  currency: string | null;
};

type ClientProductionAddon = {
  id: string;
  kind: "extra_revision" | "additional_scope";
  status: string;
  title: string;
  description: string | null;
  currency: string;
  client_amount_cents: number | null;
  sent_to_client_at: string | null;
  paid_at: string | null;
  created_at: string;
};

function clientMoneyCents(cents: number | null | undefined, currency: string | null | undefined) {
  const code = String(currency || "USD").toUpperCase();
  const amount = Number(cents || 0) / 100;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount); }
  catch { return `${code} ${amount.toFixed(2)}`; }
}

function clientMoneyAmount(amount: number | null | undefined, currency: string | null | undefined) {
  const code = String(currency || "USD").toUpperCase();
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(Number(amount || 0)); }
  catch { return `${code} ${Number(amount || 0).toFixed(2)}`; }
}

const STAGES: ProductionStage[] = [
  { label: "Paid", description: "Production confirmed" },
  { label: "In production", description: "Heyy Studio is working" },
  { label: "Your review", description: "Files ready for feedback" },
  { label: "Complete", description: "Final files approved" },
];

type ClientWorkspaceTab = "Overview" | "Messages" | "Files & Review";

const CLIENT_TABS: ClientWorkspaceTab[] = ["Overview", "Messages", "Files & Review"];

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
  const [activeSection, setActiveSection] = useState<ClientWorkspaceTab>("Overview");
  const [messageCount, setMessageCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [revisionComposerSignal, setRevisionComposerSignal] = useState(0);
  const [revisionTargets, setRevisionTargets] = useState<any[]>([]);
  const [revisionCount, setRevisionCount] = useState(0);
  const [revisionPolicy, setRevisionPolicy] = useState<RevisionPolicy | null>(null);
  const [reviewPane, setReviewPane] = useState<"files" | "revisions">("files");
  const [approvingDelivery, setApprovingDelivery] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [addons, setAddons] = useState<ClientProductionAddon[]>([]);
  const [buyingExtraRevision, setBuyingExtraRevision] = useState(false);
  const [payingAddonId, setPayingAddonId] = useState<string | null>(null);
  const [reconcilingAddon, setReconcilingAddon] = useState(false);
  const revisionSectionRef = useRef<HTMLDivElement | null>(null);
  const reconciledAddonSessionRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("productionView");
  const addonSessionId = searchParams.get("session_id");
  const extraRevisionCheckout = searchParams.get("extraRevision");
  const addonPaymentState = searchParams.get("addonPayment");

  useEffect(() => {

    if (requestedView === "messages") {
      setActiveSection("Messages");
      return;
    }

    if (requestedView === "review" || requestedView === "revisions") {
      setActiveSection("Files & Review");
      setReviewPane(requestedView === "revisions" ? "revisions" : "files");

      if (requestedView === "revisions") {
        window.setTimeout(() => {
          revisionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    }
  }, [job?.id, requestedView]);

  useEffect(() => {
    let cancelled = false;
    async function loadAddons() {
      if (!job?.id) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch(`/api/production/addons?jobId=${encodeURIComponent(job.id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json();
        if (!cancelled && response.ok && payload.success) setAddons(payload.addons || []);
      } catch {
        // Add-ons are supplemental to the core production workspace.
      }
    }
    void loadAddons();
    return () => { cancelled = true; };
  }, [job?.id, timeline]);

  useEffect(() => {
    if (!addonSessionId || reconcilingAddon || reconciledAddonSessionRef.current === addonSessionId || (extraRevisionCheckout !== "paid" && addonPaymentState !== "paid")) return;
    reconciledAddonSessionRef.current = addonSessionId;
    let cancelled = false;
    async function reconcileAddon() {
      setReconcilingAddon(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch("/api/production/addons/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId: addonSessionId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || "Payment could not be confirmed.");
        if (!cancelled && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("session_id");
          url.searchParams.delete("extraRevision");
          url.searchParams.delete("addonPayment");
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
          window.location.reload();
        }
      } catch (error) {
        reconciledAddonSessionRef.current = null;
        if (!cancelled) console.error("Production add-on reconciliation failed:", error);
      } finally {
        if (!cancelled) setReconcilingAddon(false);
      }
    }
    void reconcileAddon();
    return () => { cancelled = true; };
  }, [addonSessionId, extraRevisionCheckout, addonPaymentState, reconcilingAddon]);

  const deliveryApproved = Boolean(
    job?.client_approved_at ||
      String(job?.delivery_status || "").toLowerCase() === "client approved",
  );
  const currentStage = getCurrentStage(status);
  const action = getClientAction(status, deliverableGroups.length, deliveryApproved);
  const latestReviewNote = useMemo(() => {
    const entries = Array.isArray(timeline) ? [...timeline] : [];
    return entries
      .sort((a: any, b: any) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
      .find((item: any) => /review package ready|ready for review/i.test(String(item?.title || "")) && String(item?.description || "").trim()) || null;
  }, [timeline]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function loadUnreadSummary() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || !job?.id) return;
        const response = await fetch(`/api/production/messages?jobId=${encodeURIComponent(job.id)}&summary=1`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json();
        if (!cancelled && response.ok && payload.success) setUnreadMessageCount(Number(payload.unreadCount || 0));
      } catch {
        // Attention badges are helpful but must never block the production workspace.
      }
    }

    void loadUnreadSummary();
    timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadUnreadSummary(); }, 20_000);
    return () => { cancelled = true; if (timer) window.clearInterval(timer); };
  }, [job?.id, activeSection]);

  const activity = useMemo(
    () => [
      {
        id: "production-requested",
        title: "Production request sent",
        description: "Heyy Studio received the approved concept and production scope.",
        created_at: job?.created_at,
      },
      ...(Array.isArray(timeline) ? timeline.map(formatTimelineItem) : []),
    ],
    [job?.created_at, timeline],
  );

  useEffect(() => {
    let active = true;

    async function loadRevisionCount() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;

        const response = await fetch(
          `/api/revisions/list?production_job_id=${encodeURIComponent(job.id)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const payload = await response.json();
        if (active && response.ok && payload.success) {
          setRevisionCount(Array.isArray(payload.revisions) ? payload.revisions.length : 0);
          setRevisionPolicy(payload.revisionPolicy || null);
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

  async function buyExtraRevision() {
    if (buyingExtraRevision) return;
    setBuyingExtraRevision(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/production/addons/extra-revision/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId: job.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.url) throw new Error(payload.error || "Could not open checkout.");
      window.location.assign(payload.url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not open the additional revision checkout.");
      setBuyingExtraRevision(false);
    }
  }

  async function payProductionAddon(addonId: string) {
    if (payingAddonId) return;
    setPayingAddonId(addonId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/production/addons/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ addonId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.url) throw new Error(payload.error || "Could not open checkout.");
      window.location.assign(payload.url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not open checkout.");
      setPayingAddonId(null);
    }
  }

  const revisionLimitReached = Boolean(
    revisionPolicy?.enforced && Number(revisionPolicy.remaining || 0) <= 0,
  );

  function openRevisionComposer(targets: any[] = []) {
    if (!deliverableGroups.length || deliveryApproved || revisionLimitReached) return;
    setRevisionTargets(targets);
    setReviewPane("revisions");
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
    deliverableGroups.length > 0 && !deliveryApproved;

  const productionFilesSection = deliverableGroups.length > 0 ? (
    <WorkspaceSection
      icon={<Files size={19} strokeWidth={2.15} />}
      eyebrow={deliveryApproved ? "Completed" : "Review files"}
      title={deliveryApproved ? "Final files" : "Review package"}
      description={
        deliveryApproved
          ? "Your approved final files stay available here for download."
          : "Review the latest package, download files, request changes or approve the delivery."
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
        revisionLimitReached={revisionLimitReached}
        onBuyExtraRevision={revisionPolicy?.enforced && Number(revisionPolicy.extraRevisionFee || 0) > 0 ? buyExtraRevision : undefined}
        extraRevisionPriceLabel={revisionPolicy?.enforced && Number(revisionPolicy.extraRevisionFee || 0) > 0 ? clientMoneyAmount(revisionPolicy.extraRevisionFee, revisionPolicy.currency) : null}
        buyingExtraRevision={buyingExtraRevision}
      />
    </WorkspaceSection>
  ) : null;

  const pendingClientAddons = addons.filter((addon) => addon.status === "sent");
  const reviewAttentionCount = (!deliveryApproved && deliverableGroups.length > 0 ? 1 : 0) + pendingClientAddons.length;
  const moreWorkHref = `/contact?${new URLSearchParams({
    topic: "expert-production",
    projectId: String(job?.project_id || project?.id || ""),
    projectName: String(job?.project_name || project?.name || "Project"),
    studio: String(job?.studio || project?.studio || "brand_studio"),
    serviceId: String(job?.service_id || ""),
    sourceJobId: String(job?.id || ""),
  }).toString()}`;

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

      {deliveryApproved && (
        <section
          className="mb-4 overflow-hidden rounded-[28px] border p-6 text-white shadow-[0_22px_60px_rgba(76,29,149,.18)] sm:p-7"
          style={{
            borderColor: "rgba(110, 231, 183, 0.5)",
            background: "linear-gradient(135deg, #0f172a 0%, #2e1065 55%, #064e3b 100%)",
          }}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-3xl items-start gap-4">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg"
                style={{ backgroundColor: "#34d399", color: "#0f172a", boxShadow: "0 10px 24px rgba(6,78,59,.28)" }}
              >
                <CheckCircle2 size={25} strokeWidth={2.6}/>
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: "#6ee7b7" }}>Completed & approved</p>
                <h5 className="mt-1 text-2xl font-black tracking-[-.04em] text-white sm:text-3xl">Production complete</h5>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6" style={{ color: "rgba(255,255,255,.78)" }}>
                  Your approved final files are ready and remain available in this workspace. If you need more work later, start another production request on this same project — this completed job stays unchanged.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => { setActiveSection("Files & Review"); setReviewPane("files"); }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-xs font-black transition hover:-translate-y-0.5"
                style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
              >
                <Download size={15}/>Open final files
              </button>
              <a
                href={moreWorkHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-xs font-black text-white backdrop-blur transition hover:-translate-y-0.5"
                style={{ border: "1px solid rgba(255,255,255,.28)", backgroundColor: "rgba(255,255,255,.10)", color: "#ffffff" }}
              >
                <Sparkles size={15}/>Request more work
              </a>
            </div>
          </div>
        </section>
      )}

      {pendingClientAddons.length > 0 && (
        <section className="mb-4 grid gap-3">
          {pendingClientAddons.map((addon) => (
            <div key={addon.id} className="rounded-[22px] border border-violet-200 bg-violet-50/70 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Additional project scope</p>
                  <h5 className="mt-2 text-lg font-black text-slate-950">{addon.title || "Additional production work"}</h5>
                  <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{addon.description || "Heyy Studio prepared a separate proposal for work added after the original paid scope."}</p>
                  <p className="mt-3 text-xs font-bold text-slate-500">This does not change your original paid quote. It is a separate addition.</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-950">{clientMoneyCents(addon.client_amount_cents, addon.currency)}</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">before tax</p>
                  <button type="button" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-violet-600 px-4 text-xs font-black text-white disabled:opacity-50" disabled={payingAddonId === addon.id} onClick={() => void payProductionAddon(addon.id)}>{payingAddonId === addon.id ? "Opening checkout…" : "Review & pay"}</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

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

      <nav className="heyy-client-workspace-tabs" aria-label="Production workspace sections">
        {CLIENT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className="heyy-client-workspace-tab"
            data-active={activeSection === tab ? "true" : "false"}
            onClick={() => setActiveSection(tab)}
          >
            <span className="heyy-client-workspace-tab-title"><strong>{tab}</strong>{((tab === "Messages" ? unreadMessageCount : tab === "Files & Review" ? reviewAttentionCount : 0) > 0) && <b className="heyy-client-workspace-tab-badge">{tab === "Messages" ? unreadMessageCount : reviewAttentionCount}</b>}</span>
            <span>{clientTabDescription(tab)}</span>
          </button>
        ))}
      </nav>

      {activeSection === "Overview" && (
        <div className="heyy-client-workspace-grid">
          <main className="heyy-client-workspace-main">
            <section className="heyy-client-overview-card">
              <div className="heyy-client-action-icon">
                {status === "Delivered" ? (
                  <Download size={21} strokeWidth={2.2} />
                ) : (
                  <Sparkles size={21} strokeWidth={2.2} />
                )}
              </div>
              <p className="heyy-client-action-eyebrow">Current step</p>
              <h5>{action.title}</h5>
              <p>{action.description}</p>

              <div className="heyy-client-action-meta">
                <InfoRow label="Project" value={job?.project_name || "Project"} />
                <InfoRow label="Service" value={service} />
                <InfoRow label="Studio" value={studioLabel} />
              </div>

              <button
                type="button"
                className="heyy-client-overview-cta"
                onClick={() =>
                  setActiveSection(deliverableGroups.length > 0 ? "Files & Review" : "Messages")
                }
              >
                {deliverableGroups.length > 0 ? "Open files & review" : "Message Heyy Studio"}
              </button>
            </section>
          </main>

          <aside className="heyy-client-workspace-sidebar">
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
                      {item.created_at && <time>{formatDate(item.created_at)}</time>}
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
                    ? `${deliverableGroups.length} review package${deliverableGroups.length === 1 ? "" : "s"}`
                    : "Files in production"}
                </strong>
                <p>
                  {deliverableGroups.length > 0
                    ? "Open Files & Review when you are ready to check the latest delivery."
                    : "Files appear only when Heyy Studio publishes something for your review."}
                </p>
              </div>
            </section>
          </aside>
        </div>
      )}

      {activeSection === "Messages" && (
        <div className="heyy-client-single-section">
          <WorkspaceSection
            icon={<MessageSquareText size={19} strokeWidth={2.15} />}
            eyebrow="Communication"
            title="Messages with Heyy Studio"
            description="Use this conversation for questions and project updates. Revision requests are handled separately in Files & Review."
            badge={
              unreadMessageCount > 0
                ? `${unreadMessageCount} new`
                : messageCount > 0
                  ? `${messageCount} message${messageCount === 1 ? "" : "s"}`
                  : "Conversation"
            }
          >
            <ClientProductionMessages
              jobId={job.id}
              onCountChange={setMessageCount}
              onUnreadChange={setUnreadMessageCount}
              embedded
            />
          </WorkspaceSection>
        </div>
      )}

      {activeSection === "Files & Review" && (
        <div className="heyy-client-single-section">
          {latestReviewNote && deliverableGroups.length > 0 && (
            <section className="rounded-[22px] border border-violet-200 bg-violet-50/70 p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Heyy Studio delivery note</p>
              <h5 className="mt-2 text-lg font-black text-slate-950">{latestReviewNote.title || "Review package ready"}</h5>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{latestReviewNote.description}</p>
            </section>
          )}

          {showRevisionWorkspace && (
            <nav className="heyy-client-review-tabs" aria-label="Files and review sections">
              <button type="button" data-active={reviewPane === "files" ? "true" : "false"} onClick={() => setReviewPane("files")}>
                <span>Review files</span>
                <small>{deliverableGroups.length} file group{deliverableGroups.length === 1 ? "" : "s"}</small>
              </button>
              <button type="button" data-active={reviewPane === "revisions" ? "true" : "false"} onClick={() => setReviewPane("revisions")}>
                <span>Revisions</span>
                <small>{revisionPolicy?.enforced ? `${revisionPolicy.used}/${revisionPolicy.totalAllowance ?? revisionPolicy.included} used` : revisionCount ? `${revisionCount} round${revisionCount === 1 ? "" : "s"}` : "No revisions yet"}</small>
              </button>
            </nav>
          )}

          {reviewPane === "files" || !showRevisionWorkspace ? (
            <div>
              {productionFilesSection || (
                <section className="heyy-client-empty-review">
                  <FileCheck2 size={24} />
                  <h5>Your files are being prepared</h5>
                  <p>We’ll notify you when a review package is ready. Nothing needs your approval yet.</p>
                </section>
              )}
            </div>
          ) : (
            <div ref={revisionSectionRef} id="production-revisions">
              <WorkspaceSection
                icon={<CheckCircle2 size={19} strokeWidth={2.15} />}
                eyebrow="Change request"
                title="Revision rounds"
                description="One revision round can cover one, several or all files in the current review package."
                badge={revisionPolicy?.enforced ? `${revisionPolicy.used}/${revisionPolicy.totalAllowance ?? revisionPolicy.included} used` : `${revisionCount} round${revisionCount === 1 ? "" : "s"}`}
              >
                <ClientRevisionRequest
                  productionJobId={job.id}
                  userId={project?.user_id || project?.userId || null}
                  onCreated={onRefresh}
                  openComposerSignal={revisionComposerSignal}
                  onRevisionCountChange={setRevisionCount}
                  onRevisionPolicyChange={setRevisionPolicy}
                  reviewGroups={deliverableGroups}
                  initialTargets={revisionTargets}
                  onBuyExtraRevision={revisionPolicy?.enforced && Number(revisionPolicy.extraRevisionFee || 0) > 0 ? buyExtraRevision : undefined}
                  buyingExtraRevision={buyingExtraRevision}
                />
              </WorkspaceSection>
            </div>
          )}
        </div>
      )}

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

function clientTabDescription(tab: ClientWorkspaceTab) {
  if (tab === "Overview") return "Status and what happens next";
  if (tab === "Messages") return "Questions and updates with Heyy Studio";
  return "Project files, revisions and final downloads";
}

function getCurrentStage(status: string): number {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "delivered" || normalized === "completed") {
    return STAGES.length;
  }
  if (normalized === "approved") return 3;
  if (normalized.includes("review") || normalized.includes("revision")) return 2;
  if (
    normalized.includes("assigned") ||
    normalized.includes("progress") ||
    normalized.includes("production")
  ) {
    return 1;
  }
  return 1;
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


function formatTimelineItem(item: any) {
  const title = String(item?.title || "Production update");
  const normalized = title.toLowerCase();

  let displayTitle = title;
  if (normalized === "payment received") displayTitle = "Payment confirmed";
  else if (normalized.startsWith("production delivered")) displayTitle = "Files sent for review";
  else if (normalized.startsWith("final deliverables published")) displayTitle = "Final files published";
  else if (normalized.startsWith("new final selected")) displayTitle = "New final version selected";
  else if (/revision \d+ requested/i.test(title)) displayTitle = title.replace("Requested", "requested");
  else if (/revision \d+ ready for review/i.test(title)) displayTitle = title.replace(/Ready for Review/i, "ready for review");
  else if (/revision \d+ approved/i.test(title)) displayTitle = title.replace("Approved", "approved");

  return { ...item, title: displayTitle };
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

  .heyy-production-complete-strip {
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:space-between;
    gap:18px;
    margin:0 18px 14px;
    border:1px solid #ccebdc;
    border-radius:20px;
    background:linear-gradient(110deg,#f2fbf7 0%,#ffffff 52%,#f6f1ff 100%);
    padding:16px 18px;
    box-shadow:0 8px 22px rgba(41,78,63,.06);
  }
  .heyy-production-complete-copy{display:flex;max-width:760px;align-items:flex-start;gap:13px}
  .heyy-production-complete-icon{display:grid;width:38px;height:38px;flex:0 0 38px;place-items:center;border-radius:13px;background:#0d9655;color:#fff;box-shadow:0 7px 16px rgba(13,150,85,.18)}
  .heyy-production-complete-eyebrow{margin:0;color:#087b45;font-size:8px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
  .heyy-production-complete-pill{display:inline-flex;align-items:center;border-radius:999px;background:#efe7ff;padding:4px 8px;color:#8b5cf6;font-size:8px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
  .heyy-production-complete-copy h5{margin:3px 0 0;color:#17131f;font-size:19px;font-weight:950;letter-spacing:-.035em}
  .heyy-production-complete-copy p{margin:4px 0 0;color:#6c6575;font-size:11px;font-weight:650;line-height:1.65}
  .heyy-production-complete-actions{display:flex;flex-wrap:wrap;gap:8px}
  .heyy-production-complete-actions button,.heyy-production-complete-actions a{display:inline-flex;min-height:38px;align-items:center;justify-content:center;gap:7px;border-radius:999px;padding:0 14px;font-size:10px;font-weight:900;text-decoration:none;transition:transform 160ms ease,box-shadow 160ms ease,background 160ms ease}
  .heyy-production-complete-actions button{border:1px solid #d4c4ee;background:#fff;color:#4d176f;box-shadow:0 4px 12px rgba(89,49,119,.06)}
  .heyy-production-complete-actions a{border:1px solid #d8d1df;background:#f7f5f9;color:#4e4757}
  .heyy-production-complete-actions button:hover,.heyy-production-complete-actions a:hover{transform:translateY(-1px);box-shadow:0 7px 16px rgba(69,45,84,.10)}

  .heyy-client-stage-rail {
    display: grid;
    grid-template-columns: repeat(4,minmax(0,1fr));
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

  .heyy-client-workspace-tabs {
    display: grid;
    grid-template-columns: repeat(3,minmax(0,1fr));
    gap: 5px;
    border-bottom: 1px solid #e4dfea;
    background: #f3f1f6;
    padding: 8px 18px;
  }

  .heyy-client-workspace-tab {
    min-height: 50px;
    border: 0 !important;
    border-radius: 11px !important;
    background: transparent !important;
    color: #5c5565 !important;
    padding: 8px 12px !important;
    text-align: left;
    transition: border-color 160ms ease,background 160ms ease,color 160ms ease,transform 160ms ease;
  }

  .heyy-client-workspace-tab:hover {
    transform: none;
    background: #fff !important;
  }

  .heyy-client-workspace-tab[data-active="true"] {
    background: var(--production-accent) !important;
    color: #fff !important;
    box-shadow: 0 7px 18px color-mix(in srgb,var(--production-accent) 18%,transparent);
  }

  .heyy-client-workspace-tab > span { display: block; }
  .heyy-client-workspace-tab-title{
    display:inline-flex !important;
    width:auto !important;
    align-items:center !important;
    justify-content:flex-start !important;
    gap:7px !important;
    margin:0 !important;
    opacity:1 !important;
  }
  .heyy-client-workspace-tab-badge{
    display:inline-flex !important;
    min-width:19px;
    height:19px;
    align-items:center;
    justify-content:center;
    border-radius:999px;
    background:#ff3f86;
    padding:0 5px;
    color:#fff;
    font-size:9px;
    line-height:1;
    font-weight:950;
    box-shadow:0 5px 12px rgba(255,63,134,.26);
  }
  .heyy-client-workspace-tab[data-active="true"] .heyy-client-workspace-tab-badge{background:#ffcf3f;color:#2c1735;box-shadow:0 5px 12px rgba(255,207,63,.28)}
  .heyy-client-workspace-tab strong { font-size: 11px; font-weight: 950; }
  .heyy-client-workspace-tab > span:last-child { margin-top: 3px; font-size: 8px; font-weight: 750; opacity: .72; }

  .heyy-client-review-tabs {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 5px;
    border: 1px solid #ddd6e8;
    border-radius: 16px;
    background: #f2eff6;
    padding: 5px;
  }

  .heyy-client-review-tabs button {
    min-height: 52px;
    border: 0 !important;
    border-radius: 11px !important;
    background: transparent !important;
    color: #5d5666 !important;
    padding: 9px 13px !important;
    text-align: left;
    cursor: pointer;
  }

  .heyy-client-review-tabs button:hover { background: #fff !important; }
  .heyy-client-review-tabs button[data-active="true"] {
    background: #fff !important;
    color: #8b5cf6 !important;
    box-shadow: 0 7px 18px rgba(57,35,84,.09);
  }
  .heyy-client-review-tabs span { display:block;font-size:11px;font-weight:950; }
  .heyy-client-review-tabs small { display:block;margin-top:3px;font-size:8px;font-weight:800;color:#81798a; }
  .heyy-client-review-tabs button[data-active="true"] small { color:#8b5cf6; }

  @media (max-width: 650px) {
    .heyy-client-review-tabs { grid-template-columns: minmax(0,1fr); }
  }

  .heyy-client-single-section {
    display: grid;
    gap: 16px;
    padding: 18px;
  }

  .heyy-client-overview-card {
    background:
      radial-gradient(circle at 100% 0%,var(--production-accent-soft),transparent 44%),
      #fff;
    padding: 22px;
  }

  .heyy-client-overview-card h5 {
    margin: 6px 0 0;
    color: #17151f !important;
    font-size: 24px;
    font-weight: 950;
    letter-spacing: -.04em;
  }

  .heyy-client-overview-card > p:not(.heyy-client-action-eyebrow) {
    margin: 9px 0 0;
    color: #696270 !important;
    font-size: 11px;
    line-height: 1.75;
  }

  .heyy-client-overview-cta {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    margin-top: 18px;
    border: 1px solid var(--production-accent) !important;
    border-radius: 999px !important;
    background: var(--production-accent) !important;
    color: #fff !important;
    padding: 0 17px !important;
    font-size: 10px;
    font-weight: 950;
  }

  .heyy-client-empty-review {
    display: grid;
    min-height: 220px;
    place-items: center;
    align-content: center;
    border: 1px dashed #d8d0e1;
    border-radius: 21px;
    background: #fff;
    padding: 28px;
    text-align: center;
  }

  .heyy-client-empty-review svg { color: var(--production-accent-strong); }
  .heyy-client-empty-review h5 { margin: 10px 0 0; color: #17151f !important; font-size: 17px; font-weight: 950; }
  .heyy-client-empty-review p { max-width: 520px; margin: 6px 0 0; color: #777080 !important; font-size: 10px; line-height: 1.65; }

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
  .heyy-client-overview-card,
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

  .heyy-client-section-body .heyy-send-revision,
  .heyy-client-section-body .heyy-download-all,
  .heyy-client-section-body .heyy-history-toggle {
    border-color: var(--production-accent) !important;
  }

  .heyy-client-section-body .heyy-approve-delivery {
    border-color:#0d9655 !important;
    background:#0d9655 !important;
    color:#fff !important;
    box-shadow:0 9px 22px rgba(13,150,85,.20) !important;
  }

  .heyy-client-section-body .heyy-approve-delivery:hover:not(:disabled) {
    border-color:#087b45 !important;
    background:#087b45 !important;
    box-shadow:0 12px 26px rgba(13,150,85,.24) !important;
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
  [data-theme="dark"] .heyy-client-overview-card,
  [data-theme="dark"] .heyy-client-activity-card,
  [data-theme="dark"] .heyy-client-empty-review {
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
  [data-theme="dark"] .heyy-client-overview-card h5,
  [data-theme="dark"] .heyy-client-empty-review h5,
  [data-theme="dark"] .heyy-client-stage strong,
  [data-theme="dark"] .heyy-client-info-row strong,
  [data-theme="dark"] .heyy-client-activity-heading p,
  [data-theme="dark"] .heyy-client-activity-item strong {
    color: #f5f2f8 !important;
  }

  [data-theme="dark"] .heyy-client-workspace-subtitle,
  [data-theme="dark"] .heyy-client-section-heading > div > span,
  [data-theme="dark"] .heyy-client-action-card > p:not(.heyy-client-action-eyebrow),
  [data-theme="dark"] .heyy-client-overview-card > p:not(.heyy-client-action-eyebrow),
  [data-theme="dark"] .heyy-client-empty-review p,
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


  [data-theme="dark"] .heyy-client-workspace-tabs {
    border-color: #463d50;
    background: #17131d;
  }

  [data-theme="dark"] .heyy-client-workspace-tab {
    border-color: #5a4f65 !important;
    background: #211c28 !important;
    color: #ded6e5 !important;
  }

  [data-theme="dark"] .heyy-client-workspace-tab[data-active="true"] {
    border-color: var(--production-accent) !important;
    background: var(--production-accent) !important;
    color: #fff !important;
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
  [data-theme="dark"] .heyy-client-overview-card,
  [data-theme="dark"] .heyy-client-activity-card,
  [data-theme="dark"] .heyy-client-empty-review {
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
      grid-template-columns: repeat(4,minmax(110px,1fr));
      overflow-x: auto;
      padding: 14px 16px;
    }
    .heyy-client-stage small { display: none; }
    .heyy-client-workspace-tabs {
      grid-template-columns: minmax(150px,1fr) minmax(150px,1fr) minmax(170px,1fr);
      overflow-x: auto;
      padding: 10px 12px;
    }
    .heyy-client-workspace-grid { padding: 12px; }
    .heyy-client-single-section { padding: 12px; }
    .heyy-client-workspace-sidebar { grid-template-columns: minmax(0,1fr); }
    .heyy-client-section-header { flex-direction: column; }
    .heyy-client-section-badge { align-self: flex-start; }
  }
`;
