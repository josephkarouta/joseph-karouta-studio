"use client";

import { useState } from "react";

export default function StatusButtons({
  id,
  currentStatus,
}: {
  id: number;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  const statuses = ["New", "Reviewing", "Quoted", "Won", "Lost"];

  const updateStatus = async (newStatus: string) => {
    console.log("Changing status to:", newStatus);

    setSaving(true);

    const response = await fetch("/api/project-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        status: newStatus,
      }),
    });

    const data = await response.json();

    if (data.success) {
      setStatus(newStatus);
    }

    setSaving(false);
  };

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/40">
        Project Status
      </p>

      <div className="flex flex-wrap gap-3">
        {statuses.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => updateStatus(item)}
            disabled={saving}
            className={`rounded-full px-5 py-3 text-sm font-bold transition ${
  status === item
    ? item === "New"
      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
      : item === "Reviewing"
      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
      : item === "Quoted"
      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
      : item === "Won"
      ? "bg-green-500/20 text-green-300 border border-green-500/30"
      : item === "Lost"
      ? "bg-red-500/20 text-red-300 border border-red-500/30"
      : "bg-white text-black"
    : "border border-white/15 text-white hover:bg-white hover:text-black"
}`}
          >
            {item}
          </button>
        ))}
      </div>

      {saving && (
        <p className="mt-4 text-sm text-white/50">
          Saving status...
        </p>
      )}
    </div>
  );
}