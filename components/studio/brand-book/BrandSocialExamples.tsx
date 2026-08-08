"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

function getColours(brand: any) {
  return brand?.colourPalette || brand?.colorPalette || brand?.colors || [];
}

function colourValue(colour: any, fallback: string) {
  if (!colour) return fallback;
  if (typeof colour === "string") return colour;
  return colour?.hex || colour?.value || fallback;
}

export default function BrandSocialExamples({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  const colours = getColours(brand);
  const primary = colourValue(colours[0], "#7C3AED");
  const secondary = colourValue(colours[1], "#111111");
  const accent = colourValue(colours[2], "#F4F0F8");

  return (
    <BrandBookPage page={14} eyebrow="Social Media Examples" title="Campaign Templates">
      <p className="max-w-2xl leading-7 text-white/50">
        Use these layouts as visual starting points for Instagram, LinkedIn,
        story formats and paid social campaign assets.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/25">
          <div
            className="flex aspect-square flex-col justify-between p-7"
            style={{
              background: `linear-gradient(135deg, ${primary}, ${secondary})`,
            }}
          >
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/60">
              Brand Launch
            </p>

            <h3 className="text-5xl font-black leading-none tracking-[-0.07em] text-white">
              {project?.project_name || "Brand"}
            </h3>

            <p className="max-w-[220px] text-sm leading-6 text-white/70">
              A bold launch card for high-impact announcements.
            </p>
          </div>

          <div className="p-5">
            <p className="font-black">Square Post</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/25">
          <div
            className="flex aspect-[9/16] max-h-[520px] flex-col justify-between p-7"
            style={{ backgroundColor: accent }}
          >
            <p className="text-xs font-black uppercase tracking-[0.25em] text-black/40">
              Story
            </p>

            <div>
              <h3 className="text-5xl font-black leading-none tracking-[-0.07em] text-black">
                New visual system.
              </h3>

              <div
                className="mt-8 h-3 w-24 rounded-full"
                style={{ backgroundColor: primary }}
              />
            </div>

            <p className="text-sm font-bold text-black/50">
              Swipe up / Learn more
            </p>
          </div>

          <div className="p-5">
            <p className="font-black">Story Format</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/25">
          <div className="flex aspect-[1.91/1] flex-col justify-between bg-white p-7 text-black">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-black/35">
                LinkedIn
              </p>

              <div
                className="h-10 w-10 rounded-full"
                style={{ backgroundColor: primary }}
              />
            </div>

            <h3 className="max-w-md text-4xl font-black leading-none tracking-[-0.06em]">
              A brand built to feel consistent everywhere.
            </h3>
          </div>

          <div className="p-5">
            <p className="font-black">LinkedIn / Ad Banner</p>
          </div>
        </div>
      </div>
    </BrandBookPage>
  );
}
