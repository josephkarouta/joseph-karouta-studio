"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  CircleGauge,
  ClipboardList,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Inbox,
  Layers3,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Palette,
  RefreshCw,
  Search,
  Settings,
  Sofa,
  Sparkles,
  Users,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";

import HeyySelect from "@/components/ui/heyy-select";
import {
  getStudioIdentity,
  normalizeStudioId,
} from "@/lib/studio/studio-identity";
import { VISIBLE_STUDIOS } from "@/lib/platform/platform-registry";

type AdminTab = "overview" | "requests" | "production" | "inbox";
type InboxCategory = "all" | "action" | "messages" | "website" | "experts";

const REQUESTS_PER_PAGE = 12;
const PRODUCTION_PER_PAGE = 15;
const INBOX_PER_PAGE = 12;

type Props = {
  requests: any[];
  quotes: any[];
  jobs: any[];
  revisions: any[];
  messages: any[];
  payments: any[];
  contacts: any[];
  applications: any[];
  expertOpportunities: any[];
  expertAssignments: any[];
  expertSubmissions: any[];
  initialTab?: AdminTab;
};

type AttentionItem = {
  id: string;
  title: string;
  description: string;
  eyebrow: string;
  href: string;
  action: string;
  icon: LucideIcon;
  tone: "purple" | "blue" | "orange" | "pink" | "amber" | "green";
  studio?: unknown;
  createdAt?: string | null;
};

const REQUEST_STATUSES = [
  "All",
  "Needs Pricing",
  "New",
  "Reviewing",
  "Quote Needed",
  "Quoted",
  "Converted",
  "Rejected",
];

const PRODUCTION_STATUSES = [
  "All",
  "Active Jobs",
  "Review Stages",
  "Delivered / Completed",
  "Waiting Assignment",
  "Assigned",
  "In Progress",
  "Ready For Review",
  "Client Reviewing",
  "Approved",
  "Delivered",
  "Completed",
];

const COMPLETE_JOB_STATUSES = new Set([
  "delivered",
  "approved",
  "completed",
  "cancelled",
]);

const TONE_STYLES = {
  purple: { accent: "#8b5cf6", soft: "#f4ecff", border: "#dcc8ff" },
  blue: { accent: "#1676e8", soft: "#eaf3ff", border: "#bdd8ff" },
  orange: { accent: "#d06b14", soft: "#fff2e6", border: "#ffd1a8" },
  pink: { accent: "#eb3d87", soft: "#fff0f7", border: "#ffc5df" },
  amber: { accent: "#b65a00", soft: "#fff6df", border: "#f4d18f" },
  green: { accent: "#087f5b", soft: "#e9fbf3", border: "#a8e7ce" },
} as const;

export default function AdminCommandCenter({
  requests,
  quotes,
  jobs,
  revisions,
  messages,
  payments,
  contacts,
  applications,
  expertOpportunities,
  expertAssignments,
  expertSubmissions,
  initialTab = "overview",
}: Props) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [isRefreshing, startRefresh] = useTransition();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [search, setSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("All");
  const [requestStudio, setRequestStudio] = useState("all");
  const [requestService, setRequestService] = useState("all");
  const [requestQuoteStatus, setRequestQuoteStatus] = useState("all");
  const [requestClient, setRequestClient] = useState("all");
  const [requestExpertState, setRequestExpertState] = useState("all");
  const [productionStatus, setProductionStatus] = useState("All");
  const [productionStudio, setProductionStudio] = useState("all");
  const [productionService, setProductionService] = useState("all");
  const [productionClient, setProductionClient] = useState("all");

  const quoteByRequest = useMemo(() => {
    const map = new Map<string, any>();
    quotes.forEach((quote) => {
      const requestId = String(quote.studio_request_id || "");
      if (!requestId) return;
      const current = map.get(requestId);
      const quoteDate = dateValue(quote.updated_at || quote.sent_at || quote.created_at);
      const currentDate = dateValue(current?.updated_at || current?.sent_at || current?.created_at);
      if (!current || quoteDate >= currentDate) map.set(requestId, quote);
    });
    return map;
  }, [quotes]);

  const expertOpportunityByRequest = useMemo(() => {
    const map = new Map<string, any>();
    const rank: Record<string, number> = { selected: 4, quoted: 3, requested: 2, closed: 1 };
    expertOpportunities.forEach((item) => {
      const requestId = String(item.studio_request_id || "");
      if (!requestId) return;
      const current = map.get(requestId);
      if (!current || (rank[String(item.status || "").toLowerCase()] || 0) > (rank[String(current.status || "").toLowerCase()] || 0)) {
        map.set(requestId, item);
      }
    });
    return map;
  }, [expertOpportunities]);

  const requestServiceOptions = useMemo(() => uniqueOptions(
    requests.map((request) => request.service || request.metadata?.service),
    "All services",
  ), [requests]);

  const requestClientOptions = useMemo(() => uniqueOptions(
    requests.map((request) =>
      request.client_email ||
      request.metadata?.client_email ||
      request.client_name ||
      request.metadata?.client_name,
    ),
    "All clients",
  ), [requests]);

  const quoteStatusOptions = useMemo(() => {
    const options = uniqueOptions(
      ["No quote", ...Array.from(quoteByRequest.values()).map((quote) => quote?.status || "Sent")],
      "All quote states",
    );
    return [
      options[0],
      { value: "__awaiting_payment__", label: "Awaiting payment" },
      ...options.slice(1),
    ];
  }, [quoteByRequest]);

  const requestExpertOptions = [
    { value: "all", label: "All Expert states" },
    { value: "__expert_sourcing__", label: "Expert sourcing" },
    { value: "requested", label: "Waiting quote" },
    { value: "quoted", label: "Quote ready" },
    { value: "selected", label: "Preferred selected" },
    { value: "none", label: "Not sourced" },
  ];

  const productionServiceOptions = useMemo(() => uniqueOptions(
    jobs.map((job) => job.service || job.service_id),
    "All services",
  ), [jobs]);

  const productionClientOptions = useMemo(() => uniqueOptions(
    jobs.map((job) => job.client_email || job.client_name || job.user_id),
    "All clients",
  ), [jobs]);

  const unreadMessageCounts = useMemo(() => {
    const map = new Map<string, number>();
    messages.forEach((message) => {
      if (
        String(message.sender_type || "").toLowerCase() !== "client" ||
        message.read_by_admin_at
      ) {
        return;
      }
      const jobId = String(message.production_job_id || "");
      if (!jobId) return;
      map.set(jobId, (map.get(jobId) || 0) + 1);
    });
    return map;
  }, [messages]);

  const revisionCounts = useMemo(() => {
    const map = new Map<string, number>();
    revisions.forEach((revision) => {
      if (String(revision.status || "").toLowerCase() !== "requested") return;
      const jobId = String(revision.production_job_id || "");
      if (!jobId) return;
      map.set(jobId, (map.get(jobId) || 0) + 1);
    });
    return map;
  }, [revisions]);

  const quoteNeeded = requests.filter((request) =>
    ["new", "reviewing", "quote needed"].includes(
      String(request.status || "New").toLowerCase(),
    ),
  );

  const openRequests = requests.filter((request) =>
    ["new", "reviewing", "quote needed", "quoted"].includes(
      String(request.status || "New").toLowerCase(),
    ),
  );

  const requestIdSet = new Set(requests.map((request) => String(request.id)));
  const awaitingPaymentQuotes = Array.from(quoteByRequest.values()).filter((quote) =>
    requestIdSet.has(String(quote.studio_request_id || "")) &&
    ["sent", "quoted", "pending", "awaiting payment"].includes(
      String(quote.status || "Sent").toLowerCase(),
    ),
  );

  const activeJobs = jobs.filter(
    (job) => !COMPLETE_JOB_STATUSES.has(String(job.status || "").toLowerCase()),
  );

  const requestedRevisions = revisions.filter(
    (revision) =>
      String(revision.status || "").toLowerCase() === "requested",
  );

  const unreadMessages = messages.filter(
    (message) =>
      String(message.sender_type || "").toLowerCase() === "client" &&
      !message.read_by_admin_at,
  );

  const newContacts = contacts.filter((item) =>
    ["new", "reviewing"].includes(String(item.status || "new").toLowerCase()),
  );

  const newApplications = applications.filter((item) =>
    ["new", "reviewing", "shortlisted"].includes(
      String(item.status || "new").toLowerCase(),
    ),
  );

  const expertQuotesWaiting = expertOpportunities.filter(
    (item) => String(item.status || "").toLowerCase() === "requested" && item.studio_request_id,
  );
  const expertQuotesReady = expertOpportunities.filter(
    (item) => String(item.status || "").toLowerCase() === "quoted" && item.studio_request_id,
  );
  const expertCostingRequestIds = new Set(
    expertOpportunities
      .filter((item) =>
        ["requested", "quoted", "selected"].includes(String(item.status || "").toLowerCase()) &&
        item.studio_request_id,
      )
      .map((item) => String(item.studio_request_id)),
  );
  const expertSubmissionsToReview = expertSubmissions.filter(
    (item) => String(item.status || "").toLowerCase() === "submitted",
  );
  const expertPayoutsDue = expertAssignments.filter(
    (item) => String(item.payout_status || "").toLowerCase() === "eligible",
  );
  const newRequestNotifications = requests.filter((request) =>
    ["new", "pending", "submitted"].includes(String(request.status || "new").toLowerCase()),
  );
  const adminInboxCount =
    newRequestNotifications.length +
    unreadMessages.length +
    requestedRevisions.length +
    newContacts.length +
    newApplications.length +
    expertQuotesReady.length +
    expertSubmissionsToReview.length +
    expertPayoutsDue.length;

  const attentionCount =
    jobs.filter((job) => (unreadMessageCounts.get(String(job.id)) || 0) > 0).length +
    requestedRevisions.length +
    quoteNeeded.length +
    expertQuotesReady.length +
    expertSubmissionsToReview.length +
    expertPayoutsDue.length +
    jobs.filter((job) =>
      ["ready for review", "client reviewing"].includes(String(job.status || "").toLowerCase()),
    ).length +
    newContacts.length;

  const paidPayments = payments.filter((payment) =>
    ["paid", "succeeded", "completed"].includes(
      String(payment.status || "").toLowerCase(),
    ),
  );
  const paidRevenue = paidPayments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0,
  );
  const currentMonthRevenue = paidPayments
    .filter((payment) => isCurrentMonth(payment.paid_at || payment.created_at))
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const outstandingQuoteValue = awaitingPaymentQuotes.reduce(
    (sum, quote) => sum + toNumber(quote.amount),
    0,
  );

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const unreadJobs = jobs
      .filter((job) => (unreadMessageCounts.get(String(job.id)) || 0) > 0)
      .map((job) => ({
        id: `message-${job.id}`,
        title: job.project_name || job.service || "Production conversation",
        description: `${unreadMessageCounts.get(String(job.id)) || 0} unread client message${
          (unreadMessageCounts.get(String(job.id)) || 0) === 1 ? "" : "s"
        } waiting for a reply.`,
        eyebrow: "Client message",
        href: `/admin/production/${job.id}?tab=Client`,
        action: "Open conversation",
        icon: MessageSquare,
        tone: "purple" as const,
        studio: job.studio || job.assigned_studio,
        createdAt: job.updated_at || job.created_at,
      }));

    const revisionItems = requestedRevisions.map((revision) => ({
      id: `revision-${revision.id}`,
      title: `Revision #${revision.revision_number || 1}`,
      description:
        revision.message || "A client revision request needs a studio response.",
      eyebrow: "Revision requested",
      href: `/admin/production/${revision.production_job_id}?tab=Expert&expertView=packages`,
      action: "Review revision",
      icon: FileCheck2,
      tone: "amber" as const,
      createdAt: revision.created_at,
    }));

    const requestItems = quoteNeeded.map((request) => ({
      id: `request-${request.id}`,
      title:
        request.project_name ||
        request.metadata?.project_name ||
        request.service ||
        "Production request",
      description:
        request.service ||
        request.metadata?.service ||
        "Review the scope and prepare a quote.",
      eyebrow: "Quote required",
      href: `/admin/studio-requests/${request.id}`,
      action: "Review request",
      icon: ClipboardList,
      tone: "blue" as const,
      studio: request.studio || request.metadata?.studio,
      createdAt: request.created_at,
    }));

    const reviewJobs = jobs
      .filter((job) =>
        ["ready for review", "client reviewing"].includes(
          String(job.status || "").toLowerCase(),
        ),
      )
      .map((job) => ({
        id: `review-${job.id}`,
        title: job.project_name || job.service || "Production review",
        description: "This job is at a review or approval stage.",
        eyebrow: "Review stage",
        href: `/admin/production/${job.id}?tab=Expert&expertView=packages`,
        action: "Open review",
        icon: CheckCircle2,
        tone: "green" as const,
        studio: job.studio || job.assigned_studio,
        createdAt: job.updated_at || job.created_at,
      }));

    const expertQuoteItems = expertQuotesReady
      .filter((item) => item.studio_request_id)
      .map((item) => ({
        id: `expert-quote-${item.id}`,
        title: item.shared_scope?.projectName || "Expert quote returned",
        description: "An Expert has returned fee, turnaround and revision terms. Compare the quote before pricing the client.",
        eyebrow: "Expert quote ready",
        href: `/admin/studio-requests/${item.studio_request_id}`,
        action: "Compare Expert quote",
        icon: CircleDollarSign,
        tone: "green" as const,
        studio: item.shared_scope?.studio,
        createdAt: item.quoted_at || item.updated_at || item.created_at,
      }));

    const expertSubmissionItems = expertSubmissionsToReview.map((item) => ({
      id: `expert-submission-${item.id}`,
      title: item.filename || "Expert submission",
      description: "An Expert deliverable is waiting for Heyy Studio review before anything is published to the client.",
      eyebrow: "Expert submission",
      href: `/admin/production/${item.production_job_id}?tab=Expert`,
      action: "Review submission",
      icon: FileCheck2,
      tone: "purple" as const,
      createdAt: item.submitted_at || item.created_at,
    }));

    const payoutItems = expertPayoutsDue.map((item) => ({
      id: `expert-payout-${item.id}`,
      title: item.shared_scope?.projectName || "Expert payout",
      description: "This Expert fee is marked eligible and needs manual payout tracking.",
      eyebrow: "Expert payout due",
      href: `/admin/production/${item.production_job_id}?tab=Expert`,
      action: "Open payout",
      icon: CircleDollarSign,
      tone: "amber" as const,
      createdAt: item.payout_eligible_at || item.updated_at || item.created_at,
    }));

    const contactItems = newContacts.slice(0, 3).map((item) => ({
      id: `contact-${item.id}`,
      title: item.name || item.email || "Contact submission",
      description: item.topic || truncate(item.message, 100) || "New contact form submission.",
      eyebrow: "Contact form",
      href: "/admin/platform/contact",
      action: "Open submissions",
      icon: Mail,
      tone: "pink" as const,
      createdAt: item.created_at,
    }));

    return [
      ...unreadJobs,
      ...revisionItems,
      ...requestItems,
      ...expertQuoteItems,
      ...expertSubmissionItems,
      ...payoutItems,
      ...reviewJobs,
      ...contactItems,
    ]
      .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
      .slice(0, 8);
  }, [
    jobs,
    newContacts,
    quoteNeeded,
    requestedRevisions,
    unreadMessageCounts,
    expertQuotesReady,
    expertSubmissionsToReview,
    expertPayoutsDue,
  ]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      const status = String(request.status || "New");
      const studioId = normalizeStudioId(
        request.studio || request.metadata?.studio,
      );
      const quote = quoteByRequest.get(String(request.id));
      const quoteStatus = String(quote?.status || "No quote");
      const serviceValue = String(request.service || request.metadata?.service || "").trim();
      const clientValue = String(
        request.client_email ||
        request.metadata?.client_email ||
        request.client_name ||
        request.metadata?.client_name ||
        "",
      ).trim();
      const haystack = [
        request.project_name,
        request.service,
        request.service_id,
        request.client_name,
        request.client_email,
        request.metadata?.project_name,
        request.metadata?.client_name,
        request.metadata?.client_email,
        quote?.title,
        quote?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const statusMatches = requestStatus === "All"
        || (requestStatus === "Needs Pricing"
          ? ["new", "reviewing", "quote needed"].includes(status.toLowerCase())
          : status === requestStatus);
      const quoteMatches = requestQuoteStatus === "all"
        || (requestQuoteStatus === "__awaiting_payment__"
          ? ["sent", "quoted", "pending", "awaiting payment"].includes(quoteStatus.toLowerCase())
          : quoteStatus === requestQuoteStatus);
      const expertOpportunity = expertOpportunityByRequest.get(String(request.id));
      const expertStatus = String(expertOpportunity?.status || "").toLowerCase();
      const expertMatches = requestExpertState === "all"
        || (requestExpertState === "__expert_sourcing__"
          ? expertCostingRequestIds.has(String(request.id))
          : requestExpertState === "none"
            ? !expertOpportunity
            : expertStatus === requestExpertState);

      return (
        statusMatches &&
        (requestStudio === "all" || studioId === requestStudio) &&
        (requestService === "all" || serviceValue === requestService) &&
        quoteMatches &&
        expertMatches &&
        (requestClient === "all" || clientValue === requestClient) &&
        (!term || haystack.includes(term))
      );
    });
  }, [
    expertCostingRequestIds,
    expertOpportunityByRequest,
    quoteByRequest,
    requestClient,
    requestExpertState,
    requestQuoteStatus,
    requestService,
    requests,
    requestStatus,
    requestStudio,
    search,
  ]);

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const status = String(job.status || "Waiting Assignment");
      const studioId = normalizeStudioId(job.studio || job.assigned_studio);
      const serviceValue = String(job.service || job.service_id || "").trim();
      const clientValue = String(job.client_email || job.client_name || job.user_id || "").trim();
      const haystack = [
        job.project_name,
        job.service,
        job.service_id,
        job.client_name,
        job.client_email,
        job.assigned_studio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const normalizedStatus = status.toLowerCase();
      const statusMatches = productionStatus === "All"
        || (productionStatus === "Active Jobs"
          ? !COMPLETE_JOB_STATUSES.has(normalizedStatus)
          : productionStatus === "Review Stages"
            ? ["ready for review", "client reviewing"].includes(normalizedStatus)
            : productionStatus === "Delivered / Completed"
              ? ["delivered", "approved", "completed"].includes(normalizedStatus)
              : normalizedStatus === productionStatus.toLowerCase());

      return (
        statusMatches &&
        (productionStudio === "all" || studioId === productionStudio) &&
        (productionService === "all" || serviceValue === productionService) &&
        (productionClient === "all" || clientValue === productionClient) &&
        (!term || haystack.includes(term))
      );
    });
  }, [
    jobs,
    productionClient,
    productionService,
    productionStatus,
    productionStudio,
    search,
  ]);

  function switchTab(tab: AdminTab) {
    setActiveTab(tab);
    setSearch("");
    const nextUrl = tab === "overview" ? "/admin" : `/admin?tab=${tab}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function openNeedsAttention() {
    window.requestAnimationFrame(() => {
      document.getElementById("needs-attention")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openRequestsToPrice() {
    setRequestStatus("Needs Pricing");
    setRequestStudio("all");
    setRequestService("all");
    setRequestQuoteStatus("all");
    setRequestClient("all");
    setRequestExpertState("all");
    switchTab("requests");
  }

  function openAwaitingPayment() {
    setRequestStatus("All");
    setRequestStudio("all");
    setRequestService("all");
    setRequestQuoteStatus("__awaiting_payment__");
    setRequestClient("all");
    setRequestExpertState("all");
    switchTab("requests");
  }

  function openActiveProduction() {
    setProductionStatus("Active Jobs");
    setProductionStudio("all");
    setProductionService("all");
    setProductionClient("all");
    switchTab("production");
  }

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Admin sign out failed:", error);
      setIsSigningOut(false);
    }
  }

  return (
    <main className="heyy-admin-root min-h-screen">
      <style>{ADMIN_STYLES}</style>

      <header className="heyy-admin-header">
        <div>
          <div className="heyy-admin-eyebrow">
            <Sparkles size={14} /> Heyy Studio Operations
          </div>
          <h1>Admin command center</h1>
          <p>
            Requests, quotes, payments, production, messages and submissions—using
            live platform data only.
          </p>
        </div>
        <div className="heyy-admin-header-actions">
          <button
            type="button"
            className="heyy-admin-button heyy-admin-button-secondary"
            onClick={refresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
          <Link href="/admin/platform" className="heyy-admin-button heyy-admin-button-secondary">
            <Settings size={16} /> Platform admin
          </Link>
          <Link href="/" className="heyy-admin-button heyy-admin-button-primary" target="_blank">
            View website <ExternalLink size={15} />
          </Link>
          <button
            type="button"
            className="heyy-admin-button heyy-admin-button-secondary"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
          >
            <LogOut size={16} /> {isSigningOut ? "Signing out" : "Sign out"}
          </button>
        </div>
      </header>

      <nav className="heyy-admin-tabs" aria-label="Admin sections">
        <AdminTabButton
          active={activeTab === "overview"}
          icon={LayoutDashboard}
          label="Overview"
          count={attentionCount}
          onClick={() => switchTab("overview")}
        />
        <AdminTabButton
          active={activeTab === "requests"}
          icon={ClipboardList}
          label="Requests & quotes"
          count={openRequests.length}
          onClick={() => switchTab("requests")}
        />
        <AdminTabButton
          active={activeTab === "production"}
          icon={Layers3}
          label="Production"
          count={activeJobs.length}
          onClick={() => switchTab("production")}
        />
        <AdminTabButton
          active={activeTab === "inbox"}
          icon={Inbox}
          label="Notifications & inbox"
          count={adminInboxCount}
          onClick={() => switchTab("inbox")}
        />
      </nav>

      <div className="heyy-admin-content" key={activeTab}>
        {activeTab === "overview" && (
          <OverviewPanel
            requests={requests}
            jobs={jobs}
            quotes={quotes}
            activeJobs={activeJobs}
            quoteNeeded={quoteNeeded}
            awaitingPaymentQuotes={awaitingPaymentQuotes}
            unreadMessages={unreadMessages}
            requestedRevisions={requestedRevisions}
            paidRevenue={paidRevenue}
            currentMonthRevenue={currentMonthRevenue}
            outstandingQuoteValue={outstandingQuoteValue}
            attentionItems={attentionItems}
            attentionCount={attentionCount}
            unreadMessageCounts={unreadMessageCounts}
            expertQuotesReady={expertQuotesReady}
            expertQuotesWaiting={expertQuotesWaiting}
            expertSubmissionsToReview={expertSubmissionsToReview}
            expertPayoutsDue={expertPayoutsDue}
            onNeedsAttention={openNeedsAttention}
            onRequestsToPrice={openRequestsToPrice}
            onAwaitingPayment={openAwaitingPayment}
            onActiveProduction={openActiveProduction}
          />
        )}

        {activeTab === "requests" && (
          <RequestsPanel
            requests={filteredRequests}
            quoteByRequest={quoteByRequest}
            search={search}
            setSearch={setSearch}
            status={requestStatus}
            setStatus={setRequestStatus}
            studio={requestStudio}
            setStudio={setRequestStudio}
            service={requestService}
            setService={setRequestService}
            serviceOptions={requestServiceOptions}
            quoteStatus={requestQuoteStatus}
            setQuoteStatus={setRequestQuoteStatus}
            quoteStatusOptions={quoteStatusOptions}
            expertState={requestExpertState}
            setExpertState={setRequestExpertState}
            expertOptions={requestExpertOptions}
            client={requestClient}
            setClient={setRequestClient}
            clientOptions={requestClientOptions}
            total={requests.length}
            expertCosting={expertCostingRequestIds.size}
            quoteNeeded={quoteNeeded.length}
            awaitingPayment={awaitingPaymentQuotes.length}
            expertOpportunityByRequest={expertOpportunityByRequest}
          />
        )}

        {activeTab === "production" && (
          <ProductionPanel
            jobs={filteredJobs}
            search={search}
            setSearch={setSearch}
            status={productionStatus}
            setStatus={setProductionStatus}
            studio={productionStudio}
            setStudio={setProductionStudio}
            service={productionService}
            setService={setProductionService}
            serviceOptions={productionServiceOptions}
            client={productionClient}
            setClient={setProductionClient}
            clientOptions={productionClientOptions}
            total={jobs.length}
            active={activeJobs.length}
            reviewCount={jobs.filter((job) => ["ready for review", "client reviewing"].includes(String(job.status || "").toLowerCase())).length}
            deliveredCount={jobs.filter((job) => ["delivered", "completed", "approved"].includes(String(job.status || "").toLowerCase())).length}
            unreadMessageCounts={unreadMessageCounts}
            revisionCounts={revisionCounts}
          />
        )}

        {activeTab === "inbox" && (
          <InboxPanel
            requests={requests}
            jobs={jobs}
            unreadMessageCounts={unreadMessageCounts}
            contacts={contacts}
            applications={applications}
            revisions={revisions}
            expertOpportunities={expertOpportunities}
            expertAssignments={expertAssignments}
            expertSubmissions={expertSubmissions}
          />
        )}
      </div>
    </main>
  );
}

function OverviewPanel({
  requests,
  jobs,
  quotes,
  activeJobs,
  quoteNeeded,
  awaitingPaymentQuotes,
  unreadMessages,
  requestedRevisions,
  paidRevenue,
  currentMonthRevenue,
  outstandingQuoteValue,
  attentionItems,
  attentionCount,
  unreadMessageCounts,
  expertQuotesReady,
  expertQuotesWaiting,
  expertSubmissionsToReview,
  expertPayoutsDue,
  onNeedsAttention,
  onRequestsToPrice,
  onAwaitingPayment,
  onActiveProduction,
}: {
  requests: any[];
  jobs: any[];
  quotes: any[];
  activeJobs: any[];
  quoteNeeded: any[];
  awaitingPaymentQuotes: any[];
  unreadMessages: any[];
  requestedRevisions: any[];
  paidRevenue: number;
  currentMonthRevenue: number;
  outstandingQuoteValue: number;
  attentionItems: AttentionItem[];
  attentionCount: number;
  unreadMessageCounts: Map<string, number>;
  expertQuotesReady: any[];
  expertQuotesWaiting: any[];
  expertSubmissionsToReview: any[];
  expertPayoutsDue: any[];
  onNeedsAttention: () => void;
  onRequestsToPrice: () => void;
  onAwaitingPayment: () => void;
  onActiveProduction: () => void;
}) {
  const studioWorkload = VISIBLE_STUDIOS.map((studio) => ({
    ...studio,
    requests: requests.filter(
      (request) =>
        normalizeStudioId(request.studio || request.metadata?.studio) === studio.id,
    ).length,
    activeJobs: activeJobs.filter(
      (job) => normalizeStudioId(job.studio || job.assigned_studio) === studio.id,
    ).length,
  }));

  const pipeline = [
    { label: "Client requests", value: requests.length, icon: ClipboardList },
    { label: "Expert quotes returned", value: expertQuotesReady.length, icon: CircleDollarSign },
    { label: "Client quotes sent", value: quotes.length, icon: CreditCard },
    { label: "Active production", value: activeJobs.length, icon: Layers3 },
    { label: "Expert submissions to review", value: expertSubmissionsToReview.length, icon: FileCheck2 },
    {
      label: "Delivered",
      value: jobs.filter((job) =>
        ["delivered", "completed", "approved"].includes(
          String(job.status || "").toLowerCase(),
        ),
      ).length,
      icon: CheckCircle2,
    },
  ];
  const maxPipeline = Math.max(...pipeline.map((item) => item.value), 1);

  return (
    <div className="heyy-admin-stack">
      <section className="heyy-admin-metrics four compact">
        <MetricCard
          icon={AlertCircle}
          label="Needs attention"
          value={attentionCount}
          note="Live actions that need an Admin decision"
          tone="purple"
          onClick={onNeedsAttention}
          actionLabel="Show priority actions"
        />
        <MetricCard
          icon={ClipboardList}
          label="Requests to price"
          value={quoteNeeded.length}
          note={`${expertQuotesReady.length} Expert quote${expertQuotesReady.length === 1 ? "" : "s"} ready`}
          tone="blue"
          onClick={onRequestsToPrice}
          actionLabel="Show requests that need pricing"
        />
        <MetricCard
          icon={Clock3}
          label="Awaiting payment"
          value={awaitingPaymentQuotes.length}
          note={`${formatMoney(outstandingQuoteValue)} outstanding`}
          tone="amber"
          onClick={onAwaitingPayment}
          actionLabel="Show requests awaiting payment"
        />
        <MetricCard
          icon={Layers3}
          label="Active production"
          value={activeJobs.length}
          note={`${unreadMessages.length} messages · ${requestedRevisions.length} revisions`}
          tone="green"
          onClick={onActiveProduction}
          actionLabel="Show active production jobs"
        />
      </section>

      <section className="heyy-admin-two-column">
        <Panel
          sectionId="needs-attention"
          eyebrow="Operational queues"
          title="Needs your attention"
          description={attentionCount > attentionItems.length
            ? `Showing the top ${attentionItems.length} of ${attentionCount} live actions that need a decision.`
            : "Only actions tied to live requests, production and submissions appear here."}
          action={<Link href="/admin?tab=inbox">View all notifications <ArrowRight size={14} /></Link>}
        >
          <div className="heyy-attention-list">
            {attentionItems.length ? (
              attentionItems.map((item) => <AttentionRow key={item.id} item={item} />)
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing urgent"
                description="There are no unread messages, pending quotes or revision requests right now."
              />
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Workflow health"
          title="Production pipeline"
          description="A live overview from request through delivery."
        >
          <div className="heyy-pipeline-list">
            {pipeline.map((item) => {
              const Icon = item.icon;
              return (
                <div className="heyy-pipeline-row" key={item.label}>
                  <div className="heyy-pipeline-label">
                    <span><Icon size={16} /></span>
                    <strong>{item.label}</strong>
                    <b>{item.value}</b>
                  </div>
                  <div className="heyy-pipeline-track">
                    <span style={{ width: `${Math.max(8, (item.value / maxPipeline) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="heyy-admin-inline-actions">
            <Link href="/admin?tab=production" className="heyy-admin-link-button">
              Open production queue <ArrowRight size={15} />
            </Link>
            <Link href="/admin/platform/generations" className="heyy-admin-link-button muted">
              AI generations
            </Link>
          </div>
        </Panel>
      </section>

      <Panel
        eyebrow="Studio workload"
        title="Live work by specialist Studio"
        description="The four public Studios use the same operational system while keeping their own identity."
      >
        <div className="heyy-studio-grid">
          {studioWorkload.map((studio) => (
            <div
              className="heyy-studio-workload"
              key={studio.id}
              style={
                {
                  "--studio-accent": studio.accent,
                  "--studio-soft": studio.soft,
                  "--studio-border": studio.border,
                } as CSSProperties
              }
            >
              <StudioGlyph studio={studio.id} />
              <div>
                <strong>{studio.label}</strong>
                <span className="heyy-studio-meta">{studio.requests} total requests</span>
              </div>
              <div className="heyy-studio-count">
                <b>{studio.activeJobs}</b>
                <span>active</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <section className="heyy-admin-two-column">
        <Panel
          eyebrow="Recent production"
          title="Latest active jobs"
          description="Open the project workspace directly from the queue."
        >
          <div className="heyy-compact-list">
            {activeJobs.slice(0, 5).map((job) => (
              <ProductionRow
                key={job.id}
                job={job}
                unread={unreadMessageCounts.get(String(job.id)) || 0}
                revisions={0}
              />
            ))}
            {!activeJobs.length && (
              <EmptyState
                icon={Layers3}
                title="No active production"
                description="Paid production jobs will appear here automatically."
              />
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Platform administration"
          title="Manage the business website"
          description="Direct access to the real public content and operational records."
        >
          <div className="heyy-quick-grid">
            <QuickLink href="/admin/platform/clients" icon={Users} title="Client history" note="Projects, quotes and revenue" />
            <QuickLink href="/admin/platform/users" icon={Users} title="Users" note="Accounts and plans" />
            <QuickLink href="/admin/platform/contact" icon={Mail} title="Contact" note="Website enquiries" />
            <QuickLink href="/admin/platform/careers" icon={BriefcaseBusiness} title="Expert roles" note="Published opportunities" />
            <QuickLink href="/admin/platform/applications" icon={BriefcaseBusiness} title="Expert applications" note="Candidates, portfolios and CVs" />
            <QuickLink href="/admin/platform/pages" icon={Palette} title="Public pages" note="Policies and content" />
            <QuickLink href="/admin/platform/help" icon={BellRing} title="Help centre" note="Support articles" />
            <QuickLink href="/admin/platform/generations" icon={WandSparkles} title="Generations" note="AI job monitoring" />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function RequestsPanel({
  requests,
  quoteByRequest,
  search,
  setSearch,
  status,
  setStatus,
  studio,
  setStudio,
  service,
  setService,
  serviceOptions,
  quoteStatus,
  setQuoteStatus,
  quoteStatusOptions,
  expertState,
  setExpertState,
  expertOptions,
  client,
  setClient,
  clientOptions,
  total,
  expertCosting,
  quoteNeeded,
  awaitingPayment,
  expertOpportunityByRequest,
}: {
  requests: any[];
  quoteByRequest: Map<string, any>;
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  studio: string;
  setStudio: (value: string) => void;
  service: string;
  setService: (value: string) => void;
  serviceOptions: Array<{ value: string; label: string }>;
  quoteStatus: string;
  setQuoteStatus: (value: string) => void;
  quoteStatusOptions: Array<{ value: string; label: string }>;
  expertState: string;
  setExpertState: (value: string) => void;
  expertOptions: Array<{ value: string; label: string }>;
  client: string;
  setClient: (value: string) => void;
  clientOptions: Array<{ value: string; label: string }>;
  total: number;
  expertCosting: number;
  quoteNeeded: number;
  awaitingPayment: number;
  expertOpportunityByRequest: Map<string, any>;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, status, studio, service, quoteStatus, expertState, client]);

  const sortedRequests = useMemo(
    () => [...requests].sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at)),
    [requests],
  );
  const totalPages = Math.max(1, Math.ceil(sortedRequests.length / REQUESTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRequests = sortedRequests.slice(
    (safePage - 1) * REQUESTS_PER_PAGE,
    safePage * REQUESTS_PER_PAGE,
  );

  return (
    <div className="heyy-admin-stack">
      <section className="heyy-admin-metrics four compact">
        <MetricCard icon={ClipboardList} label="All requests" value={total} note="Across every Studio" tone="purple" onClick={() => { setStatus("All"); setStudio("all"); setService("all"); setQuoteStatus("all"); setExpertState("all"); setClient("all"); setSearch(""); }} actionLabel="Show all requests" />
        <MetricCard icon={AlertCircle} label="Needs pricing" value={quoteNeeded} note="Admin review or quote required" tone="blue" onClick={() => { setStatus("Needs Pricing"); setStudio("all"); setService("all"); setQuoteStatus("all"); setExpertState("all"); setClient("all"); setSearch(""); }} actionLabel="Show requests needing pricing" />
        <MetricCard icon={CircleDollarSign} label="Expert sourcing" value={expertCosting} note="Private Expert costing in progress" tone="amber" onClick={() => { setStatus("All"); setStudio("all"); setService("all"); setQuoteStatus("all"); setExpertState("__expert_sourcing__"); setClient("all"); setSearch(""); }} actionLabel="Show requests in Expert sourcing" />
        <MetricCard icon={CreditCard} label="Awaiting payment" value={awaitingPayment} note="Client quote sent" tone="green" onClick={() => { setStatus("All"); setStudio("all"); setService("all"); setQuoteStatus("__awaiting_payment__"); setExpertState("all"); setClient("all"); setSearch(""); }} actionLabel="Show requests awaiting payment" />
      </section>

      <Panel
        eyebrow="Commercial workflow"
        title="Requests & quotes"
        description="A scalable queue for every request. Filter first, then open only the project you need."
      >
        <AdminToolbar
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          statuses={REQUEST_STATUSES}
          studio={studio}
          setStudio={setStudio}
          placeholder="Search project, client or service…"
        >
          <AdminFilter value={service} options={serviceOptions} onChange={setService} label="Filter requests by service" />
          <AdminFilter value={quoteStatus} options={quoteStatusOptions} onChange={setQuoteStatus} label="Filter requests by quote state" />
          <AdminFilter value={expertState} options={expertOptions} onChange={setExpertState} label="Filter requests by Expert state" />
          <AdminFilter value={client} options={clientOptions} onChange={setClient} label="Filter requests by client" />
        </AdminToolbar>

        <QueueHeader
          shown={pageRequests.length}
          total={sortedRequests.length}
          page={safePage}
          pageSize={REQUESTS_PER_PAGE}
          noun="requests"
        />

        {pageRequests.length ? (
          <div className="heyy-admin-table-wrap">
            <div className="heyy-admin-table heyy-requests-table">
              <div className="heyy-admin-table-head">
                <span>Project</span>
                <span>Client</span>
                <span>Studio</span>
                <span>Status</span>
                <span>Quote</span>
                <span>Expert</span>
                <span>Requested</span>
                <span />
              </div>
              {pageRequests.map((request) => (
                <RequestTableRow
                  key={request.id}
                  request={request}
                  quote={quoteByRequest.get(String(request.id))}
                  expertOpportunity={expertOpportunityByRequest.get(String(request.id))}
                />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="No matching requests"
            description="Try another search, Studio or status filter."
          />
        )}

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </Panel>
    </div>
  );
}

function ProductionPanel({
  jobs,
  search,
  setSearch,
  status,
  setStatus,
  studio,
  setStudio,
  service,
  setService,
  serviceOptions,
  client,
  setClient,
  clientOptions,
  total,
  active,
  reviewCount,
  deliveredCount,
  unreadMessageCounts,
  revisionCounts,
}: {
  jobs: any[];
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  studio: string;
  setStudio: (value: string) => void;
  service: string;
  setService: (value: string) => void;
  serviceOptions: Array<{ value: string; label: string }>;
  client: string;
  setClient: (value: string) => void;
  clientOptions: Array<{ value: string; label: string }>;
  total: number;
  active: number;
  reviewCount: number;
  deliveredCount: number;
  unreadMessageCounts: Map<string, number>;
  revisionCounts: Map<string, number>;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, status, studio, service, client]);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => dateValue(b.updated_at || b.created_at) - dateValue(a.updated_at || a.created_at)),
    [jobs],
  );
  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / PRODUCTION_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageJobs = sortedJobs.slice(
    (safePage - 1) * PRODUCTION_PER_PAGE,
    safePage * PRODUCTION_PER_PAGE,
  );

  return (
    <div className="heyy-admin-stack">
      <section className="heyy-admin-metrics four compact">
        <MetricCard icon={Layers3} label="All production" value={total} note="Paid operational jobs" tone="purple" onClick={() => { setStatus("All"); setStudio("all"); setService("all"); setClient("all"); setSearch(""); }} actionLabel="Show all production jobs" />
        <MetricCard icon={CircleGauge} label="Active jobs" value={active} note="Currently in production" tone="blue" onClick={() => { setStatus("Active Jobs"); setStudio("all"); setService("all"); setClient("all"); setSearch(""); }} actionLabel="Show active production jobs" />
        <MetricCard icon={FileCheck2} label="Review stages" value={reviewCount} note="Needs review or approval" tone="amber" onClick={() => { setStatus("Review Stages"); setStudio("all"); setService("all"); setClient("all"); setSearch(""); }} actionLabel="Show production jobs in review" />
        <MetricCard icon={CheckCircle2} label="Delivered" value={deliveredCount} note="Approved or completed" tone="green" onClick={() => { setStatus("Delivered / Completed"); setStudio("all"); setService("all"); setClient("all"); setSearch(""); }} actionLabel="Show delivered production jobs" />
      </section>

      <Panel
        eyebrow="Operations"
        title="Production queue"
        description="A paginated operational queue for jobs, messages, revisions and delivery."
      >
        <AdminToolbar
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          statuses={PRODUCTION_STATUSES}
          studio={studio}
          setStudio={setStudio}
          placeholder="Search project, client or service…"
        >
          <AdminFilter value={service} options={serviceOptions} onChange={setService} label="Filter production by service" />
          <AdminFilter value={client} options={clientOptions} onChange={setClient} label="Filter production by client" />
        </AdminToolbar>

        <QueueHeader
          shown={pageJobs.length}
          total={sortedJobs.length}
          page={safePage}
          pageSize={PRODUCTION_PER_PAGE}
          noun="jobs"
        />

        {pageJobs.length ? (
          <div className="heyy-admin-table-wrap">
            <div className="heyy-admin-table heyy-production-table">
              <div className="heyy-admin-table-head">
                <span>Project</span>
                <span>Client</span>
                <span>Studio</span>
                <span>Status</span>
                <span>Activity</span>
                <span>Updated</span>
                <span />
              </div>
              {pageJobs.map((job) => (
                <ProductionTableRow
                  key={job.id}
                  job={job}
                  unread={unreadMessageCounts.get(String(job.id)) || 0}
                  revisions={revisionCounts.get(String(job.id)) || 0}
                />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="No matching production jobs"
            description="Try another search, Studio or status filter."
          />
        )}

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </Panel>
    </div>
  );
}

function InboxPanel({
  requests,
  jobs,
  unreadMessageCounts,
  contacts,
  applications,
  revisions,
  expertOpportunities,
  expertAssignments,
  expertSubmissions,
}: {
  requests: any[];
  jobs: any[];
  unreadMessageCounts: Map<string, number>;
  contacts: any[];
  applications: any[];
  revisions: any[];
  expertOpportunities: any[];
  expertAssignments: any[];
  expertSubmissions: any[];
}) {
  const [category, setCategory] = useState<InboxCategory>("all");
  const [page, setPage] = useState(1);

  const newRequests = requests.filter((request) =>
    ["new", "pending", "submitted"].includes(String(request.status || "new").toLowerCase()),
  );
  const messageJobs = jobs.filter(
    (job) => (unreadMessageCounts.get(String(job.id)) || 0) > 0,
  );
  const newContacts = contacts.filter((item) =>
    ["new", "reviewing"].includes(String(item.status || "new").toLowerCase()),
  );
  const newApplications = applications.filter((item) =>
    ["new", "reviewing", "shortlisted"].includes(String(item.status || "new").toLowerCase()),
  );
  const requestedRevisions = revisions.filter(
    (item) => String(item.status || "").toLowerCase() === "requested",
  );
  const expertQuotesReady = expertOpportunities.filter(
    (item) => String(item.status || "").toLowerCase() === "quoted" && item.studio_request_id,
  );
  const expertPayoutsDue = expertAssignments.filter(
    (item) => String(item.payout_status || "").toLowerCase() === "eligible",
  );
  const expertSubmissionsToReview = expertSubmissions.filter(
    (item) => String(item.status || "").toLowerCase() === "submitted",
  );

  const inboxItems = useMemo(() => {
    const items: Array<{
      id: string;
      category: Exclude<InboxCategory, "all">;
      eyebrow: string;
      title: string;
      description: string;
      status: string;
      href: string;
      icon: LucideIcon;
      tone: keyof typeof TONE_STYLES;
      createdAt?: string | null;
    }> = [];

    newRequests.forEach((request) => {
      items.push({
        id: `request-${request.id}`,
        category: "action",
        eyebrow: "New production request",
        title: request.project_name || request.projectName || request.service || "Production request",
        description: request.service || request.production_type || request.studio || "Studio production",
        status: "Review",
        href: `/admin/studio-requests/${request.id}`,
        icon: ClipboardList,
        tone: "blue",
        createdAt: request.created_at,
      });
    });

    messageJobs.forEach((job) => {
      const unread = unreadMessageCounts.get(String(job.id)) || 0;
      items.push({
        id: `message-${job.id}`,
        category: "messages",
        eyebrow: "Client message",
        title: job.project_name || job.service || "Production conversation",
        description: `${unread} unread client message${unread === 1 ? "" : "s"} waiting for a reply.`,
        status: "Reply",
        href: `/admin/production/${job.id}?tab=Client`,
        icon: MessageSquare,
        tone: "purple",
        createdAt: job.updated_at || job.created_at,
      });
    });

    requestedRevisions.forEach((revision) => {
      items.push({
        id: `revision-${revision.id}`,
        category: "action",
        eyebrow: "Revision requested",
        title: `Revision #${revision.revision_number || 1}`,
        description: revision.message || "A client revision request needs review.",
        status: "Review",
        href: `/admin/production/${revision.production_job_id}?tab=Expert&expertView=packages`,
        icon: FileCheck2,
        tone: "amber",
        createdAt: revision.created_at,
      });
    });

    expertQuotesReady.forEach((item) => {
      items.push({
        id: `expert-quote-${item.id}`,
        category: "experts",
        eyebrow: "Expert quote ready",
        title: item.shared_scope?.projectName || "Expert quote returned",
        description: "Fee, turnaround and revision terms are ready for Admin review.",
        status: "Compare",
        href: `/admin/studio-requests/${item.studio_request_id}`,
        icon: CircleDollarSign,
        tone: "green",
        createdAt: item.quoted_at || item.updated_at || item.created_at,
      });
    });

    expertSubmissionsToReview.forEach((item) => {
      items.push({
        id: `expert-submission-${item.id}`,
        category: "experts",
        eyebrow: "Expert submission",
        title: item.filename || "Expert deliverable",
        description: "A deliverable is waiting for Heyy Studio review before client release.",
        status: "Review",
        href: `/admin/production/${item.production_job_id}?tab=Expert`,
        icon: FileCheck2,
        tone: "purple",
        createdAt: item.submitted_at || item.created_at,
      });
    });

    expertPayoutsDue.forEach((item) => {
      items.push({
        id: `expert-payout-${item.id}`,
        category: "experts",
        eyebrow: "Expert payout due",
        title: item.shared_scope?.projectName || "Expert payout",
        description: "This Expert fee is eligible and needs manual payout tracking.",
        status: "Open",
        href: `/admin/production/${item.production_job_id}?tab=Expert`,
        icon: CircleDollarSign,
        tone: "amber",
        createdAt: item.payout_eligible_at || item.updated_at || item.created_at,
      });
    });

    newContacts.forEach((item) => {
      items.push({
        id: `contact-${item.id}`,
        category: "website",
        eyebrow: "Website contact",
        title: item.name || item.email || "Contact submission",
        description: item.topic || truncate(item.message, 110) || "New website enquiry.",
        status: String(item.status || "New"),
        href: "/admin/platform/contact",
        icon: Mail,
        tone: "pink",
        createdAt: item.created_at,
      });
    });

    newApplications.forEach((item) => {
      items.push({
        id: `application-${item.id}`,
        category: "experts",
        eyebrow: "Expert Network application",
        title: item.name || item.email || "Expert applicant",
        description: item.location || item.portfolio_url || "Candidate application",
        status: String(item.status || "New"),
        href: `/admin/platform/applications?application=${encodeURIComponent(String(item.id || ""))}`,
        icon: BriefcaseBusiness,
        tone: "purple",
        createdAt: item.created_at,
      });
    });

    return items.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
  }, [
    expertPayoutsDue,
    expertQuotesReady,
    expertSubmissionsToReview,
    messageJobs,
    newApplications,
    newContacts,
    newRequests,
    requestedRevisions,
    unreadMessageCounts,
  ]);

  useEffect(() => {
    setPage(1);
  }, [category]);

  const filteredItems = category === "all"
    ? inboxItems
    : category === "action"
      ? inboxItems.filter((item) => item.category === "action")
      : inboxItems.filter((item) => item.category === category);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / INBOX_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice(
    (safePage - 1) * INBOX_PER_PAGE,
    safePage * INBOX_PER_PAGE,
  );

  const expertItemCount = expertQuotesReady.length + expertSubmissionsToReview.length + expertPayoutsDue.length + newApplications.length;
  const actionCount = newRequests.length + requestedRevisions.length;

  return (
    <div className="heyy-admin-stack">
      <section className="heyy-admin-metrics four compact">
        <MetricCard icon={AlertCircle} label="Needs action" value={actionCount} note="Requests and revisions" tone="blue" onClick={() => setCategory("action")} actionLabel="Show items needing action" />
        <MetricCard icon={MessageSquare} label="Client messages" value={messageJobs.length} note="Unread production conversations" tone="purple" onClick={() => setCategory("messages")} actionLabel="Show unread client messages" />
        <MetricCard icon={BriefcaseBusiness} label="Expert items" value={expertItemCount} note="Quotes, submissions, payouts, applicants" tone="amber" onClick={() => setCategory("experts")} actionLabel="Show Expert items" />
        <MetricCard icon={Mail} label="Website forms" value={newContacts.length} note="New or reviewing enquiries" tone="pink" onClick={() => setCategory("website")} actionLabel="Show website forms" />
      </section>

      <Panel
        eyebrow="Priority inbox"
        title="Notifications & inbox"
        description="One operational feed for everything that needs Admin attention."
        action={
          <div className="heyy-inbox-shortcuts">
            <Link href="/admin/platform/contact">Contact forms</Link>
            <Link href="/admin/platform/applications">Expert applications</Link>
          </div>
        }
      >
        <div className="heyy-inbox-filters" role="tablist" aria-label="Inbox filters">
          <InboxFilter active={category === "all"} onClick={() => setCategory("all")} label="All" count={inboxItems.length} />
          <InboxFilter active={category === "action"} onClick={() => setCategory("action")} label="Needs action" count={actionCount} />
          <InboxFilter active={category === "messages"} onClick={() => setCategory("messages")} label="Messages" count={messageJobs.length} />
          <InboxFilter active={category === "website"} onClick={() => setCategory("website")} label="Website" count={newContacts.length} />
          <InboxFilter active={category === "experts"} onClick={() => setCategory("experts")} label="Experts" count={expertItemCount} />
        </div>

        <QueueHeader
          shown={pageItems.length}
          total={filteredItems.length}
          page={safePage}
          pageSize={INBOX_PER_PAGE}
          noun="items"
        />

        <div className="heyy-inbox-list">
          {pageItems.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))}
          {!pageItems.length && (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing waiting here"
              description="This inbox view is clear right now."
            />
          )}
        </div>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </Panel>
    </div>
  );
}

function QueueHeader({
  shown,
  total,
  page,
  pageSize,
  noun,
}: {
  shown: number;
  total: number;
  page: number;
  pageSize: number;
  noun: string;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = total === 0 ? 0 : start + shown - 1;
  return (
    <div className="heyy-queue-header">
      <span>{total ? `Showing ${start}–${end} of ${total} ${noun}` : `0 ${noun}`}</span>
      <small>Newest first</small>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((value) => value === 1 || value === totalPages || Math.abs(value - page) <= 1);
  const withGaps: Array<number | "gap"> = [];
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) withGaps.push("gap");
    withGaps.push(value);
  });

  return (
    <div className="heyy-pagination" aria-label="Pagination">
      <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
        <ChevronLeft size={15} /> Previous
      </button>
      <div>
        {withGaps.map((value, index) => value === "gap" ? (
          <span key={`gap-${index}`} className="heyy-page-gap">…</span>
        ) : (
          <button
            key={value}
            type="button"
            data-active={value === page}
            onClick={() => onPageChange(value)}
            aria-current={value === page ? "page" : undefined}
          >
            {value}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        Next <ChevronRight size={15} />
      </button>
    </div>
  );
}

function RequestTableRow({ request, quote, expertOpportunity }: { request: any; quote?: any; expertOpportunity?: any }) {
  const studio = getStudioIdentity(request.studio || request.metadata?.studio);
  const projectName = request.project_name || request.metadata?.project_name || request.service || "Production request";
  const clientName = request.client_name || request.metadata?.client_name || request.client_email || request.metadata?.client_email || "Logged-in user";
  const quoteStatus = quote?.status || "Not sent";
  const expertStatus = expertOpportunity
    ? String(expertOpportunity.status || "").toLowerCase() === "selected"
      ? "Preferred selected"
      : String(expertOpportunity.status || "").toLowerCase() === "quoted"
        ? "Quote ready"
        : "Waiting quote"
    : "Not sourced";

  return (
    <Link
      href={`/admin/studio-requests/${request.id}`}
      className="heyy-admin-table-row heyy-request-table-row"
      style={{ "--studio-accent": studio.accent } as CSSProperties}
    >
      <div className="heyy-table-project">
        <span className="heyy-row-accent" />
        <div>
          <strong>{projectName}</strong>
          <small>{request.service || request.metadata?.service || "Expert production"}</small>
        </div>
      </div>
      <span className="heyy-table-muted">{clientName}</span>
      <StudioBadge value={studio.id} />
      <span className="heyy-status-pill">{request.status || "New"}</span>
      <div className="heyy-table-stack">
        <strong>{quoteStatus}</strong>
        <small>{quote ? formatMoney(toNumber(quote.amount), quote.currency) : "No amount"}</small>
      </div>
      <span className="heyy-table-muted">{expertStatus}</span>
      <span className="heyy-table-muted">{formatDate(request.created_at)}</span>
      <ArrowRight size={16} className="heyy-table-arrow" />
    </Link>
  );
}

function ProductionTableRow({ job, unread, revisions }: { job: any; unread: number; revisions: number }) {
  const studio = getStudioIdentity(job.studio || job.assigned_studio);
  return (
    <Link
      href={`/admin/production/${job.id}`}
      className="heyy-admin-table-row heyy-production-table-row"
      style={{ "--studio-accent": studio.accent } as CSSProperties}
    >
      <div className="heyy-table-project">
        <span className="heyy-row-accent" />
        <div>
          <strong>{job.project_name || job.service || "Production job"}</strong>
          <small>{job.service || studio.label}</small>
        </div>
      </div>
      <span className="heyy-table-muted">{job.client_name || job.client_email || "Client"}</span>
      <StudioBadge value={studio.id} />
      <span className="heyy-status-pill">{job.status || "Waiting Assignment"}</span>
      <div className="heyy-table-activity">
        {unread > 0 && <span><MessageSquare size={12} /> {unread}</span>}
        {revisions > 0 && <span className="amber"><FileCheck2 size={12} /> {revisions}</span>}
        {unread === 0 && revisions === 0 && <small>Clear</small>}
      </div>
      <span className="heyy-table-muted">{formatDate(job.updated_at || job.created_at)}</span>
      <ArrowRight size={16} className="heyy-table-arrow" />
    </Link>
  );
}

function InboxFilter({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button type="button" data-active={active} onClick={onClick}>
      <span>{label}</span>
      <b>{count}</b>
    </button>
  );
}

function InboxRow({
  item,
}: {
  item: {
    eyebrow: string;
    title: string;
    description: string;
    status: string;
    href: string;
    icon: LucideIcon;
    tone: keyof typeof TONE_STYLES;
    createdAt?: string | null;
  };
}) {
  const Icon = item.icon;
  const style = TONE_STYLES[item.tone];
  return (
    <Link href={item.href} className="heyy-inbox-row">
      <span className="heyy-inbox-icon" style={{ color: style.accent, background: style.soft, borderColor: style.border }}>
        <Icon size={17} />
      </span>
      <div className="heyy-inbox-copy">
        <div className="heyy-inbox-eyebrow">{item.eyebrow}</div>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
      </div>
      <div className="heyy-inbox-meta">
        <span>{item.status}</span>
        <small>{formatDate(item.createdAt)}</small>
      </div>
      <ArrowRight size={16} />
    </Link>
  );
}

function AdminToolbar({
  search,
  setSearch,
  status,
  setStatus,
  statuses,
  studio,
  setStudio,
  placeholder,
  children,
}: {
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  statuses: string[];
  studio: string;
  setStudio: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="heyy-admin-toolbar">
      <label className="heyy-admin-search">
        <Search size={17} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={placeholder}
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
            <X size={15} />
          </button>
        )}
      </label>
      <div className="heyy-admin-filter">
        <HeyySelect
          value={status}
          options={statuses}
          onChange={setStatus}
          ariaLabel="Filter by status"
          tone="admin"
        />
      </div>
      <div className="heyy-admin-filter">
        <HeyySelect
          value={studio}
          options={[
            { value: "all", label: "All Studios" },
            ...VISIBLE_STUDIOS.map((item) => ({
              value: item.id,
              label: item.label,
            })),
          ]}
          onChange={setStudio}
          ariaLabel="Filter by Studio"
          tone="admin"
        />
      </div>
      {children}
    </div>
  );
}

function AdminFilter({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="heyy-admin-filter">
      <HeyySelect
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={label}
        tone="admin"
      />
    </div>
  );
}

function RequestCard({ request, quote, expertOpportunity }: { request: any; quote?: any; expertOpportunity?: any }) {
  const studio = getStudioIdentity(request.studio || request.metadata?.studio);
  const requestStatus = request.status || "New";
  const quoteStatus = quote?.status || "Not sent";
  const expertStatus = expertOpportunity
    ? String(expertOpportunity.status || "").toLowerCase() === "selected"
      ? "Preferred selected"
      : String(expertOpportunity.status || "").toLowerCase() === "quoted"
        ? "Quote ready"
        : "Waiting quote"
    : "Not sourced";

  return (
    <Link
      href={`/admin/studio-requests/${request.id}`}
      className="heyy-request-card"
      style={
        {
          "--studio-accent": studio.accent,
          "--studio-soft": studio.soft,
          "--studio-border": studio.border,
        } as CSSProperties
      }
    >
      <div className="heyy-card-topline">
        <StudioBadge value={studio.id} />
        <span className="heyy-status-pill">{requestStatus}</span>
      </div>
      <div>
        <h3>{request.project_name || request.metadata?.project_name || request.service || "Production request"}</h3>
        <p>{request.service || request.metadata?.service || "Expert production"}</p>
      </div>
      <div className="heyy-card-meta-grid">
        <SmallMeta label="Client" value={request.client_name || request.metadata?.client_name || "Logged-in user"} />
        <SmallMeta label="Quote" value={quoteStatus} />
        <SmallMeta label="Amount" value={quote ? formatMoney(toNumber(quote.amount), quote.currency) : "—"} />
        <SmallMeta label="Expert" value={expertStatus} />
        <SmallMeta label="Requested" value={formatDate(request.created_at)} />
      </div>
      <div className="heyy-card-action">Review request <ArrowRight size={15} /></div>
    </Link>
  );
}

function ProductionRow({
  job,
  unread,
  revisions,
  detailed = false,
}: {
  job: any;
  unread: number;
  revisions: number;
  detailed?: boolean;
}) {
  const studio = getStudioIdentity(job.studio || job.assigned_studio);
  return (
    <Link
      href={`/admin/production/${job.id}`}
      className={`heyy-production-row ${detailed ? "detailed" : ""}`}
      style={
        {
          "--studio-accent": studio.accent,
          "--studio-soft": studio.soft,
          "--studio-border": studio.border,
        } as CSSProperties
      }
    >
      <StudioGlyph studio={studio.id} />
      <div className="heyy-production-main">
        <div className="heyy-production-titleline">
          <strong>{job.project_name || job.service || "Production job"}</strong>
          <span className="heyy-status-pill">{job.status || "Waiting Assignment"}</span>
        </div>
        <p>{job.service || studio.label}</p>
        <div className="heyy-production-meta">
          <span><Clock3 size={13} /> {formatDate(job.updated_at || job.created_at)}</span>
          {detailed && <span>{studio.label}</span>}
          {detailed && job.client_name && <span>{job.client_name}</span>}
        </div>
      </div>
      <div className="heyy-production-alerts">
        {unread > 0 && <span className="heyy-alert-chip"><MessageSquare size={13} /> {unread}</span>}
        {revisions > 0 && <span className="heyy-alert-chip amber"><FileCheck2 size={13} /> {revisions}</span>}
        <ArrowRight size={17} />
      </div>
    </Link>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = item.icon;
  const style = TONE_STYLES[item.tone];
  const studio = item.studio ? getStudioIdentity(item.studio) : null;
  return (
    <Link href={item.href} className="heyy-attention-row">
      <span className="heyy-attention-icon" style={{ color: style.accent, background: style.soft, borderColor: style.border }}>
        <Icon size={17} />
      </span>
      <div>
        <div className="heyy-attention-eyebrow">
          {item.eyebrow}
          {studio && <span style={{ color: studio.accent }}>• {studio.shortLabel}</span>}
        </div>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
        <small className="heyy-admin-time"><Clock3 size={11} /> {formatDate(item.createdAt)}</small>
      </div>
      <span className="heyy-attention-action">{item.action} <ArrowRight size={14} /></span>
    </Link>
  );
}

function SubmissionRow({
  icon: Icon,
  title,
  description,
  status,
  date,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  status: string;
  date?: string;
  href: string;
}) {
  return (
    <Link href={href} className="heyy-submission-row">
      <span><Icon size={17} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description || "No additional information"}</p>
      </div>
      <div className="heyy-submission-side">
        <b>{status}</b>
        <small>{formatDate(date)}</small>
      </div>
    </Link>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  action,
  sectionId,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  sectionId?: string;
  children: ReactNode;
}) {
  return (
    <section id={sectionId} className="heyy-admin-panel">
      <div className="heyy-panel-heading">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="heyy-panel-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
  onClick,
  actionLabel,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  note: string;
  tone: keyof typeof TONE_STYLES;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const style = TONE_STYLES[tone];
  const content = (
    <>
      <span className="heyy-metric-icon" style={{ color: style.accent, background: style.soft, borderColor: style.border }}>
        <Icon size={18} />
      </span>
      <div className="heyy-metric-value">{value}</div>
      <strong>{label}</strong>
      <p>{note}</p>
      {onClick && <span className="heyy-metric-open">Open <ArrowRight size={12} /></span>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="heyy-metric-card heyy-metric-card-button"
        onClick={onClick}
        aria-label={actionLabel || `Open ${label}`}
      >
        {content}
      </button>
    );
  }

  return <article className="heyy-metric-card">{content}</article>;
}

function AdminTabButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button type="button" data-active={active} onClick={onClick}>
      <Icon size={17} />
      <span>{label}</span>
      {count > 0 && <b>{count > 99 ? "99+" : count}</b>}
    </button>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  note,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  note: string;
}) {
  return (
    <Link href={href} className="heyy-quick-link">
      <span><Icon size={18} /></span>
      <div><strong>{title}</strong><p>{note}</p></div>
      <ArrowRight size={15} />
    </Link>
  );
}

function SmallMeta({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function StudioBadge({ value }: { value: unknown }) {
  const studio = getStudioIdentity(value);
  return (
    <span className="heyy-studio-badge" style={{ color: studio.accent, background: studio.soft, borderColor: studio.border }}>
      {studio.initials} {studio.shortLabel}
    </span>
  );
}

function StudioGlyph({ studio }: { studio: unknown }) {
  const identity = getStudioIdentity(studio);
  const Icon = studioIcon(identity.id);
  return (
    <span className="heyy-studio-glyph" style={{ color: identity.accent, background: identity.soft, borderColor: identity.border }}>
      <Icon size={18} />
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="heyy-empty-state">
      <span><Icon size={20} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function studioIcon(id: string): LucideIcon {
  switch (id) {
    case "architecture_studio":
      return Building2;
    case "interior_studio":
      return Sofa;
    case "marketing_studio":
      return Megaphone;
    case "brand_studio":
      return WandSparkles;
    default:
      return Sparkles;
  }
}

function uniqueOptions(values: unknown[], allLabel: string) {
  const items = Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  return [
    { value: "all", label: allLabel },
    ...items.map((value) => ({ value, label: value })),
  ];
}

function isCurrentMonth(value: unknown) {
  if (!value) return false;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

function toNumber(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString()}`;
  }
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatDate(value: unknown) {
  if (!value) return "Not set";
  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const monthIndex = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    if (monthIndex >= 0 && monthIndex < SHORT_MONTHS.length && day >= 1 && day <= 31) {
      return `${day} ${SHORT_MONTHS[monthIndex]} ${year}`;
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function dateValue(value: unknown) {
  if (!value) return 0;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function truncate(value: unknown, length: number) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

const ADMIN_STYLES = `
  .heyy-admin-root {
    color: #17151f;
    background:
      radial-gradient(circle at 8% 4%, rgba(139,92,246,.09), transparent 26%),
      radial-gradient(circle at 92% 8%, rgba(22,118,232,.08), transparent 24%),
      #f7f6fa;
    padding: 24px;
    color-scheme: light;
  }
  .heyy-admin-root, .heyy-admin-root * { box-sizing: border-box; }
  .heyy-admin-root a { text-decoration: none; }
  .heyy-admin-header {
    max-width: 1540px;
    margin: 0 auto;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 28px;
    padding: 30px 32px;
    border: 1px solid #ded6e9;
    border-radius: 30px;
    background: linear-gradient(135deg, #fff 0%, #f6efff 48%, #eef5ff 100%);
    box-shadow: 0 24px 60px rgba(44,25,70,.10);
  }
  .heyy-admin-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #8b5cf6;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .17em;
    text-transform: uppercase;
  }
  .heyy-admin-header h1 {
    margin: 10px 0 8px;
    font-size: clamp(32px, 4vw, 58px);
    line-height: .95;
    letter-spacing: -.055em;
    font-weight: 950;
  }
  .heyy-admin-header p {
    max-width: 700px;
    margin: 0;
    color: #625b6e;
    font-size: 15px;
    line-height: 1.65;
    font-weight: 650;
  }
  .heyy-admin-header-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .heyy-admin-button {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 999px;
    padding: 0 17px;
    font-size: 13px;
    font-weight: 900;
    transition: .2s ease;
    cursor: pointer;
  }
  .heyy-admin-button-secondary { border: 1px solid #d9d1e4; color: #28232f; background: #fff; }
  .heyy-admin-button-secondary:hover { border-color: #8b5cf6; color: #8b5cf6; background: #f5edff; transform: translateY(-2px); }
  .heyy-admin-button-primary { border: 1px solid #17151f; color: #fff; background: #17151f; }
  .heyy-admin-button-primary:hover { border-color: #8b5cf6; background: #8b5cf6; transform: translateY(-2px); box-shadow: 0 12px 28px rgba(139,92,246,.25); }
  .heyy-admin-button:disabled { opacity: .65; cursor: wait; transform: none; }
  .heyy-admin-tabs {
    max-width: 1540px;
    margin: 16px auto 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 8px;
    border: 1px solid #e1dae9;
    border-radius: 22px;
    background: rgba(255,255,255,.88);
    box-shadow: 0 14px 38px rgba(44,25,70,.07);
    backdrop-filter: blur(18px);
  }
  .heyy-admin-tabs button {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    border: 1px solid transparent;
    border-radius: 16px;
    color: #5d5668;
    background: transparent;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    transition: .2s ease;
  }
  .heyy-admin-tabs button:hover { color: #8b5cf6; background: #f5efff; }
  .heyy-admin-tabs button[data-active="true"] { color: #fff; background: #8b5cf6; box-shadow: 0 10px 24px rgba(139,92,246,.24); }
  .heyy-admin-tabs b {
    min-width: 23px;
    height: 23px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(139,92,246,.10);
    color: #8b5cf6;
    font-size: 10px;
  }
  .heyy-admin-tabs button[data-active="true"] b { background: rgba(255,255,255,.20); color: #fff; }
  .heyy-admin-content { max-width: 1540px; margin: 18px auto 0; animation: heyyAdminEnter .28s ease; }
  .heyy-admin-stack { display: grid; gap: 18px; }
  .heyy-admin-metrics { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
  .heyy-admin-metrics.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .heyy-metric-card {
    min-height: 158px;
    padding: 18px;
    border: 1px solid #dfd8e8;
    border-radius: 22px;
    background: rgba(255,255,255,.94);
    box-shadow: 0 12px 34px rgba(42,25,64,.06);
    transition: .2s ease;
  }
  .heyy-metric-card:hover { transform: translateY(-3px); border-color: #b78cff; box-shadow: 0 18px 42px rgba(139,92,246,.11); }
  .heyy-metric-card-button { width: 100%; text-align: left; color: inherit; font: inherit; cursor: pointer; }
  .heyy-metric-card-button:focus-visible { outline: 3px solid rgba(139,92,246,.22); outline-offset: 2px; }
  .heyy-metric-open { display: inline-flex; align-items: center; gap: 4px; margin-top: 9px; color: #8b5cf6; font-size: 9px; font-weight: 950; letter-spacing: .04em; text-transform: uppercase; }
  .heyy-metric-icon { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid; border-radius: 12px; }
  .heyy-metric-value { margin-top: 18px; font-size: 28px; line-height: 1; letter-spacing: -.04em; font-weight: 950; }
  .heyy-metric-card strong { display: block; margin-top: 9px; font-size: 13px; }
  .heyy-metric-card p { margin: 5px 0 0; color: #766e80; font-size: 11px; line-height: 1.45; font-weight: 650; }
  .heyy-admin-two-column { display: grid; grid-template-columns: minmax(0, 1.16fr) minmax(360px, .84fr); gap: 18px; }
  .heyy-admin-panel {
    border: 1px solid #dfd8e8;
    border-radius: 26px;
    background: rgba(255,255,255,.95);
    padding: 22px;
    box-shadow: 0 14px 38px rgba(42,25,64,.06);
    overflow: hidden;
  }
  .heyy-panel-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
  .heyy-panel-heading > div:first-child > span { color: #8b5cf6; font-size: 10px; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
  .heyy-panel-heading h2 { margin: 6px 0 0; font-size: 24px; letter-spacing: -.035em; font-weight: 950; }
  .heyy-panel-heading p { margin: 6px 0 0; color: #756e7d; font-size: 12px; line-height: 1.55; font-weight: 620; }
  .heyy-panel-action a { display: inline-flex; align-items: center; gap: 6px; color: #8b5cf6; font-size: 12px; font-weight: 900; }
  .heyy-panel-action a:hover { color: #8b5cf6; }
  .heyy-attention-list, .heyy-compact-list, .heyy-submission-list, .heyy-production-list { display: grid; gap: 9px; }
  .heyy-attention-row {
    display: grid;
    grid-template-columns: auto minmax(0,1fr) auto;
    align-items: center;
    gap: 13px;
    padding: 13px;
    border: 1px solid #e6e0ec;
    border-radius: 17px;
    color: #201b28;
    background: #fff;
    transition: .2s ease;
  }
  .heyy-attention-row:hover { transform: translateX(3px); border-color: #8b5cf6; background: #faf7ff; box-shadow: 0 10px 24px rgba(139,92,246,.08); }
  .heyy-attention-icon { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid; border-radius: 13px; }
  .heyy-attention-eyebrow { display: flex; gap: 5px; color: #81778a; font-size: 9px; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
  .heyy-attention-row strong { display: block; margin-top: 3px; font-size: 13px; }
  .heyy-attention-row p { margin: 3px 0 0; color: #756e7d; font-size: 11px; line-height: 1.45; }
  .heyy-attention-action { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; color: #8b5cf6; font-size: 10px; font-weight: 900; }
  .heyy-admin-time { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; color: #8a828f; font-size: 9px; font-weight: 750; }
  .heyy-pipeline-list { display: grid; gap: 16px; }
  .heyy-pipeline-label { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 9px; font-size: 12px; }
  .heyy-pipeline-label > span { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; color: #8b5cf6; background: #f2e9ff; }
  .heyy-pipeline-label b { font-size: 15px; }
  .heyy-pipeline-track { height: 7px; margin: 7px 0 0 39px; border-radius: 999px; background: #eee9f2; overflow: hidden; }
  .heyy-pipeline-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#8b5cf6,#1676e8); }
  .heyy-admin-inline-actions { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 22px; }
  .heyy-admin-link-button { min-height: 39px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 14px; border-radius: 999px; color: #fff; background: #17151f; font-size: 11px; font-weight: 900; transition: .2s ease; }
  .heyy-admin-link-button:hover { background: #8b5cf6; transform: translateY(-2px); }
  .heyy-admin-link-button.muted { color: #4d4656; background: #f2eff5; }
  .heyy-admin-link-button.muted:hover { color: #8b5cf6; background: #eee3ff; }
  .heyy-studio-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 11px; }
  .heyy-studio-workload { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 11px; align-items: center; min-height: 82px; padding: 14px; border: 1px solid var(--studio-border); border-radius: 18px; background: linear-gradient(135deg,var(--studio-soft),#fff); }
  .heyy-studio-workload strong { display: block; font-size: 12px; }
  .heyy-studio-workload .heyy-studio-meta { display: block; margin-top: 3px; color: #756e7d; font-size: 10px; }
  .heyy-studio-count { min-width: 48px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 4px; text-align: right; }
  .heyy-studio-count b { display: block; color: var(--studio-accent); font-size: 22px; line-height: 1; }
  .heyy-studio-count span { display: block; color: #756e7d; font-size: 9px; font-weight: 800; line-height: 1; }
  .heyy-quick-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
  .heyy-quick-link { min-height: 72px; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 12px; border: 1px solid #e4deea; border-radius: 16px; color: #211c28; background: #fff; transition: .2s ease; }
  .heyy-quick-link:hover { border-color: #8b5cf6; background: #faf7ff; transform: translateY(-2px); }
  .heyy-quick-link > span { width: 35px; height: 35px; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; color: #8b5cf6; background: #f2e9ff; }
  .heyy-quick-link strong { display: block; font-size: 11px; }
  .heyy-quick-link p { margin: 3px 0 0; color: #7b7482; font-size: 9px; }
  .heyy-admin-toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .heyy-admin-search { flex: 1 1 300px; }
  .heyy-admin-filter { flex: 0 1 190px; min-width: 165px; }
  .heyy-admin-search { min-height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 1px solid #ded8e5; border-radius: 15px; background: #f9f8fb; }
  .heyy-admin-search:focus-within { border-color: #8b5cf6; box-shadow: 0 0 0 4px rgba(139,92,246,.10); background: #fff; }
  .heyy-admin-search input { width: 100%; border: 0; outline: 0; color: #211c28; background: transparent; font-size: 12px; font-weight: 650; }
  .heyy-admin-search button { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 9px; color: #6f6877; background: #eeeaf1; cursor: pointer; }
  .heyy-admin-filter > * { width: 100%; min-height: 48px; }
  .heyy-request-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
  .heyy-request-card { min-height: 280px; display: flex; flex-direction: column; gap: 18px; padding: 18px; border: 1px solid var(--studio-border); border-radius: 21px; color: #211c28; background: linear-gradient(145deg,var(--studio-soft),#fff 42%); transition: .22s ease; }
  .heyy-request-card:hover { transform: translateY(-4px); box-shadow: 0 17px 38px rgba(42,25,64,.12); }
  .heyy-card-topline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .heyy-request-card h3 { margin: 0; font-size: 18px; line-height: 1.15; letter-spacing: -.025em; font-weight: 950; }
  .heyy-request-card p { margin: 6px 0 0; color: #746c7c; font-size: 11px; line-height: 1.5; }
  .heyy-card-meta-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; margin-top: auto; }
  .heyy-card-meta-grid > div { min-height: 55px; padding: 10px; border: 1px solid #ebe6ef; border-radius: 13px; background: rgba(255,255,255,.78); }
  .heyy-card-meta-grid span { display: block; color: #938a9b; font-size: 8px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .heyy-card-meta-grid strong { display: block; margin-top: 4px; font-size: 10px; line-height: 1.35; }
  .heyy-card-action { display: flex; align-items: center; justify-content: flex-end; gap: 6px; color: var(--studio-accent); font-size: 10px; font-weight: 900; }
  .heyy-studio-badge, .heyy-status-pill { display: inline-flex; align-items: center; border: 1px solid; border-radius: 999px; padding: 6px 9px; font-size: 8px; font-weight: 950; letter-spacing: .07em; text-transform: uppercase; }
  .heyy-status-pill { border-color: #ded8e5; color: #5f5767; background: #fff; }
  .heyy-production-row { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 12px; min-height: 78px; padding: 13px; border: 1px solid var(--studio-border); border-radius: 17px; color: #211c28; background: linear-gradient(135deg,var(--studio-soft),#fff 38%); transition: .2s ease; }
  .heyy-production-row:hover { transform: translateX(3px); box-shadow: 0 11px 28px rgba(42,25,64,.09); }
  .heyy-production-row.detailed { min-height: 92px; padding: 15px; }
  .heyy-production-titleline { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .heyy-production-main strong { font-size: 12px; }
  .heyy-production-main p { margin: 4px 0 0; color: #756e7d; font-size: 10px; }
  .heyy-production-meta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; color: #8a828f; font-size: 9px; font-weight: 700; }
  .heyy-production-meta span { display: inline-flex; align-items: center; gap: 4px; }
  .heyy-production-alerts { display: flex; align-items: center; gap: 7px; color: var(--studio-accent); }
  .heyy-alert-chip { min-height: 28px; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; border-radius: 999px; color: #8b5cf6; background: #eee2ff; font-size: 9px; font-weight: 950; }
  .heyy-alert-chip.amber { color: #a65300; background: #fff0d5; }
  .heyy-studio-glyph { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid; border-radius: 13px; flex: 0 0 auto; line-height: 0; }
  .heyy-studio-glyph svg { display: block; margin: 0; }
  .heyy-submission-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
  .heyy-submission-row { min-height: 72px; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 11px; padding: 12px; border: 1px solid #e5dfea; border-radius: 15px; color: #211c28; background: #fff; transition: .2s ease; }
  .heyy-submission-row:hover { border-color: #8b5cf6; background: #faf7ff; transform: translateY(-2px); }
  .heyy-submission-row > span { width: 35px; height: 35px; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; color: #8b5cf6; background: #f2e9ff; }
  .heyy-submission-row strong { display: block; font-size: 11px; }
  .heyy-submission-row p { margin: 3px 0 0; color: #77707e; font-size: 9px; line-height: 1.4; }
  .heyy-submission-side { text-align: right; }
  .heyy-submission-side b { display: block; color: #8b5cf6; font-size: 9px; text-transform: uppercase; }
  .heyy-submission-side small { display: block; margin-top: 4px; color: #99919e; font-size: 8px; }
  .heyy-empty-state { min-height: 170px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; border: 1px dashed #d9d1e0; border-radius: 18px; background: #faf9fb; }
  .heyy-empty-state > span { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; color: #8b5cf6; background: #eee3ff; }
  .heyy-empty-state strong { margin-top: 11px; font-size: 13px; }
  .heyy-empty-state p { max-width: 360px; margin: 5px 0 0; color: #817989; font-size: 10px; line-height: 1.5; }
  .heyy-grid-empty { grid-column: 1 / -1; }

  /* Admin polish — scalable queues, calmer hierarchy, clearer notifications */
  .heyy-admin-root { background: #f6f5f8; padding: 20px; }
  .heyy-admin-header { align-items: center; padding: 22px 26px; border-radius: 24px; background: #fff; box-shadow: 0 10px 30px rgba(35,24,48,.06); }
  .heyy-admin-header h1 { margin: 7px 0 6px; font-size: clamp(30px,3.2vw,46px); }
  .heyy-admin-header p { max-width: 620px; font-size: 13px; line-height: 1.5; }
  .heyy-admin-tabs { position: sticky; top: 10px; z-index: 30; margin-top: 12px; border-radius: 18px; box-shadow: 0 10px 28px rgba(35,24,48,.08); }
  .heyy-admin-tabs button { min-height: 46px; border-radius: 13px; }
  .heyy-admin-content { margin-top: 14px; }
  .heyy-admin-stack { gap: 14px; }
  .heyy-admin-metrics.compact .heyy-metric-card { min-height: 118px; padding: 15px; border-radius: 18px; box-shadow: none; }
  .heyy-admin-metrics.compact .heyy-metric-icon { width: 34px; height: 34px; }
  .heyy-admin-metrics.compact .heyy-metric-value { margin-top: 12px; font-size: 24px; }
  .heyy-admin-metrics.compact .heyy-metric-card strong { margin-top: 6px; font-size: 12px; }
  .heyy-admin-metrics.compact .heyy-metric-card p { margin-top: 3px; font-size: 10px; }
  .heyy-admin-panel { border-radius: 22px; padding: 20px; box-shadow: 0 8px 26px rgba(35,24,48,.05); }
  .heyy-panel-heading { align-items: flex-start; margin-bottom: 16px; }
  .heyy-panel-heading h2 { font-size: 22px; }
  .heyy-panel-heading p { max-width: 760px; font-size: 11px; }
  .heyy-admin-toolbar { gap: 8px; margin-bottom: 12px; }
  .heyy-admin-search, .heyy-admin-filter > * { min-height: 44px; }
  .heyy-admin-search { border-radius: 12px; background: #fff; }
  .heyy-admin-filter { flex-basis: 170px; min-width: 150px; }
  .heyy-queue-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 2px 10px; color: #625b6e; font-size: 10px; font-weight: 850; }
  .heyy-queue-header small { color: #948d9b; font-size: 9px; font-weight: 750; }
  .heyy-admin-table-wrap { width: 100%; overflow-x: auto; border: 1px solid #e7e2eb; border-radius: 16px; background: #fff; }
  .heyy-admin-table { min-width: 1180px; }
  .heyy-production-table { min-width: 1040px; }
  .heyy-admin-table-head, .heyy-admin-table-row { display: grid; align-items: center; gap: 12px; }
  .heyy-requests-table .heyy-admin-table-head, .heyy-requests-table .heyy-admin-table-row { grid-template-columns: minmax(220px,1.6fr) minmax(150px,1fr) 120px 112px 120px 130px 90px 24px; }
  .heyy-production-table .heyy-admin-table-head, .heyy-production-table .heyy-admin-table-row { grid-template-columns: minmax(240px,1.8fr) minmax(150px,1fr) 120px 140px 120px 95px 24px; }
  .heyy-admin-table-head { min-height: 42px; padding: 0 14px; border-bottom: 1px solid #ebe7ef; color: #8a8390; background: #faf9fb; font-size: 8px; font-weight: 950; letter-spacing: .10em; text-transform: uppercase; }
  .heyy-admin-table-row { min-height: 68px; padding: 10px 14px; border-bottom: 1px solid #efebf2; color: #211c28; transition: .16s ease; }
  .heyy-admin-table-row:last-child { border-bottom: 0; }
  .heyy-admin-table-row:hover { background: #faf7ff; }
  .heyy-table-project { min-width: 0; display: grid; grid-template-columns: 4px minmax(0,1fr); gap: 10px; align-items: stretch; }
  .heyy-row-accent { width: 4px; min-height: 38px; border-radius: 999px; background: var(--studio-accent); }
  .heyy-table-project strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  .heyy-table-project small, .heyy-table-stack small { display: block; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #8b8492; font-size: 9px; }
  .heyy-table-muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #655e6d; font-size: 10px; font-weight: 720; }
  .heyy-table-stack strong { display: block; font-size: 10px; }
  .heyy-table-arrow { color: #8b5cf6; }
  .heyy-table-activity { display: flex; align-items: center; gap: 5px; }
  .heyy-table-activity > span { min-height: 25px; display: inline-flex; align-items: center; gap: 4px; padding: 0 7px; border-radius: 999px; color: #8b5cf6; background: #f1eaff; font-size: 9px; font-weight: 900; }
  .heyy-table-activity > span.amber { color: #9a5300; background: #fff1d8; }
  .heyy-table-activity small { color: #9a939f; font-size: 9px; font-weight: 750; }
  .heyy-admin-table-row .heyy-studio-badge, .heyy-admin-table-row .heyy-status-pill { justify-self: start; padding: 5px 7px; font-size: 7px; }
  .heyy-pagination { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; margin-top: 15px; }
  .heyy-pagination > button, .heyy-pagination > div button { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid #dfd9e5; border-radius: 10px; color: #3e3747; background: #fff; font-size: 10px; font-weight: 850; cursor: pointer; }
  .heyy-pagination > button { padding: 0 11px; }
  .heyy-pagination > button:hover:not(:disabled), .heyy-pagination > div button:hover { border-color: #8b5cf6; color: #8b5cf6; background: #faf7ff; }
  .heyy-pagination > button:disabled { opacity: .38; cursor: default; }
  .heyy-pagination > div { display: flex; justify-content: center; gap: 5px; }
  .heyy-pagination > div button { width: 36px; }
  .heyy-pagination > div button[data-active="true"] { border-color: #8b5cf6; color: #fff; background: #8b5cf6; }
  .heyy-page-gap { width: 24px; display: inline-flex; align-items: center; justify-content: center; color: #9a939f; }
  .heyy-inbox-shortcuts { display: flex; gap: 8px; flex-wrap: wrap; }
  .heyy-inbox-shortcuts a { min-height: 34px; padding: 0 11px; border: 1px solid #e2dce7; border-radius: 999px; color: #5f5767; background: #fff; font-size: 9px; font-weight: 850; }
  .heyy-inbox-shortcuts a:hover { border-color: #8b5cf6; color: #8b5cf6; background: #faf7ff; }
  .heyy-inbox-filters { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 10px; padding-bottom: 12px; border-bottom: 1px solid #eeeaf1; }
  .heyy-inbox-filters button { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border: 1px solid #e2dce7; border-radius: 999px; color: #5f5767; background: #fff; font-size: 10px; font-weight: 850; cursor: pointer; }
  .heyy-inbox-filters button b { min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; color: #8b5cf6; background: #f1eaff; font-size: 8px; }
  .heyy-inbox-filters button[data-active="true"] { border-color: #8b5cf6; color: #fff; background: #8b5cf6; }
  .heyy-inbox-filters button[data-active="true"] b { color: #8b5cf6; background: #fff; }
  .heyy-inbox-list { display: grid; gap: 7px; }
  .heyy-inbox-row { min-height: 78px; display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; gap: 12px; padding: 12px 13px; border: 1px solid #e8e3ec; border-radius: 15px; color: #211c28; background: #fff; transition: .16s ease; }
  .heyy-inbox-row:hover { border-color: #c9b2f7; background: #faf7ff; }
  .heyy-inbox-icon { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid; border-radius: 12px; }
  .heyy-inbox-eyebrow { color: #8a8291; font-size: 8px; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
  .heyy-inbox-copy strong { display: block; margin-top: 3px; font-size: 11px; }
  .heyy-inbox-copy p { margin: 3px 0 0; color: #746d7b; font-size: 9px; line-height: 1.45; }
  .heyy-inbox-meta { min-width: 92px; text-align: right; }
  .heyy-inbox-meta span { display: block; color: #8b5cf6; font-size: 8px; font-weight: 950; text-transform: uppercase; }
  .heyy-inbox-meta small { display: block; margin-top: 4px; color: #9a939f; font-size: 8px; }
  @keyframes heyyAdminEnter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (max-width: 1220px) {
    .heyy-admin-metrics { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .heyy-admin-metrics.four { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .heyy-request-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .heyy-studio-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  }
  @media (max-width: 900px) {
    .heyy-admin-root { padding: 14px; }
    .heyy-admin-header { align-items: flex-start; flex-direction: column; padding: 24px; }
    .heyy-admin-header-actions { justify-content: flex-start; }
    .heyy-admin-tabs { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .heyy-admin-two-column { grid-template-columns: 1fr; }
    .heyy-admin-toolbar { grid-template-columns: 1fr; }
    .heyy-attention-action { display: none; }
  }
  @media (max-width: 640px) {
    .heyy-admin-metrics, .heyy-admin-metrics.four, .heyy-request-grid, .heyy-studio-grid, .heyy-submission-grid, .heyy-quick-grid { grid-template-columns: 1fr; }
    .heyy-admin-tabs { grid-template-columns: 1fr; }
    .heyy-admin-header-actions, .heyy-admin-button { width: 100%; }
    .heyy-panel-heading { align-items: flex-start; flex-direction: column; }
    .heyy-attention-row { grid-template-columns: auto minmax(0,1fr); }
    .heyy-card-meta-grid { grid-template-columns: 1fr; }
    .heyy-production-row { grid-template-columns: auto minmax(0,1fr); }
    .heyy-production-alerts { grid-column: 2; justify-content: flex-start; }
  }
`;
