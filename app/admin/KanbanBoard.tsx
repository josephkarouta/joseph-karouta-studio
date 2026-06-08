"use client";

export default function KanbanBoard({
  leads,
}: {
  leads: any[];
}) {
  const columns = [
    "New",
    "Reviewing",
    "Quoted",
    "Won",
    "Lost",
  ];

  return (
    <div className="mt-10 grid gap-4 md:grid-cols-5">
      {columns.map((column) => (
        <div
          key={column}
          className="rounded-3xl border border-white/10 bg-white/5 p-4"
        >
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-white/40">
            {column}
          </p>

          <div className="space-y-3">
            {leads
              .filter((lead) => lead.status === column)
              .map((lead) => (
                <a
                  key={lead.id}
                  href={`/admin/${lead.id}`}
                  className="block rounded-2xl border border-white/10 bg-black/30 p-4 hover:border-[#A78BFA]"
                >
                  <p className="text-xs text-white/40">
                    {lead.project_id}
                  </p>

                  <p className="mt-2 font-bold">
                    {lead.name}
                  </p>

                  <p className="mt-1 text-xs text-white/50">
                    ${Number(lead.quote_value || 0).toLocaleString()}
                  </p>
                </a>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}