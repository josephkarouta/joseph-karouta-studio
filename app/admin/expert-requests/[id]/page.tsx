import { createClient } from "@supabase/supabase-js";
import ExpertRequestStatus from "./ExpertRequestStatus";
import ConvertButton from "./ConvertButton";
import DeleteExpertRequestButton from "./DeleteExpertRequestButton";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ExpertRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: request, error } = await supabase
    .from("expert_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !request) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <div className="mx-auto max-w-5xl">
          <p>Request not found.</p>

          <a
            href="/admin/expert-requests"
            className="mt-6 inline-block rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
          >
            Back to Expert Requests
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <a
          href="/admin/expert-requests"
          className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
        >
          Back to Expert Requests
        </a>

        <p className="mt-10 text-sm uppercase tracking-[0.3em] text-white/40">
          Expert Request
        </p>

        <h1 className="mt-3 text-5xl font-black">{request.name}</h1>

<div className="mt-6 flex flex-wrap gap-3">
  <ConvertButton id={request.id} />

  <DeleteExpertRequestButton id={request.id} />
</div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">Client Details</h2>
            <div className="mt-4">
  <ExpertRequestStatus
    id={request.id}
    currentStatus={request.status || "New"}
  />
</div>

            <div className="mt-4 space-y-2 text-white/60">
              <p>Email: {request.email}</p>
              <p>Phone: {request.phone}</p>
              <p>Company: {request.company || "—"}</p>
              <p>Status: {request.status || "New"}</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {request.email && (
                <a
                  href={`mailto:${request.email}`}
                  className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black hover:bg-white/90"
                >
                  Email Client
                </a>
              )}

              {request.phone && (
                <a
                  href={`tel:${request.phone}`}
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
                >
                  Call Client
                </a>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">Files</h2>

            {request.attachments?.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {request.attachments.map((file: string, index: number) => (
                  <a
                    key={file}
                    href={file}
                    target="_blank"
                    className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-300 hover:bg-purple-500/20"
                  >
                    Attachment {index + 1}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-white/50">No files uploaded.</p>
            )}
          </div>
        </div>

        {request.notes && (
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">Notes</h2>
            <p className="mt-4 whitespace-pre-wrap text-white/70">
              {request.notes}
            </p>
          </div>
        )}

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold">Project Brief</h2>

          <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-6 text-sm leading-7 text-white/80">
            {request.project_brief || "No brief saved."}
          </div>
        </div>
      </div>
    </main>
  );
}