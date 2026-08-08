"use client";

import { useMemo } from "react";
import { useAssets } from "@/hooks/use-assets";

function formatAssetType(type: string) {
  return String(type || "asset")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StudioVersions() {
  const { assets } = useAssets();

  const versions = useMemo(() => {
    const assetVersions = assets.map((asset: any, index: number) => ({
      id: asset.id,
      version: `V${index + 2}`,
      title: formatAssetType(asset.asset_type),
      description: asset.title,
      createdAt: asset.created_at,
    }));

    return [
      {
        id: "v1",
        version: "V1",
        title: "Project created",
        description: "Initial brand system saved.",
        createdAt: null,
      },
      ...assetVersions,
    ];
  }, [assets]);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-purple-300">
        Version History
      </p>

      <div className="mt-6 grid gap-3">
        {versions.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-white/10 bg-black/30 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-white/35">
                  {item.version}
                </p>

                <h4 className="mt-2 font-black text-white">
                  {item.title}
                </h4>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  {item.description}
                </p>
              </div>
            </div>

            {item.createdAt && (
              <p className="mt-3 text-xs text-white/25">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
