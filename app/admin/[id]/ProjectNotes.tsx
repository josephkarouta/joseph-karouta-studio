"use client";

import { useState } from "react";

export default function ProjectNotes({
  id,
  initialNotes,
}: {
  id: number;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    setSaving(true);

    await fetch("/api/project-notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        internal_notes: notes,
      }),
    });

    setSaving(false);
  };

  return (
    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
      <h2 className="mb-4 text-xl font-bold">Internal Notes</h2>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add internal project notes..."
        className="min-h-40 w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none"
      />

      <button
        onClick={saveNotes}
        disabled={saving}
        className="mt-4 rounded-full bg-white px-6 py-3 text-sm font-bold text-black"
      >
        {saving ? "Saving..." : "Save Notes"}
      </button>
    </div>
  );
}