"use client";

import { useState } from "react";
import {
  BadgeCheck,
  ChartPie,
  Image,
  LayoutTemplate,
  Palette,
  Sparkles,
  SwatchBook,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";
import DisclosureChevron from "@/components/studio/ui/DisclosureChevron";

function rgbFromHex(hex: string) {
  if (!hex || !hex.startsWith("#")) return "";
  const value = hex.replace("#", "");
  if (value.length !== 6) return "";
  const bigint = parseInt(value, 16);
  return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
}

function cmykFromHex(hex: string) {
  if (!hex || !hex.startsWith("#")) return "";
  const value = hex.replace("#", "");
  if (value.length !== 6) return "";

  const r = parseInt(value.substring(0, 2), 16) / 255;
  const g = parseInt(value.substring(2, 4), 16) / 255;
  const b = parseInt(value.substring(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);

  if (k === 1) return "0, 0, 0, 100";

  const c = Math.round(((1 - r - k) / (1 - k)) * 100);
  const m = Math.round(((1 - g - k) / (1 - k)) * 100);
  const y = Math.round(((1 - b - k) / (1 - k)) * 100);

  return `${c}, ${m}, ${y}, ${Math.round(k * 100)}`;
}

function getColourValue(colour: any) {
  if (typeof colour === "string") return colour;
  return colour?.hex || colour?.value || "#111111";
}

function getColourName(colour: any, index: number) {
  if (typeof colour === "string") return `Colour ${index + 1}`;
  return colour?.name || colour?.role || `Colour ${index + 1}`;
}

const panelMeta = {
  primary: { Icon: Palette, accent: "#1766c2", soft: "#edf6ff", border: "#bdd9ff" },
  support: { Icon: SwatchBook, accent: "#6c00ff", soft: "#f3eaff", border: "#d8c2fb" },
  usage: { Icon: ChartPie, accent: "#087e9d", soft: "#ebfbff", border: "#b8e5ee" },
  pairings: {
    Icon: LayoutTemplate,
    accent: "#c51f7c",
    soft: "#fff0f8",
    border: "#f2bfdc",
  },
  guidance: {
    Icon: BadgeCheck,
    accent: "#0b8f4d",
    soft: "#ebfbf2",
    border: "#b7e6cb",
  },
};

type PanelTone = keyof typeof panelMeta;

export default function BrandColours({ brand }: { brand: any }) {
  const colours =
    brand?.colourPalette || brand?.colorPalette || brand?.colors || [];
  const usage = ["Primary", "Secondary", "Accent", "Neutral", "Support"];
  const primaryColours = colours.slice(0, 2);
  const supportColours = colours.slice(2);

  return (
    <BrandBookPage
      page={4}
      eyebrow="Colour System"
      title="Colour System"
      tone="blue"
      icon={Palette}
    >
      <style>{`
        .heyy-colour-role-badge {
          display: inline-flex !important;
          min-height: 27px !important;
          align-items: center !important;
          border: 1px solid rgba(255,255,255,.9) !important;
          border-radius: 999px !important;
          background: rgba(15,23,42,.92) !important;
          padding: 0 11px !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          font-size: 8px !important;
          font-weight: 950 !important;
          letter-spacing: .16em !important;
          line-height: 1 !important;
          text-shadow: none !important;
          text-transform: uppercase !important;
          box-shadow: 0 6px 16px rgba(15,23,42,.2) !important;
          backdrop-filter: blur(8px);
        }
      `}</style>
      <div className="rounded-[18px] border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4 md:p-5">
        <p className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
          The colour system defines the visual mood of the brand. Use these
          colours consistently across digital, print, presentation and campaign
          applications.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <ColourPanel
          title="Primary Palette"
          label="Core colours"
          tone="primary"
          defaultOpen
        >
          {primaryColours.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {primaryColours.map((colour: any, index: number) => (
                <ColourCard
                  key={index}
                  colour={colour}
                  index={index}
                  usage={usage[index] || "Primary"}
                  featured
                />
              ))}
            </div>
          )}
        </ColourPanel>

        {supportColours.length > 0 && (
          <ColourPanel
            title="Supporting Palette"
            label="Secondary colours"
            tone="support"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {supportColours.map((colour: any, index: number) => (
                <ColourCard
                  key={index}
                  colour={colour}
                  index={index + 2}
                  usage={usage[index + 2] || "Support"}
                />
              ))}
            </div>
          </ColourPanel>
        )}

        {colours.length > 0 && (
          <ColourPanel
            title="Colour Usage"
            label="Application balance"
            tone="usage"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <UsageCard
                Icon={Image}
                title="Backgrounds"
                value="60%"
                body="Use neutral and primary colours for large background areas."
                accent="#1766c2"
              />
              <UsageCard
                Icon={Type}
                title="Headlines"
                value="25%"
                body="Use strong contrast for headings and important messages."
                accent="#6c00ff"
              />
              <UsageCard
                Icon={Sparkles}
                title="Accents"
                value="15%"
                body="Use accent colours for buttons, badges and highlights."
                accent="#c51f7c"
              />
            </div>
          </ColourPanel>
        )}

        {colours.length > 1 && (
          <ColourPanel
            title="Recommended Combinations"
            label="Approved pairings"
            tone="pairings"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Combination
                title="Primary on White"
                bg="#ffffff"
                fg={getColourValue(colours[0])}
              />
              <Combination
                title="White on Primary"
                bg={getColourValue(colours[0])}
                fg="#ffffff"
              />
              <Combination
                title="Secondary Accent"
                bg={getColourValue(colours[1])}
                fg={getColourValue(colours[2]) || "#ffffff"}
              />
            </div>
          </ColourPanel>
        )}

        <ColourPanel
          title="Do & Don't"
          label="Practical guidance"
          tone="guidance"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Guideline
              good
              title="Use clear contrast"
              body="Keep the palette consistent and make sure text remains readable across every touchpoint."
            />
            <Guideline
              title="Avoid visual noise"
              body="Do not place low-contrast colours together or use every colour at equal strength in one layout."
            />
          </div>
        </ColourPanel>
      </div>
    </BrandBookPage>
  );
}

function ColourPanel({
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
  const meta = panelMeta[tone];
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
        <div className="flex min-w-0 items-center gap-3">
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

function ColourCard({
  colour,
  index,
  usage,
  featured = false,
}: {
  colour: any;
  index: number;
  usage: string;
  featured?: boolean;
}) {
  const hex = getColourValue(colour);
  const rgb = colour?.rgb || rgbFromHex(hex) || "—";
  const cmyk = colour?.cmyk || cmykFromHex(hex) || "—";

  return (
    <div className="group overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_12px_28px_rgba(32,28,43,.07)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(32,28,43,.12)]">
      <div
        className={`relative ${featured ? "h-36" : "h-28"}`}
        style={{ backgroundColor: hex }}
      >
        <span className="heyy-colour-role-badge absolute bottom-3 left-3">
          {usage}
        </span>
      </div>

      <div className="p-4">
        <h4 className="text-lg font-black tracking-[-0.035em] text-slate-950">
          {getColourName(colour, index)}
        </h4>

        {colour?.usage && (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {colour.usage}
          </p>
        )}

        <div className="mt-4 grid gap-2">
          <Meta label="HEX" value={hex} />
          <Meta label="RGB" value={rgb} />
          <Meta label="CMYK" value={cmyk} />
        </div>
      </div>
    </div>
  );
}

function UsageCard({
  Icon,
  title,
  value,
  body,
  accent,
}: {
  Icon: LucideIcon;
  title: string;
  value: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="rounded-[17px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black text-white"
          style={{ background: accent }}
        >
          <Icon size={16} strokeWidth={2.1} />
        </span>
        <p
          className="text-3xl font-black tracking-[-0.06em]"
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

function Combination({
  title,
  bg,
  fg,
}: {
  title: string;
  bg: string;
  fg: string;
}) {
  return (
    <div className="overflow-hidden rounded-[17px] border border-slate-200 bg-white shadow-sm">
      <div
        className="relative flex h-28 items-center justify-center overflow-hidden p-4 text-3xl font-black"
        style={{ backgroundColor: bg, color: fg }}
      >
        <span className="absolute left-3 top-3 text-[8px] font-black uppercase tracking-[0.18em] opacity-70">
          Contrast test
        </span>
        Aa
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <p className="text-sm font-black text-slate-800">{title}</p>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
          Approved
        </span>
      </div>
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
          {good ? <BadgeCheck size={16} /> : <X size={16} />}
        </span>
        <p className="text-sm font-black text-slate-950">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <span className="truncate font-mono text-xs font-bold text-slate-700">
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[17px] border border-dashed border-blue-200 bg-blue-50/50 p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
        <Palette size={20} />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-600">
        No colour palette generated yet.
      </p>
    </div>
  );
}
