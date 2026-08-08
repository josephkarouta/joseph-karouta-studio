import { createClient } from "@supabase/supabase-js";
import AdminCommandCenter from "@/components/admin/AdminCommandCenter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminTab = "overview" | "requests" | "production" | "inbox";

type AdminPageProps = {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function loadTable(table: string) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`Admin dashboard could not load ${table}:`, error.message);
    return [];
  }

  return data || [];
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {});
  const rawTab = resolvedSearchParams.tab;
  const requestedTab = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  const allowedTabs: AdminTab[] = [
    "overview",
    "requests",
    "production",
    "inbox",
  ];
  const initialTab: AdminTab = allowedTabs.includes(requestedTab as AdminTab)
    ? (requestedTab as AdminTab)
    : "overview";

  const [
    requests,
    quotes,
    jobs,
    revisions,
    messages,
    payments,
    contacts,
    applications,
  ] = await Promise.all([
    loadTable("studio_requests"),
    loadTable("workspace_quotes"),
    loadTable("production_jobs"),
    loadTable("workspace_revisions"),
    loadTable("production_messages"),
    loadTable("payments"),
    loadTable("contact_submissions"),
    loadTable("career_applications"),
  ]);

  return (
    <AdminCommandCenter
      requests={requests}
      quotes={quotes}
      jobs={jobs}
      revisions={revisions}
      messages={messages}
      payments={payments}
      contacts={contacts}
      applications={applications}
      initialTab={initialTab}
    />
  );
}
