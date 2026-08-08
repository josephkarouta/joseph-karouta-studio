"use client";

import { useState } from "react";

export default function ProjectTag({
  id,
  currentTag,
}: {
  id: number;
  currentTag: string;
}) {
  const [tag, setTag] = useState(currentTag || "");
  const [saving, setSaving] = useState(false);

  const tags = [
    "Branding",
    "Website",
    "Architecture",
    "Interior",
    "Events",
  ];

  const updateTag = async (newTag: string) => {
    setSaving(true);

    const response = await fetch("/api/project-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        project_tag: newTag,
      }),
    });

    const data = await response.json();

    if (data.success) {
      setTag(newTag);
    }

    setSaving(false);
  };

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/40">
        Project Tag
      </p>

      <div className="flex flex-wrap gap-3">
        {tags.map((item) => (
          <button
            key={item}
            onClick={() => updateTag(item)}
            disabled={saving}
            className={`rounded-full px-5 py-3 text-sm font-bold transition ${
              tag === item
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "border border-white/15 text-white hover:bg-white hover:text-black"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}