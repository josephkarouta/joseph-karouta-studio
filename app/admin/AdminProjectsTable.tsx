"use client";

import { useEffect, useState } from "react";

export default function AdminProjectsTable({ leads }: { leads: any[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

  const statuses = ["All", "New", "Reviewing", "Quoted", "Won", "Lost"];
  const tags = [
    "All",
    "Branding",
    "Website",
    "Architecture",
    "Interior",
    "Events",
  ];

  const filteredLeads = leads.filter((lead) => {
    const searchText = `${lead.project_id || ""} ${lead.name || ""} ${
      lead.email || ""
    } ${lead.company || ""} ${lead.phone || ""}`.toLowerCase();

    const matchesSearch = searchText.includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "All" || lead.status === statusFilter;
    const matchesTag = tagFilter === "All" || lead.project_tag === tagFilter;

    return matchesSearch && matchesStatus && matchesTag;
  });

  function getStatusClass(status: string) {
    if (status === "New") return "bg-blue-500/20 text-blue-300";
    if (status === "Reviewing") return "bg-yellow-500/20 text-yellow-300";
    if (status === "Quoted") return "bg-purple-500/20 text-purple-300";
    if (status === "Won") return "bg-green-500/20 text-green-300";
    if (status === "Lost") return "bg-red-500/20 text-red-300";

    return "bg-white/10 text-white";
  }

  function getFollowUpState(date: string | null) {
    if (!date) return "none";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const followUpDate = new Date(date);
    followUpDate.setHours(0, 0, 0, 0);

    if (followUpDate < today) return "overdue";
    if (followUpDate.getTime() === today.getTime()) return "today";

    return "future";
  }

  function getFollowUpClass(date: string | null) {
    const state = getFollowUpState(date);

    if (state === "overdue") {
      return "border-red-500/30 bg-red-500/10 text-red-300";
    }

    if (state === "today") {
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    }

    if (state === "future") {
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    }

    return "border-white/10 bg-white/5 text-white/30";
  }

  function getFollowUpLabel(date: string | null) {
    if (!date) return "—";

    const state = getFollowUpState(date);
    const formattedDate = new Date(date).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    if (state === "overdue") return `Overdue · ${formattedDate}`;
    if (state === "today") return `Today · ${formattedDate}`;

    return formattedDate;
  }

  if (!mounted) {
  return (
    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/50">
      Loading projects...
    </div>
  );
}

  return (
    <div className="mt-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects, names, emails, phones or companies..."
          className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-purple-400 md:max-w-md"
        />

        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  statusFilter === status
                    ? "bg-white text-black"
                    : "border border-white/15 text-white hover:bg-white hover:text-black"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  tagFilter === tag
                    ? "border border-purple-500/30 bg-purple-500/20 text-purple-300"
                    : "border border-white/15 text-white hover:bg-white hover:text-black"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="p-4">Project ID</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
              <th className="p-4">Name</th>
              <th className="p-4">Tag</th>
              <th className="p-4">Quote</th>
              <th className="p-4">Follow Up</th>
              <th className="p-4">Files</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="border-t border-white/10">
                <td className="p-4">
                  <a
                    href={`/admin/${lead.id}`}
                    className="whitespace-nowrap text-[#A78BFA] hover:underline"
                  >
                    {lead.project_id || `Lead ${lead.id}`}
                  </a>
                </td>

                <td className="p-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                      lead.status
                    )}`}
                  >
                    {lead.status || "New"}
                  </span>
                </td>

                <td className="p-4 text-white/60">
                  {lead.created_at
                    ? new Date(lead.created_at).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "—"}
                </td>

                <td className="p-4 font-medium text-white">
                  {lead.name || "—"}
                </td>

                <td className="p-4">
                  {lead.project_tag ? (
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                      {lead.project_tag}
                    </span>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                </td>

                <td className="p-4 text-white/60">
                  ${Number(lead.quote_value || 0).toLocaleString()}
                </td>

                <td className="p-4">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getFollowUpClass(
                      lead.follow_up_date
                    )}`}
                  >
                    {getFollowUpLabel(lead.follow_up_date)}
                  </span>
                </td>

                <td className="p-4 text-white/60">
                  {lead.attachments?.length || 0}
                </td>

                <td className="p-4">
                  <a
                    href={`/admin/${lead.id}`}
                    className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white hover:text-black"
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLeads.length === 0 && (
          <div className="p-8 text-center text-white/50">
            No projects found.
          </div>
        )}
      </div>
    </div>
  );
}
