"use client";

import type { ReactNode } from "react";
import type { StudioTone } from "@/components/ui/StudioModeToggle";
import { cx } from "@/components/ui/heyy";

const TONES: Record<StudioTone, { accent: string; soft: string; border: string }> = {
  platform: { accent: "#6f2dff", soft: "rgba(111,45,255,.12)", border: "rgba(111,45,255,.34)" },
  brand: { accent: "#9f2ce0", soft: "rgba(159,44,224,.14)", border: "rgba(159,44,224,.34)" },
  architecture: { accent: "#2e7cf6", soft: "rgba(46,124,246,.14)", border: "rgba(46,124,246,.34)" },
  interior: { accent: "#d06b14", soft: "rgba(208,107,20,.14)", border: "rgba(208,107,20,.34)" },
  marketing: { accent: "#eb3d87", soft: "rgba(235,61,135,.14)", border: "rgba(235,61,135,.34)" },
};

export default function StudioHero({
  tone,
  eyebrow,
  title,
  description,
  controls,
  meta,
  className,
}: {
  tone: StudioTone;
  eyebrow: string;
  title: string;
  description?: string | null;
  controls?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  const colors = TONES[tone];

  return (
    <section
      className={cx("studio-shared-hero relative overflow-hidden rounded-[2rem] border p-6 shadow-[var(--shadow-card)] sm:p-9", className)}
      style={{
        borderColor: colors.border,
        background: `linear-gradient(120deg,${colors.soft},var(--surface-strong),${colors.soft})`,
      }}
    >
      <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full border-[34px] border-white/20" />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-4xl">
          <p className="text-[.62rem] font-black uppercase tracking-[.22em]" style={{ color: colors.accent }}>
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-black leading-[.94] tracking-[-.06em] text-[var(--text-primary)] sm:text-6xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">
              {description}
            </p>
          ) : null}
          {meta ? <div className="mt-5">{meta}</div> : null}
        </div>

        {controls ? (
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 backdrop-blur-xl">
            {controls}
          </div>
        ) : null}
      </div>
    </section>
  );
}
