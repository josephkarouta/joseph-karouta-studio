"use client";

import { useState } from "react";

export default function FollowUpDate({
  id,
  initialDate,
}: {
  id: number;
  initialDate: string | null;
}) {
  const [date, setDate] = useState(initialDate || "");
  const [saving, setSaving] = useState(false);

  async function saveDate(newDate: string) {
    setDate(newDate);
    setSaving(true);

    await fetch("/api/update-follow-up-date", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        follow_up_date: newDate || null,
      }),
    });

    setSaving(false);
  }

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm uppercase tracking-[0.3em] text-white/40">
        Follow Up
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => saveDate(e.target.value)}
          className="rounded-full border border-white/10 bg-black/30 px-5 py-3 text-white outline-none focus:border-purple-400"
        />

        {date && (
          <button
            type="button"
            onClick={() => saveDate("")}
            className="rounded-full border border-red-500/30 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-500/20"
          >
            Clear
          </button>
        )}

        {saving && <p className="text-sm text-white/40">Saving...</p>}
      </div>
    </div>
  );
}