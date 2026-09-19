"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeDollarSign,
  Check,
  CircleDollarSign,
  Clock3,
  Download,
  FileUp,
  Filter,
  Loader2,
  MessageSquareText,
  Search,
  Send,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import HeyySelect from "@/components/ui/heyy-select";

type Expert = {
  id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  studio: string;
  role_title: string | null;
  location: string | null;
  timezone: string | null;
  years_experience: number | null;
  specialties: string[];
  software_tools: string[];
  languages: string[];
  availability: string;
  status: string;
  portfolio_url: string | null;
  linkedin_url: string | null;
  payout_method?: string | null;
  payout_details?: { details?: string } | null;
};

type Opportunity = {
  id: string;
  status: string;
  expert_profile_id: string;
  quoted_fee_cents: number | null;
  currency: string;
  turnaround_days: number | null;
  included_revisions: number | null;
  expert_notes: string | null;
  requested_at: string;
  quoted_at: string | null;
  expert: Expert | null;
};

type Assignment = {
  id: string;
  status: string;
  expert_profile_id: string;
  agreed_fee_cents: number;
  currency: string;
  turnaround_days: number | null;
  included_revisions: number | null;
  assigned_at: string;
  due_at: string | null;
  payout_status: string;
  paid_at: string | null;
  payment_reference: string | null;
  payout_proof_path?: string | null;
  payout_proof_url?: string | null;
  internal_notes: string | null;
  client_payment_state: string | null;
  expert: Expert | null;
};

type ExpertMessage = {
  id: string;
  sender_type: "expert" | "admin";
  body: string;
  created_at: string;
};

type Submission = {
  id: string;
  batch_id: string;
  batch_sequence: number;
  filename: string;
  file_size: number | null;
  version: number;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  published_at?: string | null;
  download_url: string | null;
};

type ProductionAddon = {
  id: string;
  production_job_id: string;
  kind: "extra_revision" | "additional_scope";
  status: string;
  title: string;
  description: string | null;
  currency: string;
  client_amount_cents: number | null;
  expert_cost_cents: number | null;
  expert_turnaround_days: number | null;
  expert_notes: string | null;
  expert_quoted_at: string | null;
  sent_to_client_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type Payload = {
  job: {
    id: string;
    projectName: string | null;
    studio: string | null;
    assignedStudio: string | null;
    service: string | null;
    status: string | null;
    deliveryStatus: string | null;
    sharedScope: Record<string, any>;
  };
  experts: Expert[];
  opportunities: Opportunity[];
  assignment: Assignment | null;
  messages: ExpertMessage[];
  submissions: Submission[];
  addons: ProductionAddon[];
  activeRevision: {
    id: string;
    revision_number: number;
    status: string;
    message: string | null;
    expert_client_message?: string | null;
    expert_show_client_message?: boolean | null;
    admin_response: string | null;
    target_files?: Array<{ id?: string; filename?: string; version?: number }>;
    forwarded_to_expert_at?: string | null;
    client_message?: { attachments?: Array<{ id: string; filename: string; download_url?: string | null }> } | null;
  } | null;
};

const PAYOUT_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "eligible", label: "Ready for payout" },
  { value: "held", label: "On hold" },
  { value: "paid", label: "Paid" },
];

const ASSIGNMENT_OPTIONS = [
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ExpertOperations({ jobId, job, onReload, productionOnly = false }: { jobId: string; job?: any; onReload?: () => void | Promise<void>; productionOnly?: boolean }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("available_or_limited");
  const [specialty, setSpecialty] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [sharedBrief, setSharedBrief] = useState("");
  const [clientSelection, setClientSelection] = useState<string[]>([]);
  const [clientPackageMessage, setClientPackageMessage] = useState("");
  const [packageChangeNotes, setPackageChangeNotes] = useState<Record<string, string>>({});
  const [packageChangeSelections, setPackageChangeSelections] = useState<Record<string, string[]>>({});
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [revisionClientMessage, setRevisionClientMessage] = useState("");
  const [shareRevisionClientMessage, setShareRevisionClientMessage] = useState(true);
  const [payoutProofUploading, setPayoutProofUploading] = useState(false);
  const [additionalScopeDraft, setAdditionalScopeDraft] = useState("");
  const [addonClientAmounts, setAddonClientAmounts] = useState<Record<string, string>>({});
  const [addonClientDescriptions, setAddonClientDescriptions] = useState<Record<string, string>>({});
  const [expertWorkspaceView, setExpertWorkspaceView] = useState<"messages" | "packages" | "final" | "payout">("packages");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/expert-operations?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Expert Operations could not be loaded.");
      setData(result);
      setPaymentReference(result.assignment?.payment_reference || "");
      setAssignmentNotes(result.assignment?.internal_notes || "");
      setSharedBrief(result.job?.sharedScope?.brief || "");
      setRevisionInstructions(result.activeRevision?.admin_response || "");
      setRevisionClientMessage(result.activeRevision?.expert_client_message ?? result.activeRevision?.message ?? "");
      setShareRevisionClientMessage(result.activeRevision?.expert_show_client_message !== false);
      setAddonClientAmounts((current) => {
        const next = { ...current };
        for (const addon of result.addons || []) {
          if (next[addon.id] === undefined) {
            const suggested = Number(addon.client_amount_cents || 0) > 0
              ? Number(addon.client_amount_cents) / 100
              : Number(addon.expert_cost_cents || 0) > 0
                ? Math.ceil(Number(addon.expert_cost_cents) * 1.25) / 100
                : 0;
            next[addon.id] = suggested > 0 ? suggested.toFixed(2) : "";
          }
        }
        return next;
      });
      setAddonClientDescriptions((current) => {
        const next = { ...current };
        for (const addon of result.addons || []) if (next[addon.id] === undefined) next[addon.id] = addon.description || "";
        return next;
      });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Expert Operations could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [jobId]);

  useEffect(() => {
    const requestedView = searchParams.get("expertView");
    if (requestedView === "messages" || requestedView === "packages" || requestedView === "final" || requestedView === "payout") {
      setExpertWorkspaceView(requestedView);
    }
  }, [searchParams]);

  const specialties = useMemo(() => {
    const values = new Set<string>();
    for (const expert of data?.experts || []) for (const item of expert.specialties || []) if (item) values.add(item);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [data?.experts]);

  const filteredExperts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.experts || []).filter((expert) => {
      if (availability === "available" && expert.availability !== "available") return false;
      if (availability === "limited" && expert.availability !== "limited") return false;
      if (availability === "available_or_limited" && expert.availability === "unavailable") return false;
      if (specialty !== "all" && !(expert.specialties || []).includes(specialty)) return false;
      if (!query) return true;
      return [expert.full_name, expert.role_title, expert.location, ...(expert.specialties || []), ...(expert.software_tools || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data?.experts, search, availability, specialty]);

  const requestedExpertIds = useMemo(
    () => new Set((data?.opportunities || []).filter((item) => !["closed", "declined", "expired"].includes(item.status)).map((item) => item.expert_profile_id)),
    [data?.opportunities],
  );

  async function uploadPayoutProof(file: File) {
    if (!data?.assignment || payoutProofUploading) return;
    setPayoutProofUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("assignmentId", data.assignment.id);
      formData.append("file", file);
      const response = await fetch("/api/admin/expert-payout-proof", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Payout proof could not be uploaded.");
      await load(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Payout proof could not be uploaded.");
    } finally {
      setPayoutProofUploading(false);
    }
  }

  async function action(actionName: string, body: Record<string, unknown> = {}) {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/admin/expert-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, jobId, ...body }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Expert Operations action failed.");
      setData(result);
      setSelected([]);
      setMessage("");
      setPaymentReference(result.assignment?.payment_reference || "");
      setAssignmentNotes(result.assignment?.internal_notes || "");
      setSharedBrief(result.job?.sharedScope?.brief || sharedBrief);
      if (actionName === "publish_selection") {
        setClientSelection([]);
        setClientPackageMessage("");
      }
      if (actionName === "forward_revision") {
        setRevisionInstructions(result.activeRevision?.admin_response || "");
        setRevisionClientMessage(result.activeRevision?.expert_client_message ?? result.activeRevision?.message ?? "");
        setShareRevisionClientMessage(result.activeRevision?.expert_show_client_message !== false);
      }
      if (actionName === "request_additional_scope_quote") setAdditionalScopeDraft("");
      if (actionName === "review_batch") {
        const batchId = String(body.batchId || "");
        if (batchId) {
          setPackageChangeSelections((current) => ({ ...current, [batchId]: [] }));
          setPackageChangeNotes((current) => ({ ...current, [batchId]: "" }));
        }
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "Expert Operations action failed.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <div className="heyy-expertops-loading"><Loader2 className="animate-spin" size={20} /> Loading Expert Operations…</div>;
  }

  if (!data) {
    return <div className="heyy-expertops-error">{error || "Expert Operations could not be loaded."}</div>;
  }

  const quoted = data.opportunities.filter((item) => item.status === "quoted");
  const submissionBatches = Array.from(data.submissions.reduce((map, submission) => {
    const key = submission.batch_id || submission.id;
    const current = map.get(key) || [];
    current.push(submission);
    map.set(key, current);
    return map;
  }, new Map<string, Submission[]>()).entries())
    .map(([batchId, files]) => ({
      batchId,
      sequence: Math.max(...files.map((file) => Number(file.batch_sequence || 1))),
      files: [...files].sort((a, b) => a.filename.localeCompare(b.filename)),
      note: files.find((file) => file.notes)?.notes || null,
      submittedAt: files.map((file) => file.submitted_at).sort()[0],
      status: files.every((file) => file.status === "published") ? "published" : files.some((file) => file.status === "changes_requested") ? "changes_requested" : files.some((file) => file.status === "approved") ? "approved" : "submitted",
      adminNote: files.find((file) => file.admin_notes)?.admin_notes || null,
    }))
    .sort((a, b) => b.sequence - a.sequence);

  const selectableForClient = [...data.submissions]
    .filter((submission) => submission.status !== "rejected")
    .sort((a, b) => {
      if (a.filename === b.filename) {
        if (b.version !== a.version) return b.version - a.version;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      }
      return a.filename.localeCompare(b.filename);
    });

  const selectedClientFiles = selectableForClient.filter((submission) => clientSelection.includes(submission.id));
  const paidPayoutAddons = (data.addons || []).filter((addon) => addon.status === "paid" && Number(addon.expert_cost_cents || 0) > 0);
  const payoutAddonTotal = paidPayoutAddons.reduce((sum, addon) => sum + Number(addon.expert_cost_cents || 0), 0);
  const baseExpertFee = data.assignment ? Math.max(0, Number(data.assignment.agreed_fee_cents || 0) - payoutAddonTotal) : 0;

  function toggleClientFile(submission: Submission) {
    setClientSelection((current) => {
      if (current.includes(submission.id)) return current.filter((id) => id !== submission.id);
      const sameFilenameIds = new Set(
        selectableForClient.filter((item) => item.filename === submission.filename).map((item) => item.id),
      );
      return [...current.filter((id) => !sameFilenameIds.has(id)), submission.id];
    });
  }

  function selectLatestVersionsForClient() {
    const latestByFilename = new Map<string, Submission>();
    for (const submission of selectableForClient) {
      if (!latestByFilename.has(submission.filename)) latestByFilename.set(submission.filename, submission);
    }
    setClientSelection(Array.from(latestByFilename.values()).map((submission) => submission.id));
  }

  function toggleChangeFile(batchId: string, submissionId: string) {
    setPackageChangeSelections((current) => {
      const existing = current[batchId] || [];
      return {
        ...current,
        [batchId]: existing.includes(submissionId)
          ? existing.filter((id) => id !== submissionId)
          : [...existing, submissionId],
      };
    });
  }

  return (
    <div className="heyy-expertops">
      <style>{`
        .heyy-expertops{display:grid;gap:16px}.heyy-expertops-card{border:1px solid #ddd6e8;border-radius:24px;background:#fff;box-shadow:0 10px 28px rgba(30,20,45,.055);overflow:hidden}.heyy-expertops-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid #eee9f4;background:linear-gradient(135deg,#fff,#f7f1ff)}.heyy-expertops-body{padding:20px 24px}.heyy-expertops-kicker{font-size:9px;font-weight:900;letter-spacing:.19em;text-transform:uppercase;color:#8b5cf6}.heyy-expertops-title{margin-top:4px;font-size:22px;font-weight:900;letter-spacing:-.025em;color:#17151f}.heyy-expertops-copy{margin-top:5px;font-size:12px;line-height:1.7;color:#6b6473}.heyy-expertops-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.heyy-expertops-filter{border:1px solid #e3deea;border-radius:15px;background:#faf9fc;padding:10px 12px}.heyy-expertops-label{display:block;margin-bottom:6px;font-size:9px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:#746d7c}.heyy-expertops-input,.heyy-expertops-textarea{width:100%;border:1px solid #ded8e6;border-radius:13px;background:#fff;color:#17151f;outline:none}.heyy-expertops-input{height:44px;padding:0 12px}.heyy-expertops-textarea{min-height:96px;padding:12px;resize:vertical}.heyy-expertops-input:focus,.heyy-expertops-textarea:focus{border-color:#8b5cf6;box-shadow:0 0 0 4px rgba(139,92,246,.1)}.heyy-expertops-list{display:grid;gap:10px;margin-top:16px}.heyy-expert-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid #e4deeb;border-radius:18px;background:#fff;padding:14px}.heyy-expert-row[data-selected=true]{border-color:#8b5cf6;background:#fbf8ff}.heyy-expert-check{display:grid;width:34px;height:34px;place-items:center;border:1px solid #d9d2e2;border-radius:11px;background:#faf9fc;color:#8b8392;cursor:pointer}.heyy-expert-check[data-active=true]{border-color:#8b5cf6;background:#8b5cf6;color:#fff}.heyy-expert-name{font-size:14px;font-weight:900;color:#17151f}.heyy-expert-meta{margin-top:3px;font-size:11px;font-weight:700;color:#7a7281}.heyy-expert-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.heyy-expert-tag{border-radius:999px;background:#f1e9ff;padding:4px 8px;font-size:9px;font-weight:900;color:#8b5cf6}.heyy-expert-status{border-radius:999px;padding:6px 9px;font-size:9px;font-weight:900;text-transform:uppercase}.heyy-expert-status.available{background:#e7f8ee;color:#147a43}.heyy-expert-status.limited{background:#fff3d6;color:#9a6500}.heyy-expert-status.unavailable{background:#f1eff3;color:#716a78}.heyy-expertops-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.heyy-expertops-button{display:inline-flex;min-height:42px;align-items:center;justify-content:center;gap:7px;border:1px solid #17151f;border-radius:13px;background:#17151f;padding:0 14px;color:#fff;cursor:pointer;font-size:11px;font-weight:900}.heyy-expertops-button.secondary{border-color:#d9d2e2;background:#fff;color:#403949}.heyy-expertops-button.purple{border-color:#8b5cf6;background:#8b5cf6;color:#fff}.heyy-expertops-button.green{border-color:#168d53;background:#168d53;color:#fff}.heyy-expertops-button.red{border-color:#efc5cb;background:#fff5f6;color:#b42335}.heyy-expertops-button:disabled{cursor:not-allowed;opacity:.45}.heyy-quote-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.heyy-quote-card{border:1px solid #e0d6ef;border-radius:18px;background:#fcfaff;padding:16px}.heyy-quote-money{font-size:24px;font-weight:950;letter-spacing:-.04em;color:#17151f}.heyy-quote-meta{margin-top:7px;display:flex;flex-wrap:wrap;gap:6px}.heyy-pill{border-radius:999px;background:#eee9f4;padding:5px 8px;font-size:9px;font-weight:900;color:#554d60}.heyy-assignment-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.heyy-metric{border:1px solid #e5e0eb;border-radius:15px;background:#faf9fc;padding:12px}.heyy-metric span{display:block;font-size:8px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#827a8a}.heyy-metric strong{display:block;margin-top:4px;font-size:13px;color:#17151f}.heyy-message-list{display:grid;gap:8px;max-height:320px;overflow:auto;padding-right:4px}.heyy-message{max-width:84%;border-radius:16px;padding:10px 12px;font-size:12px;line-height:1.6}.heyy-message.admin{justify-self:end;background:#8b5cf6;color:#fff}.heyy-message.expert{justify-self:start;border:1px solid #ded2f0;background:#f4f0fb;color:#332d39;box-shadow:0 5px 14px rgba(45,27,70,.04)}.heyy-message-time{margin-top:4px;font-size:8px;font-weight:800;opacity:.65}.heyy-package{border:2px solid #d7c9ea;border-radius:19px;background:#fff;padding:16px;box-shadow:0 8px 20px rgba(45,27,70,.045)}.heyy-package-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.heyy-package-files{display:grid;gap:8px;margin-top:12px}.heyy-submission{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;border:1px solid #e3deea;border-radius:14px;background:#faf9fc;padding:12px}.heyy-submission-name{font-size:12px;font-weight:900;color:#17151f}.heyy-submission-meta{margin-top:3px;font-size:10px;color:#7b7383}.heyy-expertops-empty{border:1px dashed #dcd4e6;border-radius:18px;background:#fbfafc;padding:24px;text-align:center;color:#756e7c}.heyy-expertops-loading,.heyy-expertops-error{display:flex;min-height:220px;align-items:center;justify-content:center;gap:8px;border:1px solid #e3deea;border-radius:22px;background:#fff;font-size:13px;font-weight:900;color:#8b5cf6}.heyy-expertops-error{color:#b42335}.heyy-expertops-alert{border:1px solid #efc9ce;border-radius:14px;background:#fff4f5;padding:11px 13px;font-size:11px;font-weight:800;color:#b42335}.heyy-expertops-subtabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;border:1px solid #ddd6e8;border-radius:17px;background:#f2eff6;padding:5px}.heyy-expertops-subtab{min-height:50px;border:0;border-radius:12px;background:transparent;padding:9px 12px;text-align:left;color:#655d6d;cursor:pointer;font-size:11px;font-weight:900}.heyy-expertops-subtab:hover{background:#fff}.heyy-expertops-subtab[data-active=true]{background:#fff;color:#8b5cf6;box-shadow:0 7px 18px rgba(57,35,84,.09)}.heyy-expertops-subtab small{display:block;margin-top:3px;font-size:9px;font-weight:800;color:#81798a}.heyy-expertops-subtab[data-active=true] small{color:#8b5cf6}.heyy-two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:900px){.heyy-expertops-grid,.heyy-quote-grid,.heyy-assignment-summary,.heyy-two-col{grid-template-columns:1fr}.heyy-expertops-subtabs{grid-template-columns:1fr}.heyy-expert-row{grid-template-columns:auto minmax(0,1fr)}.heyy-expert-row>div:last-child{grid-column:2}.heyy-expertops-head{padding:18px}.heyy-expertops-body{padding:18px}}
      `}</style>

      {error && <div className="heyy-expertops-alert">{error}</div>}

      {!data.assignment && !productionOnly && (
        <>
          <section className="heyy-expertops-card">
            <div className="heyy-expertops-head">
              <div>
                <p className="heyy-expertops-kicker">Expert matching</p>
                <h2 className="heyy-expertops-title">Find Experts for this production job</h2>
                <p className="heyy-expertops-copy">Only active Experts in this Studio are shown. Filter the network, select one or more matches, then request private quotes.</p>
              </div>
              <UsersRound size={22} color="#8b5cf6" />
            </div>
            <div className="heyy-expertops-body">
              <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <span className="heyy-expertops-label">Shared Expert brief</span>
                <textarea className="heyy-expertops-textarea" value={sharedBrief} onChange={(event) => setSharedBrief(event.target.value)} placeholder="Only include the project information this Expert needs to quote. Do not include client billing, unnecessary contact details or Heyy Studio margin." />
                <p className="heyy-expertops-copy">This exact brief is copied into the private opportunity. Review it before sending quote requests.</p>
              </div>

              <div className="heyy-expertops-grid">
                <div className="heyy-expertops-filter">
                  <span className="heyy-expertops-label"><Search size={11} className="inline" /> Search</span>
                  <input className="heyy-expertops-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, skill, software…" />
                </div>
                <div className="heyy-expertops-filter">
                  <span className="heyy-expertops-label"><Filter size={11} className="inline" /> Availability</span>
                  <HeyySelect tone="admin" value={availability} ariaLabel="Expert availability filter" options={[
                    { value: "available_or_limited", label: "Available + Limited" },
                    { value: "available", label: "Available only" },
                    { value: "limited", label: "Limited only" },
                    { value: "all", label: "All" },
                  ]} onChange={setAvailability} />
                </div>
                <div className="heyy-expertops-filter">
                  <span className="heyy-expertops-label">Specialty</span>
                  <HeyySelect tone="admin" value={specialty} ariaLabel="Expert specialty filter" options={[{ value: "all", label: "All specialties" }, ...specialties.map((item) => ({ value: item, label: item }))]} onChange={setSpecialty} />
                </div>
              </div>

              <div className="heyy-expertops-list">
                {filteredExperts.length ? filteredExperts.map((expert) => {
                  const isSelected = selected.includes(expert.id);
                  const alreadyRequested = requestedExpertIds.has(expert.id);
                  return (
                    <div key={expert.id} className="heyy-expert-row" data-selected={isSelected ? "true" : "false"}>
                      <button type="button" className="heyy-expert-check" data-active={isSelected ? "true" : "false"} disabled={alreadyRequested || working} onClick={() => setSelected((current) => current.includes(expert.id) ? current.filter((id) => id !== expert.id) : [...current, expert.id])} aria-label={`Select ${expert.full_name}`}>
                        {alreadyRequested ? <Clock3 size={15} /> : isSelected ? <Check size={16} /> : null}
                      </button>
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><span className="heyy-expert-name">{expert.full_name}</span>{alreadyRequested && <span className="heyy-pill">Quote requested</span>}</div>
                        <p className="heyy-expert-meta">{expert.role_title || "Heyy Studio Expert"}{expert.location ? ` · ${expert.location}` : ""}{expert.years_experience !== null ? ` · ${expert.years_experience} yrs` : ""}</p>
                        <div className="heyy-expert-tags">{(expert.specialties || []).slice(0, 6).map((item) => <span key={item} className="heyy-expert-tag">{item}</span>)}</div>
                      </div>
                      <div className={`heyy-expert-status ${expert.availability}`}>{expert.availability}</div>
                    </div>
                  );
                }) : <div className="heyy-expertops-empty">No Experts match these filters.</div>}
              </div>

              <div className="heyy-expertops-actions">
                <button type="button" className="heyy-expertops-button purple" disabled={!selected.length || working} onClick={() => void action("request_quotes", { expertIds: selected, sharedBrief })}>
                  {working ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />} Request quote{selected.length === 1 ? "" : "s"} {selected.length ? `(${selected.length})` : ""}
                </button>
              </div>
            </div>
          </section>

          <section className="heyy-expertops-card">
            <div className="heyy-expertops-head">
              <div><p className="heyy-expertops-kicker">Quote comparison</p><h2 className="heyy-expertops-title">Expert responses</h2><p className="heyy-expertops-copy">The client quote stays separate. These are internal Expert fees only.</p></div>
              <BadgeDollarSign size={22} color="#8b5cf6" />
            </div>
            <div className="heyy-expertops-body">
              {data.opportunities.length === 0 ? <div className="heyy-expertops-empty">No quote requests sent yet.</div> : (
                <div className="heyy-quote-grid">
                  {data.opportunities.map((opportunity) => (
                    <div key={opportunity.id} className="heyy-quote-card">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="heyy-expert-name">{opportunity.expert?.full_name || "Expert"}</p><p className="heyy-expert-meta">{opportunity.expert?.role_title || opportunity.expert?.studio || "Heyy Studio Expert"}</p></div>
                        <span className="heyy-pill">{prettyStatus(opportunity.status)}</span>
                      </div>
                      {opportunity.status === "quoted" && opportunity.quoted_fee_cents !== null ? (
                        <>
                          <p className="heyy-quote-money mt-4">{money(opportunity.quoted_fee_cents, opportunity.currency)}</p>
                          <div className="heyy-quote-meta"><span className="heyy-pill">{opportunity.turnaround_days || "—"} days</span><span className="heyy-pill">{opportunity.included_revisions ?? "—"} revisions</span></div>
                          {opportunity.expert_notes && <p className="heyy-expertops-copy mt-3 whitespace-pre-wrap">{opportunity.expert_notes}</p>}
                          <div className="heyy-expertops-actions"><button type="button" className="heyy-expertops-button green" disabled={working} onClick={() => void action("select_quote", { opportunityId: opportunity.id })}><UserRoundCheck size={15} /> Select & assign</button></div>
                        </>
                      ) : <p className="heyy-expertops-copy mt-4">{opportunity.status === "requested" ? "Waiting for the Expert to submit fee, turnaround and revisions." : "This quote request is closed."}</p>}
                    </div>
                  ))}
                </div>
              )}
              {quoted.length > 1 && <p className="heyy-expertops-copy mt-4">Compare scope fit, turnaround and fee before assigning. Selecting one quote closes the other open requests.</p>}
            </div>
          </section>
        </>
      )}

      {productionOnly && !data.assignment && (
        <section className="heyy-expertops-card">
          <div className="heyy-expertops-head">
            <div>
              <p className="heyy-expertops-kicker">Expert assignment</p>
              <h2 className="heyy-expertops-title">No Expert is assigned to this paid job</h2>
              <p className="heyy-expertops-copy">
                New work should be sourced from Requests & Quotes before the client pays.
                This production job was created without a preferred Expert, so matching is intentionally not repeated here.
              </p>
            </div>
            <UsersRound size={22} color="#8b5cf6" />
          </div>
          <div className="heyy-expertops-body">
            <div className="heyy-expertops-empty">
              Use the pre-production Expert Sourcing tab on future requests. Existing direct-production jobs can continue without an Expert assignment.
            </div>
          </div>
        </section>
      )}

      {data.assignment && (
        <>
          <section className="heyy-expertops-card">
            <div className="heyy-expertops-head">
              <div><p className="heyy-expertops-kicker">Assigned Expert</p><h2 className="heyy-expertops-title">{data.assignment.expert?.full_name || "Assigned Expert"}</h2><p className="heyy-expertops-copy">The Expert sees only the shared project scope and this private internal workspace.</p></div>
              <UserRoundCheck size={22} color="#168d53" />
            </div>
            <div className="heyy-expertops-body">
              <div className="heyy-assignment-summary">
                <Metric label="Expert fee" value={money(data.assignment.agreed_fee_cents, data.assignment.currency)} />
                <Metric label="Turnaround" value={data.assignment.turnaround_days ? `${data.assignment.turnaround_days} days` : "—"} />
                <Metric label="Revisions" value={String(data.assignment.included_revisions ?? "—")} />
                <Metric label="Client payment" value={data.assignment.client_payment_state || "Unknown"} />
              </div>
              <div className="mt-4 max-w-sm">
                <div className="heyy-expertops-filter"><span className="heyy-expertops-label">Project status</span><HeyySelect tone="admin" value={data.assignment.status} ariaLabel="Expert assignment status" options={ASSIGNMENT_OPTIONS} onChange={(value) => void action("update_assignment", { assignmentId: data.assignment!.id, status: value, internalNotes: assignmentNotes, paymentReference })} /></div>
              </div>
            </div>
          </section>

          <nav className="heyy-expertops-subtabs" aria-label="Expert production sections">
            <button type="button" className="heyy-expertops-subtab" data-active={expertWorkspaceView === "messages" ? "true" : "false"} onClick={() => setExpertWorkspaceView("messages")}>Messages<small>{data.messages.length} update{data.messages.length === 1 ? "" : "s"}</small></button>
            <button type="button" className="heyy-expertops-subtab" data-active={expertWorkspaceView === "packages" ? "true" : "false"} onClick={() => setExpertWorkspaceView("packages")}>Project files<small>{submissionBatches.length} package{submissionBatches.length === 1 ? "" : "s"}</small></button>
            <button type="button" className="heyy-expertops-subtab" data-active={expertWorkspaceView === "final" ? "true" : "false"} onClick={() => setExpertWorkspaceView("final")}>Final files<small>Versions & handoff</small></button>
            <button type="button" className="heyy-expertops-subtab" data-active={expertWorkspaceView === "payout" ? "true" : "false"} onClick={() => setExpertWorkspaceView("payout")}>Payout<small>{prettyStatus(data.assignment.payout_status)}</small></button>
          </nav>

          {expertWorkspaceView === "messages" && (
<section className="heyy-expertops-card">
              <div className="heyy-expertops-head"><div><p className="heyy-expertops-kicker">Private communication</p><h2 className="heyy-expertops-title">Expert ↔ Heyy Admin</h2></div><MessageSquareText size={20} color="#8b5cf6" /></div>
              <div className="heyy-expertops-body">
                <div className="heyy-message-list">{data.messages.length ? data.messages.map((item) => <div key={item.id} className={`heyy-message ${item.sender_type}`}><div>{item.body}</div><div className="heyy-message-time">{item.sender_type === "admin" ? "Heyy Studio" : data.assignment?.expert?.full_name || "Expert"} · {formatDate(item.created_at)}</div></div>) : <div className="heyy-expertops-empty">No private Expert messages yet.</div>}</div>
                <div className="mt-4"><textarea className="heyy-expertops-textarea" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message the assigned Expert…" /><div className="heyy-expertops-actions"><button type="button" className="heyy-expertops-button purple" disabled={!message.trim() || working} onClick={() => void action("send_message", { assignmentId: data.assignment!.id, message })}><Send size={14} /> Send to Expert</button></div></div>
              </div>
            </section>
          )}

          {expertWorkspaceView === "packages" && (
            <section className="heyy-expertops-card">
              <div className="heyy-expertops-head">
                <div>
                  <p className="heyy-expertops-kicker">Expert review packages</p>
                  <h2 className="heyy-expertops-title">Build the client review package</h2>
                  <p className="heyy-expertops-copy">
                    Expert uploads stay as history. When the work is ready, choose the exact approved files — even from different Expert packages — and send them to the client together.
                  </p>
                </div>
                <FileUp size={20} color="#168d53" />
              </div>
              <div className="heyy-expertops-body">
                {(data.addons || []).some((addon) => addon.kind === "extra_revision" && addon.status === "paid") && (
                  <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="heyy-expertops-kicker">Commercial additions</p><h3 className="mt-1 text-sm font-black text-slate-950">Paid additional revisions</h3><p className="mt-1 text-xs font-semibold leading-5 text-slate-600">These are separate client payments. The Expert portion is included in the total Expert fee and payout ledger.</p></div><span className="heyy-pill">Paid</span></div>
                    <div className="mt-3 grid gap-2">
                      {(data.addons || []).filter((addon) => addon.kind === "extra_revision" && addon.status === "paid").map((addon) => <div key={addon.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700"><span>Additional revision · {addon.paid_at ? formatDate(addon.paid_at) : "Paid"}</span><span>Client {money(Number(addon.client_amount_cents || 0), addon.currency)}{Number(addon.expert_cost_cents || 0) > 0 ? ` · Expert +${money(Number(addon.expert_cost_cents || 0), addon.currency)}` : ""}</span></div>)}
                    </div>
                  </div>
                )}
                <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="heyy-expertops-kicker">Change order</p>
                      <h3 className="mt-1 text-sm font-black text-slate-950">Additional project scope</h3>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">If the client adds work after payment, keep the original paid quote unchanged. Ask the assigned Expert for the added cost first, then send a separate client proposal.</p>
                    </div>
                    <span className="heyy-pill">Separate payment</span>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/80 bg-white p-3">
                    <label>
                      <span className="heyy-expertops-label">Describe the added work</span>
                      <textarea className="heyy-expertops-textarea mt-2" value={additionalScopeDraft} onChange={(event) => setAdditionalScopeDraft(event.target.value)} placeholder="Example: Add one extra packaging variant and prepare print-ready artwork for the new size." />
                    </label>
                    <div className="heyy-expertops-actions">
                      <button type="button" className="heyy-expertops-button secondary" disabled={working || !additionalScopeDraft.trim()} onClick={() => void action("request_additional_scope_quote", { description: additionalScopeDraft })}>
                        Request Expert quote for added scope
                      </button>
                    </div>
                  </div>

                  {(data.addons || []).filter((addon) => addon.kind === "additional_scope").length > 0 && (
                    <div className="mt-4 grid gap-3">
                      {(data.addons || []).filter((addon) => addon.kind === "additional_scope").map((addon) => {
                        const expertAmount = Number(addon.expert_cost_cents || 0);
                        const clientAmount = addonClientAmounts[addon.id] ?? "";
                        return (
                          <div key={addon.id} className="rounded-xl border border-sky-100 bg-white p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-black text-slate-950">{addon.title || "Additional project scope"}</p>
                                <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-600">{addon.description || "Additional project work"}</p>
                              </div>
                              <span className="heyy-pill">{prettyStatus(addon.status)}</span>
                            </div>

                            {addon.status === "awaiting_expert_quote" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-700">Waiting for the assigned Expert to price this added work.</p>}

                            {addon.status === "expert_quoted" && (
                              <div className="mt-3">
                                <div className="heyy-assignment-summary">
                                  <Metric label="Expert added fee" value={money(expertAmount, addon.currency)} />
                                  <Metric label="Turnaround" value={addon.expert_turnaround_days ? `${addon.expert_turnaround_days} days` : "—"} />
                                  <Metric label="Expert note" value={addon.expert_notes || "—"} />
                                  <Metric label="Client status" value="Not sent" />
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <label><span className="heyy-expertops-label">Client price before tax</span><input className="heyy-expertops-input" inputMode="decimal" value={clientAmount} onChange={(event) => setAddonClientAmounts((current) => ({ ...current, [addon.id]: event.target.value }))} placeholder="0.00" /></label>
                                  <label><span className="heyy-expertops-label">Currency</span><input className="heyy-expertops-input" value={String(addon.currency || "USD").toUpperCase()} disabled /></label>
                                </div>
                                <label className="mt-3 block"><span className="heyy-expertops-label">Client-facing added scope</span><textarea className="heyy-expertops-textarea mt-2" value={addonClientDescriptions[addon.id] ?? addon.description ?? ""} onChange={(event) => setAddonClientDescriptions((current) => ({ ...current, [addon.id]: event.target.value }))} /></label>
                                <div className="heyy-expertops-actions">
                                  <button type="button" className="heyy-expertops-button purple" disabled={working || !(Number(clientAmount) > 0) || !(addonClientDescriptions[addon.id] ?? addon.description ?? "").trim()} onClick={() => void action("send_additional_scope_to_client", { addonId: addon.id, clientAmountCents: Math.round(Number(clientAmount) * 100), clientDescription: addonClientDescriptions[addon.id] ?? addon.description ?? "" })}>Send additional quote to client</button>
                                  <button type="button" className="heyy-expertops-button secondary" disabled={working} onClick={() => void action("cancel_additional_scope", { addonId: addon.id })}>Cancel</button>
                                </div>
                              </div>
                            )}

                            {addon.status === "sent" && <p className="mt-3 rounded-lg bg-violet-50 p-3 text-xs font-bold text-violet-700">Client proposal sent · {money(Number(addon.client_amount_cents || 0), addon.currency)} before tax. Waiting for payment.</p>}
                            {addon.status === "paid" && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-700">Paid and active ✓ Client paid {money(Number(addon.client_amount_cents || 0), addon.currency)} before tax. The Expert fee has been added to the payout total.</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {data.activeRevision && (
                  <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="heyy-expertops-kicker">Current client revision</p>
                        <p className="mt-1 text-sm font-black text-slate-900">Revision #{data.activeRevision.revision_number} · {data.activeRevision.status}</p>
                      </div>
                      {data.activeRevision.forwarded_to_expert_at && <span className="heyy-pill">Sent to Expert</span>}
                    </div>
                    <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3">
                      <p className="heyy-expertops-label">Client request</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-700">{data.activeRevision.message || "No additional client note."}</p>
                    </div>
                    {Array.isArray(data.activeRevision.target_files) && data.activeRevision.target_files.length > 0 && (
                      <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3">
                        <p className="heyy-expertops-label">Files included in this revision round</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {data.activeRevision.target_files.map((item, index) => <span key={item.id || `${item.filename}-${index}`} className="heyy-pill">{item.filename || "Production file"}{item.version ? ` · v${item.version}` : ""}</span>)}
                        </div>
                      </div>
                    )}
                    {Array.isArray(data.activeRevision.client_message?.attachments) && data.activeRevision.client_message!.attachments!.length > 0 && (
                      <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3">
                        <p className="heyy-expertops-label">Client attachments</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {data.activeRevision.client_message!.attachments!.map((attachment) => attachment.download_url ? <a key={attachment.id} className="heyy-expertops-button secondary" href={attachment.download_url} target="_blank" rel="noreferrer"><Download size={12} /> {attachment.filename}</a> : <span key={attachment.id} className="heyy-pill">{attachment.filename}</span>)}
                        </div>
                      </div>
                    )}
                    {!data.activeRevision.forwarded_to_expert_at ? (
                      <div className="mt-3 rounded-xl border border-violet-200 bg-white p-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="heyy-expertops-label">Client message shared with Expert</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">Keep it, edit it, or hide it completely. The original client request above is never changed.</p>
                            </div>
                            <button type="button" className={`heyy-expertops-button ${shareRevisionClientMessage ? "purple" : "secondary"}`} onClick={() => setShareRevisionClientMessage((current) => !current)}>
                              {shareRevisionClientMessage ? "Sharing client message" : "Client message hidden"}
                            </button>
                          </div>
                          {shareRevisionClientMessage && (
                            <textarea className="heyy-expertops-textarea mt-3" value={revisionClientMessage} onChange={(event) => setRevisionClientMessage(event.target.value)} placeholder="Edit the client message before sharing it with the Expert…" />
                          )}
                        </div>
                        <label className="mt-3 block">
                          <span className="heyy-expertops-label">Heyy Studio instructions to Expert *</span>
                          <textarea className="heyy-expertops-textarea mt-2" value={revisionInstructions} onChange={(event) => setRevisionInstructions(event.target.value)} placeholder="Add the exact production guidance, priorities or context the Expert should act on…" />
                        </label>
                        <p className="heyy-expertops-copy">Client attachments and targeted files remain available as revision context. Only the client message text is controlled above.</p>
                        {data.assignment && (
                          <div className="heyy-expertops-actions">
                            <button type="button" className="heyy-expertops-button purple" disabled={working || !revisionInstructions.trim() || (shareRevisionClientMessage && !revisionClientMessage.trim())} onClick={() => void action("forward_revision", { assignmentId: data.assignment!.id, revisionId: data.activeRevision!.id, adminInstructions: revisionInstructions, shareClientMessage: shareRevisionClientMessage, clientMessageForExpert: revisionClientMessage })}>
                              <Send size={13} /> Send revision to Expert
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="heyy-expertops-label">Instructions sent to Expert</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-emerald-800">{data.activeRevision.admin_response || revisionInstructions}</p>
                      </div>
                    )}
                    <p className="heyy-expertops-copy">After the Expert submits the revised package, choose the new files together with any unchanged approved files that still belong in the client delivery.</p>
                  </div>
                )}

                {selectableForClient.length > 0 && (
                  <div className="mb-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="heyy-expertops-kicker">Client package builder</p>
                        <h3 className="mt-1 text-base font-black text-slate-950">Choose the files the client should receive</h3>
                        <p className="heyy-expertops-copy">Pick one version per filename. You can combine unchanged files from an earlier Expert package with revised files from a newer package.</p>
                      </div>
                      <span className="heyy-pill">{selectedClientFiles.length} selected</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="heyy-expertops-button secondary" disabled={working} onClick={selectLatestVersionsForClient}>Select latest versions</button>
                      <button type="button" className="heyy-expertops-button secondary" disabled={working || clientSelection.length === 0} onClick={() => setClientSelection([])}>Clear</button>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {selectableForClient.map((submission) => {
                        const selectedForClient = clientSelection.includes(submission.id);
                        const batch = submissionBatches.find((item) => item.batchId === submission.batch_id);
                        return (
                          <button
                            type="button"
                            key={`client-${submission.id}`}
                            onClick={() => toggleClientFile(submission)}
                            className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition ${selectedForClient ? "border-emerald-500 bg-white shadow-sm" : "border-emerald-100 bg-white/70 hover:border-emerald-300"}`}
                          >
                            <span className={`grid h-7 w-7 place-items-center rounded-lg border ${selectedForClient ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-400"}`}>{selectedForClient ? <Check size={14} /> : null}</span>
                            <span>
                              <strong className="block text-xs text-slate-950">{submission.filename} · v{submission.version}</strong>
                              <span className="mt-1 block text-[10px] font-semibold text-slate-500">Package #{batch?.sequence || submission.batch_sequence || 1} · {prettyStatus(submission.status)} · {fileSize(submission.file_size)}</span><span className="mt-1 block text-[9px] font-bold text-slate-400">Submitted {formatDate(submission.submitted_at)}{submission.published_at ? ` · Sent to client ${formatDate(submission.published_at)}` : ""}</span>
                            </span>
                            {submission.status === "published" && <span className="heyy-pill">Already with client</span>}
                          </button>
                        );
                      })}
                    </div>
                    <label className="mt-4 block">
                      <span className="heyy-expertops-label">Message to client</span>
                      <textarea
                        className="heyy-expertops-textarea"
                        value={clientPackageMessage}
                        onChange={(event) => setClientPackageMessage(event.target.value)}
                        placeholder={data.activeRevision ? `Revision ${data.activeRevision.revision_number} is ready. Please review the selected updated files.` : "Your review files are ready. Please review the selected files and send any changes as one revision round."}
                      />
                    </label>
                    <div className="heyy-expertops-actions">
                      <button
                        type="button"
                        className="heyy-expertops-button green"
                        disabled={working || clientSelection.length === 0 || !clientPackageMessage.trim()}
                        onClick={() => void action("publish_selection", { submissionIds: clientSelection, clientMessage: clientPackageMessage })}
                      >
                        {working ? <Loader2 className="animate-spin" size={13} /> : <Send size={13} />} Send {clientSelection.length || "selected"} file{clientSelection.length === 1 ? "" : "s"} to client
                      </button>
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <p className="heyy-expertops-kicker">Expert package history</p>
                  <p className="heyy-expertops-copy">Keep each Expert submission as a clear record. Request changes only on the files that actually need changes.</p>
                </div>
                <div className="heyy-expertops-list">
                  {submissionBatches.length ? submissionBatches.map((batch) => {
                    const changeNote = packageChangeNotes[batch.batchId] ?? "";
                    const changeSelection = packageChangeSelections[batch.batchId] || [];
                    const changeableFiles = batch.files.filter((submission) => ["submitted", "approved"].includes(submission.status));
                    return (
                      <div className="heyy-package" key={batch.batchId}>
                        <div className="heyy-package-head">
                          <div>
                            <p className="heyy-expertops-kicker">Review package #{batch.sequence}</p>
                            <h3 className="mt-1 text-base font-black text-slate-950">{batch.files.length} file{batch.files.length === 1 ? "" : "s"} from {data.assignment?.expert?.full_name || "Expert"}</h3>
                            <p className="heyy-submission-meta">{prettyStatus(batch.status)} · {formatDate(batch.submittedAt)}</p>
                          </div>
                          <span className="heyy-pill">Package #{batch.sequence}</span>
                        </div>
                        {batch.note && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="heyy-expertops-label">Expert submission note</p><p className="heyy-expertops-copy whitespace-pre-wrap">{batch.note}</p></div>}
                        {batch.adminNote && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="heyy-expertops-label">Heyy Studio feedback</p><p className="heyy-expertops-copy whitespace-pre-wrap">{batch.adminNote}</p></div>}
                        <div className="heyy-package-files">
                          {batch.files.map((submission) => {
                            const canRequestChange = ["submitted", "approved"].includes(submission.status);
                            const selectedForChange = changeSelection.includes(submission.id);
                            return (
                              <div className="heyy-submission" key={submission.id}>
                                <div className="flex min-w-0 items-center gap-3">
                                  {canRequestChange && (
                                    <button type="button" className="heyy-expert-check shrink-0" data-active={selectedForChange ? "true" : "false"} onClick={() => toggleChangeFile(batch.batchId, submission.id)} aria-label={`Select ${submission.filename} for changes`}>
                                      {selectedForChange ? <Check size={14} /> : null}
                                    </button>
                                  )}
                                  <div className="min-w-0"><p className="heyy-submission-name truncate">{submission.filename} <span className="heyy-pill">v{submission.version}</span></p><p className="heyy-submission-meta">{fileSize(submission.file_size)} · {prettyStatus(submission.status)}</p></div>
                                </div>
                                {submission.download_url && <a className="heyy-expertops-button secondary" href={submission.download_url} target="_blank" rel="noreferrer"><Download size={13} /> Open</a>}
                              </div>
                            );
                          })}
                        </div>
                        {changeableFiles.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/40 p-4">
                            <p className="heyy-expertops-label">Need Expert changes?</p>
                            <p className="heyy-expertops-copy">Select only the files that need another Expert version, then explain the change once.</p>
                            <textarea className="heyy-expertops-textarea mt-3" value={changeNote} onChange={(event) => setPackageChangeNotes((current) => ({ ...current, [batch.batchId]: event.target.value }))} placeholder="Tell the Expert exactly what should change…" />
                            <div className="heyy-expertops-actions">
                              <button type="button" className="heyy-expertops-button red" disabled={working || changeSelection.length === 0 || !changeNote.trim()} onClick={() => void action("review_batch", { batchId: batch.batchId, status: "changes_requested", adminNotes: changeNote, submissionIds: changeSelection })}>
                                <X size={13} /> Request changes ({changeSelection.length})
                              </button>
                            </div>
                          </div>
                        )}
                        {batch.status === "changes_requested" && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">Some files need changes. Unchanged files can still be selected above for the final client package.</p>}
                        {batch.status === "published" && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">This Expert package has already contributed files to the client delivery.</p>}
                      </div>
                    );
                  }) : <div className="heyy-expertops-empty">No Expert review packages submitted yet.</div>}
                </div>
              </div>
            </section>
          )}

          {expertWorkspaceView === "final" && (
            <section className="heyy-expertops-card">
              <div className="heyy-expertops-head"><div><p className="heyy-expertops-kicker">Final handoff</p><h2 className="heyy-expertops-title">Client-approved final files</h2><p className="heyy-expertops-copy">Only the files approved by the client appear here. Version history and working files remain under Project files.</p></div><Check size={20} color="#168d53" /></div>
              <div className="heyy-expertops-body"><ApprovedFinalFiles jobId={jobId} clientApproved={data.job.deliveryStatus === "Client Approved"} /></div>
            </section>
          )}

          {expertWorkspaceView === "payout" && (
            <section className="heyy-expertops-card">
              <div className="heyy-expertops-head">
                <div>
                  <p className="heyy-expertops-kicker">Payout tracking</p>
                  <h2 className="heyy-expertops-title">Expert payout record</h2>
                  <p className="heyy-expertops-copy">Record the off-platform payment, keep proof and references together, and generate the Expert Payout Statement for Admin expenses and the Expert’s records.</p>
                </div>
                <CircleDollarSign size={22} color="#8b5cf6" />
              </div>
              <div className="heyy-expertops-body">
                <div className={`rounded-[20px] border p-5 ${data.assignment.payout_status === "paid" ? "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-violet-50" : data.assignment.payout_status === "eligible" ? "border-violet-200 bg-gradient-to-r from-violet-50 via-white to-white" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-600">{data.assignment.payout_status === "paid" ? "Payment recorded" : data.assignment.payout_status === "eligible" ? "Ready for payout" : "Payout status"}</p>
                      <div className="mt-1 flex flex-wrap items-end gap-3"><h3 className="text-3xl font-black tracking-[-.04em] text-slate-950">{money(data.assignment.agreed_fee_cents, data.assignment.currency)}</h3><span className={`mb-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] ${data.assignment.payout_status === "paid" ? "bg-emerald-100 text-emerald-700" : data.assignment.payout_status === "eligible" ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-600"}`}>{data.assignment.payout_status === "eligible" ? "Ready for payout" : prettyStatus(data.assignment.payout_status)}</span></div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">Total Expert payout for this completed production job.</p>
                    </div>
                    {data.assignment.payout_status === "paid" && <a className="heyy-expertops-button green" href={`/api/admin/expert-payouts/${encodeURIComponent(data.assignment.id)}/statement`}><Download size={13}/> Download payout statement</a>}
                  </div>
                  {data.assignment.payout_status === "paid" && <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-xl border border-emerald-100 bg-white/80 p-3"><span className="heyy-expertops-label">Paid date</span><strong className="text-slate-900">{data.assignment.paid_at ? formatDate(data.assignment.paid_at) : "Recorded"}</strong></div><div className="rounded-xl border border-emerald-100 bg-white/80 p-3"><span className="heyy-expertops-label">Payment reference</span><strong className="break-words text-slate-900">{data.assignment.payment_reference || "Not recorded"}</strong></div></div>}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
                  <div className="rounded-[18px] border border-violet-100 bg-white p-4">
                    <p className="heyy-expertops-label">Payout breakdown</p>
                    <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60 px-3">
                      <div className="flex items-center justify-between gap-3 py-3 text-xs"><span className="font-bold text-slate-500">Original agreed Expert fee</span><strong className="text-slate-950">{money(baseExpertFee, data.assignment.currency)}</strong></div>
                      {paidPayoutAddons.map((addon) => <div key={addon.id} className="flex items-center justify-between gap-3 py-3 text-xs"><span className="font-bold text-slate-500">{addon.kind === "extra_revision" ? "Additional revision" : addon.title || "Additional scope"}</span><strong className="text-slate-950">+ {money(Number(addon.expert_cost_cents || 0), addon.currency || data.assignment?.currency || "USD")}</strong></div>)}
                      <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-black text-slate-800">Total payout</span><strong className="text-violet-700">{money(data.assignment.agreed_fee_cents, data.assignment.currency)}</strong></div>
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-violet-200 bg-violet-50/60 p-4">
                    <p className="heyy-expertops-label">Expert payout instructions</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{data.assignment.expert?.payout_method ? prettyStatus(data.assignment.expert.payout_method) : "Payout details not provided"}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-600">{data.assignment.expert?.payout_details?.details || "Ask the Expert to add payout details in Expert Portal → Expert profile before paying."}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="heyy-expertops-label">Manual payment record</p><p className="text-xs font-semibold leading-5 text-slate-500">Pay the Expert by bank transfer, Wise, PayPal or the agreed method, then save the status, reference and optional proof here.</p></div>{data.assignment.payout_status === "paid" && <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-emerald-700">Expense record complete</span>}</div>
                  <div className="heyy-two-col mt-4">
                    <div className="heyy-expertops-filter"><span className="heyy-expertops-label">Payout status</span><HeyySelect tone="admin" value={data.assignment.payout_status} ariaLabel="Expert payout status" options={PAYOUT_OPTIONS} onChange={(value) => void action("update_assignment", { assignmentId: data.assignment!.id, payoutStatus: value, internalNotes: assignmentNotes, paymentReference })} /></div>
                    <label><span className="heyy-expertops-label">Payment reference</span><input className="heyy-expertops-input" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Bank transfer / Wise / PayPal reference" /></label>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2"><label><span className="heyy-expertops-label">Proof of payment (optional)</span><input className="heyy-expertops-input !h-auto py-2" type="file" accept="image/*,application/pdf" disabled={payoutProofUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPayoutProof(file); event.currentTarget.value = ""; }} /></label><div className="flex items-end">{data.assignment.payout_proof_url ? <a className="heyy-expertops-button secondary" href={data.assignment.payout_proof_url} target="_blank" rel="noreferrer"><Download size={13} /> Open payout proof</a> : <span className="text-xs font-semibold text-slate-400">{payoutProofUploading ? "Uploading proof…" : "No proof attached"}</span>}</div></div>
                  <label className="mt-3 block"><span className="heyy-expertops-label">Private Admin note</span><input className="heyy-expertops-input" value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} placeholder="Internal note about this payout" /></label>
                  <div className="heyy-expertops-actions"><button type="button" className="heyy-expertops-button secondary" disabled={working} onClick={() => void action("update_assignment", { assignmentId: data.assignment!.id, internalNotes: assignmentNotes, paymentReference })}>Save payout record</button>{data.assignment.payout_status === "paid" && <a className="heyy-expertops-button purple" href={`/api/admin/expert-payouts/${encodeURIComponent(data.assignment.id)}/statement`}><Download size={13}/> Expert Payout Statement</a>}</div>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}


function ApprovedFinalFiles({ jobId, clientApproved }: { jobId: string; clientApproved: boolean }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadFinalFiles() {
      setLoadingFiles(true);
      setFileError("");
      try {
        const response = await fetch(`/api/admin/production-deliverables?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Final files could not be loaded.");
        if (!cancelled) setFiles((result.deliverables || []).filter((file: any) => file.client_visible && file.is_latest));
      } catch (value) {
        if (!cancelled) setFileError(value instanceof Error ? value.message : "Final files could not be loaded.");
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    }
    void loadFinalFiles();
    return () => { cancelled = true; };
  }, [jobId, clientApproved]);

  async function download(path: string) {
    const response = await fetch("/api/admin/download-production-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.url) throw new Error(result.error || "Download link could not be created.");
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (loadingFiles) return <div className="heyy-expertops-empty"><Loader2 size={16} className="animate-spin" /> Loading final files…</div>;
  if (fileError) return <div className="heyy-expertops-error">{fileError}</div>;
  if (!clientApproved) return <div className="heyy-expertops-empty">Final files will appear here after the client approves the delivered package.</div>;
  if (!files.length) return <div className="heyy-expertops-empty">The client approved this project, but no final files have been recorded yet. Refresh once to reconcile the final package.</div>;

  return (
    <div className="grid gap-3">
      {files.map((file) => (
        <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">{file.original_filename || file.filename || "Final production file"}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">Client approved · Final delivery</p>
          </div>
          <button type="button" className="heyy-expertops-button secondary" onClick={() => void download(file.storage_path).catch((value) => alert(value instanceof Error ? value.message : "Download failed."))}>
            <Download size={13} /> Download
          </button>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="heyy-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function prettyStatus(value: string) {
  return String(value || "—").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(cents: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents || 0) / 100);
  } catch {
    return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function fileSize(value: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
