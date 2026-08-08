"use client";

import ProductionChecklist from "@/components/production/shared/ProductionChecklist";
import HeyySelect from "@/components/ui/heyy-select";

type ProductionSidebarProps = {
  job: any;
  metadata: any;
  status: string;
  priority: string;
  assignedStudio: string;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onAssignedStudioChange: (value: string) => void;
  checklistRefreshKey: number;
  saving: boolean;
  onSave: () => void;
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

const STUDIO_OPTIONS = [
  { id: "brand_studio", label: "Brand Studio" },
  { id: "marketing_studio", label: "Marketing Studio" },
  { id: "architecture_studio", label: "Architecture Studio" },
  { id: "interior_studio", label: "Interior Studio" },
  { id: "website_studio", label: "Website Studio" },
  { id: "ai_studio", label: "AI Studio" },
];

export default function ProductionSidebar({
  job,
  metadata,
  status,
  priority,
  assignedStudio,
  onStatusChange,
  onPriorityChange,
  onAssignedStudioChange,
  checklistRefreshKey,
  saving,
  onSave,
}: ProductionSidebarProps) {
  const clientName =
    job.client_name || metadata.client_name || "Logged-in User";
  const clientEmail =
    job.client_email || metadata.client_email || "No email attached";

  return (
    <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
      <section className="rounded-[26px] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-lg shadow-violet-900/5">
        <div className="flex gap-4">
          {job.preview_image ? (
            <img
              src={job.preview_image}
              className="h-24 w-24 shrink-0 rounded-2xl border border-violet-200 object-cover"
              alt={job.service || "Production preview"}
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-violet-200 bg-white text-xs font-bold text-violet-400">
              No Preview
            </div>
          )}

          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-600">
              Job Control
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
      </section>

      <section className="rounded-[26px] border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-md shadow-slate-900/5">
        <div className="grid grid-cols-2 gap-3">
          <CompactInfo label="Client" value={clientName} />
          <CompactInfo label="Requested" value={formatDate(job.created_at)} />
          <CompactInfo label="Studio" value={job.studio || "-"} />
          <CompactInfo label="Delivery" value={job.delivery_status || "Pending"} />
        </div>

        <div className="mt-3 rounded-2xl border border-blue-200 bg-white p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-500">
            Client Email
          </p>
          <p className="mt-2 break-all text-xs font-bold text-slate-700">
            {clientEmail}
          </p>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-md shadow-slate-900/5">
        <FieldLabel>Status</FieldLabel>
        <HeyySelect value={status} tone="admin" ariaLabel="Production status" options={STATUS_OPTIONS} onChange={onStatusChange} />

        <FieldLabel className="mt-5">Priority</FieldLabel>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {PRIORITY_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPriorityChange(item)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-black transition ${
                priority === item
                  ? "border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-600/20"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <FieldLabel className="mt-5">Assigned Studio</FieldLabel>
        <HeyySelect value={assignedStudio} tone="admin" ariaLabel="Assigned Studio" placeholder="Unassigned" options={STUDIO_OPTIONS.map((studio) => ({ value: studio.id, label: studio.label }))} onChange={onAssignedStudioChange} />

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="mt-5 w-full rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-violet-600 hover:bg-violet-600 hover:shadow-xl hover:shadow-violet-600/25 disabled:cursor-wait disabled:opacity-50"
        >
          {saving ? "Saving Changes..." : "Save Job Changes"}
        </button>
      </section>

      <details className="group overflow-hidden rounded-[26px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-md shadow-slate-900/5">
        <summary className="cursor-pointer list-none p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">
                Progress
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950">
                Production Checklist
              </h3>
            </div>
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-emerald-700 transition group-open:rotate-180">
              ↓
            </span>
          </div>
        </summary>

        <div className="border-t border-emerald-200 p-4">
          <ProductionChecklist
            jobId={job.id}
            refreshKey={checklistRefreshKey}
          />
        </div>
      </details>
    </aside>
  );
}

function CompactInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-500">
        {label}
      </p>
      <p className="mt-2 truncate text-xs font-bold text-slate-700">{value}</p>
    </div>
  );
}

function FieldLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ${className}`}
    >
      {children}
    </p>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}/${date.getUTCFullYear()}`;
}
