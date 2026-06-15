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
    const { data: expertRequests } = await supabase
  .from("expert_requests")
  .select("id,status");

const newExpertRequests =
  expertRequests?.filter(
    (request) =>
      request.status === "New" ||
      !request.status
  ).length || 0;
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

const reviewingPipeline =
  leads
    ?.filter((lead) => lead.status === "Reviewing")
    .reduce(
      (sum, lead) => sum + Number(lead.quote_value || 0),
      0
    ) || 0;

const potentialRevenue =
  quotedPipeline + reviewingPipeline;

const averageQuote =
  leads?.length
    ? Math.round(
        leads.reduce(
          (sum, lead) => sum + Number(lead.quote_value || 0),
          0
        ) / leads.length
      )
    : 0;

    const today = new Date();
today.setHours(0, 0, 0, 0);

const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const sevenDaysFromNow = new Date(today);
sevenDaysFromNow.setDate(today.getDate() + 7);

const overdueFollowUps =
  leads?.filter((lead) => {
    if (!lead.follow_up_date) return false;

    const followUpDate = new Date(lead.follow_up_date);
    followUpDate.setHours(0, 0, 0, 0);

    return followUpDate < today;
  }).length || 0;

const dueTodayFollowUps =
  leads?.filter((lead) => {
    if (!lead.follow_up_date) return false;

    const followUpDate = new Date(lead.follow_up_date);
    followUpDate.setHours(0, 0, 0, 0);

    return followUpDate.getTime() === today.getTime();
  }).length || 0;

const thisWeekFollowUps =
  leads?.filter((lead) => {
    if (!lead.follow_up_date) return false;

    const followUpDate = new Date(lead.follow_up_date);
    followUpDate.setHours(0, 0, 0, 0);

    return followUpDate >= today && followUpDate <= sevenDaysFromNow;
  }).length || 0;

  const upcomingFollowUps =
  leads
    ?.filter((lead) => lead.follow_up_date)
    .sort(
      (a, b) =>
        new Date(a.follow_up_date).getTime() -
        new Date(b.follow_up_date).getTime()
    )
    .slice(0, 10) || [];

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
        {overdueFollowUps > 0 && (
  <a
    href="#followups"
    className="mt-6 block rounded-3xl border border-red-500/30 bg-red-500/10 p-5 transition hover:bg-red-500/15"
  >
    <p className="text-sm font-bold text-red-300">
      ⚠️ {overdueFollowUps} overdue follow-up
      {overdueFollowUps > 1 ? "s" : ""} need attention.
    </p>
  </a>
)}
        <div className="mt-6 flex flex-wrap gap-3">
<a
  href="/admin/expert-requests"
  className="relative rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white hover:text-black transition-all duration-200"
>
  Expert Requests

  {newExpertRequests > 0 && (
    <span className="ml-2 rounded-full bg-purple-500 px-2 py-1 text-xs font-bold text-white">
      {newExpertRequests}
    </span>
  )}
</a>

  <a
    href="/"
    className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white hover:text-black"
  >
    View Website
  </a>
</div>

        <div className="mt-10 grid gap-4 md:grid-cols-6">

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

<div className="rounded-3xl border border-purple-500/20 bg-purple-500/10 p-6">
  <p className="text-sm text-purple-300">New Expert Requests</p>
  <p className="mt-2 text-4xl font-black">{newExpertRequests}</p>
</div>

</div>

<div className="mt-4 grid gap-4 md:grid-cols-4">

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

  <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
  <p className="text-sm text-blue-300">
    Potential Revenue
  </p>

  <p className="mt-2 text-4xl font-black">
    ${potentialRevenue.toLocaleString()}
  </p>
</div>

<div className="mt-4 grid gap-4 md:grid-cols-3">
  <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6">
    <p className="text-sm text-red-300">Overdue Follow Ups</p>
    <p className="mt-2 text-4xl font-black">{overdueFollowUps}</p>
  </div>

  <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-6">
    <p className="text-sm text-yellow-300">Due Today</p>
    <p className="mt-2 text-4xl font-black">{dueTodayFollowUps}</p>
  </div>

  <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
    <p className="text-sm text-blue-300">This Week</p>
    <p className="mt-2 text-4xl font-black">{thisWeekFollowUps}</p>
  </div>
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

<div
  id="followups"
  className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"
>
  <h2 className="text-2xl font-bold">
    Upcoming Follow Ups
  </h2>

  {upcomingFollowUps.length === 0 ? (
    <p className="mt-4 text-white/40">
      No follow ups scheduled.
    </p>
  ) : (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/40">
            <th className="p-4">Date</th>
            <th className="p-4">Client</th>
            <th className="p-4">Status</th>
            <th className="p-4">Action</th>
          </tr>
        </thead>

        <tbody>
          {upcomingFollowUps.map((lead) => (
            <tr
              key={lead.id}
              className="border-b border-white/5"
            >
              <td className="p-4">
                {new Date(
                  lead.follow_up_date
                ).toLocaleDateString("en-AU")}
              </td>

              <td className="p-4 font-bold">
                {lead.name}
              </td>

              <td className="p-4">
                {lead.status}
              </td>

              <td className="p-4">
                <a
                  href={`/admin/${lead.id}`}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white hover:text-black"
                >
                  Open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

        <LeadsChart leads={leads || []} />

        <AdminProjectsTable leads={leads || []} />
      </div>
    </main>
  );
}