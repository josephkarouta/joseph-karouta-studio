"use client";

import { useEffect, useRef, useState } from "react";

export type BrandBookNavSection = {
  id: string;
  label: string;
  group?: string;
};

export default function BrandBookNav({
  sections,
  activeId,
}: {
  sections: BrandBookNavSection[];
  activeId?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [localActiveId, setLocalActiveId] = useState(activeId || sections[0]?.id || "");

  useEffect(() => {
    if (activeId) setLocalActiveId(activeId);
  }, [activeId]);

  function scrollByAmount(direction: "left" | "right") {
    scrollerRef.current?.scrollBy({
      left: direction === "left" ? -340 : 340,
      behavior: "smooth",
    });
  }

  return (
    <div className="sticky top-20 z-30 -mx-1 rounded-xl border border-white/10 bg-black/80 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 rounded-l-[1.5rem] bg-gradient-to-r from-black/95 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 rounded-r-[1.5rem] bg-gradient-to-l from-black/95 to-transparent" />

      <button
        type="button"
        onClick={() => scrollByAmount("left")}
        className="absolute left-2 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/80 text-xs text-white/60 transition hover:bg-white hover:text-black lg:flex"
        aria-label="Scroll brand book navigation left"
      >
        ←
      </button>

      <div
        ref={scrollerRef}
        className="scrollbar-hide flex gap-2 overflow-x-auto px-1 pr-10 lg:px-10"
      >
        {sections.map((section, index) => {
          const isActive = localActiveId === section.id || activeId === section.id;

          return (
            <a
              key={section.id}
              href={`#brand-book-${section.id}`}
              onClick={() => setLocalActiveId(section.id)}
              className={[
                "group shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition",
                isActive
                  ? "border-purple-300/70 bg-purple-400/20 text-purple-100 shadow-lg shadow-purple-950/30"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:border-purple-400/50 hover:bg-purple-500/15 hover:text-purple-100",
              ].join(" ")}
            >
              <span
                className={[
                  "mr-2",
                  isActive ? "text-purple-200" : "text-white/25 group-hover:text-purple-200",
                ].join(" ")}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.label}
            </a>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scrollByAmount("right")}
        className="absolute right-2 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/80 text-xs text-white/60 transition hover:bg-white hover:text-black lg:flex"
        aria-label="Scroll brand book navigation right"
      >
        →
      </button>
    </div>
  );
}
