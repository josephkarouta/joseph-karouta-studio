"use client";

import { useState } from "react";
import {
  BadgeCheck,
  LayoutTemplate,
  Maximize2,
  Type,
} from "lucide-react";
import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";
import DisclosureChevron from "@/components/studio/ui/DisclosureChevron";

function getFonts(brand: any) {
  return brand?.typography || brand?.typographySystem || brand?.fonts || [];
}

function getFontName(font: any) {
  if (typeof font === "string") return font;
  return font?.font || font?.name || "Typography";
}

function getFontRole(font: any, index: number) {
  if (typeof font === "string") {
    return index === 0 ? "Heading" : index === 1 ? "Body" : "Accent";
  }

  return (
    font?.role ||
    font?.usage ||
    (index === 0 ? "Heading" : index === 1 ? "Body" : "Accent")
  );
}

function getFontUrl(font: any) {
  if (typeof font === "string") return "";
  return font?.sourceUrl || font?.url || font?.downloadUrl || "";
}

function getFontReason(font: any) {
  if (typeof font === "string") return "";
  return font?.reason || font?.description || "";
}

function roleLabel(role: string) {
  const safe = role.toLowerCase();
  if (safe.includes("head")) return "Heading";
  if (safe.includes("body")) return "Body";
  if (safe.includes("accent") || safe.includes("highlight")) return "Accent";
  return role;
}

const rolePalette = [
  { accent: "#6c00ff", soft: "#f3eaff", border: "#d8c2fb" },
  { accent: "#1766c2", soft: "#edf6ff", border: "#bdd9ff" },
  { accent: "#c51f7c", soft: "#fff0f8", border: "#f2bfdc" },
];

const panelPalette = {
  family: { Icon: Type, accent: "#a45c00", soft: "#fff7df", border: "#efd395" },
  scale: { Icon: Maximize2, accent: "#6c00ff", soft: "#f3eaff", border: "#d8c2fb" },
  preview: { Icon: LayoutTemplate, accent: "#1766c2", soft: "#edf6ff", border: "#bdd9ff" },
  usage: { Icon: Type, accent: "#087e9d", soft: "#ebfbff", border: "#b8e5ee" },
  rules: { Icon: BadgeCheck, accent: "#0b8f4d", soft: "#ebfbf2", border: "#b7e6cb" },
};

type PanelTone = keyof typeof panelPalette;

export default function BrandTypography({ brand }: { brand: any }) {
  const fonts = getFonts(brand);
  const headingFont = fonts[0];
  const bodyFont = fonts[1] || fonts[0];
  const accentFont = fonts[2] || fonts[0];
  const headingName = getFontName(headingFont);
  const bodyName = getFontName(bodyFont);
  const accentName = getFontName(accentFont);

  return (
    <BrandBookPage
      eyebrow="Typography System"
      title="Typography System"
      tone="amber"
      icon={Type}
    >
      <div className="rounded-[18px] border border-amber-100 bg-gradient-to-r from-amber-50 to-white p-4 md:p-5">
        <p className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
          Typography defines the visual voice of the brand. Use this hierarchy
          to keep websites, presentations, social assets and client-facing
          documents consistent.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <TypePanel
          title="Font Family"
          label="Typeface selection"
          tone="family"
          defaultOpen
        >
          {fonts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4">
              {fonts.map((font: any, index: number) => {
                const name = getFontName(font);
                const role = roleLabel(getFontRole(font, index));
                const url = getFontUrl(font);
                const reason = getFontReason(font);
                const palette = rolePalette[index % rolePalette.length];

                return (
                  <article
                    key={`${name}-${index}`}
                    className="group grid overflow-hidden rounded-[20px] bg-white shadow-[0_13px_30px_rgba(43,31,55,.07)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(43,31,55,.12)] lg:grid-cols-[230px_1fr]"
                    style={{ border: `1px solid ${palette.border}` }}
                  >
                    <div
                      className="relative flex min-h-48 flex-col justify-between overflow-hidden p-5"
                      style={{
                        background: `linear-gradient(145deg,${palette.soft},#ffffff)`,
                      }}
                    >
                      <span
                        className="absolute -right-7 -top-10 text-[150px] font-black leading-none opacity-[0.055]"
                        style={{ color: palette.accent }}
                      >
                        Aa
                      </span>

                      <span
                        className="relative z-10 w-fit rounded-full px-3 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white"
                        style={{ background: palette.accent }}
                      >
                        {role}
                      </span>

                      <p
                        className="relative z-10 my-6 text-7xl font-black leading-none tracking-[-0.09em]"
                        style={{
                          color: palette.accent,
                          fontFamily: `"${name}", Arial, sans-serif`,
                        }}
                      >
                        Aa
                      </p>

                      <div className="relative z-10">
                        <h3 className="text-2xl font-black tracking-[-0.05em] text-slate-950">
                          {name}
                        </h3>
                        {font?.fallback && (
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Fallback: {font.fallback}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex min-h-48 flex-col justify-between p-5 md:p-6">
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p
                            className="text-[9px] font-black uppercase tracking-[0.22em]"
                            style={{ color: palette.accent }}
                          >
                            Character set
                          </p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>

                        <div
                          style={{ fontFamily: `"${name}", Arial, sans-serif` }}
                        >
                          <p className="mt-4 break-words text-3xl font-black leading-tight tracking-[-0.04em] text-slate-950">
                            ABCDEFGHIJKLM
                          </p>
                          <p className="mt-2 break-words text-2xl font-bold leading-tight text-slate-700">
                            nopqrstuvwxyz
                          </p>
                          <p className="mt-2 text-lg text-slate-500">
                            0123456789 ! ? &amp; @
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
                        <p className="max-w-xl text-sm leading-6 text-slate-500">
                          {reason ||
                            "Use this typeface consistently according to its role in the system."}
                        </p>

                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full px-5 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5"
                            style={{
                              background: `linear-gradient(135deg,${palette.accent},#6c00ff)`,
                              boxShadow: `0 10px 22px ${palette.accent}30`,
                            }}
                          >
                            View Font ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </TypePanel>

        <TypePanel title="Type Scale" label="Size hierarchy" tone="scale">
          <div className="grid gap-3">
            <ScaleRow
              label="Hero"
              size="64 / 72"
              sample="Design with confidence."
              accent="#6c00ff"
            />
            <ScaleRow
              label="H1"
              size="48 / 56"
              sample="Brand Guidelines"
              accent="#7d2ae8"
            />
            <ScaleRow
              label="H2"
              size="36 / 44"
              sample="Visual identity system"
              accent="#1766c2"
            />
            <ScaleRow
              label="H3"
              size="24 / 32"
              sample="Colour palette"
              accent="#087e9d"
            />
            <ScaleRow
              label="Body"
              size="16 / 26"
              sample="Readable text for websites, proposals, presentations and brand documents."
              accent="#52606f"
            />
            <ScaleRow
              label="Caption"
              size="12 / 18"
              sample="Small supporting information and labels."
              accent="#77808d"
            />
          </div>
        </TypePanel>

        <TypePanel
          title="Hierarchy Preview"
          label="Layout example"
          tone="preview"
        >
          <div className="relative overflow-hidden rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6 md:p-8">
            <span className="absolute -right-7 -top-16 text-[190px] font-black leading-none text-blue-600/[0.04]">
              Aa
            </span>
            <p className="relative text-[9px] font-black uppercase tracking-[0.28em] text-blue-700">
              Brand System
            </p>
            <h3 className="relative mt-4 max-w-2xl text-4xl font-black leading-[1.02] tracking-[-0.07em] text-slate-950 md:text-5xl">
              Design that feels intentional.
            </h3>
            <h4 className="relative mt-6 text-xl font-black tracking-[-0.04em] text-slate-800 md:text-2xl">
              Clear hierarchy, calm spacing and consistent rhythm.
            </h4>
            <p className="relative mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Body copy should stay readable and confident across every brand
              touchpoint. Keep paragraphs short, line-height generous and
              spacing consistent between sections.
            </p>
            <div className="relative mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-violet-600/20">
                Primary CTA
              </span>
              <span className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-black text-blue-700">
                Secondary CTA
              </span>
            </div>
          </div>
        </TypePanel>

        <TypePanel title="Usage Guidance" label="Applications" tone="usage">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <UsageCard
              icon="⌘"
              title="Website"
              body={`${headingName} for hero and section titles. ${bodyName} for clear readable interface copy.`}
              accent="#1766c2"
            />
            <UsageCard
              icon="▤"
              title="Presentation"
              body="Use strong headings, short body text and generous spacing for slide clarity."
              accent="#6c00ff"
            />
            <UsageCard
              icon="✦"
              title="Social"
              body={`${accentName} can be used for short highlights, campaign hooks and pull quotes.`}
              accent="#c51f7c"
            />
            <UsageCard
              icon="□"
              title="Proposal"
              body="Use the body typeface for long-form content and the heading typeface for section hierarchy."
              accent="#087e9d"
            />
            <UsageCard
              icon="▧"
              title="Print"
              body="Keep contrast high and avoid very small text sizes on dark backgrounds."
              accent="#a45c00"
            />
            <UsageCard
              icon="@"
              title="Email"
              body="Use system-safe fallbacks when custom fonts are not supported."
              accent="#0b8f4d"
            />
          </div>
        </TypePanel>

        <TypePanel title="Best Practices" label="Rules" tone="rules">
          <div className="grid gap-3 md:grid-cols-2">
            <Guideline
              good
              title="Build a clear hierarchy"
              body="Use consistent spacing and no more than two or three typefaces across the system."
            />
            <Guideline
              title="Avoid decorative overload"
              body="Do not stretch text, mix too many weights or use display fonts for long paragraphs."
            />
          </div>
        </TypePanel>
      </div>
    </BrandBookPage>
  );
}

function TypePanel({
  title,
  label,
  tone,
  defaultOpen = false,
  children,
}: {
  title: string;
  label: string;
  tone: PanelTone;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = panelPalette[tone];
  const Icon = meta.Icon;

  return (
    <div
      className="overflow-hidden rounded-[18px] bg-white shadow-[0_8px_22px_rgba(40,31,53,.045)]"
      style={{ border: `1px solid ${meta.border}` }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left md:p-5"
        style={{
          background: `linear-gradient(135deg,${meta.soft},#ffffff 78%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-xs font-black text-white shadow-md"
            style={{ background: meta.accent }}
          >
            <Icon size={18} strokeWidth={2.1} />
          </span>
          <div>
            <p
              className="text-[9px] font-black uppercase tracking-[0.22em]"
              style={{ color: meta.accent }}
            >
              {label}
            </p>
            <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-950">
              {title}
            </h3>
          </div>
        </div>
        <DisclosureChevron open={open} />
      </button>

      {open && (
        <div
          className="border-t p-4 md:p-5"
          style={{ borderColor: meta.border }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ScaleRow({
  label,
  size,
  sample,
  accent,
}: {
  label: string;
  size: string;
  sample: string;
  accent: string;
}) {
  return (
    <div className="grid gap-4 rounded-[17px] border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4 md:grid-cols-[105px_1fr_95px] md:items-center">
      <span
        className="w-fit rounded-full px-3 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white"
        style={{ background: accent }}
      >
        {label}
      </span>
      <p
        className={[
          "font-black tracking-[-0.05em] text-slate-950",
          label === "Hero"
            ? "text-4xl md:text-5xl"
            : label === "H1"
              ? "text-3xl md:text-4xl"
              : label === "H2"
                ? "text-2xl md:text-3xl"
                : label === "H3"
                  ? "text-xl md:text-2xl"
                  : label === "Body"
                    ? "text-base font-medium leading-7 tracking-normal text-slate-700"
                    : "text-xs font-medium tracking-normal text-slate-500",
        ].join(" ")}
      >
        {sample}
      </p>
      <p className="rounded-lg bg-white px-3 py-2 text-center font-mono text-xs font-bold text-slate-500 shadow-sm">
        {size}
      </p>
    </div>
  );
}

function UsageCard({
  icon,
  title,
  body,
  accent,
}: {
  icon: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="rounded-[17px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black text-white"
        style={{ background: accent }}
      >
        {icon}
      </span>
      <p className="mt-4 text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function Guideline({
  title,
  body,
  good = false,
}: {
  title: string;
  body: string;
  good?: boolean;
}) {
  return (
    <div
      className={`rounded-[17px] border p-4 ${
        good
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
          : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white ${
            good ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {good ? "✓" : "×"}
        </span>
        <p className="text-sm font-black text-slate-950">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[17px] border border-dashed border-amber-200 bg-amber-50/60 p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 font-black text-amber-700">
        Aa
      </span>
      <p className="mt-3 text-sm font-bold text-slate-600">
        No typography system saved yet.
      </p>
    </div>
  );
}
