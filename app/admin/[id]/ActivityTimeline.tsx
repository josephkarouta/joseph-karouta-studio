"use client";

import { useState } from "react";

export default function ActivityTimeline({
  leadId,
  activities,
}: {
  leadId: number;
  activities: any[];
}) {
  const [activity, setActivity] = useState("");
  const [saving, setSaving] = useState(false);

  const deleteActivity = async (id: number) => {
  await fetch("/api/project-activity-delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id,
    }),
  });

  location.reload();
};

const saveActivity = async () => {
  if (!activity.trim()) return;

  setSaving(true);

  await fetch("/api/project-activity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      lead_id: leadId,
      content: activity,
      type: "note",
    }),
  });

  setActivity("");
  setSaving(false);
  location.reload();
};

  return (
  <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/40">
      Activity Timeline
    </p>

    <div className="flex gap-3">
      <input
        value={activity}
        onChange={(e) => setActivity(e.target.value)}
        placeholder="Add activity..."
        className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-white outline-none focus:border-purple-400"
      />

      <button
        onClick={saveActivity}
        disabled={saving}
        className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black"
      >
        {saving ? "Saving..." : "Add"}
      </button>
    </div>

    <div className="mt-5 flex flex-wrap gap-3">
      {activities.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
        >
          <div className="flex flex-col">
            <span>{item.content}</span>

            <span className="text-[10px] text-white/40">
              {new Date(item.created_at).toLocaleString("en-AU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <button
            onClick={() => deleteActivity(item.id)}
            className="mt-0 rounded-full border border-red-500/30 px-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
        >
          ×
        </button>
        </div>
      ))}
    </div>
  </div>
);
}