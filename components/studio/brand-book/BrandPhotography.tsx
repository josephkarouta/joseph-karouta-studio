"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

export default function BrandPhotography({
  concept,
  moodboard,
}: {
  concept?: any;
  moodboard?: any;
}) {
  const keywords =
    concept?.keywords || [
      "Clean",
      "Premium",
      "Minimal",
      "Modern",
    ];

  const prompt =
    moodboard?.prompt ||
    concept?.story ||
    concept?.visualDirection ||
    "Create premium brand photography with consistent lighting, colour palette and composition.";

  return (
    <BrandBookPage
      page={12}
      eyebrow="Photography"
      title="Visual Direction"
    >
      <p className="max-w-2xl text-sm leading-6 text-white/50">
        Photography should reinforce the selected brand direction and remain
        visually consistent across every customer touchpoint.
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        {/* LEFT */}
        <div className="space-y-3">
          {moodboard?.imageUrl ? (
            <img
              src={moodboard.imageUrl}
              alt="Moodboard"
              className="aspect-video w-full rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20">
              <p className="text-sm text-white/35">
                Moodboard Preview
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <VisualCard
              title="Lighting"
              body="Soft controlled lighting with premium contrast."
            />

            <VisualCard
              title="Composition"
              body="Simple framing and generous negative space."
            />

            <VisualCard
              title="Textures"
              body="Natural premium materials and subtle detail."
            />

            <VisualCard
              title="Mood"
              body="Confident, modern and intentional."
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="text-lg font-black">
              Keywords
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((item: string) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-300">
              AI Prompt
            </p>

            <p className="mt-3 text-sm leading-6 text-white/60">
              {prompt}
            </p>
          </div>
        </div>
      </div>
    </BrandBookPage>
  );
}

function VisualCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-300">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-white/55">
        {body}
      </p>
    </div>
  );
}