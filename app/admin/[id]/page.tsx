import ActivityTimeline from "./ActivityTimeline";
import QuoteValue from "./QuoteValue";
import StatusButtons from "./StatusButtons";
import ProjectTag from "./ProjectTag";
import FileAttachments from "./FileAttachments";
import FileUploader from "./FileUploader";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: lead } = await supabase
  .from("leads")
  .select("*")
  .eq("id", id)
  .single();

const { data: activities } = await supabase
  .from("project_activities")
  .select("*")
  .eq("lead_id", id)
  .order("created_at", { ascending: false });

  if (!lead) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        Project not found.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-5xl">

        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          {lead.project_id}
        </p>

        <h1 className="mt-3 text-5xl font-black">
  {lead.name}
</h1>

<StatusButtons
  id={lead.id}
  currentStatus={lead.status || "New"}
/>

<ProjectTag
  id={lead.id}
  currentTag={lead.project_tag || ""}
/>

<QuoteValue
  id={lead.id}
  initialValue={lead.quote_value}
  quoteHistory={lead.quote_history || []}
/>

<ActivityTimeline
  leadId={lead.id}
  activities={activities || []}
/>

<div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="mb-4 text-xl font-bold">Project Brief</h2>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
  <h2 className="mb-4 text-xl font-bold">Client Details</h2>

  <p className="text-white/60">Email: {lead.email}</p>
  <p className="text-white/60">Phone: {lead.phone}</p>
  <p className="text-white/60">Company: {lead.company || "—"}</p>

  <div className="mt-6 flex flex-wrap gap-3">
    {lead.email && (
      <a
        href={`mailto:${lead.email}`}
        className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-white/80"
      >
        Email Client
      </a>
    )}

    {lead.phone && (
      <a
        href={`tel:${lead.phone}`}
        className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-white hover:bg-white/10"
      >
        Call Client
      </a>
    )}
  </div>
</div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <h2 className="mb-4 text-xl font-bold">Files</h2>

    <FileAttachments attachments={lead.attachments || []} />
    <FileUploader leadId={lead.id} />
  </div>
</div>

          <div className="whitespace-pre-wrap text-white/80">
            {lead.project_brief}
          </div>
          
        </div>

      </div>
    </main>
  );
}