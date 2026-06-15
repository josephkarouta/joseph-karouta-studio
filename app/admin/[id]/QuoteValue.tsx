"use client";

import { useState } from "react";

export default function QuoteValue({
  id,
  initialValue,
  quoteHistory,
}: {
  id: number;
  initialValue: number | null;
  quoteHistory: any[];
}) {
  const [value, setValue] = useState(initialValue?.toString() || "");
  const [saving, setSaving] = useState(false);

  const saveQuote = async () => {
    setSaving(true);

    await fetch("/api/project-quote-history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  id,
  amount: value,
}),
    });

    setSaving(false);
    location.reload();
  };

  const deleteQuote = async (index: number) => {
  await fetch("/api/project-quote-delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id,
      index,
    }),
  });

  location.reload();
};

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/40">
        Quote Value
      </p>

      <div className="flex gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="5000"
          type="number"
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-purple-400"
        />

        <button
          onClick={saveQuote}
          disabled={saving}
          className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add"}
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
  {quoteHistory.map((item, index) => (
    <div
  key={index}
  className="flex w-fit items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
>
      <div className="flex flex-col">
        <span>${Number(item.amount).toLocaleString()}</span>

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
  onClick={() => deleteQuote(index)}
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