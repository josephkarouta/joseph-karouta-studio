"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

export default function BrandMoodboard({ moodboard }: { moodboard?: any }) {
  return (
    <BrandBookPage page={7} eyebrow="Moodboard" title="Visual Direction">
      <p className="max-w-2xl leading-7 text-white/50">
        The selected moodboard becomes the visual reference for image style,
        colour atmosphere, composition and campaign direction.
      </p>

      {moodboard?.imageUrl ? (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/25">
            <img
              src={moodboard.imageUrl}
              alt={moodboard.title || "Selected moodboard"}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          <div className="grid gap-4">
            <Info
              title={moodboard.title || "Selected Moodboard"}
              body={
                moodboard.visualDirection ||
                moodboard.story ||
                "This moodboard defines the image style, colour mood and visual atmosphere for the brand."
              }
            />

            <Info
              title="Image Direction"
              body="Use images that feel connected to this moodboard. Keep lighting, colour temperature, contrast and composition consistent across brand outputs."
            />

            <Info
              title="AI Prompt Guidance"
              body={
                moodboard.prompt ||
                "Generate clean, premium, brand-aligned images using the approved palette, atmosphere and visual style."
              }
            />
          </div>
        </div>
      ) : (
        <div className="mt-10 rounded-[1.5rem] border border-dashed border-white/15 bg-black/25 p-10 text-center">
          <p className="text-white/50">
            Generate or select a moodboard to include it in the Brand Book.
          </p>
        </div>
      )}
    </BrandBookPage>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-white/35">
        {title}
      </p>

      <p className="mt-3 leading-7 text-white/55">{body}</p>
    </div>
  );
}
