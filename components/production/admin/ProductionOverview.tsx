"use client";

type ProductionOverviewProps = {
  job: any;
  metadata: any;
  status: string;
};

export default function ProductionOverview({
  job,
  metadata,
  status,
}: ProductionOverviewProps) {
  const action = getNextAction(status);

  const brief =
    metadata.selected_application?.description ||
    metadata.description ||
    job.notes ||
    "No production brief was attached.";

  return (
    <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-xl hover:shadow-violet-900/10">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-gradient-to-br from-white to-violet-50 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={status} strong />
            <Badge value={job.delivery_status || "Pending"} />
            <Badge value={job.priority || "Normal"} />
          </div>

          <p className="mt-7 text-[10px] font-black uppercase tracking-[0.22em] text-violet-600">
            Current Action
          </p>

          <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.04em] text-slate-950 md:text-4xl">
            {action.title}
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            {action.description}
          </p>
        </div>

        <div className="border-t border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 md:p-8 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
            Production Brief
          </p>

          <p className="mt-3 line-clamp-6 text-sm leading-7 text-slate-600">
            {brief}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Summary label="Project" value={job.project_name || "-"} tone="purple" />
            <Summary label="Service" value={job.service || "-"} tone="blue" />
            <Summary label="Studio" value={job.studio || "-"} tone="pink" />
            <Summary
              label="Assigned"
              value={job.assigned_studio || "Unassigned"}
              tone="emerald"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function getNextAction(status: string) {
  switch (status) {
    case "Waiting Assignment":
      return {
        title: "Assign the job and confirm the production owner.",
        description:
          "Review the brief, choose the responsible studio and move the job to Assigned.",
      };
    case "Assigned":
      return {
        title: "Start production when the team is ready.",
        description:
          "Confirm the brief and source material, then move the job to In Progress.",
      };
    case "In Progress":
      return {
        title: "Complete the active work and prepare files.",
        description:
          "Respond to any active revision request or prepare the final production files for delivery.",
      };
    case "Ready For Review":
    case "Client Reviewing":
      return {
        title: "Client review is the next required action.",
        description:
          "Monitor feedback and use the revision workspace when changes are requested.",
      };
    case "Approved":
      return {
        title: "Prepare the approved work for final delivery.",
        description:
          "Upload the production-ready file, mark one version Final and deliver it to the client.",
      };
    case "Delivered":
      return {
        title: "This delivery is complete.",
        description:
          "The delivered file is locked. New uploads remain private until a new version is marked Final and delivered.",
      };
    default:
      return {
        title: "Review the job and choose the next production step.",
        description:
          "Use the Job Control panel to update status, priority and assigned studio.",
      };
  }
}

function Badge({ value, strong = false }: { value: string; strong?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.17em] ${
        strong
          ? "border-violet-200 bg-violet-100 text-violet-700"
          : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {value}
    </span>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "purple" | "blue" | "pink" | "emerald";
}) {
  const styles = {
    purple: "border-violet-200 bg-violet-50",
    blue: "border-blue-200 bg-blue-50",
    pink: "border-pink-200 bg-pink-50",
    emerald: "border-emerald-200 bg-emerald-50",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${styles}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 truncate text-xs font-bold text-slate-800">{value}</p>
    </div>
  );
}
