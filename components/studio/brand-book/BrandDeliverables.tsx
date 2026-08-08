"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

export default function BrandDeliverables() {
  const deliverables = [
    {
      title: "Brand Book PDF",
      body: "Client-ready brand guidelines exported from the live Brand Book.",
      status: "Included",
    },
    {
      title: "Logo Package",
      body: "Primary, reverse, monochrome and transparent logo files.",
      status: "Generate / Export",
    },
    {
      title: "Colour System",
      body: "HEX, RGB and CMYK-ready colour palette.",
      status: "Included",
    },
    {
      title: "Typography System",
      body: "Font pairings, hierarchy and usage notes.",
      status: "Included",
    },
    {
      title: "Social Kit",
      body: "Static social templates generated from the brand system.",
      status: "Template",
    },
    {
      title: "Premium AI Mockups",
      body: "Photorealistic website, packaging, billboard and campaign renders.",
      status: "Credits",
    },
  ];

  return (
    <BrandBookPage page={17} eyebrow="Deliverables" title="Brand Handover Package">
      <p className="max-w-2xl leading-7 text-white/50">
        Deliverables are separated into included system outputs and premium
        credit-based outputs. This keeps the Brand Book powerful without making
        every generation expensive.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {deliverables.map((item) => (
          <div
            key={item.title}
            className="rounded-[1.5rem] border border-white/10 bg-black/25 p-6"
          >
            <p className="text-xs uppercase tracking-[0.25em] text-purple-300">
              {item.status}
            </p>

            <h3 className="mt-4 text-xl font-black">{item.title}</h3>

            <p className="mt-3 text-sm leading-6 text-white/50">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </BrandBookPage>
  );
}
