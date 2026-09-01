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
import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";

import HeyySelect from "@/components/ui/heyy-select";
import {
  getStudioIdentity,
  normalizeStudioId,
} from "@/lib/studio/studio-identity";
import { VISIBLE_STUDIOS } from "@/lib/platform/platform-registry";

type AdminTab = "overview" | "requests" | "production" | "inbox";

type Props = {
  requests: any[];
  quotes: any[];
  jobs: any[];
  revisions: any[];
  messages: any[];
  payments: any[];
  contacts: any[];
  applications: any[];
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
  "New",
  "Reviewing",
  "Quote Needed",
  "Quoted",
  "Converted",
  "Rejected",
];

const PRODUCTION_STATUSES = [
  "All",
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
  purple: { accent: "#6c00ff", soft: "#f4ecff", border: "#dcc8ff" },
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
  initialTab = "overview",
}: Props) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [search, setSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("All");
  const [requestStudio, setRequestStudio] = useState("all");
  const [requestService, setRequestService] = useState("all");
  const [requestQuoteStatus, setRequestQuoteStatus] = useState("all");
  const [requestClient, setRequestClient] = useState("all");
  const [productionStatus, setProductionStatus] = useState("All");
  const [productionStudio, setProductionStudio] = useState("all");
  const [productionService, setProductionService] = useState("all");
  const [productionClient, setProductionClient] = useState("all");

  const quoteByRequest = useMemo(() => {
    const map = new Map<string, any>();
    quotes.forEach((quote) => {
      const requestId = String(quote.studio_request_id || "");
      if (!requestId || map.has(requestId)) return;
      map.set(requestId, quote);
    });
    return map;
  }, [quotes]);

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

  const quoteStatusOptions = useMemo(() => uniqueOptions(
    ["No quote", ...Array.from(quoteByRequest.values()).map((quote) => quote?.status || "Sent")],
    "All quote states",
  ), [quoteByRequest]);

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

  const awaitingPaymentQuotes = quotes.filter((quote) =>
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
        href: `/admin/production/${job.id}?tab=Communication`,
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
      href: `/admin/production/${revision.production_job_id}?tab=Workbench`,
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
        href: `/admin/production/${job.id}`,
        action: "Open production",
        icon: CheckCircle2,
        tone: "green" as const,
        studio: job.studio || job.assigned_studio,
        createdAt: job.updated_at || job.created_at,
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

      return (
        (requestStatus === "All" || status === requestStatus) &&
        (requestStudio === "all" || studioId === requestStudio) &&
        (requestService === "all" || serviceValue === requestService) &&
        (requestQuoteStatus === "all" || quoteStatus === requestQuoteStatus) &&
        (requestClient === "all" || clientValue === requestClient) &&
        (!term || haystack.includes(term))
      );
    });
  }, [
    quoteByRequest,
    requestClient,
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

      return (
        (productionStatus === "All" || status === productionStatus) &&
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

  function refresh() {
    startRefresh(() => router.refresh());
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
        </div>
      </header>

      <nav className="heyy-admin-tabs" aria-label="Admin sections">
        <AdminTabButton
          active={activeTab === "overview"}
          icon={LayoutDashboard}
          label="Overview"
          count={attentionItems.length}
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
          count={unreadMessages.length + newContacts.length + newApplications.length}
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
            unreadMessageCounts={unreadMessageCounts}
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
            client={requestClient}
            setClient={setRequestClient}
            clientOptions={requestClientOptions}
            total={requests.length}
            open={openRequests.length}
            quoteNeeded={quoteNeeded.length}
            awaitingPayment={awaitingPaymentQuotes.length}
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
            unreadMessageCounts={unreadMessageCounts}
            revisionCounts={revisionCounts}
          />
        )}

        {activeTab === "inbox" && (
          <InboxPanel
            jobs={jobs}
            unreadMessageCounts={unreadMessageCounts}
            contacts={contacts}
            applications={applications}
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
  unreadMessageCounts,
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
  unreadMessageCounts: Map<string, number>;
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
    { label: "Requests", value: requests.length, icon: ClipboardList },
    { label: "Quotes sent", value: quotes.length, icon: CreditCard },
    { label: "Active production", value: activeJobs.length, icon: Layers3 },
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
      <section className="heyy-admin-metrics">
        <MetricCard
          icon={ClipboardList}
          label="Quotes to prepare"
          value={quoteNeeded.length}
          note="New or reviewing requests"
          tone="blue"
        />
        <MetricCard
          icon={Clock3}
          label="Outstanding quotes"
          value={formatMoney(outstandingQuoteValue)}
          note={`${awaitingPaymentQuotes.length} quote${awaitingPaymentQuotes.length === 1 ? "" : "s"} awaiting payment`}
          tone="amber"
        />
        <MetricCard
          icon={Layers3}
          label="Active production"
          value={activeJobs.length}
          note="Jobs currently in the studio"
          tone="orange"
        />
        <MetricCard
          icon={MessageSquare}
          label="Unread messages"
          value={unreadMessages.length}
          note="Client messages needing a reply"
          tone="purple"
        />
        <MetricCard
          icon={FileCheck2}
          label="Revision requests"
          value={requestedRevisions.length}
          note="Client changes waiting for action"
          tone="pink"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Revenue this month"
          value={formatMoney(currentMonthRevenue)}
          note={`All-time paid production ${formatMoney(paidRevenue)}`}
          tone="green"
        />
      </section>

      <section className="heyy-admin-two-column">
        <Panel
          eyebrow="Operational queues"
          title="Needs your attention"
          description="Only actions tied to live requests, production and submissions appear here."
          action={<Link href="/admin?tab=requests">View all requests <ArrowRight size={14} /></Link>}
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
                <span>{studio.requests} total requests</span>
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
            <QuickLink href="/admin/platform/careers" icon={BriefcaseBusiness} title="Careers" note="Open positions" />
            <QuickLink href="/admin/platform/applications" icon={BriefcaseBusiness} title="Applications" note="Candidates and CVs" />
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
  client,
  setClient,
  clientOptions,
  total,
  open,
  quoteNeeded,
  awaitingPayment,
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
  client: string;
  setClient: (value: string) => void;
  clientOptions: Array<{ value: string; label: string }>;
  total: number;
  open: number;
  quoteNeeded: number;
  awaitingPayment: number;
}) {
  return (
    <div className="heyy-admin-stack">
      <section className="heyy-admin-metrics four">
        <MetricCard icon={ClipboardList} label="All requests" value={total} note="Across every Studio" tone="purple" />
        <MetricCard icon={CircleGauge} label="Open requests" value={open} note="Still in the quote workflow" tone="blue" />
        <MetricCard icon={AlertCircle} label="Quote required" value={quoteNeeded} note="Needs admin review" tone="amber" />
        <MetricCard icon={CreditCard} label="Awaiting payment" value={awaitingPayment} note="Quote sent to client" tone="green" />
      </section>

      <Panel
        eyebrow="Commercial workflow"
        title="Requests & quotes"
        description="Search real Studio requests, review scope and follow each quote through payment."
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
          <AdminFilter value={quoteStatus} options={quoteStatusOptions} onChange={setQuoteStatus} label="Filter requests by quote status" />
          <AdminFilter value={client} options={clientOptions} onChange={setClient} label="Filter requests by client" />
        </AdminToolbar>
        <div className="heyy-request-grid">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              quote={quoteByRequest.get(String(request.id))}
            />
          ))}
          {!requests.length && (
            <div className="heyy-grid-empty">
              <EmptyState
                icon={Search}
                title="No matching requests"
                description="Try another search, Studio or status filter."
              />
            </div>
          )}
        </div>
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
  unreadMessageCounts: Map<string, number>;
  revisionCounts: Map<string, number>;
}) {
  const reviewCount = jobs.filter((job) =>
    ["Ready For Review", "Client Reviewing"].includes(job.status),
  ).length;
  const deliveredCount = jobs.filter((job) =>
    ["Delivered", "Completed", "Approved"].includes(job.status),
  ).length;

  return (
    <div className="heyy-admin-stack">
      <section className="heyy-admin-metrics four">
        <MetricCard icon={Layers3} label="All production" value={total} note="Paid operational jobs" tone="purple" />
        <MetricCard icon={CircleGauge} label="Active jobs" value={active} note="Currently being produced" tone="blue" />
        <MetricCard icon={FileCheck2} label="Review stages" value={reviewCount} note="Waiting on review or approval" tone="amber" />
        <MetricCard icon={CheckCircle2} label="Delivered" value={deliveredCount} note="Approved or completed" tone="green" />
      </section>

      <Panel
        eyebrow="Operations"
        title="Production queue"
        description="Manage workload, client communication, revisions and final delivery."
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
        <div className="heyy-production-list">
          {jobs.map((job) => (
            <ProductionRow
              key={job.id}
              job={job}
              unread={unreadMessageCounts.get(String(job.id)) || 0}
              revisions={revisionCounts.get(String(job.id)) || 0}
              detailed
            />
          ))}
          {!jobs.length && (
            <EmptyState
              icon={Search}
              title="No matching production jobs"
              description="Try another search, Studio or status filter."
            />
          )}
        </div>
      </Panel>
    </div>
  );
}

function InboxPanel({
  jobs,
  unreadMessageCounts,
  contacts,
  applications,
}: {
  jobs: any[];
  unreadMessageCounts: Map<string, number>;
  contacts: any[];
  applications: any[];
}) {
  const messageJobs = jobs.filter(
    (job) => (unreadMessageCounts.get(String(job.id)) || 0) > 0,
  );

  return (
    <div className="heyy-admin-stack">
      <section className="heyy-admin-metrics four">
        <MetricCard icon={MessageSquare} label="Client messages" value={messageJobs.length} note="Production conversations" tone="purple" />
        <MetricCard icon={Mail} label="Contact forms" value={contacts.filter((item) => String(item.status || "new").toLowerCase() === "new").length} note="New website submissions" tone="pink" />
        <MetricCard icon={BriefcaseBusiness} label="Applications" value={applications.filter((item) => String(item.status || "new").toLowerCase() === "new").length} note="New career applicants" tone="blue" />
        <MetricCard icon={Inbox} label="Total inbox" value={messageJobs.length + contacts.length + applications.length} note="All live communication records" tone="green" />
      </section>

      <section className="heyy-admin-two-column">
        <Panel
          eyebrow="Production communication"
          title="Unread client messages"
          description="Messages are linked directly to the paid production workspace."
        >
          <div className="heyy-compact-list">
            {messageJobs.map((job) => (
              <ProductionRow
                key={job.id}
                job={job}
                unread={unreadMessageCounts.get(String(job.id)) || 0}
                revisions={0}
              />
            ))}
            {!messageJobs.length && (
              <EmptyState icon={MessageSquare} title="All messages answered" description="There are no unread client production messages." />
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Website forms"
          title="Contact submissions"
          description="Real enquiries submitted through the public contact page."
          action={<Link href="/admin/platform/contact">Manage all <ArrowRight size={14} /></Link>}
        >
          <div className="heyy-submission-list">
            {contacts.slice(0, 6).map((item) => (
              <SubmissionRow
                key={item.id}
                icon={Mail}
                title={item.name || item.email || "Contact submission"}
                description={item.topic || truncate(item.message, 90)}
                status={item.status || "New"}
                date={item.created_at}
                href="/admin/platform/contact"
              />
            ))}
            {!contacts.length && (
              <EmptyState icon={Mail} title="No contact submissions" description="Website contact forms will appear here." />
            )}
          </div>
        </Panel>
      </section>

      <Panel
        eyebrow="People"
        title="Career applications"
        description="Review genuine applications from the public Careers page."
        action={<Link href="/admin/platform/applications">View applications <ArrowRight size={14} /></Link>}
      >
        <div className="heyy-submission-grid">
          {applications.slice(0, 8).map((item) => (
            <SubmissionRow
              key={item.id}
              icon={BriefcaseBusiness}
              title={item.name || item.email || "Career application"}
              description={item.location || item.portfolio_url || "Candidate application"}
              status={item.status || "New"}
              date={item.created_at}
              href={`/admin/platform/applications?application=${encodeURIComponent(String(item.id || ""))}`}
            />
          ))}
          {!applications.length && (
            <div className="heyy-grid-empty">
              <EmptyState icon={BriefcaseBusiness} title="No career applications" description="New candidate submissions will appear here." />
            </div>
          )}
        </div>
      </Panel>
    </div>
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

function RequestCard({ request, quote }: { request: any; quote?: any }) {
  const studio = getStudioIdentity(request.studio || request.metadata?.studio);
  const requestStatus = request.status || "New";
  const quoteStatus = quote?.status || "Not sent";

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
        {detailed && (
          <div className="heyy-production-meta">
            <span><CalendarDays size={13} /> {formatDate(job.created_at)}</span>
            <span>{studio.label}</span>
            {job.client_name && <span>{job.client_name}</span>}
          </div>
        )}
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
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="heyy-admin-panel">
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
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  note: string;
  tone: keyof typeof TONE_STYLES;
}) {
  const style = TONE_STYLES[tone];
  return (
    <article className="heyy-metric-card">
      <span className="heyy-metric-icon" style={{ color: style.accent, background: style.soft, borderColor: style.border }}>
        <Icon size={18} />
      </span>
      <div className="heyy-metric-value">{value}</div>
      <strong>{label}</strong>
      <p>{note}</p>
    </article>
  );
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
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const monthIndex = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    if (
      Number.isInteger(year) &&
      Number.isInteger(monthIndex) &&
      Number.isInteger(day) &&
      monthIndex >= 0 &&
      monthIndex < SHORT_MONTHS.length &&
      day >= 1 &&
      day <= 31
    ) {
      return `${day} ${SHORT_MONTHS[monthIndex]} ${year}`;
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Not set";
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
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
      radial-gradient(circle at 8% 4%, rgba(108,0,255,.09), transparent 26%),
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
    color: #6c00ff;
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
  .heyy-admin-button-secondary:hover { border-color: #8b4bff; color: #5a00d6; background: #f5edff; transform: translateY(-2px); }
  .heyy-admin-button-primary { border: 1px solid #17151f; color: #fff; background: #17151f; }
  .heyy-admin-button-primary:hover { border-color: #6c00ff; background: #6c00ff; transform: translateY(-2px); box-shadow: 0 12px 28px rgba(108,0,255,.25); }
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
  .heyy-admin-tabs button:hover { color: #5c00d8; background: #f5efff; }
  .heyy-admin-tabs button[data-active="true"] { color: #fff; background: #6c00ff; box-shadow: 0 10px 24px rgba(108,0,255,.24); }
  .heyy-admin-tabs b {
    min-width: 23px;
    height: 23px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(108,0,255,.10);
    color: #6c00ff;
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
  .heyy-metric-card:hover { transform: translateY(-3px); border-color: #b78cff; box-shadow: 0 18px 42px rgba(108,0,255,.11); }
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
  .heyy-panel-heading > div:first-child > span { color: #6c00ff; font-size: 10px; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
  .heyy-panel-heading h2 { margin: 6px 0 0; font-size: 24px; letter-spacing: -.035em; font-weight: 950; }
  .heyy-panel-heading p { margin: 6px 0 0; color: #756e7d; font-size: 12px; line-height: 1.55; font-weight: 620; }
  .heyy-panel-action a { display: inline-flex; align-items: center; gap: 6px; color: #6c00ff; font-size: 12px; font-weight: 900; }
  .heyy-panel-action a:hover { color: #4700ad; }
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
  .heyy-attention-row:hover { transform: translateX(3px); border-color: #a66fff; background: #faf7ff; box-shadow: 0 10px 24px rgba(108,0,255,.08); }
  .heyy-attention-icon { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid; border-radius: 13px; }
  .heyy-attention-eyebrow { display: flex; gap: 5px; color: #81778a; font-size: 9px; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
  .heyy-attention-row strong { display: block; margin-top: 3px; font-size: 13px; }
  .heyy-attention-row p { margin: 3px 0 0; color: #756e7d; font-size: 11px; line-height: 1.45; }
  .heyy-attention-action { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; color: #6c00ff; font-size: 10px; font-weight: 900; }
  .heyy-pipeline-list { display: grid; gap: 16px; }
  .heyy-pipeline-label { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 9px; font-size: 12px; }
  .heyy-pipeline-label > span { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; color: #6c00ff; background: #f2e9ff; }
  .heyy-pipeline-label b { font-size: 15px; }
  .heyy-pipeline-track { height: 7px; margin: 7px 0 0 39px; border-radius: 999px; background: #eee9f2; overflow: hidden; }
  .heyy-pipeline-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#6c00ff,#1676e8); }
  .heyy-admin-inline-actions { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 22px; }
  .heyy-admin-link-button { min-height: 39px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 14px; border-radius: 999px; color: #fff; background: #17151f; font-size: 11px; font-weight: 900; transition: .2s ease; }
  .heyy-admin-link-button:hover { background: #6c00ff; transform: translateY(-2px); }
  .heyy-admin-link-button.muted { color: #4d4656; background: #f2eff5; }
  .heyy-admin-link-button.muted:hover { color: #5b00d6; background: #eee3ff; }
  .heyy-studio-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 11px; }
  .heyy-studio-workload { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 11px; align-items: center; min-height: 82px; padding: 14px; border: 1px solid var(--studio-border); border-radius: 18px; background: linear-gradient(135deg,var(--studio-soft),#fff); }
  .heyy-studio-workload strong { display: block; font-size: 12px; }
  .heyy-studio-workload span { display: block; margin-top: 3px; color: #756e7d; font-size: 10px; }
  .heyy-studio-count { text-align: right; }
  .heyy-studio-count b { color: var(--studio-accent); font-size: 22px; line-height: 1; }
  .heyy-quick-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
  .heyy-quick-link { min-height: 72px; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 12px; border: 1px solid #e4deea; border-radius: 16px; color: #211c28; background: #fff; transition: .2s ease; }
  .heyy-quick-link:hover { border-color: #a66fff; background: #faf7ff; transform: translateY(-2px); }
  .heyy-quick-link > span { width: 35px; height: 35px; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; color: #6c00ff; background: #f2e9ff; }
  .heyy-quick-link strong { display: block; font-size: 11px; }
  .heyy-quick-link p { margin: 3px 0 0; color: #7b7482; font-size: 9px; }
  .heyy-admin-toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .heyy-admin-search { flex: 1 1 300px; }
  .heyy-admin-filter { flex: 0 1 190px; min-width: 165px; }
  .heyy-admin-search { min-height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 1px solid #ded8e5; border-radius: 15px; background: #f9f8fb; }
  .heyy-admin-search:focus-within { border-color: #8b4bff; box-shadow: 0 0 0 4px rgba(108,0,255,.10); background: #fff; }
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
  .heyy-alert-chip { min-height: 28px; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; border-radius: 999px; color: #6c00ff; background: #eee2ff; font-size: 9px; font-weight: 950; }
  .heyy-alert-chip.amber { color: #a65300; background: #fff0d5; }
  .heyy-studio-glyph { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid; border-radius: 13px; flex: 0 0 auto; }
  .heyy-submission-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
  .heyy-submission-row { min-height: 72px; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 11px; padding: 12px; border: 1px solid #e5dfea; border-radius: 15px; color: #211c28; background: #fff; transition: .2s ease; }
  .heyy-submission-row:hover { border-color: #a66fff; background: #faf7ff; transform: translateY(-2px); }
  .heyy-submission-row > span { width: 35px; height: 35px; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; color: #6c00ff; background: #f2e9ff; }
  .heyy-submission-row strong { display: block; font-size: 11px; }
  .heyy-submission-row p { margin: 3px 0 0; color: #77707e; font-size: 9px; line-height: 1.4; }
  .heyy-submission-side { text-align: right; }
  .heyy-submission-side b { display: block; color: #6c00ff; font-size: 9px; text-transform: uppercase; }
  .heyy-submission-side small { display: block; margin-top: 4px; color: #99919e; font-size: 8px; }
  .heyy-empty-state { min-height: 170px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; border: 1px dashed #d9d1e0; border-radius: 18px; background: #faf9fb; }
  .heyy-empty-state > span { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; color: #6c00ff; background: #eee3ff; }
  .heyy-empty-state strong { margin-top: 11px; font-size: 13px; }
  .heyy-empty-state p { max-width: 360px; margin: 5px 0 0; color: #817989; font-size: 10px; line-height: 1.5; }
  .heyy-grid-empty { grid-column: 1 / -1; }
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
