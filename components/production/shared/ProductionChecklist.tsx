"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  title: string;
  completed: boolean;
};

type Props = {
  jobId: string;
  refreshKey?: number;
};

export default function ProductionChecklist({ jobId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadChecklist() {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/admin/production-checklist?jobId=${jobId}`,
      );
      const data = await response.json();

      if (data.success) {
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChecklist();
  }, [jobId, refreshKey]);

  const progress = useMemo(() => {
    if (!items.length) return 0;
    const completed = items.filter((item) => item.completed).length;
    return Math.round((completed / items.length) * 100);
  }, [items]);

  async function toggle(id: string) {
    const response = await fetch("/api/admin/production-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await response.json();
    if (data.success) {
      await loadChecklist();
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
        Loading checklist...
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-emerald-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-black text-slate-950">Production Checklist</h3>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
          {progress}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-5 space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-violet-400 hover:bg-violet-50"
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
                item.completed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 bg-white text-transparent"
              }`}
            >
              ✓
            </div>

            <span
              className={
                item.completed
                  ? "text-slate-400 line-through"
                  : "font-bold text-slate-700"
              }
            >
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
