"use client";

const sections = [
  ["01", "Brand Foundation", "Strategy, positioning, voice and personality.", "overview"],
  ["02", "Colour System", "Palette, HEX, RGB, CMYK and usage.", "colours"],
  ["03", "Typography", "Font hierarchy, previews and download links.", "typography"],
  ["04", "Creative Concept", "Selected concept, keywords and visual logic.", "concept"],
  ["05", "Moodboard", "Selected moodboard and image direction.", "moodboard"],
  ["06", "Logo System", "Primary logo, reverse logo and usage notes.", "logo"],
  ["07", "Logo Rules", "Clear space, do and don't guidance.", "rules"],
  ["08", "Patterns & Icons", "Graphic language, background systems and icon style.", "patterns"],
  ["09", "Photography", "Image style, visual atmosphere and prompts.", "photography"],
  ["10", "Applications", "Website, packaging, presentations and stationery.", "applications"],
  ["11", "Marketing Mockups", "Social, posters, billboards, merchandise and vehicle ideas.", "social"],
  ["12", "Assets & Deliverables", "Logo pack, social kit, presentation kit and final checklist.", "assets"],
];

export default function BrandBookTOC() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 md:p-10">
      <p className="text-xs uppercase tracking-[0.35em] text-purple-300">
        Table of Contents
      </p>

      <div className="mt-4">
        <h2 className="text-4xl font-black">Brand Book Map</h2>

        <p className="mt-4 max-w-2xl leading-7 text-white/50">
          Browse the full living brand system. Each section is connected to
          saved project assets and updates as the project evolves.
        </p>
      </div>

      <div className="mt-10 grid gap-3 md:grid-cols-2">
        {sections.map(([number, title, body, id]) => (
          <a
            key={id}
            href={`#brand-book-${id}`}
            className="group rounded-[1.5rem] border border-white/10 bg-black/25 p-5 transition hover:border-purple-400/50 hover:bg-purple-500/10"
          >
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-sm font-black text-purple-200">
                {number}
              </span>

              <div>
                <h3 className="font-black group-hover:text-purple-100">
                  {title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  {body}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
