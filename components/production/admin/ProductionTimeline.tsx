"use client";

type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  created_at: string;
};

type Props = {
  createdAt: string;
  timeline: TimelineItem[];
};

export default function ProductionTimeline({ createdAt, timeline }: Props) {
  return (
    <section className="rounded-[22px] border border-cyan-200 bg-white p-5">
      <div className="space-y-5">
        <Item
          title="Production Requested"
          description="The client submitted this production request."
          date={createdAt}
        />

        {timeline.map((item) => (
          <Item
            key={item.id}
            title={item.title}
            description={item.description}
            date={item.created_at}
          />
        ))}
      </div>
    </section>
  );
}

function Item({
  title,
  description,
  date,
}: {
  title: string;
  description?: string;
  date: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-violet-500" />
      <div>
        <h4 className="font-black text-slate-900">{title}</h4>
        {description && (
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        )}
        <p className="mt-2 text-xs text-slate-400">{formatDateTime(date)}</p>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
