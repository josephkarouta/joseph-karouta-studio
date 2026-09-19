"use client";

import type { ReactNode } from "react";
import type { StudioTone } from "@/components/ui/StudioModeToggle";

const TONES: Record<StudioTone, { accent: string; end: string; soft: string }> = {
  platform: { accent: "#8b5cf6", end: "#a000e8", soft: "rgba(139,92,246,.12)" },
  brand: { accent: "#8b5cf6", end: "#c000e8", soft: "rgba(159,44,224,.12)" },
  architecture: { accent: "#176fd8", end: "#2e8df6", soft: "rgba(46,124,246,.12)" },
  interior: { accent: "#b65408", end: "#ed7c22", soft: "rgba(208,107,20,.12)" },
  marketing: { accent: "#c82d72", end: "#ef3da0", soft: "rgba(235,61,135,.12)" },
};

export type StudioSummaryRow = { label: string; value: ReactNode };

export default function StudioCreationSummary({
  tone,
  eyebrow,
  title,
  subtitle,
  progress,
  rows,
  children,
  note,
}: {
  tone: StudioTone;
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  progress?: number | null;
  rows?: StudioSummaryRow[];
  children?: ReactNode;
  note?: { eyebrow: string; text: string } | null;
}) {
  const colors = TONES[tone];
  const normalizedProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <section className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow-card)]">
      <header className="p-5 text-white" style={{ background: `linear-gradient(135deg,${colors.accent},${colors.end})` }}>
        <p className="text-[.6rem] font-black uppercase tracking-[.18em] text-white/70">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm font-semibold leading-6 text-white/80">{subtitle}</p> : null}
      </header>

      <div className="p-5">
        {normalizedProgress != null ? (
          <div className="mb-5">
            <div className="flex items-center justify-between gap-3 text-xs font-black">
              <span>Brief progress</span>
              <span style={{ color: colors.accent }}>{normalizedProgress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${normalizedProgress}%`, background: colors.accent }} />
            </div>
          </div>
        ) : null}

        {rows?.length ? (
          <div className="grid gap-2">
            {rows.map((row) => (
              <div key={row.label} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <p className="text-[.56rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">{row.label}</p>
                <div className="mt-1 text-xs font-black leading-5 text-[var(--text-primary)]">{row.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {children ? <div className={rows?.length ? "mt-5 border-t border-[var(--border)] pt-4" : ""}>{children}</div> : null}

        {note ? (
          <div className="mt-5 rounded-[16px] border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
            <p className="text-[.56rem] font-black uppercase tracking-[.15em] text-amber-700 dark:text-amber-300">{note.eyebrow}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-900 dark:text-amber-100">{note.text}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
