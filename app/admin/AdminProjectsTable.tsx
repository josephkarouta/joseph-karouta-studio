"use client";

import { useState } from "react";

export default function AdminProjectsTable({ leads }: { leads: any[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const statuses = ["All", "New", "Reviewing", "Quoted", "Won", "Lost"];

  const filteredLeads = leads.filter((lead) => {
    const searchText = `${lead.project_id} ${lead.name} ${lead.email} ${lead.company}`
      .toLowerCase();

    const matchesSearch = searchText.includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="mt-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects, names, emails or companies..."
          className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white outline-none placeholder:text-white/35 md:max-w-md"
        />

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
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="p-4">Project ID</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Company</th>
              <th className="p-4">Files</th>
            </tr>
          </thead>

          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="border-t border-white/10">
                <td className="p-4">
                  <a
                    href={`/admin/${lead.id}`}
                    className="text-[#A78BFA] hover:underline"
                  >
                    {lead.project_id}
                  </a>
                </td>

                <td className="p-4">
                  <span
  className={`rounded-full px-3 py-1 text-xs font-bold ${
    lead.status === "New"
      ? "bg-blue-500/20 text-blue-300"
      : lead.status === "Reviewing"
      ? "bg-yellow-500/20 text-yellow-300"
      : lead.status === "Quoted"
      ? "bg-purple-500/20 text-purple-300"
      : lead.status === "Won"
      ? "bg-green-500/20 text-green-300"
      : lead.status === "Lost"
      ? "bg-red-500/20 text-red-300"
      : "bg-white/10 text-white"
  }`}
>
  {lead.status}
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

                <td className="p-4">{lead.name}</td>
                <td className="p-4 text-white/60">{lead.email}</td>
                <td className="p-4 text-white/60">{lead.company || "—"}</td>
                <td className="p-4 text-white/60">
                  {lead.attachments?.length || 0}
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