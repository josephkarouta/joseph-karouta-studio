import ActivityTimeline from "./ActivityTimeline";
import QuoteValue from "./QuoteValue";
import StatusButtons from "./StatusButtons";
import ProjectTag from "./ProjectTag";
import FileAttachments from "./FileAttachments";
import FileUploader from "./FileUploader";
import { createClient } from "@supabase/supabase-js";
import InternalNotes from "./InternalNotes";
import EmailTemplates from "./EmailTemplates";
import DeleteLeadButton from "./DeleteLeadButton";
import FollowUpDate from "./FollowUpDate";

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

  const { data: allLeads } = await supabase
  .from("leads")
  .select("id")
  .order("id", { ascending: true });

const { data: activities } = await supabase
  .from("project_activities")
  .select("*")
  .eq("lead_id", id)
  .order("created_at", { ascending: false });

  const currentIndex =
  allLeads?.findIndex(
    (item) => item.id === lead?.id
  ) ?? -1;

const previousLead =
  currentIndex > 0
    ? allLeads?.[currentIndex - 1]
    : null;

const nextLead =
  currentIndex < (allLeads?.length || 0) - 1
    ? allLeads?.[currentIndex + 1]
    : null;

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
        
        <div className="flex flex-wrap items-center gap-3">

  {previousLead && (
    <a
      href={`/admin/${previousLead.id}`}
      className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
    >
      ← Previous
    </a>
  )}

  <a
    href="/admin"
    className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
  >
    Back to Admin
  </a>

  {nextLead && (
    <a
      href={`/admin/${nextLead.id}`}
      className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
    >
      Next →
    </a>
  )}

</div>

        <p className="mt-8 text-sm uppercase tracking-[0.3em] text-white/40">
          {lead.project_id}
        </p>

        <h1 className="mt-3 text-5xl font-black">
  {lead.name}
</h1>

<div className="mt-6 grid gap-4 md:grid-cols-5">
  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
      Project ID
    </p>
    <p className="mt-2 text-lg font-bold text-white">
      {lead.project_id || "—"}
    </p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
      Status
    </p>
    <p className="mt-2 text-lg font-bold text-white">
      {lead.status || "New"}
    </p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
      Tag
    </p>
    <p className="mt-2 text-lg font-bold text-white">
      {lead.project_tag || "—"}
    </p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
      Current Quote
    </p>
    <p className="mt-2 text-lg font-bold text-white">
      ${Number(lead.quote_value || 0).toLocaleString()}
    </p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
    <p className="text-xs uppercase tracking-[0.25em] text-white/35">
      Created
    </p>
    <p className="mt-2 text-lg font-bold text-white">
      {lead.created_at
        ? new Date(lead.created_at).toLocaleDateString("en-AU", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—"}
    </p>
  </div>
</div>

<div className="mt-6 flex flex-wrap gap-3">
  <DeleteLeadButton id={lead.id} />
</div>

<FollowUpDate
  id={lead.id}
  initialDate={lead.follow_up_date}
/>

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

<div className="mt-6">
  <InternalNotes
    id={lead.id}
    initialNotes={lead.internal_notes || "[]"}
  />
</div>

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
          className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90"
        >
          Email Client
        </a>
      )}

      {lead.phone && (
        <a
          href={`tel:${lead.phone}`}
          className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-black"
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

<div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-8">
  <h2 className="mb-6 text-xl font-bold">Project Brief</h2>

  <div className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-6 text-sm leading-7 text-white/80">
    {lead.project_brief || "No project brief saved."}
  </div>
</div>

      </div>
    </main>
  );
}