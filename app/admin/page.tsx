import KanbanBoard from "./KanbanBoard";
import AdminProjectsTable from "./AdminProjectsTable";
import LeadsChart from "./LeadsChart";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminPage() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
    const newCount =
  leads?.filter((lead) => lead.status === "New").length || 0;

const reviewingCount =
  leads?.filter((lead) => lead.status === "Reviewing").length || 0;

const quotedCount =
  leads?.filter((lead) => lead.status === "Quoted").length || 0;

const wonCount =
  leads?.filter((lead) => lead.status === "Won").length || 0;

const lostCount =
  leads?.filter((lead) => lead.status === "Lost").length || 0;
const quotedPipeline =
  leads
    ?.filter((lead) => lead.status === "Quoted")
    .reduce(
      (sum, lead) => sum + Number(lead.quote_value || 0),
      0
    ) || 0;

const wonRevenue =
  leads
    ?.filter((lead) => lead.status === "Won")
    .reduce(
      (sum, lead) => sum + Number(lead.quote_value || 0),
      0
    ) || 0;

const averageQuote =
  leads?.length
    ? Math.round(
        leads.reduce(
          (sum, lead) => sum + Number(lead.quote_value || 0),
          0
        ) / leads.length
      )
    : 0;

  if (error) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <p>Could not load projects.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          Heyy Studio Admin
        </p>

        <h1 className="mt-4 text-5xl font-black">Project Enquiries</h1>

        <div className="mt-10 grid gap-4 md:grid-cols-5">

  <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <p className="text-sm text-white/50">New</p>
    <p className="mt-2 text-4xl font-black">{newCount}</p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <p className="text-sm text-white/50">Reviewing</p>
    <p className="mt-2 text-4xl font-black">{reviewingCount}</p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <p className="text-sm text-white/50">Quoted</p>
    <p className="mt-2 text-4xl font-black">{quotedCount}</p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <p className="text-sm text-white/50">Won</p>
    <p className="mt-2 text-4xl font-black">{wonCount}</p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <p className="text-sm text-white/50">Lost</p>
    <p className="mt-2 text-4xl font-black">{lostCount}</p>
  </div>

</div>

<div className="mt-4 grid gap-4 md:grid-cols-3">

  <div className="rounded-3xl border border-purple-500/20 bg-purple-500/10 p-6">
    <p className="text-sm text-purple-300">
      Quoted Pipeline
    </p>

    <p className="mt-2 text-4xl font-black">
      ${quotedPipeline.toLocaleString()}
    </p>
  </div>

  <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-6">
    <p className="text-sm text-green-300">
      Won Revenue
    </p>

    <p className="mt-2 text-4xl font-black">
      ${wonRevenue.toLocaleString()}
    </p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <p className="text-sm text-white/50">
      Average Quote
    </p>

    <p className="mt-2 text-4xl font-black">
      ${averageQuote.toLocaleString()}
    </p>
  </div>

</div>
        
        <LeadsChart leads={leads || []} />

        <AdminProjectsTable leads={leads || []} />
      </div>
    </main>
  );
}