"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { GlassCard, cx } from "@/components/ui/heyy";
import type { StudioTone } from "@/components/ui/StudioModeToggle";

export type StudioWorkspaceNavigationItem = {
  id: string;
  label: string;
};

const NAV_TONES: Record<StudioTone, Record<string, string>> = {
  platform: {
    "--studio-nav-accent": "var(--accent)",
    "--studio-nav-strong": "var(--accent-strong)",
    "--studio-nav-soft": "var(--accent-soft)",
  },
  brand: {
    "--studio-nav-accent": "#8b5cf6",
    "--studio-nav-strong": "#8b5cf6",
    "--studio-nav-soft": "rgba(161,61,240,.12)",
  },
  architecture: {
    "--studio-nav-accent": "#2e7cf6",
    "--studio-nav-strong": "#1769d2",
    "--studio-nav-soft": "rgba(46,124,246,.12)",
  },
  interior: {
    "--studio-nav-accent": "#f08034",
    "--studio-nav-strong": "#c95d15",
    "--studio-nav-soft": "rgba(240,128,52,.13)",
  },
  marketing: {
    "--studio-nav-accent": "#ef3fb4",
    "--studio-nav-strong": "#cf238f",
    "--studio-nav-soft": "rgba(239,63,180,.12)",
  },
};

export default function StudioWorkspaceNavigation({
  tabs,
  activeTab,
  onChange,
  tone = "platform",
  ariaLabel = "Studio project sections",
  className,
}: {
  tabs: StudioWorkspaceNavigationItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  tone?: StudioTone;
  ariaLabel?: string;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setCanScrollLeft(scroller.scrollLeft > 6);
    setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 6);
  }

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    updateScrollState();
    tabRefs.current[activeTab]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });

    const timer = window.setTimeout(updateScrollState, 280);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollState) : null;
    observer?.observe(scroller);
    window.addEventListener("resize", updateScrollState);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [activeTab, tabs.length]);

  function scrollTabs(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction * Math.max(260, scroller.clientWidth * 0.72),
      behavior: "smooth",
    });
    window.setTimeout(updateScrollState, 300);
  }

  if (!tabs.length) return null;

  return (
    <GlassCard
      className={cx("mt-5 p-2.5", className)}
      style={NAV_TONES[tone] as CSSProperties}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Scroll ${ariaLabel.toLowerCase()} left`}
          onClick={() => scrollTabs(-1)}
          disabled={!canScrollLeft}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:border-[var(--studio-nav-accent)] hover:text-[var(--studio-nav-strong)] disabled:cursor-default disabled:opacity-30"
        >
          <ArrowLeft size={15} />
        </button>

        <div className="min-w-0 flex-1 overflow-hidden">
          <nav
            ref={scrollerRef}
            aria-label={ariaLabel}
            onScroll={updateScrollState}
            className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                ref={(node) => { tabRefs.current[tab.id] = node; }}
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={cx(
                  "shrink-0 rounded-xl border px-4 py-3 text-xs font-black transition",
                  activeTab === tab.id
                    ? "border-[var(--studio-nav-accent)] bg-[var(--studio-nav-accent)] text-white shadow-[0_0_0_3px_var(--studio-nav-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--studio-nav-accent)] hover:bg-[var(--studio-nav-soft)] hover:text-[var(--studio-nav-strong)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <button
          type="button"
          aria-label={`Scroll ${ariaLabel.toLowerCase()} right`}
          onClick={() => scrollTabs(1)}
          disabled={!canScrollRight}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:border-[var(--studio-nav-accent)] hover:text-[var(--studio-nav-strong)] disabled:cursor-default disabled:opacity-30"
        >
          <ArrowRight size={15} />
        </button>
      </div>
    </GlassCard>
  );
}
