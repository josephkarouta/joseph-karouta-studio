"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

export default function BrandUsageExamples() {
  const examples = [
    ["Instagram Feed", "Use bold, simplified messaging with strong contrast."],
    ["LinkedIn", "Use professional layouts with clear hierarchy and brand confidence."],
    ["Website", "Use generous spacing, strong CTAs and consistent component styles."],
    ["Packaging", "Use the logo, colour palette and pattern system with restraint."],
    ["Signage", "Prioritise legibility, contrast and recognisable brand cues."],
    ["Merchandise", "Use simplified logo marks and minimal supporting graphics."],
  ];

  return (
    <BrandBookPage page={18} eyebrow="Usage Examples" title="How the Brand System Scales">
      <p className="max-w-2xl leading-7 text-white/50">
        These usage examples guide how the brand should behave across common
        touchpoints. Detailed AI-rendered examples can be generated only when a
        user needs them.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {examples.map(([title, body]) => (
          <div
            key={title}
            className="rounded-[1.5rem] border border-white/10 bg-black/25 p-6"
          >
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-purple-200">
                ✓
              </div>

              <div>
                <h3 className="text-xl font-black">{title}</h3>

                <p className="mt-3 text-sm leading-6 text-white/50">
                  {body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </BrandBookPage>
  );
}
