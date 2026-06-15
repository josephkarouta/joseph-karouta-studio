"use client";

import { useState } from "react";

const statusStyles: Record<
  string,
  { border: string; bg: string; activeBg: string; text: string }
> = {
  New: {
    border: "#60A5FA",
    bg: "rgba(96, 165, 250, 0.18)",
    activeBg: "rgba(96, 165, 250, 0.40)",
    text: "#93C5FD",
  },
  Reviewing: {
    border: "#FACC15",
    bg: "rgba(250, 204, 21, 0.18)",
    activeBg: "rgba(250, 204, 21, 0.40)",
    text: "#FDE047",
  },
  Quoted: {
    border: "#A78BFA",
    bg: "rgba(167, 139, 250, 0.18)",
    activeBg: "rgba(167, 139, 250, 0.40)",
    text: "#C4B5FD",
  },
  Won: {
    border: "#4ADE80",
    bg: "rgba(74, 222, 128, 0.18)",
    activeBg: "rgba(74, 222, 128, 0.40)",
    text: "#86EFAC",
  },
  Lost: {
    border: "#F87171",
    bg: "rgba(248, 113, 113, 0.18)",
    activeBg: "rgba(248, 113, 113, 0.35)",
    text: "#FCA5A5",
  },
};

export default function ExpertRequestStatus({
  id,
  currentStatus,
}: {
  id: number;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus || "New");
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const statuses = ["New", "Reviewing", "Quoted", "Won", "Lost"];

  async function updateStatus(newStatus: string) {
    setStatus(newStatus);
    setSaving(true);

    const response = await fetch("/api/expert-request-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status: newStatus }),
    });

    await response.json();
    setSaving(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {statuses.map((item) => {
          const active = status === item;
          const isHovered = hovered === item;
          const style = statusStyles[item];

          return (
            <button
              key={item}
              type="button"
              onClick={() => updateStatus(item)}
              onMouseEnter={() => setHovered(item)}
              onMouseLeave={() => setHovered(null)}
              disabled={saving}
              className="rounded-full border px-5 py-3 text-sm font-bold transition"
              style={{
                borderColor: style.border,
                backgroundColor: active
                  ? style.activeBg
                  : isHovered
                  ? style.bg
                  : "transparent",
                color: active ? "#FFFFFF" : style.text,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {item}
            </button>
          );
        })}
      </div>

      {saving && <p className="mt-4 text-sm text-white/50">Saving...</p>}
    </div>
  );
}