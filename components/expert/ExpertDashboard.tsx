"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  FileText,
  FileUp,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import HeyySelect from "@/components/ui/heyy-select";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { GlassCard } from "@/components/ui/heyy";
import { createBrowserZip } from "@/lib/client/zip";

type Profile = {
  id: string;
  fullName: string;
  email: string;
  studio: string;
  roleTitle: string | null;
  location: string | null;
  timezone: string | null;
  yearsExperience: number | null;
  specialties: string[];
  softwareTools: string[];
  languages: string[];
  availability: string;
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  status: string;
  payoutMethod: string | null;
  payoutDetailsText: string;
};

type Opportunity = {
  id: string;
  status: string;
  productionJobId: string | null;
  sharedScope: Record<string, any>;
  requestedAt: string;
  expiresAt: string | null;
  quotedFeeCents: number | null;
  currency: string;
  turnaroundDays: number | null;
  includedRevisions: number | null;
  extraRevisionFeeCents: number | null;
  expertNotes: string | null;
  quotedAt: string | null;
};

type Assignment = {
  id: string;
  productionJobId: string;
  status: string;
  sharedScope: Record<string, any>;
  agreedFeeCents: number;
  currency: string;
  turnaroundDays: number | null;
  includedRevisions: number | null;
  extraRevisionFeeCents: number | null;
  assignedAt: string;
  dueAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  payoutStatus: string;
  payoutEligibleAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
};

type ExpertMessage = {
  id: string;
  assignmentId: string;
  senderType: "expert" | "admin";
  body: string;
  createdAt: string;
  readByExpertAt: string | null;
};

type Submission = {
  id: string;
  assignmentId: string;
  filename: string;
  batchId: string;
  batchSequence: number;
  fileSize: number | null;
  mimeType: string | null;
  version: number;
  notes: string | null;
  status: string;
  adminNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  downloadUrl: string | null;
};

type ExpertRevision = {
  id: string;
  assignmentId: string | null;
  productionJobId: string;
  revisionNumber: number;
  status: string;
  message: string | null;
  adminResponse: string | null;
  targetFiles: Array<{ id?: string; filename?: string; version?: number }>;
  clientAttachments: Array<{ id: string; filename: string; download_url?: string | null }>;
  forwardedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
};

type ExpertAddon = {
  id: string;
  assignmentId: string | null;
  productionJobId: string;
  kind: string;
  status: string;
  title: string;
  description: string | null;
  currency: string;
  expertCostCents: number | null;
  expertTurnaroundDays: number | null;
  expertNotes: string | null;
  expertQuotedAt: string | null;
  sentToClientAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

type Operations = {
  opportunities: Opportunity[];
  assignments: Assignment[];
  messages: ExpertMessage[];
  submissions: Submission[];
  revisions: ExpertRevision[];
  addons: ExpertAddon[];
};

type PortalSection = "opportunities" | "projects" | "messages" | "payments" | "profile";
type ProjectPanel = "overview" | "messages" | "files" | "revisions";

function studioLabel(value: string) {
  if (value === "brand_studio") return "Brand Studio";
  if (value === "marketing_studio") return "Marketing Studio";
  if (value === "architecture_studio") return "Architecture Studio";
  if (value === "interior_studio") return "Interior Studio";
  return "Heyy Studio";
}

export default function ExpertDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [operations, setOperations] = useState<Operations>({ opportunities: [], assignments: [], messages: [], submissions: [], revisions: [], addons: [] });
  const [loading, setLoading] = useState(true);
  const [opsLoading, setOpsLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<PortalSection>("opportunities");
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteFee, setQuoteFee] = useState("");
  const [quoteDays, setQuoteDays] = useState("5");
  const [quoteRevisions, setQuoteRevisions] = useState("2");
  const [quoteExtraRevisionFee, setQuoteExtraRevisionFee] = useState("50");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [projectPanel, setProjectPanel] = useState<ProjectPanel>("overview");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutDetailsText, setPayoutDetailsText] = useState("");

  function syncPortalLocation(nextSection: PortalSection, assignmentId?: string | null) {
    setSection(nextSection);
    if (assignmentId !== undefined) setSelectedAssignmentId(assignmentId);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("section", nextSection);
    if (assignmentId) url.searchParams.set("assignment", assignmentId);
    else if (assignmentId === null || nextSection !== "projects") url.searchParams.delete("assignment");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function syncProjectPanel(nextPanel: ProjectPanel, assignmentId = selectedAssignmentId) {
    setProjectPanel(nextPanel);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("section", "projects");
    if (assignmentId) url.searchParams.set("assignment", assignmentId);
    url.searchParams.set("panel", nextPanel);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (nextPanel === "messages" && selectedAssignmentId) {
      void operationAction("mark_messages_read", { assignmentId: selectedAssignmentId });
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("section") as PortalSection | null;
    if (requested && ["opportunities", "projects", "messages", "payments", "profile"].includes(requested)) {
      setSection(requested);
    }
    const assignmentId = params.get("assignment");
    if (assignmentId) setSelectedAssignmentId(assignmentId);
    const panel = params.get("panel") as ProjectPanel | null;
    if (panel && ["overview", "messages", "files", "revisions"].includes(panel)) setProjectPanel(panel);
  }, []);

  async function token() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadOperations() {
    if (!user) return;
    setOpsLoading(true);
    try {
      const accessToken = await token();
      const response = await fetch("/api/expert/operations", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Expert projects could not be loaded.");
      const next: Operations = {
        opportunities: result.opportunities || [],
        assignments: result.assignments || [],
        messages: result.messages || [],
        submissions: result.submissions || [],
        revisions: result.revisions || [],
        addons: result.addons || [],
      };
      setOperations(next);
      setSelectedAssignmentId((current) => current && next.assignments.some((item) => item.id === current) ? current : next.assignments[0]?.id || null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Expert projects could not be loaded.");
    } finally {
      setOpsLoading(false);
    }
  }

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const accessToken = await token();
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [profileResponse, operationsResponse] = await Promise.all([
        fetch("/api/expert/me", { headers, cache: "no-store" }),
        fetch("/api/expert/operations?mode=summary", { headers, cache: "no-store" }),
      ]);
      const [profileResult, operationsResult] = await Promise.all([
        profileResponse.json(),
        operationsResponse.json(),
      ]);
      if (!profileResponse.ok) throw new Error(profileResult.error || "Expert profile could not be loaded.");
      if (!operationsResponse.ok || !operationsResult.success) throw new Error(operationsResult.error || "Expert projects could not be loaded.");

      setProfile(profileResult.profile);
      setPayoutMethod(profileResult.profile?.payoutMethod || "");
      setPayoutDetailsText(profileResult.profile?.payoutDetailsText || "");
      const next: Operations = {
        opportunities: operationsResult.opportunities || [],
        assignments: operationsResult.assignments || [],
        messages: operationsResult.messages || [],
        submissions: operationsResult.submissions || [],
        revisions: operationsResult.revisions || [],
        addons: operationsResult.addons || [],
      };
      setOperations(next);
      setSelectedAssignmentId((current) => current && next.assignments.some((item) => item.id === current) ? current : next.assignments[0]?.id || null);

      // Paint the portal from the lightweight summary first. Full messages,
      // file URLs, revisions and add-ons load immediately afterwards without
      // blocking the whole page behind the opening spinner.
      window.setTimeout(() => void loadOperations(), 0);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Expert Portal could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, user?.id]);

  async function changeAvailability(value: string) {
    if (!profile) return;
    setSaving(true);
    setError("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/expert/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ availability: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Availability could not be updated.");
      setProfile(result.profile);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Availability could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function savePayoutDetails() {
    if (!profile) return;
    if (!payoutMethod) {
      setError("Choose how you prefer to receive Expert payouts.");
      return;
    }
    if (!payoutDetailsText.trim()) {
      setError("Add the payout details Heyy Studio needs to pay you.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/expert/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ payoutMethod, payoutDetailsText }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Payout details could not be saved.");
      setProfile(result.profile);
      setPayoutMethod(result.profile?.payoutMethod || "");
      setPayoutDetailsText(result.profile?.payoutDetailsText || "");
      setNotice("Payout details saved. Only Heyy Studio Admin can use them for your manual Expert payout.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Payout details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function operationAction(action: string, body: Record<string, unknown>) {
    if (saving) return false;
    setSaving(true);
    setError("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/expert/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action, ...body }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Expert action failed.");
      setOperations({
        opportunities: result.opportunities || [],
        assignments: result.assignments || [],
        messages: result.messages || [],
        submissions: result.submissions || [],
        revisions: result.revisions || [],
        addons: result.addons || [],
      });
      setSelectedAssignmentId((current) => current || result.assignments?.[0]?.id || null);
      return true;
    } catch (value) {
      setError(value instanceof Error ? value.message : "Expert action failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitQuote(opportunityId: string) {
    const fee = Number(quoteFee);
    if (!Number.isFinite(fee) || fee < 0) {
      setError("Enter a valid Expert fee.");
      return;
    }
    const extraRevisionFee = Number(quoteExtraRevisionFee);
    if (!Number.isFinite(extraRevisionFee) || extraRevisionFee < 0) {
      setError("Enter a valid Expert fee for one additional revision.");
      return;
    }
    const ok = await operationAction("submit_quote", {
      opportunityId,
      feeCents: Math.round(fee * 100),
      turnaroundDays: Number(quoteDays),
      includedRevisions: Number(quoteRevisions),
      extraRevisionFeeCents: Math.round(extraRevisionFee * 100),
      notes: quoteNotes,
    });
    if (ok) {
      setQuoteId(null);
      setQuoteFee("");
      setQuoteExtraRevisionFee("50");
      setQuoteNotes("");
    }
  }

  const openOpportunities = operations.opportunities.filter(
    (item) =>
      ["requested", "quoted", "selected"].includes(item.status) &&
      !item.productionJobId,
  );
  const activeAssignments = operations.assignments.filter((item) => item.status !== "cancelled");
  const unreadMessages = operations.messages.filter((item) => item.senderType === "admin" && !item.readByExpertAt).length;
  const selectedAssignment = operations.assignments.find((item) => item.id === selectedAssignmentId) || activeAssignments[0] || null;
  const selectedMessages = selectedAssignment ? operations.messages.filter((item) => item.assignmentId === selectedAssignment.id) : [];
  const selectedRevisions = selectedAssignment ? operations.revisions.filter((item) => item.assignmentId === selectedAssignment.id) : [];
  const selectedSubmissions = selectedAssignment ? operations.submissions.filter((item) => item.assignmentId === selectedAssignment.id) : [];
  const selectedAddons = selectedAssignment ? operations.addons.filter((item) => item.assignmentId === selectedAssignment.id) : [];
  const selectedPackageCount = new Set(selectedSubmissions.map((item) => item.batchId)).size;

  if (authLoading || loading) return <PortalShell><section className="grid min-h-[calc(100vh-var(--header-height))] place-items-center px-5"><div className="flex items-center gap-3 font-bold text-[var(--text-secondary)]"><Loader2 className="animate-spin" />Opening Expert Portal…</div></section></PortalShell>;
  if (!user) return <PortalShell><section className="grid min-h-[calc(100vh-var(--header-height))] place-items-center px-5 py-12"><GlassCard className="max-w-lg p-8 text-center"><h1 className="text-3xl font-black">Expert Portal</h1><p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">Sign in with your approved Expert Network account.</p><Link href="/login?next=/expert" className="mt-6 inline-flex h-11 items-center rounded-full bg-[var(--text-primary)] px-5 text-xs font-black text-[var(--surface-strong)]">Sign in</Link></GlassCard></section></PortalShell>;
  if (!profile) return <PortalShell><section className="grid min-h-[calc(100vh-var(--header-height))] place-items-center px-5 py-12"><GlassCard className="max-w-xl p-8 text-center"><h1 className="text-3xl font-black">Expert access not active</h1><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{error || "This account is not linked to an approved Heyy Studio Expert profile."}</p><Link href="/expertsnetwork" className="mt-6 inline-flex h-11 items-center rounded-full border border-[var(--border)] px-5 text-xs font-black">Expert Network</Link></GlassCard></section></PortalShell>;

  return <PortalShell>
    <style>{`
      .expert-action{display:inline-flex;min-height:42px;align-items:center;justify-content:center;gap:7px;border:1px solid var(--text-primary);border-radius:13px;background:var(--text-primary);padding:0 14px;color:var(--surface-strong);font-size:11px;font-weight:900;cursor:pointer}.expert-action.secondary{border-color:var(--border);background:var(--surface);color:var(--text-primary)}.expert-action.purple{border-color:var(--accent-strong);background:var(--accent-strong);color:#fff}.expert-action:disabled{opacity:.45;cursor:not-allowed}.expert-input,.expert-textarea{width:100%;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--text-primary);outline:none}.expert-input{height:44px;padding:0 12px}.expert-textarea{min-height:100px;padding:12px;resize:vertical}.expert-input:focus,.expert-textarea:focus{border-color:var(--accent-strong);box-shadow:0 0 0 4px var(--accent-soft)}.expert-message{max-width:85%;border-radius:16px;padding:11px 13px;font-size:12px;line-height:1.6;box-shadow:0 6px 16px rgba(30,20,45,.05)}.expert-message.admin{justify-self:start;border:1px solid rgba(139,92,246,.18);background:linear-gradient(135deg,rgba(139,92,246,.09),rgba(139,92,246,.035));color:var(--text-primary)}.expert-message.expert{justify-self:end;border:1px solid var(--accent-strong);background:var(--accent-strong);color:#fff}.expert-project-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface-muted);padding:7px}.expert-project-tab{display:flex;min-height:50px;align-items:center;justify-content:space-between;gap:9px;border:1px solid var(--border);border-radius:13px;background:var(--surface);padding:10px 12px;text-align:left;font-size:11px;font-weight:900;color:var(--text-secondary);cursor:pointer;box-shadow:0 3px 10px rgba(35,24,54,.035);transition:transform 160ms ease,border-color 160ms ease,background 160ms ease,color 160ms ease,box-shadow 160ms ease}.expert-project-tab:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent-strong) 45%,var(--border));background:color-mix(in srgb,var(--accent-soft) 42%,var(--surface));color:var(--accent-strong);box-shadow:0 7px 18px rgba(139,92,246,.09)}.expert-project-tab:focus-visible{outline:3px solid color-mix(in srgb,var(--accent-strong) 25%,transparent);outline-offset:2px}.expert-project-tab[data-active="true"]{border-color:var(--accent-strong);background:var(--accent-strong);color:#fff;box-shadow:0 9px 22px rgba(139,92,246,.22)}.expert-project-tab-count{display:inline-flex;min-width:24px;height:24px;align-items:center;justify-content:center;border-radius:999px;background:var(--surface);padding:0 7px;font-size:9px;font-weight:900;color:var(--text-muted)}.expert-project-tab[data-active="true"] .expert-project-tab-count{background:rgba(255,255,255,.18);color:#fff}.expert-package-card{border:2px solid color-mix(in srgb,var(--accent-strong) 26%,var(--border));border-radius:19px;background:var(--surface);padding:16px;box-shadow:0 9px 22px rgba(45,27,70,.06)}.expert-package-card[data-status="published"]{border-color:rgba(22,141,83,.34)}.expert-package-card[data-status="changes_requested"]{border-color:rgba(217,119,6,.4)}@media(max-width:760px){.expert-project-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(125deg,rgba(139,92,246,.15),rgba(239,63,180,.09),rgba(46,124,246,.10))] p-6 sm:p-9"><div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-end"><div><p className="text-[.62rem] font-black uppercase tracking-[.2em] text-[var(--accent-strong)]">{studioLabel(profile.studio)} Expert</p><h2 className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-6xl">Welcome, {profile.fullName.split(" ")[0]}.</h2><p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">Your Expert Portal is private. Only project opportunities and assignments specifically shared with you appear here. Client billing, Heyy Studio margin and unrelated projects stay private.</p></div><GlassCard className="p-4"><p className="text-[.58rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Availability</p><div className="mt-3"><HeyySelect value={profile.availability} ariaLabel="Expert availability" options={[{ value: "available", label: "Available" }, { value: "limited", label: "Limited" }, { value: "unavailable", label: "Unavailable" }]} onChange={(value) => void changeAvailability(value)} disabled={saving} /></div><p className="mt-3 text-xs font-semibold leading-5 text-[var(--text-muted)]">Keep this current so Heyy Studio only shares opportunities when the timing makes sense.</p></GlassCard></div></section>

      {error && <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm font-bold text-red-600">{error}</p>}
      {notice && <p className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700">{notice}</p>}
      {opsLoading && <p className="mt-5 flex items-center gap-2 text-xs font-black text-[var(--text-muted)]"><Loader2 className="animate-spin" size={14} />Refreshing Expert projects…</p>}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <PortalCard active={section === "opportunities"} onClick={() => syncPortalLocation("opportunities", null)} icon={<BriefcaseBusiness size={20} />} title="Project opportunities" value={openOpportunities.length} body="Review matching scopes and submit your project fee and turnaround." />
        <PortalCard active={section === "projects"} onClick={() => syncPortalLocation("projects", selectedAssignmentId || activeAssignments[0]?.id || null)} icon={<UserRoundCheck size={20} />} title="Assigned projects" value={activeAssignments.length} body="Work only on projects formally assigned to your Expert profile." />
        <PortalCard active={section === "messages"} onClick={() => { syncPortalLocation("messages", selectedAssignmentId || activeAssignments[0]?.id || null); if (selectedAssignmentId) void operationAction("mark_messages_read", { assignmentId: selectedAssignmentId }); }} icon={<MessageSquareText size={20} />} title="Heyy messages" value={unreadMessages} body="Private project communication between you and the Heyy Studio team." />
        <PortalCard active={section === "payments"} onClick={() => syncPortalLocation("payments", null)} icon={<CircleDollarSign size={20} />} title="Payments" value={operations.assignments.filter((item) => item.payoutStatus === "paid").length} body="Track your agreed Expert fees and manual payout status." />
        <PortalCard active={section === "profile"} onClick={() => syncPortalLocation("profile", null)} icon={<Sparkles size={20} />} title="Expert profile" body="Your profile, specialties and how Heyy Studio projects work." />
      </section>

      {section === "opportunities" && <section className="mt-6 grid gap-4">
        <SectionHeading kicker="Private opportunities" title="Review scope and quote before assignment" copy="Heyy Studio can request quotes from several Experts. If your quote is preferred, it stays pending here until the client pays. Only then does it become an assigned project." />
        {openOpportunities.length ? openOpportunities.map((opportunity) => <GlassCard key={opportunity.id} className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[.58rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">{prettyStatus(opportunity.status)}</p><h3 className="mt-2 text-2xl font-black">{opportunity.sharedScope.projectName || "Project opportunity"}</h3><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{opportunity.sharedScope.service || studioLabel(profile.studio)} · Shared {formatDate(opportunity.requestedAt)}</p></div>{opportunity.quotedFeeCents !== null && <span className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-black text-[var(--accent-strong)]">Your quote: {money(opportunity.quotedFeeCents, opportunity.currency)}</span>}</div>
          <SharedScopePack scope={opportunity.sharedScope} profileStudio={profile.studio} title="Quote pack shared by Heyy Studio" />
          {opportunity.status === "selected" ? <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-500/10 p-4"><p className="text-[.58rem] font-black uppercase tracking-[.14em] text-emerald-700">Preferred by Heyy Studio</p><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Your quote has been selected internally. The project is waiting for client payment, so work has not started yet. If payment is confirmed, it will automatically move to Assigned Projects with the agreed fee and scope.</p></div> : quoteId === opportunity.id ? <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label><span className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Your project fee ({opportunity.currency})</span><input className="expert-input mt-2" type="number" min="0" step="0.01" value={quoteFee} onChange={(event) => setQuoteFee(event.target.value)} placeholder="750.00" /></label><label><span className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Turnaround days</span><input className="expert-input mt-2" type="number" min="1" max="365" value={quoteDays} onChange={(event) => setQuoteDays(event.target.value)} /></label><label><span className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Included revisions</span><input className="expert-input mt-2" type="number" min="0" max="50" value={quoteRevisions} onChange={(event) => setQuoteRevisions(event.target.value)} /></label><label><span className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Your fee per extra revision ({opportunity.currency})</span><input className="expert-input mt-2" type="number" min="0" step="0.01" value={quoteExtraRevisionFee} onChange={(event) => setQuoteExtraRevisionFee(event.target.value)} placeholder="50.00" /><span className="mt-2 block text-[10px] font-semibold leading-4 text-[var(--text-muted)]">This is the amount you expect to receive. Heyy Studio adds its management fee before showing the price to the client.</span></label></div><label className="mt-3 block"><span className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Notes / assumptions</span><textarea className="expert-textarea mt-2" value={quoteNotes} onChange={(event) => setQuoteNotes(event.target.value)} placeholder="What is included, assumptions, timing notes…" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="expert-action purple" disabled={saving} onClick={() => void submitQuote(opportunity.id)}>{saving ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Submit quote</button><button type="button" className="expert-action secondary" onClick={() => setQuoteId(null)}>Cancel</button></div></div> : <div className="mt-5"><div className={opportunity.status === "quoted" ? "mb-4 rounded-2xl border border-violet-200 bg-violet-500/10 p-4" : "hidden"}><p className="text-[.58rem] font-black uppercase tracking-[.14em] text-violet-700">Quote received by Heyy Studio</p><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Your quote has been sent successfully. Heyy Studio will review it and let you know if it is selected. You can update your quote while the project is still under review.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="expert-action purple" disabled={saving || profile.availability === "unavailable"} onClick={() => { setQuoteId(opportunity.id); setQuoteFee(opportunity.quotedFeeCents !== null ? String(opportunity.quotedFeeCents / 100) : ""); setQuoteDays(String(opportunity.turnaroundDays || 5)); setQuoteRevisions(String(opportunity.includedRevisions ?? 2)); setQuoteExtraRevisionFee(opportunity.extraRevisionFeeCents !== null ? String(opportunity.extraRevisionFeeCents / 100) : "50"); setQuoteNotes(opportunity.expertNotes || ""); }}>{opportunity.status === "quoted" ? "Update quote" : "Quote this project"}</button><button type="button" className="expert-action secondary" disabled={saving} onClick={() => void operationAction("decline_opportunity", { opportunityId: opportunity.id })}><X size={14} /> Decline</button></div></div>}
        </GlassCard>) : <EmptyPanel title="No open opportunities" body="When Heyy Studio shares a matching project with you, the private brief and quote action will appear here." />}
      </section>}

      {section === "projects" && <section className="mt-6 grid gap-4">
        <SectionHeading kicker="Assigned projects" title="Your controlled production workspace" copy="Keep the brief, messages, project files and client revisions separated so nothing gets lost." />
        {activeAssignments.length && selectedAssignment ? <GlassCard className="p-6">
          <div className="grid gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
            <div>
              <p className="text-[.56rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Assigned project</p>
              <div className="mt-2"><HeyySelect value={selectedAssignment.id} ariaLabel="Assigned project" options={activeAssignments.map((item) => ({ value: item.id, label: item.sharedScope.projectName || "Assigned project" }))} onChange={(value) => { setSelectedAssignmentId(value); syncPortalLocation("projects", value); }} /></div>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[.58rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">{prettyStatus(selectedAssignment.status)}</p><h3 className="mt-2 text-2xl font-black">{selectedAssignment.sharedScope.projectName || "Assigned project"}</h3><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{selectedAssignment.sharedScope.service || studioLabel(profile.studio)}</p></div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-black text-[var(--accent-strong)]">{money(selectedAssignment.agreedFeeCents, selectedAssignment.currency)}</span>
            </div>
          </div>

          <div className="expert-project-tabs" aria-label="Assigned project workspace">
            {([
              ["overview", "Overview", ""],
              ["messages", "Messages", String(selectedMessages.length)],
              ["files", "Project files", String(selectedPackageCount)],
              ["revisions", "Client revisions", String(selectedRevisions.length)],
            ] as Array<[ProjectPanel,string,string]>).map(([value,label,count]) => <button key={value} type="button" className="expert-project-tab" data-active={projectPanel === value ? "true" : "false"} onClick={() => syncProjectPanel(value)}><span>{label}</span>{count ? <span className="expert-project-tab-count">{count}</span> : null}</button>)}
          </div>

          {projectPanel === "overview" && <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Info label="Due" value={selectedAssignment.dueAt ? formatDate(selectedAssignment.dueAt) : "Not fixed"} /><Info label="Turnaround" value={selectedAssignment.turnaroundDays ? `${selectedAssignment.turnaroundDays} days` : "—"} /><Info label="Included revisions" value={String(selectedAssignment.includedRevisions ?? "—")} /><Info label="Your fee / extra revision" value={selectedAssignment.extraRevisionFeeCents !== null ? money(selectedAssignment.extraRevisionFeeCents, selectedAssignment.currency) : "—"} /><Info label="Payout" value={prettyStatus(selectedAssignment.payoutStatus)} /></div>
            {selectedAssignment.status === "completed" && <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-500/10 p-4"><p className="text-[.58rem] font-black uppercase tracking-[.14em] text-emerald-700">Project completed · client approved</p><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">The client approved the final package. No more project files are required unless Heyy Studio reopens the job. Your payout status is now <strong>{prettyStatus(selectedAssignment.payoutStatus)}</strong>.</p></div>}
            <SharedScopePack scope={selectedAssignment.sharedScope} profileStudio={profile.studio} title="Shared project scope" />
            {selectedAddons.length > 0 && <div className="mt-5 grid gap-3">
              {selectedAddons.map((addon) => <ExpertAdditionalScopeCard key={addon.id} addon={addon} saving={saving} onSubmit={async (input) => { const ok = await operationAction("submit_additional_scope_quote", { addonId: addon.id, ...input }); if (ok) { setNotice("Your additional-scope quote was sent to Heyy Studio for review."); window.setTimeout(() => setNotice(""), 5000); } return ok; }} />)}
            </div>}
            {selectedAssignment.status === "assigned" && <div className="mt-5"><button type="button" className="expert-action purple" disabled={saving} onClick={async () => { const ok = await operationAction("start_assignment", { assignmentId: selectedAssignment.id }); if (ok) { syncPortalLocation("projects", selectedAssignment.id); syncProjectPanel("files", selectedAssignment.id); setNotice("Project started. Heyy Studio has been notified. Open Project files to send your first package."); window.setTimeout(() => setNotice(""), 5000); } }}><Check size={14} /> Start project</button></div>}
          </div>}

          {projectPanel === "messages" && <div className="mt-5">
            <div className="grid max-h-[430px] gap-2 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">{selectedMessages.length ? selectedMessages.map((item) => <div key={item.id} className={`expert-message ${item.senderType === "expert" ? "expert" : "admin"}`}><div>{item.body}</div><div className="mt-1 text-[9px] font-bold opacity-65">{item.senderType === "expert" ? "You" : "Heyy Studio"} · {formatDate(item.createdAt)}</div></div>) : <p className="py-8 text-center text-xs font-bold text-[var(--text-muted)]">No messages in this project yet.</p>}</div>
            <div className="mt-3"><textarea className="expert-textarea" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask a project question or send an update to Heyy Studio…" /><button type="button" className="expert-action purple mt-2" disabled={!message.trim() || saving} onClick={async () => { const ok = await operationAction("send_message", { assignmentId: selectedAssignment.id, message }); if (ok) setMessage(""); }}><Send size={14} /> Send message</button></div>
          </div>}

          {projectPanel === "files" && <div className="mt-5"><ExpertDeliverableUploader assignmentId={selectedAssignment.id} submissions={selectedSubmissions} getAccessToken={token} onRefresh={loadOperations} onError={setError} readOnly={selectedAssignment.status === "completed"} /></div>}

          {projectPanel === "revisions" && <div className="mt-5 grid gap-3">
            {selectedRevisions.length ? [...selectedRevisions].sort((a,b) => b.revisionNumber - a.revisionNumber).map((revision) => <div key={revision.id} className="overflow-hidden rounded-2xl border border-violet-200 bg-[var(--surface)] shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-violet-100 bg-violet-500/5 p-4"><div><p className="text-[.56rem] font-black uppercase tracking-[.14em] text-[var(--accent-strong)]">Client revision #{revision.revisionNumber}</p><p className="mt-1 text-lg font-black">Changes forwarded by Heyy Studio</p></div><div className="text-right"><span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-[var(--accent-strong)]">{prettyStatus(revision.status)}</span><p className="mt-2 text-[10px] font-bold text-[var(--text-muted)]">Forwarded {revision.forwardedAt ? formatDate(revision.forwardedAt) : "—"}</p></div></div><div className="p-4"><div className="grid gap-3"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm"><p className="text-[.54rem] font-black uppercase tracking-[.12em] text-slate-500">Client request shared by Heyy Studio</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{revision.message || "No client message was shared for this revision."}</p></div><div className="rounded-xl border border-violet-200 bg-violet-500/5 p-4"><p className="text-[.54rem] font-black uppercase tracking-[.12em] text-[var(--accent-strong)]">Heyy Studio instructions</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[var(--text-secondary)]">{revision.adminResponse || "Follow the client request above and the targeted files below."}</p></div></div>{revision.targetFiles.length > 0 && <div className="mt-4"><p className="text-[.54rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Files to update</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{revision.targetFiles.map((file,index) => <div key={file.id || `${file.filename}-${index}`} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-black"><FileText size={14} className="text-[var(--accent-strong)]"/><span className="truncate">{file.filename || "Production file"}{file.version ? ` · v${file.version}` : ""}</span></div>)}</div></div>}{revision.clientAttachments?.length > 0 && <div className="mt-4"><p className="text-[.54rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Client attachments</p><div className="mt-2 flex flex-wrap gap-2">{revision.clientAttachments.map((attachment) => attachment.download_url ? <a key={attachment.id} className="expert-action secondary !min-h-9" href={attachment.download_url} target="_blank" rel="noreferrer"><Download size={13} /> {attachment.filename}</a> : <span key={attachment.id} className="rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-black">{attachment.filename}</span>)}</div></div>}<p className="mt-4 rounded-xl border border-amber-200 bg-amber-500/10 p-3 text-xs font-bold leading-5 text-amber-800">Prepare the requested changes, then send the updated files from <button type="button" className="font-black underline underline-offset-2" onClick={() => syncProjectPanel("files", selectedAssignment.id)}>Project files</button> as a new package.</p></div></div>) : <EmptyPanel title="No client revisions forwarded" body="When the client requests changes, Heyy Studio reviews the request first. Only revisions explicitly forwarded to you appear here." />}
          </div>}
        </GlassCard> : <EmptyPanel title="No assigned projects" body="A project appears here after the client pays and Heyy Studio activates the preferred Expert assignment." />}
      </section>}

      {section === "messages" && <section className="mt-6 grid gap-4">
        <SectionHeading kicker="Private communication" title="Expert ↔ Heyy Studio Admin" copy="This channel is internal. Direct Expert ↔ Client messaging is not enabled for the launch version." />
        {activeAssignments.length ? <GlassCard className="p-6"><div className="grid gap-5 lg:grid-cols-[280px_1fr]"><div><p className="text-[.56rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Project</p><div className="mt-2"><HeyySelect value={selectedAssignment?.id || ""} ariaLabel="Assigned project" options={activeAssignments.map((item) => ({ value: item.id, label: item.sharedScope.projectName || "Assigned project" }))} onChange={(value) => { syncPortalLocation("messages", value); void operationAction("mark_messages_read", { assignmentId: value }); }} /></div>{selectedAssignment && <div className="mt-4"><Info label="Status" value={prettyStatus(selectedAssignment.status)} /><div className="mt-2"><Info label="Due" value={selectedAssignment.dueAt ? formatDate(selectedAssignment.dueAt) : "Not fixed"} /></div></div>}</div><div><div className="grid max-h-[380px] gap-2 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">{selectedMessages.length ? selectedMessages.map((item) => <div key={item.id} className={`expert-message ${item.senderType === "expert" ? "expert" : "admin"}`}><div>{item.body}</div><div className="mt-1 text-[9px] font-bold opacity-65">{item.senderType === "expert" ? "You" : "Heyy Studio"} · {formatDate(item.createdAt)}</div></div>) : <p className="py-8 text-center text-xs font-bold text-[var(--text-muted)]">No messages in this project yet.</p>}</div><div className="mt-3"><textarea className="expert-textarea" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask a project question or send an update to Heyy Studio…" /><button type="button" className="expert-action purple mt-2" disabled={!message.trim() || saving || !selectedAssignment} onClick={async () => { if (!selectedAssignment) return; const ok = await operationAction("send_message", { assignmentId: selectedAssignment.id, message }); if (ok) setMessage(""); }}><Send size={14} /> Send message</button></div></div></div></GlassCard> : <EmptyPanel title="No project message channels" body="Internal messaging opens after you are assigned to a production project." />}
      </section>}

      {section === "payments" && <section className="mt-6 grid gap-4">
        <SectionHeading kicker="Expert payments" title="Agreed fees and payout status" copy="Expert payouts are paid manually by Heyy Studio at launch. When a client approves the final delivery, your payout becomes Ready for payout. After Admin sends the bank/Wise/PayPal payment and marks it Paid, the status updates here automatically." />
        <div className="rounded-2xl border border-violet-200 bg-violet-500/5 p-4 text-xs font-semibold leading-6 text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">How it works:</strong> Pending = project still in progress · Ready for payout = client approved and Heyy Studio can pay you · Paid = Admin recorded the off-platform payment and reference.</div>
        {operations.assignments.length ? <div className="grid gap-3">{operations.assignments.map((assignment) => {
          const paidAddons = operations.addons.filter((addon) => addon.assignmentId === assignment.id && addon.status === "paid" && Number(addon.expertCostCents || 0) > 0);
          const additionsTotal = paidAddons.reduce((sum, addon) => sum + Number(addon.expertCostCents || 0), 0);
          const baseFee = Math.max(0, Number(assignment.agreedFeeCents || 0) - additionsTotal);
          const statusLabel = assignment.payoutStatus === "eligible" ? "Ready for payout" : prettyStatus(assignment.payoutStatus);
          return <GlassCard key={assignment.id} className="p-5"><div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-lg font-black">{assignment.sharedScope.projectName || "Expert project"}</p><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{assignment.sharedScope.service || studioLabel(profile.studio)} · Assigned {formatDate(assignment.assignedAt)}</p></div><div className="text-left md:text-right"><p className="text-2xl font-black">{money(assignment.agreedFeeCents, assignment.currency)}</p><p className={`mt-1 text-[10px] font-black uppercase tracking-[.12em] ${assignment.payoutStatus === "paid" ? "text-emerald-700" : assignment.payoutStatus === "eligible" ? "text-violet-700" : "text-[var(--text-muted)]"}`}>{statusLabel}</p></div></div>{paidAddons.length > 0 && <div className="mt-4 grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs"><div className="flex justify-between gap-3"><span className="font-bold text-[var(--text-muted)]">Original agreed fee</span><strong>{money(baseFee, assignment.currency)}</strong></div>{paidAddons.map((addon) => <div key={addon.id} className="flex justify-between gap-3"><span className="font-bold text-[var(--text-muted)]">{addon.kind === "extra_revision" ? "Additional revision" : "Additional scope"}</span><strong>+ {money(Number(addon.expertCostCents || 0), addon.currency || assignment.currency)}</strong></div>)}</div>}{assignment.payoutStatus === "eligible" && <p className="mt-3 rounded-xl bg-violet-500/10 p-3 text-xs font-bold text-violet-700">Client approved ✓ Heyy Studio can now send your payout using the details saved in Expert profile.</p>}{assignment.payoutStatus === "paid" && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-500/10 p-3"><p className="text-xs font-bold text-emerald-700">Paid {assignment.paidAt ? formatDate(assignment.paidAt) : ""}{assignment.paymentReference ? ` · Ref: ${assignment.paymentReference}` : ""}</p><button type="button" className="expert-action secondary !min-h-9" onClick={() => void downloadExpertPayoutStatement(assignment.id)}><Download size={13}/> Payout statement</button></div>}</GlassCard>;
        })}</div> : <EmptyPanel title="No payments to track yet" body="Your agreed project fee appears here after Heyy Studio assigns a quoted project to you." />}
      </section>}

      {section === "profile" && <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="grid gap-5"><GlassCard className="p-6"><div className="flex items-center gap-3"><Sparkles className="text-[var(--accent-strong)]" size={20} /><h3 className="text-xl font-black">Expert profile</h3></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Role" value={profile.roleTitle || "Heyy Studio Expert"} /><Info label="Studio" value={studioLabel(profile.studio)} /><Info label="Location" value={profile.location || "Not added"} /><Info label="Time zone" value={profile.timezone || "Not added"} /><Info label="Experience" value={profile.yearsExperience !== null ? `${profile.yearsExperience} years` : "Not added"} /><Info label="Languages" value={profile.languages.join(", ") || "Not added"} /></div>{profile.specialties.length > 0 && <div className="mt-5"><p className="text-[.58rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Specialties</p><div className="mt-2 flex flex-wrap gap-2">{profile.specialties.map((item) => <span key={item} className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--accent-strong)]">{item}</span>)}</div></div>}</GlassCard><GlassCard className="p-6"><div className="flex items-center gap-3"><CircleDollarSign className="text-[var(--accent-strong)]" size={20} /><h3 className="text-xl font-black">Payout details</h3></div><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Heyy Studio uses these private details only to send manual Expert payouts. They are never shown to clients.</p><div className="mt-4"><p className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Preferred method</p><div className="mt-2"><HeyySelect value={payoutMethod} ariaLabel="Preferred payout method" options={[{ value: "", label: "Choose method" }, { value: "bank_transfer", label: "Bank transfer" }, { value: "wise", label: "Wise" }, { value: "paypal", label: "PayPal" }, { value: "other", label: "Other" }]} onChange={setPayoutMethod} disabled={saving} /></div></div><label className="mt-4 block"><span className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Payment details</span><textarea className="expert-textarea mt-2" value={payoutDetailsText} onChange={(event) => setPayoutDetailsText(event.target.value)} placeholder="Add the details needed for this method (for example account name + bank details, Wise email, or PayPal email)." /></label><button type="button" className="expert-action purple mt-3" disabled={saving || !payoutMethod || !payoutDetailsText.trim()} onClick={() => void savePayoutDetails()}>{saving ? <Loader2 className="animate-spin" size={14} /> : <CircleDollarSign size={14} />} Save payout details</button></GlassCard></div><GlassCard className="p-6"><Clock3 className="text-[var(--accent-strong)]" size={20} /><h3 className="mt-3 text-xl font-black">How Expert projects work</h3><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Opportunity → your quote → Heyy Studio preference → client payment → assigned project → private Admin communication → Expert project files → Admin review → client publishing → client approval or revision → payout tracking.</p></GlassCard></section>}
    </div>
  </PortalShell>;
}

function ExpertAdditionalScopeCard({ addon, saving, onSubmit }: { addon: ExpertAddon; saving: boolean; onSubmit: (input: { expertCostCents: number; turnaroundDays: number; notes: string }) => Promise<boolean> }) {
  const [fee, setFee] = useState(addon.expertCostCents ? (addon.expertCostCents / 100).toFixed(2) : "");
  const [days, setDays] = useState(String(addon.expertTurnaroundDays || 3));
  const [notes, setNotes] = useState(addon.expertNotes || "");
  const canQuote = ["awaiting_expert_quote", "expert_quoted"].includes(addon.status);

  return <div className="rounded-2xl border border-sky-200 bg-sky-500/5 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.56rem] font-black uppercase tracking-[.14em] text-sky-700">Additional project scope</p><p className="mt-1 text-base font-black">{addon.title || "Added work"}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-sky-700">{prettyStatus(addon.status)}</span></div>
    <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-[var(--text-secondary)]">{addon.description || "Heyy Studio requested pricing for additional work on this project."}</p>
    {canQuote && <div className="mt-4 grid gap-3 rounded-xl border border-sky-100 bg-[var(--surface)] p-4"><div className="grid gap-3 sm:grid-cols-2"><label><span className="text-[.54rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Your added fee ({String(addon.currency || "USD").toUpperCase()})</span><input className="expert-input mt-2" inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="0.00" /></label><label><span className="text-[.54rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Added turnaround</span><input className="expert-input mt-2" inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} placeholder="3" /></label></div><label><span className="text-[.54rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">What this added quote covers</span><textarea className="expert-textarea mt-2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Explain the additional deliverables, assumptions or timing." /></label><button type="button" className="expert-action purple w-fit" disabled={saving || !(Number(fee) >= 0) || !(Number(days) > 0) || !notes.trim()} onClick={() => void onSubmit({ expertCostCents: Math.round(Number(fee) * 100), turnaroundDays: Math.round(Number(days)), notes: notes.trim() })}>{saving ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} {addon.status === "expert_quoted" ? "Update added-scope quote" : "Send added-scope quote"}</button></div>}
    {addon.status === "sent" && <p className="mt-4 rounded-xl bg-violet-500/10 p-3 text-xs font-bold text-violet-700">Heyy Studio sent the additional scope to the client. Wait for payment before starting this added work.</p>}
    {addon.status === "paid" && <p className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-700">Additional scope paid and active ✓ The added fee is included in your Expert payout total.</p>}
  </div>;
}

function SharedScopePack({
  scope,
  profileStudio,
  title,
}: {
  scope: Record<string, any>;
  profileStudio: string;
  title: string;
}) {
  const items = Array.isArray(scope?.quotePack?.items) ? scope.quotePack.items : [];
  const visuals = Array.isArray(scope?.quotePack?.visuals) ? scope.quotePack.visuals : [];
  const [previewVisual, setPreviewVisual] = useState<any | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const key = String(item?.sectionTitle || "Project context");
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  }

  function referenceFilename(visual: any, index = 0) {
    const raw = String(visual?.title || visual?.label || `reference-${index + 1}`)
      .replace(/[^a-zA-Z0-9._ -]+/g, "-")
      .replace(/\s+/g, " ")
      .trim() || `reference-${index + 1}`;
    const url = String(visual?.url || "");
    const extension = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url)?.[1] || "jpg";
    return /\.[a-zA-Z0-9]{2,5}$/.test(raw) ? raw : `${raw}.${extension}`;
  }

  async function downloadReference(visual: any, index = 0) {
    const url = String(visual?.url || "");
    if (!url) return;
    const filename = referenceFilename(visual, index);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Reference download failed.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }

  async function downloadAllReferences() {
    if (downloadingAll) return;
    const references = visuals.length
      ? visuals
      : scope?.previewImage
        ? [{ url: scope.previewImage, title: "Project preview" }]
        : [];
    setDownloadingAll(true);
    try {
      const encoder = new TextEncoder();
      const escape = (value: unknown) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const sectionsHtml = Array.from(groups.entries()).map(([sectionTitle, sectionItems]) => `
        <section class="section"><h2>${escape(sectionTitle)}</h2><div class="rows">${sectionItems.map((item) => `<div class="row"><span>${escape(item?.label || "Project detail")}</span><strong>${escape(item?.value || "—")}</strong></div>`).join("")}</div></section>`).join("");
      const detailsHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(scope?.projectName || "Expert project")} — Heyy Studio Expert Pack</title><style>body{margin:0;background:#f6f4fa;color:#17131f;font-family:Arial,Helvetica,sans-serif}.page{max-width:920px;margin:36px auto;padding:0 20px}.hero{overflow:hidden;border:1px solid #e4def0;border-radius:26px;background:linear-gradient(135deg,#fff,#f2eaff);box-shadow:0 18px 50px rgba(55,30,83,.08)}.brand{padding:22px 28px;border-top:5px solid #8b5cf6;font-size:13px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#8b5cf6}.heroBody{padding:34px 28px;background:#17131f;color:white}.heroBody h1{margin:0;font-size:38px;line-height:1.05}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:22px 28px}.meta div,.brief,.section{border:1px solid #e7e2ec;border-radius:18px;background:#fff;padding:16px}.meta span,.row span{display:block;color:#857d91;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.meta strong{display:block;margin-top:6px;font-size:14px}.brief{margin:18px 0;padding:22px}.brief h2,.section h2{margin:0 0 12px;font-size:18px}.brief p{margin:0;white-space:pre-wrap;color:#5c5663;line-height:1.7}.section{margin:14px 0;padding:0;overflow:hidden}.section h2{padding:15px 18px;margin:0;background:#f7efff;color:#8b5cf6;font-size:12px;letter-spacing:.1em;text-transform:uppercase}.row{display:grid;grid-template-columns:minmax(150px,.35fr) 1fr;gap:18px;padding:14px 18px;border-top:1px solid #eeeaf2}.row strong{font-size:13px;line-height:1.6;white-space:pre-wrap}.foot{padding:20px 4px;color:#8d8695;font-size:11px}@media(max-width:650px){.meta{grid-template-columns:1fr}.row{grid-template-columns:1fr}.heroBody h1{font-size:30px}}</style></head><body><main class="page"><div class="hero"><div class="brand">Heyy Studio · Expert Project Pack</div><div class="heroBody"><h1>${escape(scope?.projectName || "Expert project")}</h1></div><div class="meta"><div><span>Service</span><strong>${escape(scope?.service || "Production")}</strong></div><div><span>Studio</span><strong>${escape(studioLabel(scope?.studio || profileStudio))}</strong></div><div><span>Requested deadline</span><strong>${escape(scope?.requestedDeadline || "Not fixed")}</strong></div></div></div><section class="brief"><h2>Project brief</h2><p>${escape(scope?.brief || "No additional brief was provided.")}</p></section>${sectionsHtml}<div class="foot">Create with AI. Build with Experts. · This pack contains only the project context Heyy Studio approved for Expert sharing.</div></main></body></html>`;

      const zipFiles: Array<{ name: string; data: ArrayBuffer | Uint8Array }> = [
        { name: "Project-Details.html", data: encoder.encode(detailsHtml) },
        { name: "README.txt", data: encoder.encode("Open Project-Details.html for the formatted Heyy Studio project brief. Reference files are inside the References folder.") },
      ];
      for (let index = 0; index < references.length; index += 1) {
        const visual = references[index];
        const url = String(visual?.url || "");
        if (!url) continue;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not download ${referenceFilename(visual, index)}.`);
        zipFiles.push({ name: `References/${referenceFilename(visual, index)}`, data: await response.arrayBuffer() });
      }

      const zip = createBrowserZip(zipFiles);
      const objectUrl = URL.createObjectURL(zip);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${String(scope?.projectName || "Heyy-Studio-Project").replace(/[^a-zA-Z0-9._ -]+/g, "-")}-Expert-Pack.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not prepare the Expert project ZIP.");
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="mt-5 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Requested deadline" value={scope?.requestedDeadline || "Not fixed"} />
        <Info label="Studio" value={studioLabel(scope?.studio || profileStudio)} />
        <Info label="Shared references" value={visuals.length ? `${visuals.length} visual${visuals.length === 1 ? "" : "s"}` : scope?.previewImage ? "1 visual" : "None"} />
      </div>

      {(items.length > 0 || visuals.length > 0) ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[.56rem] font-black uppercase tracking-[.14em] text-[var(--accent-strong)]">Shared by Heyy Studio</p>
              <h4 className="mt-1 text-lg font-black">{title}</h4>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-[var(--text-muted)]">{items.length} details · {visuals.length} visuals</span>
              {(items.length > 0 || visuals.length > 0 || scope?.previewImage) && <button type="button" className="expert-action secondary !min-h-9" disabled={downloadingAll} onClick={() => void downloadAllReferences()}>{downloadingAll ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />} Download project ZIP</button>}
            </div>
          </div>

          {Array.from(groups.entries()).map(([sectionTitle, sectionItems]) => (
            <div key={sectionTitle} className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{sectionTitle}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {sectionItems.map((item: any) => (
                  <div key={item.id || `${sectionTitle}-${item.label}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-[.54rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">{item.label || "Project detail"}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs font-bold leading-5 text-[var(--text-secondary)]">{item.value || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {visuals.length > 0 && (
            <div className="mt-4">
              <p className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Approved / selected references</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visuals.map((visual: any, index: number) => (
                  <div key={visual.id || visual.url} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                    <button type="button" className="block h-44 w-full bg-[var(--surface-muted)]" onClick={() => setPreviewVisual(visual)} aria-label={`Preview ${visual.title || "project reference"}`}>
                      <img src={visual.url} alt={visual.title || "Shared project reference"} className="h-full w-full object-contain" loading="lazy" />
                    </button>
                    <div className="p-3">
                      <p className="truncate text-xs font-black">{visual.title || "Project reference"}</p>
                      <p className="mt-1 truncate text-[10px] font-bold text-[var(--text-muted)]">{visual.type || "Visual reference"}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="expert-action secondary !min-h-9 flex-1" onClick={() => setPreviewVisual(visual)}><Eye size={13} /> Preview</button>
                        <button type="button" className="expert-action secondary !min-h-9 flex-1" onClick={() => void downloadReference(visual, index)}><Download size={13} /> Download</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-[var(--accent-strong)]/20 bg-[var(--accent-soft)] p-4">
            <p className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--accent-strong)]">Heyy Studio instructions</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-[var(--text-secondary)]">{scope?.brief || "No additional note was shared."}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[.56rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Shared production brief</p>
          {scope?.previewImage && <button type="button" className="mt-3 block w-full" onClick={() => setPreviewVisual({ url: scope.previewImage, title: "Approved project direction" })}><img src={scope.previewImage} alt="Approved project direction" className="max-h-72 w-full rounded-xl border border-[var(--border)] object-contain" /></button>}
          <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-[var(--text-secondary)]">{scope?.brief || "No additional brief was shared."}</p>
        </div>
      )}

      {previewVisual && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Project reference preview" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewVisual(null); }}><div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-[var(--surface)] shadow-2xl"><div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4"><div className="min-w-0"><p className="truncate text-sm font-black">{previewVisual.title || "Project reference"}</p><p className="mt-1 text-[10px] font-bold text-[var(--text-muted)]">{previewVisual.type || "Approved / selected reference"}</p></div><div className="flex gap-2"><button type="button" className="expert-action secondary !min-h-9" onClick={() => void downloadReference(previewVisual)}><Download size={13} /> Download</button><button type="button" className="expert-action secondary !min-h-9 !w-9 !px-0" aria-label="Close preview" onClick={() => setPreviewVisual(null)}><X size={15} /></button></div></div><div className="grid max-h-[calc(92vh-72px)] place-items-center overflow-auto bg-black/5 p-4"><img src={previewVisual.url} alt={previewVisual.title || "Project reference"} className="max-h-[calc(92vh-105px)] max-w-full object-contain" /></div></div></div>}
    </div>
  );
}


type UploadState = "queued" | "uploading" | "processing" | "error";

type QueuedDeliverable = {
  key: string;
  file: File;
  progress: number;
  status: UploadState;
  error?: string;
};

const MAX_EXPERT_FILE_SIZE = 75 * 1024 * 1024;
const MAX_EXPERT_BATCH_FILES = 25;

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function ExpertDeliverableUploader({
  assignmentId,
  submissions,
  getAccessToken,
  onRefresh,
  onError,
  readOnly = false,
}: {
  assignmentId: string;
  submissions: Submission[];
  getAccessToken: () => Promise<string>;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  readOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<QueuedDeliverable[]>([]);
  const [notes, setNotes] = useState("");
  const [draftBatchId, setDraftBatchId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function chooseFiles(files: FileList | null) {
    if (!files?.length) return;
    onError("");
    if (!draftBatchId) setDraftBatchId(crypto.randomUUID());
    const incoming = Array.from(files);
    const tooLarge = incoming.find((file) => file.size > MAX_EXPERT_FILE_SIZE);
    if (tooLarge) {
      onError(`${tooLarge.name} is larger than 75 MB. Choose a smaller file.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const empty = incoming.find((file) => file.size <= 0);
    if (empty) {
      onError(`${empty.name} is empty and cannot be uploaded.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setItems((current) => {
      const existing = new Set(current.map((item) => item.key));
      const additions = incoming
        .filter((file) => !existing.has(fileKey(file)))
        .map((file) => ({ key: fileKey(file), file, progress: 0, status: "queued" as const }));
      const next = [...current, ...additions];
      if (next.length > MAX_EXPERT_BATCH_FILES) {
        onError(`Choose up to ${MAX_EXPERT_BATCH_FILES} files in one upload batch.`);
        return next.slice(0, MAX_EXPERT_BATCH_FILES);
      }
      return next;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeQueued(key: string) {
    if (uploading) return;
    setItems((current) => current.filter((item) => item.key !== key));
  }

  async function uploadOne(file: File, accessToken: string, batchId: string, onProgress: (progress: number, processing?: boolean) => void) {
    return new Promise<void>((resolve, reject) => {
      const form = new FormData();
      form.append("assignmentId", assignmentId);
      form.append("batchId", batchId);
      form.append("file", file);
      form.append("notes", notes);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/expert/operations/upload");
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      };
      xhr.upload.onload = () => onProgress(100, true);
      xhr.onerror = () => reject(new Error("The upload connection was interrupted. Please retry."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.onload = () => {
        let result: any = {};
        try {
          result = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          result = {};
        }
        if (xhr.status >= 200 && xhr.status < 300 && result.success) {
          resolve();
          return;
        }
        reject(new Error(result.error || `Upload failed (${xhr.status || "network error"}).`));
      };
      xhr.send(form);
    });
  }

  async function uploadAll() {
    if (!items.length || uploading || readOnly) return;
    if (!notes.trim()) { onError("Add a submission note before sending this package to Heyy Studio."); return; }
    setUploading(true);
    onError("");
    const batchId = draftBatchId || crypto.randomUUID();
    if (!draftBatchId) setDraftBatchId(batchId);
    let hadError = false;
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
      const keys = items.filter((item) => item.status === "queued" || item.status === "error").map((item) => item.key);
      for (const key of keys) {
        const item = items.find((entry) => entry.key === key);
        if (!item) continue;
        setItems((current) => current.map((entry) => entry.key === key ? { ...entry, status: "uploading", progress: 0, error: undefined } : entry));
        try {
          await uploadOne(item.file, accessToken, batchId, (progress, processing) => {
            setItems((current) => current.map((entry) => entry.key === key ? { ...entry, progress, status: processing ? "processing" : "uploading" } : entry));
          });
          setItems((current) => current.filter((entry) => entry.key !== key));
        } catch (value) {
          hadError = true;
          const message = value instanceof Error ? value.message : "Upload failed.";
          setItems((current) => current.map((entry) => entry.key === key ? { ...entry, status: "error", error: message } : entry));
        }
      }
      if (!hadError) {
        const completeResponse = await fetch("/api/expert/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            action: "complete_submission_batch",
            assignmentId,
            batchId,
            note: notes.trim() || null,
          }),
        });
        const completePayload = await completeResponse.json();
        if (!completeResponse.ok || !completePayload.success) {
          throw new Error(completePayload.error || "The review package uploaded, but could not be submitted to Heyy Studio.");
        }
        setNotes("");
        setDraftBatchId(null);
      }
      await onRefresh();
    } catch (value) {
      hadError = true;
      onError(value instanceof Error ? value.message : "Deliverables could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }


  async function deleteSubmission(submission: Submission) {
    if (deletingId || submission.reviewedAt || submission.publishedAt || submission.status !== "submitted") return;
    if (!window.confirm(`Delete ${submission.filename}? This removes the Expert submission before Admin review.`)) return;
    setDeletingId(submission.id);
    onError("");
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/expert/operations/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ submissionId: submission.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Uploaded file could not be deleted.");
      await onRefresh();
    } catch (value) {
      onError(value instanceof Error ? value.message : "Uploaded file could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  const retryCount = items.filter((item) => item.status === "queued" || item.status === "error").length;
  const submissionBatches = Array.from(submissions.reduce((map, submission) => {
    const key = submission.batchId || submission.id;
    const current = map.get(key) || [];
    current.push(submission);
    map.set(key, current);
    return map;
  }, new Map<string, Submission[]>()).entries())
    .map(([batchId, files]) => ({
      batchId,
      sequence: Math.max(...files.map((file) => Number(file.batchSequence || 1))),
      files: [...files].sort((a, b) => a.filename.localeCompare(b.filename)),
      note: files.find((file) => file.notes)?.notes || null,
      submittedAt: files.map((file) => file.submittedAt).sort()[0],
    }))
    .sort((a, b) => b.sequence - a.sequence);

  return <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><FileUp size={17} className="text-[var(--accent-strong)]" /><h4 className="font-black">Project files & packages</h4></div><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">Choose the files for one package, add a required submission note, then send the package to Heyy Studio for review. The client cannot see anything until Heyy Studio publishes it.</p></div>
      {items.length > 0 && <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black text-[var(--accent-strong)]">{items.length} selected</span>}
    </div>

    {readOnly && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-500/10 p-3 text-xs font-bold leading-5 text-emerald-800">Client approved the final delivery. This project is complete, so new packages are closed unless Heyy Studio reopens the assignment.</div>}
    <input ref={inputRef} className="sr-only" type="file" multiple disabled={readOnly} onChange={(event) => chooseFiles(event.target.files)} />
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="expert-action secondary" disabled={uploading || readOnly} onClick={() => inputRef.current?.click()}><FileUp size={14} /> {items.length ? "Add more files" : "Choose files"}</button>
      {items.length > 0 && <button type="button" className="expert-action secondary" disabled={uploading || readOnly} onClick={() => { setItems([]); setDraftBatchId(null); }}><Trash2 size={14} /> Clear selection</button>}
    </div>

    {items.length > 0 && <div className="mt-4 grid gap-2">{items.map((item) => <div key={item.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><FileText size={16} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-black">{item.file.name}</p><button type="button" aria-label={`Remove ${item.file.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-red-600 disabled:opacity-40" disabled={uploading} onClick={() => removeQueued(item.key)}><X size={13} /></button></div><p className="mt-0.5 text-[10px] font-bold text-[var(--text-muted)]">{formatBytes(item.file.size)} · {item.status === "queued" ? "Ready" : item.status === "uploading" ? `Uploading ${item.progress}%` : item.status === "processing" ? "Upload sent · saving securely…" : "Upload failed"}</p></div></div>{item.status !== "queued" && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className={`h-full rounded-full transition-[width] duration-200 ${item.status === "error" ? "bg-red-500" : "bg-[var(--accent-strong)]"}`} style={{ width: `${item.status === "error" ? Math.max(item.progress, 8) : item.progress}%` }} /></div>}{item.error && <p className="mt-2 text-[10px] font-bold text-red-600">{item.error}</p>}</div>)}</div>}

    {!readOnly && <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><div><input className="expert-input" required value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Submission note to Heyy Studio *" /><p className="mt-1.5 text-[10px] font-bold text-[var(--text-muted)]">Required. Explain what is included in this package or what changed.</p></div><button type="button" className="expert-action purple" disabled={!retryCount || uploading || !notes.trim()} onClick={() => void uploadAll()}>{uploading ? <><Loader2 className="animate-spin" size={14} /> Sending package…</> : <><Send size={14} /> Send package</>}</button></div>}

    {submissionBatches.length > 0 && <div className="mt-5 border-t border-[var(--border)] pt-4"><div className="flex items-center justify-between gap-3"><p className="text-[.58rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Submitted to Heyy Studio</p><span className="text-[10px] font-bold text-[var(--text-muted)]">{submissionBatches.length} review package{submissionBatches.length === 1 ? "" : "s"}</span></div><div className="mt-3 grid gap-3">{submissionBatches.map((batch) => {
      const batchStatus = batch.files.every((file) => file.status === "published") ? "published" : batch.files.some((file) => file.status === "changes_requested") ? "changes_requested" : batch.files.some((file) => file.status === "approved") ? "approved" : "submitted";
      const adminNote = batch.files.find((file) => file.adminNotes)?.adminNotes || null;
      return <div key={batch.batchId} className="expert-package-card" data-status={batchStatus}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black">Review package #{batch.sequence}</p><p className="mt-1 text-[10px] font-bold text-[var(--text-muted)]">{prettyStatus(batchStatus)} · {batch.files.length} file{batch.files.length === 1 ? "" : "s"} · {formatDate(batch.submittedAt)}</p></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-[var(--accent-strong)]">Package #{batch.sequence}</span></div>{batch.note && <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3"><p className="text-[.54rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Your note to Heyy Studio</p><p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-[var(--text-secondary)]">{batch.note}</p></div>}{adminNote && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-500/10 p-3"><p className="text-[.54rem] font-black uppercase tracking-[.12em] text-amber-700">Heyy Studio feedback</p><p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-amber-800">{adminNote}</p></div>}<div className="mt-3 grid gap-2">{batch.files.map((submission) => { const canDelete = submission.status === "submitted" && !submission.reviewedAt && !submission.publishedAt; return <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"><div className="min-w-0"><p className="truncate text-xs font-black">{submission.filename} · v{submission.version}</p><p className="mt-1 text-[10px] font-bold text-[var(--text-muted)]">{prettyStatus(submission.status)} · {submission.fileSize ? formatBytes(submission.fileSize) : "Size unavailable"}</p></div><div className="flex flex-wrap gap-2">{submission.downloadUrl && <a className="expert-action secondary !min-h-9" href={submission.downloadUrl} target="_blank" rel="noreferrer"><Download size={13} /> Open</a>}{canDelete && <button type="button" className="expert-action secondary !min-h-9" disabled={deletingId === submission.id} onClick={() => void deleteSubmission(submission)}>{deletingId === submission.id ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />} Delete</button>}</div></div>; })}</div>{batchStatus === "changes_requested" && <p className="mt-3 text-xs font-bold text-amber-700">Changes were requested. Upload the next review package when the updated files are ready.</p>}{batchStatus === "published" && <p className="mt-3 text-xs font-bold text-emerald-700">This package has been published by Heyy Studio for client review.</p>}</div>;
    })}</div></div>}

  </div>;
}

function PortalShell({ children }: { children: ReactNode }) {
  return <div className="heyy-page min-h-screen bg-[var(--background)] text-[var(--text-primary)]"><SiteHeader /><main className="pt-[var(--header-height)]">{children}</main><SiteFooter /></div>;
}

function PortalCard({ icon, title, body, value, active, onClick }: { icon: ReactNode; title: string; body: string; value?: number; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-left"><GlassCard className={`h-full p-5 transition ${active ? "ring-2 ring-[var(--accent-strong)]" : "hover:-translate-y-0.5"}`}><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{icon}</span>{value !== undefined && <span className="grid min-h-8 min-w-8 place-items-center rounded-full border border-[var(--border)] px-2 text-xs font-black">{value}</span>}</div><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{body}</p></GlassCard></button>;
}

function SectionHeading({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return <div><p className="text-[.6rem] font-black uppercase tracking-[.18em] text-[var(--accent-strong)]">{kicker}</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em]">{title}</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">{copy}</p></div>;
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <GlassCard className="p-8 text-center"><BriefcaseBusiness className="mx-auto text-[var(--accent-strong)]" size={22} /><h3 className="mt-3 text-xl font-black">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-[var(--text-secondary)]">{body}</p></GlassCard>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}

async function downloadExpertPayoutStatement(assignmentId: string) {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    const response = await fetch(`/api/expert/payouts/${encodeURIComponent(assignmentId)}/statement`, { headers: { Authorization: `Bearer ${token}` } });
    const errorPayload = response.ok ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorPayload?.error || "Payout statement could not be downloaded.");
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "Heyy-Studio-Expert-Payout-Statement.pdf";
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Payout statement could not be downloaded.");
  }
}

function money(cents: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents || 0) / 100);
  } catch {
    return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;
  }
}

function prettyStatus(value: string) {
  return String(value || "—").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
