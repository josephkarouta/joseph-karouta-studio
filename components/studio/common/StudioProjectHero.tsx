"use client";

import StudioHero from "@/components/studio/common/StudioHero";
import StudioModeToggle, { type StudioTone } from "@/components/ui/StudioModeToggle";

const ACCENTS: Record<StudioTone, string> = {
  platform: "#6f2dff",
  brand: "#9f2ce0",
  architecture: "#2e7cf6",
  interior: "#d06b14",
  marketing: "#eb3d87",
};

const HERO_IMAGES: Partial<Record<StudioTone, string>> = {
  brand: "/studio-heroes/brand-studio-hero.webp",
  marketing: "/studio-heroes/marketing-studio-hero.webp",
  architecture: "/studio-heroes/architecture-studio-hero.webp",
  interior: "/studio-heroes/interior-studio-hero.webp",
};

export default function StudioProjectHero({
  tone,
  eyebrow,
  title,
  description,
  progress,
  statusLabel,
  mode,
  onModeChange,
  saving = false,
}: {
  tone: StudioTone;
  eyebrow: string;
  title: string;
  description?: string | null;
  progress?: number | null;
  statusLabel?: string | null;
  mode?: "guided" | "professional";
  onModeChange?: (mode: "guided" | "professional") => void;
  saving?: boolean;
}) {
  const normalizedProgress = progress == null
    ? null
    : Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  const accent = ACCENTS[tone];

  return (
    <StudioHero
      tone={tone}
      eyebrow={eyebrow}
      title={title}
      description={description}
      imageSrc={HERO_IMAGES[tone]}
      imagePosition="center 58%"
      controls={(
        <div className="flex min-h-[132px] flex-col justify-center">
          {normalizedProgress !== null ? (
            <>
              <div className="flex items-center justify-between gap-4 px-1">
                <span className="text-[.58rem] font-black uppercase tracking-[.15em] text-[var(--text-muted)]">Project progress</span>
                <strong className="text-2xl font-black" style={{ color: accent }}>{normalizedProgress}%</strong>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <span className="block h-full rounded-full" style={{ width: `${normalizedProgress}%`, background: accent }} />
              </div>
              {statusLabel ? (
                <p className="mt-3 px-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{statusLabel}</p>
              ) : null}
            </>
          ) : (
            <div className="flex items-center justify-between gap-4 px-1">
              <div>
                <p className="text-[.58rem] font-black uppercase tracking-[.15em] text-[var(--text-muted)]">Project status</p>
                <p className="mt-2 text-sm font-black text-[var(--text-primary)]">{statusLabel || "Active project"}</p>
              </div>
              <span
                className="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[.58rem] font-black uppercase tracking-[.13em]"
                style={{ borderColor: `${accent}55`, background: `${accent}14`, color: accent }}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
              </span>
            </div>
          )}

          {mode && onModeChange ? (
            <StudioModeToggle
              value={mode}
              onChange={onModeChange}
              tone={tone}
              compact
              saving={saving}
              className="mt-3"
            />
          ) : null}
        </div>
      )}
    />
  );
}
