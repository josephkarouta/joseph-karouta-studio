import { createClient } from "@supabase/supabase-js";
import ClientHistoryManager, {
  type AdminClientHistory,
  type AdminClientActivity,
} from "@/components/admin/platform/ClientHistoryManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return String(value || "").trim();
}

function dateValue(value: unknown) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function activity(
  type: AdminClientActivity["type"],
  title: string,
  detail: string,
  createdAt: unknown,
  href?: string,
): AdminClientActivity {
  return {
    type,
    title,
    detail,
    createdAt: text(createdAt) || null,
    href: href || null,
  };
}

async function loadRows(table: string) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error(`Client history could not load ${table}:`, error.message);
    return [] as any[];
  }
  return (data || []) as any[];
}

export default async function AdminClientsPage() {
  const [authResult, projects, requests, quotes, jobs, payments, wallets, subscriptions] =
    await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      loadRows("studio_projects"),
      loadRows("studio_requests"),
      loadRows("workspace_quotes"),
      loadRows("production_jobs"),
      loadRows("payments"),
      loadRows("credit_wallets"),
      loadRows("user_subscriptions"),
    ]);

  const users = authResult.data?.users || [];
  const walletByUser = new Map(wallets.map((row) => [text(row.user_id), row]));
  const subscriptionByUser = new Map(
    subscriptions.map((row) => [text(row.user_id), row]),
  );
  const requestById = new Map(requests.map((row) => [text(row.id), row]));
  const jobById = new Map(jobs.map((row) => [text(row.id), row]));
  const projectOwnerById = new Map(
    projects.map((row) => [text(row.id), text(row.user_id)]),
  );
  const quoteById = new Map(quotes.map((row) => [text(row.id), row]));

  function quoteUserId(quote: any) {
    const request = requestById.get(text(quote.studio_request_id));
    if (request?.user_id) return text(request.user_id);
    const job = jobById.get(text(quote.production_job_id));
    if (job?.user_id) return text(job.user_id);
    return projectOwnerById.get(text(quote.project_id)) || "";
  }

  function paymentUserId(payment: any) {
    const quote = quoteById.get(text(payment.quote_id));
    return quote ? quoteUserId(quote) : "";
  }

  const clients: AdminClientHistory[] = users.map((user) => {
    const userId = user.id;
    const userProjects = projects.filter((row) => text(row.user_id) === userId);
    const userRequests = requests.filter((row) => text(row.user_id) === userId);
    const userQuotes = quotes.filter((row) => quoteUserId(row) === userId);
    const userJobs = jobs.filter((row) => text(row.user_id) === userId);
    const userPayments = payments.filter((row) => paymentUserId(row) === userId);
    const wallet = walletByUser.get(userId) || {};
    const subscription = subscriptionByUser.get(userId) || {};

    const paidRevenue = userPayments
      .filter((row) => ["paid", "succeeded", "completed"].includes(text(row.status).toLowerCase()))
      .reduce((sum, row) => sum + numberValue(row.amount), 0);

    const outstandingQuoteValue = userQuotes
      .filter((row) => ["sent", "quoted", "pending", "awaiting payment"].includes(text(row.status).toLowerCase()))
      .reduce((sum, row) => sum + numberValue(row.amount), 0);

    const activities: AdminClientActivity[] = [
      ...userProjects.map((row) =>
        activity(
          "project",
          text(row.name || row.title || row.project_name) || "Studio project",
          text(row.studio || row.project_type) || "Project created",
          row.updated_at || row.created_at,
          row.id ? `/projects/${row.id}` : undefined,
        ),
      ),
      ...userRequests.map((row) =>
        activity(
          "request",
          text(row.project_name || row.service) || "Production request",
          `${text(row.service) || "Expert production"} · ${text(row.status) || "New"}`,
          row.updated_at || row.created_at,
          row.id ? `/admin/studio-requests/${row.id}` : undefined,
        ),
      ),
      ...userQuotes.map((row) =>
        activity(
          "quote",
          text(row.title) || "Quote",
          `${text(row.status) || "Sent"} · ${text(row.currency || "USD")} ${numberValue(row.amount).toLocaleString("en-US")}`,
          row.updated_at || row.created_at,
          row.studio_request_id ? `/admin/studio-requests/${row.studio_request_id}` : undefined,
        ),
      ),
      ...userJobs.map((row) =>
        activity(
          "production",
          text(row.project_name || row.service) || "Production job",
          `${text(row.service) || "Production"} · ${text(row.status) || "Waiting Assignment"}`,
          row.updated_at || row.created_at,
          row.id ? `/admin/production/${row.id}` : undefined,
        ),
      ),
      ...userPayments.map((row) =>
        activity(
          "payment",
          "Production payment",
          `${text(row.currency || "USD")} ${numberValue(row.amount).toLocaleString("en-US")} · ${text(row.status) || "Paid"}`,
          row.paid_at || row.created_at,
        ),
      ),
    ]
      .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
      .slice(0, 60);

    const latestActivity = activities[0]?.createdAt || user.last_sign_in_at || user.created_at;
    const monthly = numberValue((wallet as any).monthly_balance);
    const purchased = numberValue((wallet as any).purchased_balance);
    const reserved = numberValue((wallet as any).reserved_balance);

    return {
      id: userId,
      name:
        text(user.user_metadata?.full_name || user.user_metadata?.name) ||
        text(user.email) ||
        "Heyy Studio user",
      email: text(user.email) || "No email",
      plan: text((subscription as any).plan || "free").toLowerCase(),
      subscriptionStatus: text((subscription as any).status || "free").toLowerCase(),
      availableCredits: Math.max(0, monthly + purchased - reserved),
      projectCount: userProjects.length,
      requestCount: userRequests.length,
      quoteCount: userQuotes.length,
      productionCount: userJobs.length,
      paidRevenue,
      outstandingQuoteValue,
      joinedAt: user.created_at || null,
      lastActivityAt: latestActivity || null,
      activities,
    };
  });

  clients.sort((a, b) => dateValue(b.lastActivityAt) - dateValue(a.lastActivityAt));

  return <ClientHistoryManager clients={clients} />;
}
