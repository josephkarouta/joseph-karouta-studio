"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { getStudioIdentity } from "../../../../lib/studio/studio-identity";
import ExpertSourcing from "@/components/production/admin/ExpertSourcing";

type StudioRequest = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  studio: string;
  service: string;
  status: string;
  notes: string | null;
  project_brief: string | null;
  preview_image: string | null;
  metadata: any;
  created_at: string;
};


type ExpertSelection = {
  id: string;
  expert_profile_id: string;
  status: string;
  quoted_fee_cents: number | null;
  currency: string;
  turnaround_days: number | null;
  included_revisions: number | null;
  extra_revision_fee_cents: number | null;
  expert_notes: string | null;
  quoted_at: string | null;
  shared_scope: Record<string, any>;
  expert: {
    id: string;
    full_name: string;
    studio: string | null;
    role_title: string | null;
    availability: string | null;
  } | null;
};

type RequestWorkspaceTab = "Client Brief" | "Expert Sourcing" | "Client Quote" | "Activity";

const REQUEST_TABS: RequestWorkspaceTab[] = [
  "Client Brief",
  "Expert Sourcing",
  "Client Quote",
  "Activity",
];

const REQUEST_TAB_SLUGS: Record<RequestWorkspaceTab, string> = {
  "Client Brief": "client-brief",
  "Expert Sourcing": "expert-sourcing",
  "Client Quote": "client-quote",
  "Activity": "activity",
};

function requestTabFromSlug(value: string | null): RequestWorkspaceTab | null {
  const match = Object.entries(REQUEST_TAB_SLUGS).find(([, slug]) => slug === String(value || "").toLowerCase());
  return (match?.[0] as RequestWorkspaceTab | undefined) || null;
}

type QuoteTemplate = {
  id: string;
  name: string;
  studio?: string | null;
  service_id?: string | null;
  content: Record<string, unknown>;
};

type WorkspaceQuote = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string | null;
  estimated_days: number | null;
  included_revisions: number | null;
  extra_revision_fee: number | null;
  status: string;
  created_at: string;
  paid_at?: string | null;
  production_job_id?: string | null;
  expert_cost_amount?: number | null;
  management_fee_percent?: number | null;
  management_fee_amount?: number | null;
  expert_extra_revision_cost_amount?: number | null;
  expert_opportunity_id?: string | null;
  subtotal_amount?: number | null;
  discount_amount?: number | null;
  discount_label?: string | null;
};

export default function StudioRequestReviewPage() {
  const params = useParams();
  const router = useRouter();

  const [request, setRequest] = useState<StudioRequest | null>(null);
  const [quote, setQuote] = useState<WorkspaceQuote | null>(null);
  const [expertSelection, setExpertSelection] = useState<ExpertSelection | null>(null);
  const [activeTab, setActiveTab] = useState<RequestWorkspaceTab>("Client Brief");
  const [loading, setLoading] = useState(true);

  function selectTab(tab: RequestWorkspaceTab) {
    setActiveTab(tab);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("section", REQUEST_TAB_SLUGS[tab]);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function loadRequest() {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/studio-request?id=${params.id}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Studio request not found");
      }

      setRequest(data.request);
      setQuote(data.quote || null);
      setExpertSelection(data.expertSelection || null);
    } catch (error) {
      console.error("Studio request load error:", error);
      setRequest(null);
      setQuote(null);
      setExpertSelection(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedTab = requestTabFromSlug(new URLSearchParams(window.location.search).get("section"));
    if (requestedTab) setActiveTab(requestedTab);
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      void loadRequest();
    }
  }, [params.id]);

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#f8f7fb", color: "#8b5cf6" }}
      >
        Loading studio request...
      </main>
    );
  }

  if (!request) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#f8f7fb", color: "#8b5cf6" }}
      >
        Studio request not found.
      </main>
    );
  }

  return (
    <main
      className="heyy-review-page min-h-screen"
      style={{
        backgroundColor: "#f8f7fb",
        color: "#17151f",
        colorScheme: "light",
      }}
    >
      <style>{`
        .heyy-review-page, .heyy-review-page * { box-sizing: border-box; }
        .heyy-review-page button,
        .heyy-review-page input,
        .heyy-review-page textarea { font: inherit; }

        .heyy-review-shell {
          max-width: 1520px;
          margin: 0 auto;
          padding: 16px 24px 42px;
        }

        .heyy-review-hero {
          position: relative !important;
          overflow: hidden !important;
          border: 1px solid #ddd0f4 !important;
          border-radius: 28px !important;
          background: linear-gradient(135deg, #ffffff 0%, #f5efff 55%, #e8d8ff 100%) !important;
          color: #17151f !important;
          padding: 26px 30px !important;
          box-shadow: 0 18px 42px rgba(73,35,116,.10) !important;
        }

        .heyy-review-hero::after {
          content: "/";
          position: absolute;
          right: 26px;
          top: 50%;
          transform: translateY(-50%) rotate(20deg);
          font-size: 175px;
          line-height: 1;
          font-weight: 900;
          color: rgba(255,255,255,.74);
          pointer-events: none;
        }

        .heyy-review-hero-inner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .heyy-back-button,
        .heyy-refresh-request {
          border: 0 !important;
          background: transparent !important;
          color: #5f5868 !important;
          font-weight: 900 !important;
          cursor: pointer !important;
        }

        .heyy-back-button:hover { color: #8b5cf6 !important; }

        .heyy-refresh-request {
          border: 1px solid #17151f !important;
          border-radius: 999px !important;
          background: #17151f !important;
          color: #fff !important;
          padding: 12px 18px !important;
          transition: all 220ms ease !important;
        }

        .heyy-refresh-request:hover {
          transform: translateY(-2px);
          border-color: #8b5cf6 !important;
          background: #8b5cf6 !important;
          box-shadow: 0 12px 28px rgba(139,92,246,.25) !important;
        }

        .heyy-request-progress {
          display: grid !important;
          grid-template-columns: repeat(5,minmax(0,1fr)) !important;
          gap: 8px !important;
          margin-top: 14px !important;
          border: 1px solid #ddd6e8 !important;
          border-radius: 20px !important;
          background: #fff !important;
          padding: 7px !important;
          box-shadow: 0 10px 28px rgba(30,20,45,.05) !important;
        }

        .heyy-request-progress-step {
          position: relative !important;
          min-height: 62px !important;
          border: 1px solid #ece7f1 !important;
          border-radius: 14px !important;
          background: #faf9fc !important;
          padding: 11px 12px !important;
        }

        .heyy-request-progress-step[data-state="done"] {
          border-color: #b9e9cc !important;
          background: #f1fff6 !important;
        }

        .heyy-request-progress-step[data-state="active"] {
          border-color: #8b5cf6 !important;
          background: #f4edff !important;
          box-shadow: inset 0 0 0 1px rgba(139,92,246,.08) !important;
        }

        .heyy-request-progress-step strong {
          display: block !important;
          color: #17151f !important;
          font-size: 10px !important;
          font-weight: 900 !important;
        }

        .heyy-request-progress-step span {
          display: block !important;
          margin-top: 4px !important;
          color: #777080 !important;
          font-size: 9px !important;
          line-height: 1.45 !important;
        }

        .heyy-request-tabs {
          display: grid !important;
          grid-template-columns: repeat(4,minmax(0,1fr)) !important;
          gap: 7px !important;
          margin-top: 14px !important;
          border: 1px solid #ddd6e8 !important;
          border-radius: 20px !important;
          background: #fff !important;
          padding: 7px !important;
          box-shadow: 0 10px 28px rgba(30,20,45,.05) !important;
        }

        .heyy-request-tab {
          min-height: 58px !important;
          border: 1px solid transparent !important;
          border-radius: 14px !important;
          background: #f8f7fb !important;
          color: #51495a !important;
          padding: 11px 13px !important;
          text-align: left !important;
          cursor: pointer !important;
          font-weight: 900 !important;
          transition: all 180ms ease !important;
        }

        .heyy-request-tab:hover {
          border-color: #8b5cf6 !important;
          background: #f2e9ff !important;
          color: #8b5cf6 !important;
        }

        .heyy-request-tab[data-active="true"] {
          border-color: #8b5cf6 !important;
          background: #8b5cf6 !important;
          color: #fff !important;
          box-shadow: 0 10px 24px rgba(139,92,246,.20) !important;
        }

        .heyy-request-tab small {
          display: block !important;
          margin-top: 3px !important;
          font-size: 9px !important;
          font-weight: 700 !important;
          opacity: .72 !important;
        }

        .heyy-request-tab-panel {
          display: grid !important;
          gap: 18px !important;
          margin-top: 18px !important;
        }

        .heyy-client-quote-grid {
          display: grid !important;
          grid-template-columns: minmax(0,1fr) minmax(340px,430px) !important;
          align-items: start !important;
          gap: 18px !important;
        }

        .heyy-internal-cost-card {
          border: 1px solid #cfe8da !important;
          border-radius: 17px !important;
          background: linear-gradient(135deg,#f2fff7,#fff) !important;
          padding: 15px !important;
        }

        .heyy-activity-grid {
          display: grid !important;
          grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          gap: 12px !important;
        }

        .heyy-review-layout {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 390px !important;
          align-items: start !important;
          gap: 18px !important;
          margin-top: 18px !important;
        }

        .heyy-review-left {
          display: grid !important;
          gap: 18px !important;
          min-width: 0 !important;
        }

        .heyy-surface {
          border: 1px solid #ded7e8 !important;
          border-radius: 24px !important;
          background: #fff !important;
          color: #17151f !important;
          box-shadow: 0 10px 28px rgba(30,20,45,.055) !important;
          transition: all 220ms ease !important;
        }

        .heyy-surface:hover {
          transform: translateY(-2px);
          border-color: #8b5cf6 !important;
          box-shadow: 0 16px 34px rgba(139,92,246,.11) !important;
        }

        .heyy-summary-grid {
          display: grid !important;
          grid-template-columns: 240px minmax(0,1fr) !important;
          overflow: hidden !important;
        }

        .heyy-preview-box {
          height: 230px !important;
          min-height: 230px !important;
          overflow: hidden !important;
          background: #efe7fb !important;
        }

        .heyy-preview-box img {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-height: 230px !important;
          object-fit: cover !important;
        }

        .heyy-summary-copy {
          padding: 24px !important;
          min-width: 0 !important;
        }

        .heyy-info-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          gap: 10px !important;
          margin-top: 20px !important;
        }

        .heyy-info-tile {
          min-width: 0 !important;
          border: 1px solid #e5e0ea !important;
          border-radius: 15px !important;
          background: #faf9fc !important;
          color: #17151f !important;
          padding: 12px 13px !important;
        }

        .heyy-content-card {
          padding: 22px !important;
        }

        .heyy-notes-card {
          background: linear-gradient(135deg,#eef7ff 0%,#ffffff 58%) !important;
          border-color: #bfdbfe !important;
        }

        .heyy-brief-card {
          background: linear-gradient(135deg,#f4edff 0%,#ffffff 58%) !important;
          border-color: #d8c2ff !important;
        }

        .heyy-brief-content {
          max-height: 420px !important;
          overflow: auto !important;
          margin: 14px 0 0 !important;
          border: 1px solid #e3d9f2 !important;
          border-radius: 16px !important;
          background: rgba(255,255,255,.82) !important;
          color: #4d4656 !important;
          padding: 16px !important;
          white-space: pre-wrap !important;
          word-break: break-word !important;
          font-family: inherit !important;
          font-size: 13px !important;
          line-height: 1.75 !important;
        }

        .heyy-brief-sections {
          display: grid !important;
          gap: 12px !important;
          margin-top: 16px !important;
        }

        .heyy-brief-section {
          border: 1px solid #e4daef !important;
          border-radius: 18px !important;
          background: rgba(255,255,255,.84) !important;
          padding: 16px !important;
        }

        .heyy-brief-field-grid {
          display: grid !important;
          grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          gap: 9px !important;
          margin-top: 12px !important;
        }

        .heyy-brief-field {
          min-width: 0 !important;
          border: 1px solid #ece6f2 !important;
          border-radius: 13px !important;
          background: #faf9fc !important;
          padding: 11px 12px !important;
        }

        .heyy-brief-field[data-wide="true"] {
          grid-column: 1 / -1 !important;
        }

        .heyy-progress-chips {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 8px !important;
          margin-top: 12px !important;
        }

        .heyy-progress-chip {
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
          border-radius: 999px !important;
          padding: 8px 11px !important;
          font-size: 10px !important;
          font-weight: 900 !important;
        }

        .heyy-technical-details {
          margin-top: 12px !important;
          border: 1px solid #ddd2ea !important;
          border-radius: 15px !important;
          background: rgba(255,255,255,.72) !important;
          padding: 12px 14px !important;
        }

        .heyy-technical-details summary {
          cursor: pointer !important;
          color: #8b5cf6 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }

        .heyy-quote-panel {
          position: sticky !important;
          top: 18px !important;
          padding: 22px !important;
          border-color: #f5cf79 !important;
          background: linear-gradient(145deg,#fff7dc 0%,#ffffff 62%) !important;
        }

        .heyy-field {
          display: block !important;
          margin-top: 14px !important;
        }

        .heyy-field:first-child { margin-top: 0 !important; }

        .heyy-field-label {
          display: block !important;
          margin-bottom: 7px !important;
          color: #5a5263 !important;
          font-size: 10px !important;
          font-weight: 900 !important;
          letter-spacing: .16em !important;
          text-transform: uppercase !important;
        }

        .heyy-review-input,
        .heyy-review-textarea {
          width: 100% !important;
          border: 1px solid #ded8e6 !important;
          border-radius: 14px !important;
          background: #fff !important;
          color: #17151f !important;
          padding: 0 14px !important;
          outline: none !important;
        }

        .heyy-review-input { min-height: 48px !important; }
        .heyy-review-textarea {
          min-height: 128px !important;
          padding-top: 13px !important;
          resize: vertical !important;
        }

        .heyy-review-input:focus,
        .heyy-review-textarea:focus {
          border-color: #8b5cf6 !important;
          box-shadow: 0 0 0 4px rgba(139,92,246,.12) !important;
        }

        .heyy-quote-details {
          display: grid !important;
          grid-template-columns: repeat(3,minmax(0,1fr)) !important;
          gap: 8px !important;
          margin-top: 14px !important;
        }

        .heyy-quote-detail {
          border: 1px solid #f1dfac !important;
          border-radius: 13px !important;
          background: rgba(255,255,255,.8) !important;
          padding: 11px !important;
        }

        .heyy-quote-detail-input {
          width: 100% !important;
          min-height: 38px !important;
          margin-top: 7px !important;
          border: 1px solid #e7d49c !important;
          border-radius: 10px !important;
          background: #fff !important;
          color: #17151f !important;
          padding: 0 9px !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          outline: none !important;
        }

        .heyy-quote-detail-input:focus {
          border-color: #8b5cf6 !important;
          box-shadow: 0 0 0 3px rgba(139,92,246,.11) !important;
        }

        .heyy-quote-error {
          margin-top: 12px !important;
          border: 1px solid #fecdd3 !important;
          border-radius: 12px !important;
          background: #fff1f2 !important;
          color: #be123c !important;
          padding: 10px 12px !important;
          font-size: 11px !important;
          font-weight: 800 !important;
        }

        .heyy-send-quote {
          width: 100% !important;
          min-height: 50px !important;
          margin-top: 14px !important;
          border: 1px solid #17151f !important;
          border-radius: 15px !important;
          background: #17151f !important;
          color: #fff !important;
          font-weight: 900 !important;
          transition: all 220ms ease !important;
        }

        .heyy-send-quote:hover {
          transform: translateY(-2px);
          border-color: #8b5cf6 !important;
          background: #8b5cf6 !important;
          box-shadow: 0 13px 28px rgba(139,92,246,.26) !important;
        }

        .heyy-send-quote:disabled {
          cursor: wait !important;
          opacity: .55 !important;
        }

        @media (max-width: 1080px) {
          .heyy-review-layout {
            grid-template-columns: minmax(0,1fr) !important;
          }
          .heyy-client-quote-grid { grid-template-columns: minmax(0,1fr) !important; }
          .heyy-request-progress { grid-template-columns: repeat(3,minmax(0,1fr)) !important; }
          .heyy-quote-panel {
            position: static !important;
          }
        }

        @media (max-width: 700px) {
          .heyy-review-shell { padding: 12px 12px 30px; }
          .heyy-review-hero { padding: 22px 18px !important; }
          .heyy-review-hero::after { display: none; }
          .heyy-summary-grid {
            grid-template-columns: minmax(0,1fr) !important;
          }
          .heyy-preview-box,
          .heyy-preview-box img {
            height: 190px !important;
            min-height: 190px !important;
            max-height: 190px !important;
          }
          .heyy-info-grid,
          .heyy-quote-details,
          .heyy-brief-field-grid,
          .heyy-request-tabs,
          .heyy-request-progress,
          .heyy-activity-grid {
            grid-template-columns: minmax(0,1fr) !important;
          }
        }
      `}</style>

      <div className="heyy-review-shell">
        <div className="heyy-review-hero">
          <div className="heyy-review-hero-inner">
            <div>
              <button
                type="button"
                onClick={() => router.push("/admin?tab=requests")}
                className="heyy-back-button"
              >
                ← Back to Requests & Quotes
              </button>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
                Review Request
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                {request.project_name || "Untitled Project"}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill value={request.status || "New"} />
                <span className="rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                  {request.service || "Service"}
                </span>
                <StudioPill studio={request.studio} />
              </div>
            </div>

            <button
              type="button"
              onClick={loadRequest}
              className="heyy-refresh-request"
            >
              Refresh Request
            </button>
          </div>
        </div>

        <div className="heyy-request-progress" aria-label="Request progress">
          {requestProgressSteps(request, quote, expertSelection).map((step) => (
            <div
              key={step.label}
              className="heyy-request-progress-step"
              data-state={step.state}
            >
              <strong>{step.label}</strong>
              <span>{step.description}</span>
            </div>
          ))}
        </div>

        <nav className="heyy-request-tabs" aria-label="Request workspace sections">
          {REQUEST_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className="heyy-request-tab"
              data-active={activeTab === tab ? "true" : "false"}
              onClick={() => selectTab(tab)}
            >
              {tab}
              <small>{requestTabDescription(tab)}</small>
            </button>
          ))}
        </nav>

        <div className="heyy-request-tab-panel">
          {activeTab === "Client Brief" && (
            <>
              <div className="heyy-surface heyy-summary-grid">
                <div className="heyy-preview-box">
                  {request.preview_image ? (
                    <img
                      src={request.preview_image}
                      alt={request.service || "Request preview"}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-black text-violet-500">
                      No Preview
                    </div>
                  )}
                </div>

                <div className="heyy-summary-copy">
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-violet-600">
                    Request Summary
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.025em]">
                    {request.project_name || "Untitled Project"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {request.service || "Service not set"}
                  </p>
                  <div className="heyy-info-grid">
                    <InfoTile
                      label="Client"
                      value={
                        request.metadata?.client_name ||
                        request.metadata?.name ||
                        "Logged-in User"
                      }
                    />
                    <InfoTile
                      label="Email"
                      value={
                        request.metadata?.client_email ||
                        request.metadata?.email ||
                        "Not attached"
                      }
                    />
                    <StudioInfoTile studio={request.studio} />
                    <InfoTile
                      label="Requested"
                      value={formatDateTime(request.created_at)}
                    />
                  </div>
                </div>
              </div>

              <div className="heyy-surface heyy-content-card heyy-notes-card">
                <h2 className="text-xl font-black tracking-[-0.02em]">Client Notes</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {request.notes || "No notes provided."}
                </p>
              </div>

              <div className="heyy-surface heyy-content-card heyy-brief-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black tracking-[-0.02em]">Project Brief</h2>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      Review the client request and approved project context before sharing anything with an Expert.
                    </p>
                  </div>
                  <StudioPill studio={request.studio} />
                </div>
                <ProjectBriefSummary request={request} />
              </div>
            </>
          )}

          {activeTab === "Expert Sourcing" && (
            <ExpertSourcing
              requestId={request.id}
              onChanged={loadRequest}
              onPreferredSelected={() => selectTab("Client Quote")}
            />
          )}

          {activeTab === "Client Quote" && (
            <div className="heyy-client-quote-grid">
              <div className="grid gap-4">
                <InternalExpertCostCard
                  selection={expertSelection}
                  clientQuote={quote}
                />
                <QuoteQuestions request={request} onRefresh={loadRequest} />
              </div>

              <div className="heyy-surface heyy-quote-panel">
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-amber-700">
                  {quote ? (String(quote.status || "").toLowerCase() === "paid" || quote.paid_at ? "Paid Quote" : "Sent Quote") : "Client Quote"}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.025em]">
                  {quote ? (String(quote.status || "").toLowerCase() === "paid" || quote.paid_at ? "Payment Confirmed" : "Quote Awaiting Payment") : "Create & Send Quote"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {quote
                    ? (String(quote.status || "").toLowerCase() === "paid" || quote.paid_at
                      ? "The client paid this quote and the request is now connected to the production job."
                      : "This is the Heyy Studio quote the client sees. You can revise it before payment if the scope, Expert cost or price changes. Expert cost and Heyy margin stay internal.")
                    : expertSelection
                      ? "Use the selected Expert cost as an internal reference, then set the final Heyy Studio client price."
                      : "You can source an Expert first or send a direct Heyy Studio quote when the cost is already known."}
                </p>

                <div className="mt-5">
                  {quote ? (
                    <ExistingQuoteCard quote={quote} request={request} expertSelection={expertSelection} onUpdated={loadRequest} />
                  ) : (
                    <CreateQuoteForm
                      request={request}
                      expertSelection={expertSelection}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Activity" && (
            <RequestActivity
              request={request}
              quote={quote}
              expertSelection={expertSelection}
            />
          )}
        </div>
      </div>
    </main>
  );
}


function requestTabDescription(tab: RequestWorkspaceTab) {
  if (tab === "Client Brief") return "Client scope and approved context";
  if (tab === "Expert Sourcing") return "Private matching and Expert quotes";
  if (tab === "Client Quote") return "Heyy Studio price and client questions";
  return "Commercial milestones and handoff";
}

function requestProgressSteps(
  request: StudioRequest,
  quote: WorkspaceQuote | null,
  expertSelection: ExpertSelection | null,
) {
  const converted =
    String(request.status || "").toLowerCase() === "converted" ||
    Boolean(quote?.production_job_id);
  const paid = converted || Boolean(quote?.paid_at) || String(quote?.status || "").toLowerCase() === "paid";

  return [
    {
      label: "Request received",
      description: "Client brief is ready for Admin review.",
      state: "done",
    },
    {
      label: "Expert costing",
      description: expertSelection
        ? "Preferred Expert selected."
        : quote
          ? "Direct Heyy Studio quote — Expert sourcing skipped."
          : "Optional private Expert quotes before pricing.",
      state: expertSelection || quote ? "done" : "active",
    },
    {
      label: "Client quote",
      description: quote ? "Heyy Studio quote sent." : "Set the final client scope and price.",
      state: quote ? "done" : expertSelection ? "active" : "pending",
    },
    {
      label: "Awaiting payment",
      description: paid ? "Payment confirmed." : quote ? "Waiting for client payment." : "Starts after the client quote.",
      state: paid ? "done" : quote ? "active" : "pending",
    },
    {
      label: "Production",
      description: converted ? "Converted to a paid production job." : "Expert assignment activates after payment.",
      state: converted ? "done" : "pending",
    },
  ];
}

function InternalExpertCostCard({
  selection,
  clientQuote,
}: {
  selection: ExpertSelection | null;
  clientQuote: WorkspaceQuote | null;
}) {
  if (!selection) {
    return (
      <div className="heyy-surface heyy-content-card">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
          Internal costing
        </p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.02em]">No preferred Expert selected</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          You can source an Expert first, or continue with a direct Heyy Studio quote when the production cost is already known.
        </p>
      </div>
    );
  }

  const clientCents = clientQuote ? Math.round(Number(clientQuote.amount || 0) * 100) : null;
  const expertCents = Number(selection.quoted_fee_cents || 0);
  const grossMarginCents = clientCents === null ? null : clientCents - expertCents;

  return (
    <div className="heyy-internal-cost-card">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
        Internal only — never shown to client
      </p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-slate-950">
        {selection.expert?.full_name || "Preferred Expert"}
      </h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <QuoteSummaryItem
          label="Expert Fee"
          value={formatMoney(selection.quoted_fee_cents, selection.currency)}
        />
        <QuoteSummaryItem
          label="Expert Turnaround"
          value={selection.turnaround_days ? `${selection.turnaround_days} days` : "—"}
        />
        <QuoteSummaryItem
          label="Expert Revisions"
          value={String(selection.included_revisions ?? "—")}
        />
        <QuoteSummaryItem
          label="Expert Fee / Extra Revision"
          value={selection.extra_revision_fee_cents !== null ? formatMoney(selection.extra_revision_fee_cents, selection.currency) : "—"}
        />
      </div>
      {grossMarginCents !== null && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-4 py-3">
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
            Gross project margin before platform/provider/tax costs
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatMoney(grossMarginCents, selection.currency)}
          </p>
        </div>
      )}
      <p className="mt-3 text-[10px] font-bold leading-5 text-slate-500">
        The client sees only the Heyy Studio scope, price, delivery and revision allowance.
      </p>
    </div>
  );
}

function RequestActivity({
  request,
  quote,
  expertSelection,
}: {
  request: StudioRequest;
  quote: WorkspaceQuote | null;
  expertSelection: ExpertSelection | null;
}) {
  const converted =
    String(request.status || "").toLowerCase() === "converted" ||
    Boolean(quote?.production_job_id);

  return (
    <div className="heyy-surface heyy-content-card">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
        Request Activity
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Commercial handoff timeline</h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        This view separates pre-production commercial decisions from the paid production workspace.
      </p>
      <div className="heyy-activity-grid mt-5">
        <ActivityTile
          label="Client request received"
          value={formatDateTime(request.created_at)}
          status="Done"
        />
        <ActivityTile
          label="Preferred Expert"
          value={expertSelection?.expert?.full_name || "Not selected"}
          status={expertSelection ? "Selected" : "Pending"}
        />
        <ActivityTile
          label="Client quote"
          value={quote ? `${quote.currency || "USD"} ${Number(quote.amount || 0).toFixed(2)}` : "Not sent"}
          status={quote ? String(quote.status || "Sent") : "Pending"}
        />
        <ActivityTile
          label="Production handoff"
          value={converted ? "Paid production job created" : "Waiting for payment"}
          status={converted ? "Done" : "Pending"}
        />
      </div>
    </div>
  );
}

function ActivityTile({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#faf9fc] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-violet-700">
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

function formatMoney(cents: number | null, currency = "USD") {
  if (cents === null || cents === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(Number(cents) / 100);
  } catch {
    return `${currency} ${(Number(cents) / 100).toFixed(2)}`;
  }
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="heyy-info-tile">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-700">
        {value}
      </p>
    </div>
  );
}

function StudioPill({ studio }: { studio: unknown }) {
  const identity = getStudioIdentity(studio);

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em]"
      style={{
        backgroundColor: identity.soft,
        color: identity.accentDark,
        border: `1px solid ${identity.border}`,
      }}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[7px]"
        style={{ backgroundColor: identity.accent, color: "#ffffff" }}
      >
        {identity.initials}
      </span>
      {identity.label}
    </span>
  );
}

function StudioInfoTile({ studio }: { studio: unknown }) {
  const identity = getStudioIdentity(studio);

  return (
    <div className="heyy-info-tile">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
        Studio
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[9px] font-black"
          style={{
            backgroundColor: identity.soft,
            color: identity.accentDark,
            border: `1px solid ${identity.border}`,
          }}
        >
          {identity.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black" style={{ color: identity.accentDark }}>
            {identity.label}
          </p>
          <p className="truncate text-[9px] text-slate-400">{identity.shortLabel} request</p>
        </div>
      </div>
    </div>
  );
}

type BriefField = {
  label: string;
  value: unknown;
  wide?: boolean;
};

function ProjectBriefSummary({ request }: { request: StudioRequest }) {
  const metadataContext = asRecord(request.metadata?.project_context);
  const context = Object.keys(metadataContext).length
    ? metadataContext
    : extractProjectContext(request.project_brief);
  const studio = String(request.studio || "").toLowerCase();

  if (!context) {
    return (
      <div className="heyy-brief-sections">
        <p className="text-sm leading-7 text-slate-600">
          Structured project information was not attached to this request.
        </p>
        <GeneratedAssetGallery request={request} />
        <ProductionRequestDetails request={request} />
        <RequestReference request={request} />
      </div>
    );
  }

  if (studio === "architecture_studio") {
    return <ArchitectureBriefSummary context={context} request={request} />;
  }

  if (studio === "brand_studio") {
    return <BrandBriefSummary context={context} request={request} />;
  }

  return <GeneralBriefSummary context={context} request={request} />;
}

function BrandBriefSummary({ context, request }: { context: any; request: StudioRequest }) {
  const journey = asRecord(context?.projectJourney);
  const scope = asRecord(context?.production_scope);
  const strategy = asRecord(context?.brandStrategy);
  const foundation = asRecord(context?.foundation);
  const voice = asRecord(context?.brandVoice);
  const selectedApplications = Array.isArray(context?.selected_brand_applications)
    ? context.selected_brand_applications
    : [];

  const overviewFields: BriefField[] = [
    { label: "Brand Summary", value: context?.summary, wide: true },
    { label: "Project Journey", value: pick(journey, "journeyTitle", "journey_id", "journeyId") },
    { label: "Logo Approach", value: humanize(pick(journey, "logoAction")) },
    { label: "Selected Deliverables", value: pick(journey, "selectedDeliverables"), wide: true },
    { label: "Selected Applications", value: selectedApplications.map((item: any) => item?.label || item?.title || item?.id).filter(Boolean), wide: true },
  ];

  const foundationFields: BriefField[] = [
    { label: "Positioning / Direction", value: pick(strategy, "strategy", "positioning", "direction"), wide: true },
    { label: "Purpose / Mission", value: pick(strategy, "purpose", "mission", "commitment"), wide: true },
    { label: "Audience", value: pick(strategy, "audience", "targetAudience") || pick(foundation, "audience"), wide: true },
    { label: "Brand Voice", value: pick(voice, "voice", "toneOfVoice") || pick(strategy, "voice", "communication"), wide: true },
    { label: "Personality", value: context?.personality || pick(strategy, "traits"), wide: true },
    { label: "Core Values", value: pick(strategy, "values", "coreValues") || pick(foundation, "values"), wide: true },
  ];

  const productionFields: BriefField[] = [
    { label: "Production Scope", value: pick(scope, "title") || request.service },
    { label: "Scope Description", value: pick(scope, "description") || request.metadata?.description, wide: true },
    { label: "Required Final Files", value: context?.final_file_requirements || pick(scope, "outputs"), wide: true },
    { label: "Generated References", value: request.metadata?.generated_asset_count || visualReferencesFromRequest(request).length },
  ];

  return (
    <div className="heyy-brief-sections">
      <BriefSection title="Brand Project Overview" fields={overviewFields} />
      <BriefSection title="Brand Foundation" fields={foundationFields} />
      <BriefSection title="Selected Production Package" fields={productionFields} />
      <GeneratedAssetGallery request={request} />
      <ProductionRequestDetails request={request} />
      <RequestReference request={request} />
    </div>
  );
}

function ArchitectureBriefSummary({ context, request }: { context: any; request: StudioRequest }) {
  const project = context?.project || {};
  const site = context?.site || {};
  const planning = context?.planning || {};
  const direction = context?.selected_direction || {};
  const concept = context?.architecture_concept || null;
  const plans = context?.concept_plan_set || null;
  const visuals = Array.isArray(context?.approved_visuals)
    ? context.approved_visuals
    : [];
  const allOutputs = Array.isArray(context?.all_generated_outputs)
    ? context.all_generated_outputs
    : Array.isArray(request.metadata?.generated_assets)
      ? request.metadata.generated_assets
      : [];
  const designPack = context?.design_pack || null;

  const projectFields: BriefField[] = [
    { label: "Project Type", value: pick(project, "project_type", "type") },
    { label: "Workflow", value: humanize(pick(project, "workflow_mode", "workflow")) },
    { label: "Scope", value: pick(project, "scope") },
    { label: "Architectural Style", value: pick(project, "architectural_style", "style") },
    { label: "Location", value: joinValues([pick(project, "city"), pick(project, "region"), pick(project, "country")]) },
    { label: "Spaces & Features", value: pick(project, "selected_spaces", "spaces"), wide: true },
  ];

  const siteFields: BriefField[] = [
    { label: "Plot Area", value: withUnit(pick(site, "plot_area"), "m²") },
    { label: "Land Dimensions", value: dimensions(site) },
    { label: "Desired Floors", value: pick(site, "desired_floors") },
    { label: "Terrain", value: pick(site, "terrain") },
    { label: "Orientation", value: pick(site, "orientation") },
    { label: "Corner Lot", value: pick(site, "corner_lot") },
    { label: "Address", value: pick(site, "address"), wide: true },
    { label: "Site Notes", value: pick(site, "site_notes", "climate_notes"), wide: true },
  ];

  const planningFields: BriefField[] = [
    { label: "Zoning", value: pick(planning, "zoning") },
    { label: "Permitted Use", value: pick(planning, "permitted_use") },
    { label: "Site Coverage", value: withUnit(pick(planning, "site_coverage_percent"), "%") },
    { label: "FAR / FSR", value: pick(planning, "floor_area_ratio") },
    { label: "Maximum Height", value: withUnit(pick(planning, "max_height_m"), "m") },
    { label: "Maximum Floors", value: pick(planning, "max_floors") },
    { label: "Setbacks", value: setbacks(planning), wide: true },
    { label: "Planning Authority", value: pick(planning, "authority_name") },
    { label: "Verification", value: joinValues([pick(planning, "verification_status"), pick(planning, "confidence")]) },
  ];

  const directionFields: BriefField[] = [
    { label: "Direction", value: pick(direction, "title") },
    { label: "Cost Level", value: pick(direction, "cost_level") },
    { label: "Architectural Philosophy", value: pick(direction, "philosophy"), wide: true },
    { label: "Site Response", value: pick(direction, "site_response"), wide: true },
    { label: "Form & Massing", value: pick(direction, "form_strategy", "form_and_massing_strategy"), wide: true },
    { label: "Façade Strategy", value: pick(direction, "facade_strategy"), wide: true },
    { label: "Materials", value: pick(direction, "materials"), wide: true },
  ];

  return (
    <div className="heyy-brief-sections">
      <BriefSection title="Project Summary" fields={projectFields} />
      <BriefSection title="Land & Site" fields={siteFields} />
      <BriefSection title="Planning Guide" fields={planningFields} />
      <BriefSection title="Selected Architecture Direction" fields={directionFields} />

      <div className="heyy-brief-section">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600">
          Architecture Package Progress
        </p>
        <div className="heyy-progress-chips">
          <ProgressChip label="Concept" ready={Boolean(concept)} />
          <ProgressChip label="Concept Plans" ready={Boolean(plans)} />
          <ProgressChip label={`${allOutputs.length} Generated Output${allOutputs.length === 1 ? "" : "s"}`} ready={allOutputs.length > 0} />
          <ProgressChip label={`${visuals.length} Approved Visual${visuals.length === 1 ? "" : "s"}`} ready={visuals.length > 0} />
          <ProgressChip label="Design Pack" ready={Boolean(designPack)} />
        </div>
      </div>

      <GeneratedOutputGallery outputs={allOutputs} />
      <ProductionRequestDetails request={request} />
      <RequestReference request={request} />
    </div>
  );
}

type VisualReference = {
  id: string;
  title: string;
  type: string;
  url: string;
  width?: number | null;
  height?: number | null;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function readAssetPayload(asset: any) {
  const source = asset?.output_payload || asset?.payload || {};
  if (typeof source === "string") {
    try {
      return JSON.parse(source);
    } catch {
      return {};
    }
  }
  return asRecord(source);
}

function visualReferencesFromRequest(request: StudioRequest): VisualReference[] {
  const references: VisualReference[] = [];
  const seen = new Set<string>();
  const generatedAssets = Array.isArray(request.metadata?.generated_assets)
    ? request.metadata.generated_assets
    : [];

  function add(item: Partial<VisualReference> & { url?: unknown }, fallbackId: string) {
    if (typeof item.url !== "string" || !item.url.trim()) return;
    const url = item.url.trim();
    if (seen.has(url)) return;
    seen.add(url);
    references.push({
      id: item.id || fallbackId,
      title: item.title || "Generated visual",
      type: item.type || "Brand reference",
      url,
      width: item.width || null,
      height: item.height || null,
    });
  }

  generatedAssets.forEach((asset: any, assetIndex: number) => {
    const payload = readAssetPayload(asset);
    const title = asset?.title || payload?.applicationLabel || humanize(asset?.asset_type || `Asset ${assetIndex + 1}`);
    const type = humanize(asset?.asset_type || payload?.applicationId || "Brand reference");
    add({
      id: asset?.id,
      title,
      type,
      url: asset?.file_url || asset?.thumbnail_url || payload?.imageUrl || payload?.image_url,
      width: payload?.width,
      height: payload?.height,
    }, `asset-${assetIndex}`);

    const outputs = Array.isArray(payload?.outputs) ? payload.outputs : [];
    outputs.forEach((output: any, outputIndex: number) => {
      add({
        id: output?.id,
        title: output?.label || `${title} ${outputIndex + 1}`,
        type,
        url: output?.imageUrl || output?.image_url || output?.file_url,
        width: output?.width,
        height: output?.height,
      }, `asset-${assetIndex}-output-${outputIndex}`);
    });

    const concepts = [
      ...(Array.isArray(payload?.conceptsByDirection) ? payload.conceptsByDirection : []),
      ...(Array.isArray(payload?.directions) ? payload.directions : []),
      ...(Array.isArray(payload?.moodboards) ? payload.moodboards : []),
      ...(Array.isArray(payload?.logos) ? payload.logos : []),
    ];
    concepts.forEach((concept: any, conceptIndex: number) => {
      add({
        id: concept?.id,
        title: concept?.title || concept?.conceptName || `${title} ${conceptIndex + 1}`,
        type,
        url: concept?.imageUrl || concept?.image_url,
      }, `asset-${assetIndex}-concept-${conceptIndex}`);
    });
  });

  add({
    id: "request-preview",
    title: `${request.service || "Production"} preview`,
    type: "Request preview",
    url: request.preview_image || undefined,
  }, "request-preview");

  return references.slice(0, 24);
}

function GeneratedAssetGallery({ request }: { request: StudioRequest }) {
  const references = visualReferencesFromRequest(request);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  if (!references.length) return null;

  return (
    <section className="heyy-brief-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600">
            Generated Visual References
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            These are the client-approved or generated concepts attached to this production request.
          </p>
        </div>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-violet-700">
          {references.length} visual{references.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {references.map((reference) => (
          <article key={reference.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setPreviewImage({ url: reference.url, title: reference.title })}
              className="block w-full cursor-zoom-in bg-slate-100 text-left"
              aria-label={`Preview ${reference.title}`}
            >
              <img
                src={reference.url}
                alt={reference.title}
                loading="lazy"
                className="h-52 w-full object-contain"
              />
            </button>
            <div className="p-4">
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-violet-700">
                {reference.type}
              </span>
              <h3 className="mt-3 line-clamp-2 text-sm font-black text-slate-900">{reference.title}</h3>
              {reference.width && reference.height ? (
                <p className="mt-1 text-[10px] font-bold text-slate-400">
                  {reference.width} × {reference.height}px
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setPreviewImage({ url: reference.url, title: reference.title })}
                className="mt-3 inline-flex rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black text-violet-700 transition hover:border-violet-600 hover:bg-violet-600 hover:text-white"
              >
                View image
              </button>
            </div>
          </article>
        ))}
      </div>
      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </section>
  );
}

function outputAssetRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function outputImageUrl(output: any) {
  const candidates = [
    output?.image_url,
    outputAssetRecord(output?.final_assets).preview_url,
    outputAssetRecord(output?.rendered_final_assets).preview_url,
    outputAssetRecord(output?.preview_assets).preview_url,
    outputAssetRecord(output?.rendered_preview_assets).preview_url,
    outputAssetRecord(output?.technical_assets).preview_url,
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 0) as string | undefined;
}

function outputStoragePath(output: any) {
  const candidates = [
    output?.storage_path,
    outputAssetRecord(output?.final_assets).master_storage_path,
    outputAssetRecord(output?.rendered_final_assets).master_storage_path,
    outputAssetRecord(output?.preview_assets).master_storage_path,
    outputAssetRecord(output?.rendered_preview_assets).master_storage_path,
    outputAssetRecord(output?.technical_assets).master_storage_path,
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 0) as string | undefined;
}

function GeneratedOutputGallery({ outputs }: { outputs: any[] }) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  if (!outputs.length) return null;
  return (
    <section className="heyy-brief-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
          Complete Generated Package
        </p>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-blue-700">
          {outputs.length} output{outputs.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-500">
        Every generated direction, concept, plan, elevation, section, visual, tour node and design-pack record attached when the client submitted production.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {outputs.map((output, index) => {
          const imageUrl = outputImageUrl(output);
          const storagePath = outputStoragePath(output);
          const title = output?.title || humanize(output?.visual_type || `Output ${index + 1}`);
          return (
            <article key={output?.id || `${output?.visual_type}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {imageUrl ? (
                <button
                  type="button"
                  onClick={() => setPreviewImage({ url: imageUrl, title })}
                  className="block w-full cursor-zoom-in bg-slate-100 text-left"
                  aria-label={`Preview ${title}`}
                >
                  <img src={imageUrl} alt={title} className="h-40 w-full object-contain" />
                </button>
              ) : (
                <div className="grid h-40 place-items-center bg-slate-50 px-5 text-center text-xs font-bold text-slate-400">
                  Image URL unavailable; storage reference is attached.
                </div>
              )}
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-blue-700">
                    {humanize(output?.group || "output")}
                  </span>
                  {output?.is_approved && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-emerald-700">Approved</span>}
                </div>
                <h3 className="mt-3 text-sm font-black text-slate-900">{title}</h3>
                <p className="mt-1 text-[10px] text-slate-500">{humanize(output?.visual_type || "Generated output")}</p>
                {storagePath && <p className="mt-3 break-all rounded-xl bg-slate-50 p-2 text-[9px] leading-4 text-slate-400">{storagePath}</p>}
              </div>
            </article>
          );
        })}
      </div>
      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </section>
  );
}

type PreviewImage = {
  url: string;
  title: string;
};

function imageDownloadName(title: string, url: string) {
  const safeTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "heyy-studio-image";
  const cleanUrl = url.split("?")[0];
  const extensionMatch = cleanUrl.match(/\.([a-zA-Z0-9]{2,5})$/);
  return `${safeTitle}.${extensionMatch?.[1]?.toLowerCase() || "png"}`;
}

async function downloadPreviewImage(image: PreviewImage) {
  const filename = imageDownloadName(image.title, image.url);
  try {
    const response = await fetch(image.url);
    if (!response.ok) throw new Error("Image download failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const anchor = document.createElement("a");
    anchor.href = image.url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}

function ImagePreviewModal({ image, onClose }: { image: PreviewImage | null; onClose: () => void }) {
  useEffect(() => {
    if (!image) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [image, onClose]);

  if (!image) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${image.title}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-7xl items-center justify-center py-2 sm:py-4">
        <div className="flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111018] shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#111018]/95 px-4 py-3 backdrop-blur sm:px-5">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">Image preview</p>
              <h3 className="mt-1 truncate text-sm font-black text-white sm:text-base">{image.title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void downloadPreviewImage(image)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-[11px] font-black text-white transition hover:bg-white/20 sm:px-4 sm:text-xs"
              >
                <span aria-hidden="true">↓</span> <span className="hidden sm:inline">Download image</span><span className="sm:hidden">Download</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-xl font-medium leading-none text-white transition hover:bg-white/20"
                aria-label="Close image preview"
              >
                ×
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
            <div className="flex min-h-full w-full items-center justify-center">
              <img
                src={image.url}
                alt={image.title}
                className="block h-auto max-h-[calc(100dvh-8rem)] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GeneralBriefSummary({ context, request }: { context: any; request: StudioRequest }) {
  const fields = Object.entries(context || {})
    .filter(([, value]) => isDisplayable(value) && !Array.isArray(value))
    .filter(([key]) => !["all_generated_outputs", "generated_assets"].includes(key))
    .slice(0, 12)
    .map(([key, value]) => ({
      label: humanize(key),
      value,
      wide: typeof value === "object",
    }));

  return (
    <div className="heyy-brief-sections">
      <BriefSection title="Project Context" fields={fields} />
      <GeneratedAssetGallery request={request} />
      <ProductionRequestDetails request={request} />
      <RequestReference request={request} />
    </div>
  );
}

function ProductionRequestDetails({ request }: { request: StudioRequest }) {
  const fields: BriefField[] = [
    { label: "Requested Service", value: request.service },
    { label: "Studio", value: getStudioIdentity(request.studio).label },
    { label: "Concept Description", value: request.metadata?.description, wide: true },
    { label: "Best Used For", value: request.metadata?.usage, wide: true },
    { label: "Expert Production Note", value: request.metadata?.expertNote, wide: true },
  ];

  return <BriefSection title="Production Request" fields={fields} />;
}

function RequestReference({ request }: { request: StudioRequest }) {
  const fields: BriefField[] = [
    { label: "Request ID", value: request.id },
    { label: "Project ID", value: request.project_id },
    { label: "Request Status", value: request.status },
    { label: "Received", value: formatDateTime(request.created_at) },
  ];

  return <BriefSection title="Request Reference" fields={fields} />;
}

function QuoteQuestions({
  request,
  onRefresh,
}: {
  request: StudioRequest;
  onRefresh: () => Promise<void>;
}) {
  const questions = Array.isArray(request.metadata?.quote_questions)
    ? request.metadata.quote_questions
    : [];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function sendReply(questionId: string) {
    const message = String(drafts[questionId] || "").trim();

    if (!message) {
      setErrorMessage("Write a reply before sending it.");
      return;
    }

    setSendingId(questionId);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/quotes/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          questionId,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Reply could not be sent.");
      }

      setDrafts((current) => ({ ...current, [questionId]: "" }));
      await onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Reply could not be sent.",
      );
    } finally {
      setSendingId(null);
    }
  }

  if (!questions.length) return null;

  return (
    <div className="heyy-surface heyy-content-card border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-amber-700">
            Quote Questions
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.02em]">
            Client and studio conversation
          </h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            Reply here. The client will see the answer inside the same quote panel.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-amber-800">
          {questions.length} question{questions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {questions.map((question: any, index: number) => {
          const questionId = String(
            question.id || `${question.created_at}-${index}`,
          );
          const replies = Array.isArray(question.replies)
            ? question.replies
            : [];

          return (
            <article
              key={questionId}
              className="rounded-2xl border border-amber-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-900">
                  {question.sender_name || "Client"}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] ${
                      replies.length
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {replies.length ? "Answered" : "Needs reply"}
                  </span>
                  <p className="text-[10px] font-bold text-slate-400">
                    {question.created_at
                      ? formatDateTime(question.created_at)
                      : "-"}
                  </p>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {question.message}
              </p>

              {replies.length > 0 && (
                <div className="mt-4 space-y-3 border-l-2 border-violet-200 pl-4">
                  {replies.map((reply: any, replyIndex: number) => (
                    <div
                      key={reply.id || `${reply.created_at}-${replyIndex}`}
                      className="rounded-xl bg-violet-50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-black text-violet-800">
                          {reply.sender_name || "Heyy Studio"}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400">
                          {reply.created_at
                            ? formatDateTime(reply.created_at)
                            : "-"}
                        </p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {reply.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="text-[9px] font-black uppercase tracking-[0.14em] text-violet-700">
                  {replies.length ? "Send another reply" : "Reply to client"}
                </label>
                <textarea
                  value={drafts[questionId] || ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [questionId]: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  placeholder="Write the studio answer here..."
                />
                <button
                  type="button"
                  onClick={() => void sendReply(questionId)}
                  disabled={sendingId === questionId}
                  className="mt-3 w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {sendingId === questionId
                    ? "Sending Reply..."
                    : "Send Reply to Client →"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

function BriefSection({ title, fields }: { title: string; fields: BriefField[] }) {
  const visibleFields = fields.filter((field) => isDisplayable(field.value));

  if (!visibleFields.length) return null;

  return (
    <section className="heyy-brief-section">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600">
        {title}
      </p>
      <div className="heyy-brief-field-grid">
        {visibleFields.map((field) => (
          <div
            key={`${title}-${field.label}`}
            className="heyy-brief-field"
            data-wide={field.wide ? "true" : "false"}
          >
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">
              {field.label}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs font-bold leading-5 text-slate-700">
              {formatBriefValue(field.value)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProgressChip({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span
      className="heyy-progress-chip"
      style={
        ready
          ? { backgroundColor: "#dcfce7", color: "#15803d" }
          : { backgroundColor: "#f1f5f9", color: "#64748b" }
      }
    >
      <span>{ready ? "✓" : "·"}</span>
      {ready ? label : `${label} not prepared`}
    </span>
  );
}

function extractProjectContext(brief: string | null): any | null {
  if (!brief) return null;

  const markers = [
    "Architecture Studio Project Context:",
    "Brand Studio Project Context:",
    "Project Context:",
    "Brand System:",
  ];

  for (const marker of markers) {
    const markerIndex = brief.lastIndexOf(marker);
    if (markerIndex === -1) continue;

    const candidate = brief.slice(markerIndex + marker.length).trim();
    const objectStart = candidate.indexOf("{");
    if (objectStart === -1) continue;

    try {
      return JSON.parse(candidate.slice(objectStart));
    } catch {
      // Try the next marker. The original brief remains available below.
    }
  }

  const firstObject = brief.indexOf("{");
  if (firstObject !== -1) {
    try {
      return JSON.parse(brief.slice(firstObject));
    } catch {
      return null;
    }
  }

  return null;
}

function pick(source: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = source?.[key];
    if (isDisplayable(value)) return value;
  }
  return null;
}

function isDisplayable(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function formatBriefValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" ? compactObject(item as Record<string, unknown>) : String(item),
      )
      .filter(Boolean)
      .join(" · ");
  }

  if (value && typeof value === "object") {
    return compactObject(value as Record<string, unknown>);
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "-");
}

function compactObject(value: Record<string, unknown>): string {
  return Object.entries(value)
    .filter(([, item]) => isDisplayable(item))
    .map(([key, item]) => `${humanize(key)}: ${formatBriefValue(item)}`)
    .join(" · ");
}

function humanize(value: unknown): string {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function joinValues(values: unknown[]): string {
  return values.filter(isDisplayable).map(formatBriefValue).join(", ");
}

function withUnit(value: unknown, unit: string): string | null {
  return isDisplayable(value) ? `${formatBriefValue(value)} ${unit}` : null;
}

function dimensions(site: any): string | null {
  const width = pick(site, "width");
  const depth = pick(site, "depth");
  if (!isDisplayable(width) && !isDisplayable(depth)) return null;
  return `${formatBriefValue(width || "-")} m × ${formatBriefValue(depth || "-")} m`;
}

function setbacks(planning: any): string | null {
  const values = [
    ["Front", pick(planning, "front_setback_m")],
    ["Rear", pick(planning, "rear_setback_m")],
    ["Side", pick(planning, "side_setback_m")],
  ].filter(([, value]) => isDisplayable(value));

  if (!values.length) return null;
  return values.map(([label, value]) => `${label}: ${formatBriefValue(value)} m`).join(" · ");
}

function ExistingQuoteCard({
  quote,
  request,
  expertSelection,
  onUpdated,
}: {
  quote: WorkspaceQuote;
  request: StudioRequest;
  expertSelection: ExpertSelection | null;
  onUpdated: () => Promise<void>;
}) {
  const normalizedStatus = String(quote.status || "Sent").toLowerCase();
  const paid = normalizedStatus === "paid" || Boolean(quote.paid_at) || Boolean(quote.production_job_id);
  const [editing, setEditing] = useState(false);

  if (editing && !paid) {
    return (
      <EditQuoteForm
        quote={quote}
        request={request}
        expertSelection={expertSelection}
        onCancel={() => setEditing(false)}
        onUpdated={async () => {
          setEditing(false);
          await onUpdated();
        }}
      />
    );
  }

  return (
    <div>
      <div
        className={`rounded-2xl border p-4 ${
          paid
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
              Current quote
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-950">
              {quote.title}
            </h3>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] ${
              paid
                ? "bg-emerald-600 text-white"
                : "bg-amber-200 text-amber-900"
            }`}
          >
            {paid ? "Paid" : quote.status || "Sent"}
          </span>
        </div>

        <p className="mt-2 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">Client quote subtotal · before tax</p>
        <p className="mt-1 text-3xl font-black tracking-[-0.03em] text-slate-950">
          {quote.currency || "USD"} {Number(quote.amount || 0).toFixed(2)}
        </p>

        {Number(quote.expert_cost_amount || 0) > 0 && (
          <div className="mt-4 grid gap-2">
            <QuoteBreakdownLine
              label="Expert production cost · internal"
              value={formatMoney(Math.round(Number(quote.expert_cost_amount || 0) * 100), quote.currency || "USD")}
            />
            <QuoteBreakdownLine
              label={`Heyy Studio service / management fee (${Number(quote.management_fee_percent || 0)}%)`}
              value={formatMoney(Math.round(Number(quote.management_fee_amount || 0) * 100), quote.currency || "USD")}
            />
            <QuoteBreakdownLine
              label="Pre-tax client subtotal"
              value={formatMoney(Math.round(Number(quote.amount || 0) * 100), quote.currency || "USD")}
              strong
            />
            <QuoteBreakdownLine
              label="AU GST estimate if applicable (10%)"
              value={formatMoney(Math.round(Number(quote.amount || 0) * 10), quote.currency || "USD")}
            />
          </div>
        )}

        {quote.description && (
          <div className="mt-4 rounded-xl border border-white/80 bg-white p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
              Scope & Inclusions
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {quote.description}
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <QuoteSummaryItem label="Delivery" value={`${quote.estimated_days ?? "-"} days`} />
          <QuoteSummaryItem label="Included Revisions" value={`${quote.included_revisions ?? 0}`} />
          <QuoteSummaryItem label="Extra Revision" value={`${quote.currency || "USD"} ${Number(quote.extra_revision_fee || 0).toFixed(2)}`} />
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4 text-[10px] font-bold leading-5 text-slate-500">
          <p>Sent: {formatDateTime(quote.created_at)}</p>
          {quote.paid_at && <p>Paid: {formatDateTime(quote.paid_at)}</p>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!paid && (
            <button type="button" onClick={() => setEditing(true)} className="rounded-full bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-700">
              Edit & resend quote
            </button>
          )}
          {paid && quote.production_job_id && (
            <a href={`/admin/production/${encodeURIComponent(String(quote.production_job_id))}`} className="rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700">
              Open production job →
            </a>
          )}
        </div>
      </div>

      <div className={`mt-4 rounded-xl border px-4 py-3 text-xs font-bold leading-6 ${paid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-violet-200 bg-violet-50 text-violet-800"}`}>
        {paid
          ? "Payment is confirmed. This quote is locked so the paid commercial record stays intact. Any new work should be handled as additional scope/change order."
          : "You can revise this unpaid quote after a client question or an agreed Expert fee change. The same quote is updated and the client is notified again — a duplicate quote is not created."}
      </div>
    </div>
  );
}

function EditQuoteForm({
  quote,
  request,
  expertSelection,
  onCancel,
  onUpdated,
}: {
  quote: WorkspaceQuote;
  request: StudioRequest;
  expertSelection: ExpertSelection | null;
  onCancel: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [title, setTitle] = useState(quote.title || `${request.service} Production`);
  const [description, setDescription] = useState(quote.description || "");
  const [expertCost, setExpertCost] = useState(
    Number(quote.expert_cost_amount || 0) > 0
      ? Number(quote.expert_cost_amount).toFixed(2)
      : expertSelection?.quoted_fee_cents
        ? (Number(expertSelection.quoted_fee_cents) / 100).toFixed(2)
        : "",
  );
  const [managementFeePercent, setManagementFeePercent] = useState(String(quote.management_fee_percent ?? 25));
  const [directAmount, setDirectAmount] = useState(Number((quote.subtotal_amount ?? quote.amount) || 0).toFixed(2));
  const [estimatedDays, setEstimatedDays] = useState(String(quote.estimated_days ?? ""));
  const [includedRevisions, setIncludedRevisions] = useState(String(quote.included_revisions ?? 0));
  const [extraRevisionFee, setExtraRevisionFee] = useState(String(quote.extra_revision_fee ?? 0));
  const [expertExtraRevisionCost, setExpertExtraRevisionCost] = useState(
    Number(quote.expert_extra_revision_cost_amount || 0) > 0
      ? Number(quote.expert_extra_revision_cost_amount).toFixed(2)
      : expertSelection?.extra_revision_fee_cents !== null && expertSelection?.extra_revision_fee_cents !== undefined
        ? (Number(expertSelection.extra_revision_fee_cents) / 100).toFixed(2)
        : "",
  );
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const hasExpertCost = Number(quote.expert_cost_amount || 0) > 0 || Boolean(expertSelection);
  const expertCostNumber = Number(expertCost);
  const managementPercentNumber = Number(managementFeePercent);
  const managementFeeAmount = hasExpertCost && Number.isFinite(expertCostNumber) && Number.isFinite(managementPercentNumber)
    ? Number((expertCostNumber * managementPercentNumber / 100).toFixed(2))
    : null;
  const calculatedSubtotal = managementFeeAmount !== null
    ? Number((expertCostNumber + managementFeeAmount).toFixed(2))
    : Number(directAmount);
  const expertExtraRevisionCostNumber = Number(expertExtraRevisionCost);
  const calculatedClientExtraRevisionFee = hasExpertCost && Number.isFinite(expertExtraRevisionCostNumber) && Number.isFinite(managementPercentNumber)
    ? Number((expertExtraRevisionCostNumber * (1 + managementPercentNumber / 100)).toFixed(2))
    : Number(extraRevisionFee);

  async function save() {
    setErrorMessage("");
    const days = Number(estimatedDays);
    const revisions = Number(includedRevisions);
    const extraFee = calculatedClientExtraRevisionFee;
    if (!title.trim() || !description.trim()) { setErrorMessage("Add the quote title and scope."); return; }
    if (hasExpertCost && (!Number.isFinite(expertCostNumber) || expertCostNumber <= 0)) { setErrorMessage("Enter the revised agreed Expert cost."); return; }
    if (hasExpertCost && (!Number.isFinite(managementPercentNumber) || managementPercentNumber < 0)) { setErrorMessage("Enter a valid Heyy Studio management fee percentage."); return; }
    if (hasExpertCost && (!Number.isFinite(expertExtraRevisionCostNumber) || expertExtraRevisionCostNumber < 0)) { setErrorMessage("Enter the Expert fee for one additional revision."); return; }
    if (!hasExpertCost && (!Number.isFinite(calculatedSubtotal) || calculatedSubtotal <= 0)) { setErrorMessage("Enter a valid quote amount."); return; }
    if (!Number.isInteger(days) || days < 1) { setErrorMessage("Enter delivery in whole days."); return; }
    if (!Number.isInteger(revisions) || revisions < 0) { setErrorMessage("Included revisions must be zero or more."); return; }
    if (!Number.isFinite(extraFee) || extraFee < 0) { setErrorMessage("Extra revision fee must be zero or more."); return; }

    setSending(true);
    try {
      const response = await fetch("/api/admin/create-quote-from-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: request.id,
          quote_id: quote.id,
          title: title.trim(),
          description: description.trim(),
          expert_cost_amount: hasExpertCost ? expertCostNumber : null,
          management_fee_percent: hasExpertCost ? managementPercentNumber : null,
          expert_extra_revision_cost_amount: hasExpertCost ? expertExtraRevisionCostNumber : null,
          subtotal_amount: calculatedSubtotal,
          discount_amount: Number(quote.discount_amount || 0),
          discount_label: quote.discount_label || null,
          currency: quote.currency || "USD",
          estimated_days: days,
          included_revisions: revisions,
          extra_revision_fee: extraFee,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Quote could not be updated.");
      await onUpdated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Quote could not be updated.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-violet-600">Revise unpaid quote</p><h3 className="mt-1 text-lg font-black">Update the same client proposal</h3><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Use this after a client question or an agreed pricing/scope change. Saving sends the updated quote to the client again.</p></div>
        <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black">Cancel</button>
      </div>

      <label className="heyy-field"><span className="heyy-field-label">Quote Title</span><input className="heyy-review-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="heyy-field"><span className="heyy-field-label">Scope & Inclusions</span><textarea className="heyy-review-textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></label>

      {hasExpertCost ? (
        <div className="mt-4 rounded-[20px] border border-emerald-200 bg-white p-4">
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">Internal commercial update</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label><span className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">Agreed Expert cost · internal</span><input className="heyy-review-input mt-2" inputMode="decimal" value={expertCost} onChange={(event) => setExpertCost(event.target.value)} /></label>
            <label><span className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">Expert fee / extra revision · internal</span><input className="heyy-review-input mt-2" inputMode="decimal" value={expertExtraRevisionCost} onChange={(event) => setExpertExtraRevisionCost(event.target.value)} /></label>
            <label><span className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">Heyy Studio management fee %</span><input className="heyy-review-input mt-2" inputMode="decimal" value={managementFeePercent} onChange={(event) => setManagementFeePercent(event.target.value)} /></label>
          </div>
          <div className="mt-3 grid gap-2">
            <QuoteBreakdownLine label="Heyy Studio fee" value={managementFeeAmount !== null ? formatMoney(Math.round(managementFeeAmount * 100), quote.currency || "USD") : "—"} />
            <QuoteBreakdownLine label="Updated client subtotal · before tax" value={Number.isFinite(calculatedSubtotal) ? formatMoney(Math.round(calculatedSubtotal * 100), quote.currency || "USD") : "—"} strong />
            <QuoteBreakdownLine label="Client extra revision · before tax" value={Number.isFinite(calculatedClientExtraRevisionFee) ? formatMoney(Math.round(calculatedClientExtraRevisionFee * 100), quote.currency || "USD") : "—"} strong />
          </div>
        </div>
      ) : (
        <label className="heyy-field"><span className="heyy-field-label">Quote Amount (USD, pre-tax)</span><input className="heyy-review-input" inputMode="decimal" value={directAmount} onChange={(event) => setDirectAmount(event.target.value)} /></label>
      )}

      <div className="heyy-quote-details">
        <EditableQuoteDetail label="Delivery" value={estimatedDays} onChange={setEstimatedDays} placeholder="Days" suffix="days" />
        <EditableQuoteDetail label="Included Revisions" value={includedRevisions} onChange={setIncludedRevisions} placeholder="Number" suffix="included" />
        {hasExpertCost ? (
          <QuoteSummaryItem label="Client Extra Revision · Pre-tax" value={Number.isFinite(calculatedClientExtraRevisionFee) ? formatMoney(Math.round(calculatedClientExtraRevisionFee * 100), quote.currency || "USD") : "—"} />
        ) : (
          <EditableQuoteDetail label="Client Extra Revision" value={extraRevisionFee} onChange={setExtraRevisionFee} placeholder="Fee" prefix="$" suffix="USD" allowDecimal />
        )}
      </div>
      {errorMessage && <div className="heyy-quote-error">{errorMessage}</div>}
      <button type="button" onClick={() => void save()} disabled={sending} className="heyy-send-quote">{sending ? "Updating Quote..." : "Update & Resend Quote →"}</button>
    </div>
  );
}

function QuoteSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

function CreateQuoteForm({ request, expertSelection }: { request: StudioRequest; expertSelection: ExpertSelection | null }) {
  const [title, setTitle] = useState(`${request.service} Production`);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [managementFeePercent, setManagementFeePercent] = useState("25");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [includedRevisions, setIncludedRevisions] = useState("");
  const [extraRevisionFee, setExtraRevisionFee] = useState("");
  const [quoteTemplates, setQuoteTemplates] = useState<QuoteTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const expertCostAmount = expertSelection
    ? Number(expertSelection.quoted_fee_cents || 0) / 100
    : null;
  const expertExtraRevisionCostAmount = expertSelection?.extra_revision_fee_cents !== null && expertSelection?.extra_revision_fee_cents !== undefined
    ? Number(expertSelection.extra_revision_fee_cents) / 100
    : null;
  const managementPercentNumber = Number(managementFeePercent);
  const managementFeeAmount =
    expertCostAmount !== null && Number.isFinite(managementPercentNumber)
      ? Number((expertCostAmount * managementPercentNumber / 100).toFixed(2))
      : null;
  const calculatedClientSubtotal =
    expertCostAmount !== null && managementFeeAmount !== null
      ? Number((expertCostAmount + managementFeeAmount).toFixed(2))
      : null;
  const calculatedClientExtraRevisionFee =
    expertExtraRevisionCostAmount !== null && Number.isFinite(managementPercentNumber)
      ? Number((expertExtraRevisionCostAmount * (1 + managementPercentNumber / 100)).toFixed(2))
      : null;
  const auGstEstimate =
    calculatedClientSubtotal !== null
      ? Number((calculatedClientSubtotal * 0.1).toFixed(2))
      : null;
  const auClientTotalEstimate =
    calculatedClientSubtotal !== null && auGstEstimate !== null
      ? Number((calculatedClientSubtotal + auGstEstimate).toFixed(2))
      : null;

  useEffect(() => {
    if (!expertSelection) return;
    if (!estimatedDays && expertSelection.turnaround_days) {
      setEstimatedDays(String(expertSelection.turnaround_days));
    }
    if (!includedRevisions && expertSelection.included_revisions !== null) {
      setIncludedRevisions(String(expertSelection.included_revisions));
    }
  }, [expertSelection?.id]);

  useEffect(() => {
    if (!expertSelection || calculatedClientSubtotal === null) return;
    setAmount(calculatedClientSubtotal.toFixed(2));
  }, [expertSelection?.id, calculatedClientSubtotal]);

  useEffect(() => {
    if (!expertSelection || calculatedClientExtraRevisionFee === null) return;
    setExtraRevisionFee(calculatedClientExtraRevisionFee.toFixed(2));
  }, [expertSelection?.id, calculatedClientExtraRevisionFee]);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/templates?kind=quote", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const studio = String(request.studio || "").toLowerCase();
        const serviceId = String(request.metadata?.service_id || "").toLowerCase();
        setQuoteTemplates((data.templates || []).filter((template: QuoteTemplate) => {
          const templateStudio = String(template.studio || "").toLowerCase();
          const templateService = String(template.service_id || "").toLowerCase();
          return (!templateStudio || templateStudio === studio) && (!templateService || templateService === serviceId);
        }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [request.studio, request.metadata?.service_id]);

  function applyTemplate(templateId: string) {
    setSelectedTemplate(templateId);
    const template = quoteTemplates.find((item) => item.id === templateId);
    if (!template) return;
    const content = template.content || {};
    if (content.title) setTitle(String(content.title));
    if (content.description) setDescription(String(content.description));
    if (!expertSelection && content.amount !== undefined && content.amount !== null) setAmount(String(content.amount));
    if (content.estimated_days !== undefined && content.estimated_days !== null) setEstimatedDays(String(content.estimated_days));
    if (content.included_revisions !== undefined && content.included_revisions !== null) setIncludedRevisions(String(content.included_revisions));
    if (content.extra_revision_fee !== undefined && content.extra_revision_fee !== null) setExtraRevisionFee(String(content.extra_revision_fee));
  }

  async function createQuote() {
    setErrorMessage("");

    const amountNumber = Number(amount);
    const daysNumber = Number(estimatedDays);
    const revisionsNumber = Number(includedRevisions);
    const extraFeeNumber = Number(extraRevisionFee);

    if (!title.trim()) {
      setErrorMessage("Add a quote title.");
      return;
    }

    if (!description.trim()) {
      setErrorMessage("Add the project scope and inclusions.");
      return;
    }

    if (expertSelection && (!Number.isFinite(managementPercentNumber) || managementPercentNumber < 0)) {
      setErrorMessage("Enter a valid Heyy Studio management fee percentage.");
      return;
    }

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setErrorMessage("Enter a valid quote amount greater than zero.");
      return;
    }

    if (!Number.isInteger(daysNumber) || daysNumber < 1) {
      setErrorMessage("Enter the estimated delivery time in whole days.");
      return;
    }

    if (!Number.isInteger(revisionsNumber) || revisionsNumber < 0) {
      setErrorMessage("Included revisions must be zero or more.");
      return;
    }

    if (!Number.isFinite(extraFeeNumber) || extraFeeNumber < 0) {
      setErrorMessage("Extra revision fee must be zero or more.");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/admin/create-quote-from-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_id: request.id,
          title: title.trim(),
          description: description.trim(),
          amount: amountNumber,
          subtotal_amount: amountNumber,
          expert_cost_amount: expertCostAmount,
          management_fee_percent: expertSelection ? managementPercentNumber : null,
          management_fee_amount: expertSelection ? managementFeeAmount : null,
          currency: "USD",
          estimated_days: daysNumber,
          included_revisions: revisionsNumber,
          extra_revision_fee: extraFeeNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not create quote");
      }

      alert("Quote created and sent.");
      router.push("/admin?tab=requests");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create quote.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {quoteTemplates.length > 0 && (
        <label className="heyy-field">
          <span className="heyy-field-label">Start from a template</span>
          <select
            value={selectedTemplate}
            onChange={(event) => applyTemplate(event.target.value)}
            className="heyy-review-input"
          >
            <option value="">Choose a saved quote template</option>
            {quoteTemplates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <p className="mt-2 text-[10px] font-bold leading-5 text-slate-500">A template fills the starting values only. You can still edit every field before sending.</p>
        </label>
      )}

      <label className="heyy-field">
        <span className="heyy-field-label">Quote Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="heyy-review-input"
          placeholder="Quote title"
        />
      </label>

      <label className="heyy-field">
        <span className="heyy-field-label">Scope & Inclusions</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="heyy-review-textarea"
          placeholder="Describe exactly what is included in this project."
        />
      </label>

      {expertSelection ? (
        <div className="mt-4 rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                Internal quote builder
              </p>
              <h3 className="mt-1 text-base font-black text-slate-950">Expert cost + Heyy Studio management fee</h3>
            </div>
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Pre-tax
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <QuoteBreakdownRow
              label="Expert production cost"
              value={formatMoney(Math.round((expertCostAmount || 0) * 100), expertSelection.currency)}
            />
            <label className="rounded-2xl border border-emerald-200 bg-white p-3">
              <span className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">Heyy Studio service / management fee</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={managementFeePercent}
                  onChange={(event) => setManagementFeePercent(event.target.value)}
                  inputMode="decimal"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-900 outline-none focus:border-violet-500"
                  aria-label="Management fee percent"
                />
                <span className="text-sm font-black text-slate-500">%</span>
                <span className="text-sm font-black text-slate-950">
                  {managementFeeAmount !== null
                    ? formatMoney(Math.round(managementFeeAmount * 100), expertSelection.currency)
                    : "—"}
                </span>
              </div>
            </label>
          </div>

          <div className="mt-3 grid gap-2">
            <QuoteBreakdownLine
              label="Client quote subtotal"
              value={calculatedClientSubtotal !== null ? formatMoney(Math.round(calculatedClientSubtotal * 100), expertSelection.currency) : "—"}
              strong
            />
            <QuoteBreakdownLine
              label="Expert fee per additional revision · internal"
              value={expertExtraRevisionCostAmount !== null ? formatMoney(Math.round(expertExtraRevisionCostAmount * 100), expertSelection.currency) : "Not quoted"}
            />
            <QuoteBreakdownLine
              label="Client additional revision price · pre-tax"
              value={calculatedClientExtraRevisionFee !== null ? formatMoney(Math.round(calculatedClientExtraRevisionFee * 100), expertSelection.currency) : "Not configured"}
              strong
            />
            <QuoteBreakdownLine
              label="AU GST estimate (10%, only when applicable)"
              value={auGstEstimate !== null ? formatMoney(Math.round(auGstEstimate * 100), expertSelection.currency) : "—"}
            />
            <QuoteBreakdownLine
              label="AU client total estimate"
              value={auClientTotalEstimate !== null ? formatMoney(Math.round(auClientTotalEstimate * 100), expertSelection.currency) : "—"}
              strong
            />
          </div>

          <p className="mt-3 text-[10px] font-bold leading-5 text-slate-500">
            The stored client quote is the pre-tax subtotal. Stripe Automatic Tax calculates the actual GST/tax at secure checkout from the client billing location, and the payment record stores the actual tax amount for accounting.
          </p>
        </div>
      ) : (
        <label className="heyy-field">
          <span className="heyy-field-label">Quote Amount (USD, pre-tax)</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="heyy-review-input"
            placeholder="Enter the project amount"
          />
          <p className="mt-2 text-[10px] font-bold leading-5 text-slate-500">Tax/GST is calculated at secure checkout according to the client billing location.</p>
        </label>
      )}

      <div className="heyy-quote-details">
        <EditableQuoteDetail
          label="Delivery"
          value={estimatedDays}
          onChange={setEstimatedDays}
          placeholder="Days"
          suffix="days"
        />
        <EditableQuoteDetail
          label="Included Revisions"
          value={includedRevisions}
          onChange={setIncludedRevisions}
          placeholder="Number"
          suffix="included"
        />
        {expertSelection ? (
          <QuoteSummaryItem
            label="Client Extra Revision · Pre-tax"
            value={calculatedClientExtraRevisionFee !== null ? formatMoney(Math.round(calculatedClientExtraRevisionFee * 100), expertSelection.currency) : "Not configured"}
          />
        ) : (
          <EditableQuoteDetail
            label="Client Extra Revision"
            value={extraRevisionFee}
            onChange={setExtraRevisionFee}
            placeholder="Fee"
            prefix="$"
            suffix="USD"
            allowDecimal
          />
        )}
      </div>

      <p className="mt-3 text-[10px] font-bold leading-5 text-slate-500">
        These values are set separately for every project. They are saved into the client quote and production workflow.
      </p>

      {errorMessage && <div className="heyy-quote-error">{errorMessage}</div>}

      <button
        type="button"
        onClick={createQuote}
        disabled={sending}
        className="heyy-send-quote"
      >
        {sending ? "Creating Quote..." : "Create & Send Quote →"}
      </button>
    </div>
  );
}

function QuoteBreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function QuoteBreakdownLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5 ${strong ? "border-emerald-300 bg-white" : "border-emerald-100 bg-white/70"}`}>
      <span className={`text-[10px] ${strong ? "font-black text-slate-800" : "font-bold text-slate-500"}`}>{label}</span>
      <span className={`text-sm ${strong ? "font-black text-slate-950" : "font-bold text-slate-700"}`}>{value}</span>
    </div>
  );
}

function EditableQuoteDetail({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  allowDecimal = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  allowDecimal?: boolean;
}) {
  return (
    <label className="heyy-quote-detail">
      <span className="text-[8px] font-black uppercase tracking-[0.14em] text-amber-700">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="mt-2 text-xs font-black text-slate-500">{prefix}</span>}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={allowDecimal ? "decimal" : "numeric"}
          className="heyy-quote-detail-input"
          placeholder={placeholder}
        />
      </div>
      {suffix && (
        <span className="mt-1 block text-[9px] font-bold text-slate-400">
          {suffix}
        </span>
      )}
    </label>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = String(value || "New").toLowerCase();
  let style = { backgroundColor: "#ede2ff", color: "#8b5cf6" };

  if (normalized.includes("converted")) {
    style = { backgroundColor: "#dcfce7", color: "#15803d" };
  } else if (normalized.includes("quoted")) {
    style = { backgroundColor: "#dbeafe", color: "#1d4ed8" };
  } else if (
    normalized.includes("reviewing") ||
    normalized.includes("quote needed")
  ) {
    style = { backgroundColor: "#fef3c7", color: "#a16207" };
  } else if (normalized.includes("rejected")) {
    style = { backgroundColor: "#ffe4e6", color: "#be123c" };
  }

  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em]"
      style={style}
    >
      {value || "New"}
    </span>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
