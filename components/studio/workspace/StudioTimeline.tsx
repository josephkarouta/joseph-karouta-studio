"use client";

import { useMemo, useState } from "react";
import { useActivity } from "@/hooks/use-activity";
import { useAssets } from "@/hooks/use-assets";

function formatAssetType(type: string) {
  return String(type || "asset")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value?: string) {
  if (!value || value === "Now") return "Now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

export default function StudioTimeline() {
  const { assets } = useAssets();
  const { activity } = useActivity();
  const [expanded, setExpanded] = useState(false);

  const timeline = useMemo(() => {
    const assetItems = assets.map((asset: any) => ({
      id: asset.id,
      title: formatAssetType(asset.asset_type),
      description: asset.title,
      createdAt: asset.created_at,
      source: "asset",
    }));

    const activityItems = activity.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      createdAt: item.createdAt,
      source: "activity",
    }));

    return [...activityItems, ...assetItems].sort((a: any, b: any) => {
      const aTime =
        a.createdAt === "Now" || !a.createdAt
          ? Date.now()
          : new Date(a.createdAt).getTime();

      const bTime =
        b.createdAt === "Now" || !b.createdAt
          ? Date.now()
          : new Date(b.createdAt).getTime();

      return bTime - aTime;
    });
  }, [assets, activity]);

  const visibleItems = expanded ? timeline : timeline.slice(0, 6);

  if (timeline.length === 0) {
    return (
      <p className="rounded-[14px] border border-slate-200 bg-white/80 p-4 text-sm text-slate-500">
        No activity yet.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {visibleItems.map((item: any) => (
          <div key={`${item.source}-${item.id}`} className="relative pl-6">
            <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-violet-600 shadow-[0_0_0_5px_#eee3ff]" />

            <div className="rounded-[14px] border border-slate-200 bg-white/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-black text-slate-800">
                  {item.title}
                </p>

                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {formatTime(item.createdAt)}
                </span>
              </div>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {item.description || "Project activity"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {timeline.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 w-full rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-black text-violet-700 transition hover:border-violet-500 hover:bg-violet-600 hover:text-white"
        >
          {expanded ? "Show Less" : `View All ${timeline.length}`}
        </button>
      )}
    </div>
  );
}
