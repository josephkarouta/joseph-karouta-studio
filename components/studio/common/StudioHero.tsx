"use client";

import type { CSSProperties, ReactNode } from "react";
import type { StudioTone } from "@/components/ui/StudioModeToggle";
import { cx } from "@/components/ui/heyy";

const TONES: Record<StudioTone, { accent: string; soft: string; border: string }> = {
  platform: { accent: "#8b5cf6", soft: "rgba(139,92,246,.12)", border: "rgba(139,92,246,.34)" },
  brand: { accent: "#8b5cf6", soft: "rgba(159,44,224,.14)", border: "rgba(159,44,224,.34)" },
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
  imageSrc,
  imagePosition = "center 58%",
}: {
  tone: StudioTone;
  eyebrow: string;
  title: string;
  description?: string | null;
  controls?: ReactNode;
  meta?: ReactNode;
  className?: string;
  imageSrc?: string;
  imagePosition?: string;
}) {
  const colors = TONES[tone];
  const immersive = Boolean(imageSrc);

  const lightControlVars = immersive
    ? ({
        "--surface": "rgba(255,255,255,.96)",
        "--surface-strong": "#ffffff",
        "--text-primary": "#17131f",
        "--text-secondary": "#625d6b",
        "--text-muted": "#88828f",
        "--border": "rgba(23,19,31,.12)",
        "--border-strong": "rgba(23,19,31,.18)",
      } as CSSProperties)
    : undefined;

  if (immersive) {
    return (
      <section
        className={cx(
          "studio-shared-hero relative isolate h-[300px] overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#080512] shadow-[0_24px_64px_rgba(12,7,30,.22)] sm:h-[330px] sm:rounded-[2rem]",
          className,
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
          style={{ backgroundImage: `url(${imageSrc})`, backgroundPosition: imagePosition }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 sm:hidden"
          style={{
            background:
              "linear-gradient(180deg,rgba(7,4,20,.06) 0%,rgba(7,4,20,.12) 32%,rgba(7,4,20,.54) 58%,rgba(7,4,20,.94) 100%)",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 hidden sm:block"
          style={{
            background:
              "linear-gradient(90deg,rgba(7,4,20,.96) 0%,rgba(7,4,20,.88) 27%,rgba(7,4,20,.55) 43%,rgba(7,4,20,.12) 66%,rgba(7,4,20,.40) 100%),linear-gradient(180deg,rgba(7,4,20,.10) 0%,rgba(7,4,20,.05) 54%,rgba(7,4,20,.56) 100%)",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-36"
          style={{ background: "linear-gradient(180deg,transparent,rgba(7,4,20,.56))" }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex h-full flex-col justify-end gap-4 p-5 pb-6 sm:justify-center sm:gap-6 sm:p-8 lg:flex-row lg:items-center lg:justify-start lg:gap-10 lg:p-10 xl:p-12">
          <div className="min-w-0 max-w-[680px] lg:max-w-[72%]">
            <p className="text-[.56rem] font-black uppercase tracking-[.22em] text-white/70 sm:text-[.62rem] sm:tracking-[.24em]">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-[1.95rem] font-black leading-[.96] tracking-[-.055em] text-white sm:mt-4 sm:text-6xl lg:text-[4rem]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-[92%] text-[.78rem] font-semibold leading-5 text-white/80 sm:mt-4 sm:max-w-xl sm:text-base sm:leading-7 lg:max-w-none lg:whitespace-nowrap lg:text-sm xl:text-base">
                {description}
              </p>
            ) : null}
            {meta ? <div className="mt-4 text-white sm:mt-5">{meta}</div> : null}
          </div>

          {controls ? (
            <div
              className="hidden w-full max-w-[430px] self-stretch rounded-[18px] border border-white/60 bg-white/[.93] p-2.5 shadow-[0_18px_50px_rgba(10,5,28,.28)] backdrop-blur-2xl sm:block sm:self-auto sm:rounded-[22px] sm:p-3 lg:ml-auto"
              style={lightControlVars}
            >
              {controls}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

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
