import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ExpertRequestsPage() {
  const { data: requests, error } = await supabase
  .from("expert_requests")
  .select("*")
  .neq("status", "Converted")
  .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        Could not load expert requests.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <a
          href="/admin"
          className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
        >
          Back to Admin
        </a>

        <p className="mt-10 text-sm uppercase tracking-[0.3em] text-white/40">
          Heyy Studio Admin
        </p>

        <h1 className="mt-3 text-5xl font-black">Expert Requests</h1>

        <div className="mt-10 overflow-hidden rounded-3xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Company</th>
                <th className="p-4">Files</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>

            <tbody>
              {(requests || []).map((request) => (
                <tr key={request.id} className="border-t border-white/10">
                  <td className="p-4 text-white/60">
                    {request.created_at
                      ? new Date(request.created_at).toLocaleDateString(
                          "en-AU",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )
                      : "—"}
                  </td>

                  <td className="p-4">
                    <span
  className={`rounded-full px-3 py-1 text-xs font-bold border ${
    request.status === "New"
      ? "border-blue-500/30 bg-blue-500/20 text-blue-300"
      : request.status === "Reviewing"
      ? "border-yellow-500/30 bg-yellow-500/20 text-yellow-300"
      : request.status === "Quoted"
      ? "border-purple-500/30 bg-purple-500/20 text-purple-300"
      : request.status === "Won"
      ? "border-green-500/30 bg-green-500/20 text-green-300"
      : request.status === "Lost"
      ? "border-red-500/30 bg-red-500/20 text-red-300"
      : "border-white/15 bg-white/10 text-white"
  }`}
>
  {request.status || "New"}
</span>
                  </td>

                  <td className="p-4 font-bold">{request.name}</td>
                  <td className="p-4 text-white/60">{request.email}</td>
                  <td className="p-4 text-white/60">{request.phone}</td>
                  <td className="p-4 text-white/60">
                    {request.company || "—"}
                  </td>

                  <td className="p-4 text-white/60">
                    {request.attachments?.length || 0}
                  </td>

                  <td className="p-4">
                    <a
                      href={`/admin/expert-requests/${request.id}`}
                      className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black hover:bg-white/90"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {requests?.length === 0 && (
            <div className="p-8 text-center text-white/50">
              No expert requests yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}