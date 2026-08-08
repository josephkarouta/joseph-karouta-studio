"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

export default function BrandAssetsLibrary({
  assets = [],
}: {
  assets?: any[];
}) {
  const logoAssets = assets.filter((asset) =>
    ["logo_selected", "logo_variation", "logo_concept"].includes(asset.asset_type)
  );

  const moodboardAssets = assets.filter((asset) =>
    ["moodboard_selected", "moodboard_variations", "moodboard", "creative_direction_selected"].includes(asset.asset_type)
  );

  const guidelineAssets = assets.filter((asset) =>
    ["brand_guidelines"].includes(asset.asset_type)
  );

  const groups = [
    {
      title: "Logo Assets",
      description: "Selected logo concepts, variations and final logo files.",
      count: logoAssets.length,
      ready: logoAssets.length > 0,
    },
    {
      title: "Moodboard Assets",
      description: "Selected moodboards and generated visual direction assets.",
      count: moodboardAssets.length,
      ready: moodboardAssets.length > 0,
    },
    {
      title: "Brand Guidelines Text",
      description: "Generated brand book copy, tone of voice and usage guidance.",
      count: guidelineAssets.length,
      ready: guidelineAssets.length > 0,
    },
    {
      title: "Colour Palette",
      description: "HEX, RGB and CMYK-ready palette values from the Brand System.",
      count: 1,
      ready: true,
    },
    {
      title: "Typography System",
      description: "Font pairing, hierarchy and usage guidance.",
      count: 1,
      ready: true,
    },
    {
      title: "Project Backup",
      description: "Technical JSON package for support and future migration.",
      count: 1,
      ready: true,
    },
  ];

  return (
    <BrandBookPage page={16} eyebrow="Assets Library" title="Generated Brand Assets">
      <p className="max-w-2xl leading-7 text-white/50">
        This library tracks what has already been generated and saved in the
        project workspace. Premium AI-rendered mockups can be generated later
        using credits instead of creating everything upfront.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <div
            key={group.title}
            className="rounded-[1.5rem] border border-white/10 bg-black/25 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black">{group.title}</h3>

                <p className="mt-3 text-sm leading-6 text-white/50">
                  {group.description}
                </p>
              </div>

              <span
                className={
                  group.ready
                    ? "rounded-full bg-green-400 px-3 py-1 text-xs font-black text-black"
                    : "rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/35"
                }
              >
                {group.ready ? "Ready" : "Pending"}
              </span>
            </div>

            <p className="mt-5 text-xs uppercase tracking-[0.25em] text-white/30">
              {group.count} item{group.count === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
    </BrandBookPage>
  );
}
