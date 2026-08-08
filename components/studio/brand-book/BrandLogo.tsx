"use client";

import {
  BadgeCheck,
  ClipboardCheck,
  Compass,
  LayoutTemplate,
  Move,
  ScanLine,
  Maximize2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useState } from "react";
import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";
import DisclosureChevron from "@/components/studio/ui/DisclosureChevron";

function getLogoUrl(logo: any) {
  return logo?.imageUrl || logo?.url || logo?.file_url || "";
}

const panelPalette = {
  concept: { Icon: Sparkles, accent: "#c51f7c", soft: "#fff0f8", border: "#f2bfdc" },
  specs: { Icon: ClipboardCheck, accent: "#6c00ff", soft: "#f3eaff", border: "#d8c2fb" },
  roadmap: { Icon: Compass, accent: "#1766c2", soft: "#edf6ff", border: "#bdd9ff" },
  preview: { Icon: LayoutTemplate, accent: "#087e9d", soft: "#ebfbff", border: "#b8e5ee" },
  spacing: { Icon: Move, accent: "#a45c00", soft: "#fff7df", border: "#efd395" },
  size: { Icon: ScanLine, accent: "#7b44c8", soft: "#f5efff", border: "#dac8f5" },
  guidance: {
    Icon: ShieldCheck,
    accent: "#0b8f4d",
    soft: "#ebfbf2",
    border: "#b7e6cb",
  },
  handoff: { Icon: BadgeCheck, accent: "#0d7f78", soft: "#eafaf8", border: "#b7e3df" },
};

type PanelTone = keyof typeof panelPalette;

export default function BrandLogo({ logo }: { logo?: any }) {
  const logoUrl = getLogoUrl(logo);

  return (
    <BrandBookPage
      page={8}
      eyebrow="Logo Direction"
      title="Logo Direction"
      tone="rose"
      icon={BadgeCheck}
    >
      <div className="rounded-[18px] border border-rose-100 bg-gradient-to-r from-rose-50 to-white p-4 md:p-5">
        <p className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
          This is an AI-generated logo direction, not a production-ready master
          logo. Treat it as the approved creative concept that guides
          professional refinement, vector redraw and final asset production.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <LogoPanel
          title="Approved Logo Direction"
          label="AI concept"
          tone="concept"
          defaultOpen
        >
          {logoUrl ? (
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="relative flex min-h-[290px] items-center justify-center overflow-hidden rounded-[22px] border border-rose-100 bg-gradient-to-br from-white via-rose-50/40 to-violet-50 p-8 shadow-inner">
                <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-rose-700 shadow-sm">
                  Selected direction
                </span>
                <span className="absolute -bottom-20 -right-8 text-[230px] font-black leading-none text-rose-600/[0.035]">
                  /
                </span>
                <div className="relative flex min-h-44 w-full items-center justify-center rounded-[18px] border border-white bg-white/85 p-7 shadow-[0_16px_40px_rgba(83,43,72,.09)] backdrop-blur-sm">
                  <img
                    src={logoUrl}
                    alt="Approved logo direction"
                    className="max-h-44 max-w-full object-contain"
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <InfoCard
                  icon="✓"
                  accent="#0b8f4d"
                  title="What this is"
                  body="A selected AI-generated concept that establishes the preferred shape, mood and visual direction."
                />
                <InfoCard
                  icon="!"
                  accent="#c56b00"
                  title="What this is not"
                  body="It is not yet a trademark-safe vector master, transparent production asset or print-ready logo package."
                />
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </LogoPanel>

        <LogoPanel
          title="Logo Specifications"
          label="Direction details"
          tone="specs"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Spec
              icon="✓"
              title="Status"
              value="AI concept approved"
              accent="#0b8f4d"
            />
            <Spec
              icon="↗"
              title="Production"
              value="Expert required"
              accent="#1766c2"
            />
            <Spec
              icon="▧"
              title="Source"
              value="Generated image"
              accent="#6c00ff"
            />
            <Spec
              icon="○"
              title="Final files"
              value="Not created yet"
              accent="#c51f7c"
            />
          </div>
        </LogoPanel>

        <LogoPanel title="Production Roadmap" label="Next step" tone="roadmap">
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-5 text-white shadow-[0_18px_38px_rgba(108,0,255,.22)]">
              <span className="absolute -right-8 -top-14 text-[180px] font-black leading-none text-white/[0.07]">
                /
              </span>
              <p className="relative text-[9px] font-black uppercase tracking-[0.24em] text-violet-100">
                Expert production
              </p>
              <h3 className="relative mt-3 text-2xl font-black tracking-[-0.045em] text-white">
                Turn this concept into a real logo package.
              </h3>
              <p className="relative mt-3 text-sm leading-6 text-white/80">
                A Heyy Studio expert redraws the approved concept as clean
                vector artwork and prepares every format needed for professional
                launch.
              </p>
              <button
                type="button"
                className="relative mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-violet-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50"
              >
                Contact Expert ↗
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Deliverable label="Master vector logo" />
              <Deliverable label="SVG production file" />
              <Deliverable label="Transparent PNG" />
              <Deliverable label="Monochrome version" />
              <Deliverable label="Light / dark versions" />
              <Deliverable label="Favicon pack" />
              <Deliverable label="Social avatar" />
              <Deliverable label="Brand asset library" />
            </div>
          </div>
        </LogoPanel>

        <LogoPanel
          title="Concept Preview"
          label="Application context"
          tone="preview"
        >
          {logoUrl ? (
            <div className="grid gap-3 md:grid-cols-3">
              <PreviewCard
                title="Original AI concept"
                badge="Current"
                background="linear-gradient(145deg,#ffffff,#f7f2ff)"
              >
                <img
                  src={logoUrl}
                  alt="Original AI logo concept"
                  className="max-h-20 max-w-full object-contain"
                />
              </PreviewCard>
              <PreviewPlaceholder
                icon="▧"
                title="Transparent version"
                body="Prepared during expert production."
              />
              <PreviewPlaceholder
                icon="◇"
                title="Vector version"
                body="Redrawn manually as clean SVG / AI."
              />
            </div>
          ) : (
            <EmptyState />
          )}
        </LogoPanel>

        <LogoPanel title="Clear Space" label="Spacing system" tone="spacing">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[20px] border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6">
              <div className="rounded-[18px] border-2 border-dashed border-amber-300 bg-white/70 p-8">
                <div className="flex h-36 items-center justify-center rounded-[14px] border border-amber-100 bg-white shadow-sm">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo clear space diagram"
                      className="max-h-20 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm font-bold text-slate-400">
                      Logo
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 text-center text-[9px] font-black uppercase tracking-[0.18em] text-amber-700">
                Keep surrounding area clear
              </p>
            </div>

            <InfoCard
              icon="↔"
              accent="#a45c00"
              title="Recommended rule"
              body="Maintain clear space equal to at least 20% of the logo width or the height of a key logo element."
            />
          </div>
        </LogoPanel>

        <LogoPanel title="Minimum Size" label="Legibility" tone="size">
          <div className="grid gap-3 md:grid-cols-3">
            <SizeCard
              icon="⌘"
              title="Website header"
              value="120px+"
              body="Hero sections, navigation headers and large digital placements."
              accent="#1766c2"
            />
            <SizeCard
              icon="▤"
              title="Presentation"
              value="64px+"
              body="Deck covers, proposal pages and supporting layouts."
              accent="#6c00ff"
            />
            <SizeCard
              icon="◇"
              title="Icon / favicon"
              value="32px+"
              body="Only after an expert creates a simplified symbol version."
              accent="#c51f7c"
            />
          </div>
        </LogoPanel>

        <LogoPanel
          title="Production Guidelines"
          label="Important notes"
          tone="guidance"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Guideline
              good
              title="Use as creative direction"
              body="Use the image to communicate the approved style, proportion, mood and visual intent."
            />
            <Guideline
              good
              title="Redraw before launch"
              body="Recreate the mark as clean vector artwork with correct spacing and export settings."
            />
            <Guideline
              title="Do not treat as final"
              body="Do not use the AI image as a commercial master, trademark file or supplier-ready print asset."
            />
            <Guideline
              title="Do not fake vector exports"
              body="Changing a JPG or PNG extension to SVG does not create a proper production logo."
            />
          </div>
        </LogoPanel>

        <LogoPanel
          title="Production Handoff"
          label="Expert output"
          tone="handoff"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard
              icon="→"
              accent="#0d7f78"
              title="What the expert receives"
              body="The selected logo direction, brand strategy, colour palette, typography system and application context."
            />
            <InfoCard
              icon="↓"
              accent="#6c00ff"
              title="What the user receives"
              body="A professional logo package with vector artwork, transparent assets, usage rules and launch-ready files."
            />
          </div>
        </LogoPanel>

        <div className="relative overflow-hidden rounded-[22px] border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-rose-50 p-5 md:p-6">
          <span className="absolute -right-5 -top-12 text-[165px] font-black leading-none text-violet-600/[0.045]">
            ✓
          </span>
          <span className="relative inline-flex rounded-full bg-violet-600 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white">
            Ready for production
          </span>
          <h3 className="relative mt-3 text-2xl font-black tracking-[-0.045em] text-slate-950">
            This logo direction is ready for expert refinement.
          </h3>
          <p className="relative mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            The concept can guide previews, mockups and applications. Before
            real-world launch, it should be recreated as a complete vector
            identity system.
          </p>
        </div>
      </div>
    </BrandBookPage>
  );
}

function LogoPanel({
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-sm font-black text-white shadow-md"
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

function PreviewCard({
  title,
  badge,
  background,
  children,
}: {
  title: string;
  badge: string;
  background: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
      <div
        className="relative flex h-36 items-center justify-center p-5"
        style={{ background }}
      >
        <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-violet-700 shadow-sm">
          {badge}
        </span>
        {children}
      </div>
      <p className="border-t border-slate-100 p-3 text-sm font-black text-slate-800">
        {title}
      </p>
    </div>
  );
}

function PreviewPlaceholder({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-dashed border-violet-200 bg-gradient-to-br from-violet-50/70 to-white">
      <div className="flex h-36 flex-col items-center justify-center gap-3 p-5 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-lg font-black text-violet-700">
          {icon}
        </span>
        <span className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-500">
          Expert output
        </span>
      </div>
      <div className="border-t border-violet-100 bg-white p-3">
        <p className="text-sm font-black text-slate-800">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  accent,
  title,
  body,
}: {
  icon: string;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[17px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black text-white"
          style={{ background: accent }}
        >
          {icon}
        </span>
        <p
          className="text-[9px] font-black uppercase tracking-[0.18em]"
          style={{ color: accent }}
        >
          {title}
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function Spec({
  icon,
  title,
  value,
  accent,
}: {
  icon: string;
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-[17px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-white"
        style={{ background: accent }}
      >
        {icon}
      </span>
      <p className="mt-4 text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function SizeCard({
  icon,
  title,
  value,
  body,
  accent,
}: {
  icon: string;
  title: string;
  value: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="rounded-[17px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black text-white"
          style={{ background: accent }}
        >
          {icon}
        </span>
        <p
          className="text-2xl font-black tracking-[-0.05em]"
          style={{ color: accent }}
        >
          {value}
        </p>
      </div>
      <p className="mt-4 text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function Deliverable({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-3 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-xs font-black text-white">
        ✓
      </span>
      <p className="text-sm font-bold text-slate-700">{label}</p>
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
          : "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white ${
            good ? "bg-emerald-500" : "bg-amber-500"
          }`}
        >
          {good ? "✓" : "!"}
        </span>
        <p className="text-sm font-black text-slate-950">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[18px] border border-dashed border-rose-200 bg-rose-50/60 p-9 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-xl font-black text-rose-700">
        ◇
      </span>
      <p className="mt-3 text-sm font-bold text-slate-600">
        Select or generate a logo to preview it inside the Brand Book.
      </p>
    </div>
  );
}
