"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getStudioIdentity } from "../../../lib/studio/studio-identity";

type StudioRequest = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  user_id: string | null;
  studio: string;
  service: string;
  status: string;
  notes: string | null;
  project_brief: string | null;
  preview_image: string | null;
  metadata: any;
  created_at: string;
};

const STATUSES = [
  "All",
  "New",
  "Reviewing",
  "Quote Needed",
  "Quoted",
  "Rejected",
  "Converted",
];

export default function StudioRequestsPage() {
  const [requests, setRequests] = useState<StudioRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  async function loadRequests() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/studio-requests");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load studio requests");
      }

      setRequests(data.requests || []);
    } catch (error) {
      console.error("Studio requests load error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "All" || request.status === statusFilter;

      const searchText = [
        request.project_name,
        request.studio,
        request.service,
        request.status,
        request.metadata?.client_name,
        request.metadata?.client_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!term || searchText.includes(term));
    });
  }, [requests, statusFilter, search]);

  const openCount = requests.filter((request) =>
    ["New", "Reviewing", "Quote Needed", "Quoted"].includes(
      request.status || "New",
    ),
  ).length;

  const quoteNeededCount = requests.filter((request) =>
    ["New", "Reviewing", "Quote Needed"].includes(
      request.status || "New",
    ),
  ).length;

  const convertedCount = requests.filter(
    (request) => request.status === "Converted",
  ).length;

  return (
    <main
      className="heyy-requests-page min-h-screen"
      style={{
        backgroundColor: "#f8f7fb",
        color: "#17151f",
        colorScheme: "light",
      }}
    >
      <style>{`
        .heyy-requests-page, .heyy-requests-page * { box-sizing: border-box; }
        .heyy-requests-page a { text-decoration: none; }
        .heyy-requests-page button,
        .heyy-requests-page input { font: inherit; }

        .heyy-requests-shell {
          max-width: 1520px;
          margin: 0 auto;
          padding: 16px 24px 40px;
        }

        .heyy-requests-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid #ddd0f4 !important;
          border-radius: 28px !important;
          background: linear-gradient(135deg, #ffffff 0%, #f6f0ff 55%, #eadcff 100%) !important;
          color: #17151f !important;
          padding: 30px 32px !important;
          box-shadow: 0 18px 42px rgba(73, 35, 116, .10) !important;
        }

        .heyy-requests-hero::after {
          content: "/";
          position: absolute;
          right: 28px;
          top: 50%;
          transform: translateY(-50%) rotate(20deg);
          font-size: 180px;
          line-height: 1;
          font-weight: 900;
          color: rgba(255,255,255,.75);
          pointer-events: none;
        }

        .heyy-requests-heading {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .heyy-refresh {
          position: relative;
          z-index: 1;
          border: 1px solid #17151f !important;
          border-radius: 999px !important;
          background: #17151f !important;
          color: #fff !important;
          padding: 12px 20px !important;
          font-weight: 900 !important;
          transition: all 220ms ease !important;
        }

        .heyy-refresh:hover {
          transform: translateY(-2px);
          background: #6c00ff !important;
          border-color: #6c00ff !important;
          box-shadow: 0 14px 30px rgba(108,0,255,.26) !important;
        }

        .heyy-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .heyy-stat-card {
          min-height: 116px;
          border: 1px solid #ddd6e8 !important;
          border-radius: 22px !important;
          background: #fff !important;
          color: #17151f !important;
          padding: 18px !important;
          box-shadow: 0 10px 28px rgba(30, 20, 45, .05) !important;
          transition: all 220ms ease !important;
        }

        .heyy-stat-card:hover {
          transform: translateY(-3px);
          border-color: #8d4dff !important;
          box-shadow: 0 16px 34px rgba(108,0,255,.12) !important;
        }

        .heyy-toolbar {
          margin-top: 18px;
          border: 1px solid #ddd6e8 !important;
          border-radius: 22px !important;
          background: #fff !important;
          color: #17151f !important;
          padding: 14px !important;
          box-shadow: 0 10px 28px rgba(30,20,45,.05) !important;
        }

        .heyy-search {
          width: 100% !important;
          min-height: 48px !important;
          border: 1px solid #ded9e7 !important;
          border-radius: 15px !important;
          background: #f8f7fb !important;
          color: #17151f !important;
          padding: 0 16px !important;
          outline: none !important;
        }

        .heyy-search:focus {
          border-color: #7c2cff !important;
          box-shadow: 0 0 0 4px rgba(124,44,255,.12) !important;
          background: #fff !important;
        }

        .heyy-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .heyy-filter {
          border: 1px solid #ded9e7 !important;
          border-radius: 999px !important;
          background: #fff !important;
          color: #51495a !important;
          padding: 8px 14px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          transition: all 200ms ease !important;
        }

        .heyy-filter:hover {
          transform: translateY(-2px);
          border-color: #9b63ff !important;
          background: #f3eaff !important;
          color: #5b00d6 !important;
        }

        .heyy-filter[data-active="true"] {
          border-color: #6c00ff !important;
          background: #6c00ff !important;
          color: #fff !important;
          box-shadow: 0 9px 22px rgba(108,0,255,.23) !important;
        }

        .heyy-requests-list {
          margin-top: 18px;
          border: 1px solid #ddd6e8 !important;
          border-radius: 24px !important;
          background: #fff !important;
          color: #17151f !important;
          padding: 14px !important;
          box-shadow: 0 10px 28px rgba(30,20,45,.05) !important;
        }

        .heyy-request-row {
          display: grid !important;
          grid-template-columns: 72px minmax(220px, 1.45fr) minmax(145px, .7fr) minmax(145px, .7fr) auto !important;
          align-items: center !important;
          gap: 14px !important;
          min-height: 98px !important;
          margin-top: 10px !important;
          border-width: 1px !important;
          border-style: solid !important;
          border-color: #e5e0ea;
          border-radius: 20px !important;
          background: #fbfafd;
          color: #17151f !important;
          padding: 13px !important;
          transition: all 220ms ease !important;
        }

        .heyy-request-row:first-child { margin-top: 0 !important; }

        .heyy-request-row:hover {
          transform: translateY(-3px);
          border-color: #6c00ff !important;
          background: linear-gradient(135deg,#fff 0%,#f6efff 100%) !important;
          box-shadow: 0 16px 34px rgba(108,0,255,.12) !important;
        }

        .heyy-request-preview {
          width: 72px !important;
          height: 72px !important;
          overflow: hidden !important;
          border-width: 1px !important;
          border-style: solid !important;
          border-color: #e1dbe8;
          border-radius: 17px !important;
          background: linear-gradient(135deg,#f0e5ff,#fff);
        }

        .heyy-request-preview img {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }

        .heyy-review-link {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid #17151f !important;
          border-radius: 999px !important;
          background: #17151f !important;
          color: #fff !important;
          padding: 10px 15px !important;
          white-space: nowrap !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          transition: all 220ms ease !important;
        }

        .heyy-request-row:hover .heyy-review-link,
        .heyy-review-link:hover {
          transform: translateX(2px);
          border-color: #6c00ff !important;
          background: #6c00ff !important;
          box-shadow: 0 10px 24px rgba(108,0,255,.24) !important;
        }

        .heyy-empty {
          border: 1px dashed #b993ff !important;
          border-radius: 18px !important;
          background: #f5edff !important;
          color: #6520d8 !important;
          padding: 28px !important;
          text-align: center !important;
          font-size: 14px !important;
          font-weight: 800 !important;
        }

        @media (max-width: 980px) {
          .heyy-stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .heyy-request-row {
            grid-template-columns: 64px minmax(0,1fr) auto !important;
          }
          .heyy-hide-tablet { display: none !important; }
        }

        @media (max-width: 640px) {
          .heyy-requests-shell { padding: 12px 12px 28px; }
          .heyy-requests-hero { padding: 24px 20px !important; }
          .heyy-requests-hero::after { display: none; }
          .heyy-stats-grid { grid-template-columns: 1fr; }
          .heyy-request-row {
            grid-template-columns: 58px minmax(0,1fr) !important;
          }
          .heyy-request-preview {
            width: 58px !important;
            height: 58px !important;
          }
          .heyy-request-action {
            grid-column: 1 / -1;
          }
          .heyy-review-link { width: 100% !important; }
        }
      `}</style>

      <div className="heyy-requests-shell">
        <div className="heyy-requests-hero">
          <div className="heyy-requests-heading">
            <div>
              <Link
                href="/admin"
                className="text-sm font-black text-slate-500 transition hover:text-violet-600"
              >
                ← Back to Command Center
              </Link>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
                Requests & Quotes
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                Studio Requests
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                Review client requests, prepare quotes and move approved work into production.
              </p>
            </div>

            <button type="button" onClick={loadRequests} className="heyy-refresh">
              Refresh Requests
            </button>
          </div>
        </div>

        <div className="heyy-stats-grid">
          <StatCard label="Total Requests" value={requests.length} />
          <StatCard label="Open Requests" value={openCount} />
          <StatCard label="Quote Needed" value={quoteNeededCount} />
          <StatCard label="Converted" value={convertedCount} />
        </div>

        <div className="heyy-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project, client, studio or service..."
            className="heyy-search"
          />

          <div className="heyy-filters">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                data-active={statusFilter === status ? "true" : "false"}
                onClick={() => setStatusFilter(status)}
                className="heyy-filter"
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="heyy-requests-list">
          {loading ? (
            <div className="heyy-empty">Loading studio requests...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="heyy-empty">No studio requests match the current filters.</div>
          ) : (
            filteredRequests.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function RequestRow({ request }: { request: StudioRequest }) {
  const clientName =
    request.metadata?.client_name ||
    request.metadata?.name ||
    "Logged-in User";
  const identity = getStudioIdentity(request.studio);

  return (
    <Link
      href={`/admin/studio-requests/${request.id}`}
      className="heyy-request-row"
      style={{
        borderLeftWidth: 5,
        borderLeftColor: identity.accent,
        background: `linear-gradient(90deg, ${identity.soft} 0px, #ffffff 150px)`,
      }}
    >
      <div
        className="heyy-request-preview"
        style={{
          background: identity.gradient,
          borderColor: identity.border,
        }}
      >
        {request.preview_image ? (
          <img src={request.preview_image} alt={request.service || "Preview"} />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-sm font-black"
            style={{ color: identity.accent }}
          >
            {identity.initials}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={request.status || "New"} />
          <span
            className="rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em]"
            style={{
              backgroundColor: identity.soft,
              color: identity.accentDark,
            }}
          >
            {identity.shortLabel}
          </span>
        </div>
        <h3 className="mt-2 truncate text-[17px] font-black tracking-[-0.02em] text-slate-950">
          {request.project_name || "Untitled Project"}
        </h3>
        <p className="mt-1 truncate text-xs font-medium text-slate-500">
          {request.service || "Service not set"}
        </p>
      </div>

      <InfoBlock
        className="heyy-hide-tablet"
        label="Client"
        value={clientName}
      />

      <div className="heyy-hide-tablet min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
          Studio / Requested
        </p>
        <div className="mt-1 flex items-center gap-2">
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
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {formatDate(request.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="heyy-request-action">
        <span className="heyy-review-link">Review Request →</span>
      </div>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="heyy-stat-card">
      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black tracking-[-0.05em] text-slate-950">
        {value}
      </p>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  secondary,
  className = "",
}: {
  label: string;
  value: string;
  secondary?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold text-slate-700">{value}</p>
      {secondary && (
        <p className="mt-1 truncate text-xs text-slate-400">{secondary}</p>
      )}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = String(value || "New").toLowerCase();
  let style = { backgroundColor: "#ede2ff", color: "#6c00ff" };

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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}/${date.getUTCFullYear()}`;
}
