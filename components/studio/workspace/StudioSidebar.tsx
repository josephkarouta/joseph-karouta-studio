"use client";

import { useMemo, useState } from "react";

import { useAssets } from "@/hooks/use-assets";
import { useProject } from "@/hooks/use-project";
import StudioTimeline from "./StudioTimeline";

type Tone = "purple" | "green" | "blue" | "amber" | "rose" | "neutral";

type PanelPalette = {
  border: string;
  background: string;
  accent: string;
  soft: string;
  shadow: string;
};

const palettes: Record<Tone, PanelPalette> = {
  purple: {
    border: "#d7c0ff",
    background: "linear-gradient(145deg,#f2e8ff 0%,#ffffff 74%)",
    accent: "#6c00ff",
    soft: "#efe4ff",
    shadow: "rgba(108,0,255,.10)",
  },
  green: {
    border: "#b7e6cb",
    background: "linear-gradient(145deg,#eafff2 0%,#ffffff 74%)",
    accent: "#0b9854",
    soft: "#e1f9eb",
    shadow: "rgba(11,152,84,.10)",
  },
  blue: {
    border: "#b8d7ff",
    background: "linear-gradient(145deg,#edf5ff 0%,#ffffff 74%)",
    accent: "#2463d9",
    soft: "#e4efff",
    shadow: "rgba(36,99,217,.10)",
  },
  amber: {
    border: "#efd28f",
    background: "linear-gradient(145deg,#fff5d8 0%,#ffffff 74%)",
    accent: "#a96300",
    soft: "#fff0c5",
    shadow: "rgba(169,99,0,.10)",
  },
  rose: {
    border: "#f1c0dc",
    background: "linear-gradient(145deg,#fff0f8 0%,#ffffff 74%)",
    accent: "#c51f7c",
    soft: "#ffe3f2",
    shadow: "rgba(197,31,124,.10)",
  },
  neutral: {
    border: "#ddd6e5",
    background: "linear-gradient(145deg,#faf9fc 0%,#ffffff 74%)",
    accent: "#5e5667",
    soft: "#f0edf3",
    shadow: "rgba(60,48,72,.08)",
  },
};

function formatDate(value?: string) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function assetTypeLabel(type?: string) {
  return String(type || "asset")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readPayload(asset: any) {
  const payload = asset?.output_payload;
  if (!payload) return {};

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }

  return payload;
}

function getSwatches(assets: any[]) {
  const brandAsset = assets.find(
    (asset) => asset.asset_type === "brand_system",
  );

  const payload = readPayload(brandAsset);
  const colours =
    payload?.colourPalette || payload?.brand_system?.colourPalette || [];

  if (!Array.isArray(colours)) return [];

  return colours
    .map((colour: any) => colour.hex || colour.HEX || colour.value)
    .filter(Boolean)
    .slice(0, 5);
}

function SidebarPanel({
  id,
  title,
  eyebrow,
  tone = "neutral",
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  tone?: Tone;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const palette = palettes[tone];

  return (
    <section
      className="heyy-sidebar-panel overflow-hidden rounded-[22px]"
      data-open={open ? "true" : "false"}
      style={
        {
          "--sidebar-border": palette.border,
          "--sidebar-accent": palette.accent,
          "--sidebar-soft": palette.soft,
          "--sidebar-shadow": palette.shadow,
          border: `1px solid ${palette.border}`,
          background: palette.background,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="heyy-sidebar-trigger"
        aria-expanded={open}
        aria-controls={`sidebar-panel-${id}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="heyy-sidebar-panel-icon">
            <PanelIcon id={id} />
          </span>

          <div className="min-w-0">
            {eyebrow && (
              <p
                className="text-[8px] font-black uppercase tracking-[0.19em]"
                style={{ color: palette.accent }}
              >
                {eyebrow}
              </p>
            )}

            <h3 className="mt-1 truncate text-[15px] font-black tracking-[-0.025em] text-slate-950">
              {title}
            </h3>
          </div>
        </div>

        <span className={`heyy-sidebar-chevron ${open ? "rotate-180" : ""}`}>
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <div id={`sidebar-panel-${id}`} className="heyy-sidebar-content">
          {children}
        </div>
      )}
    </section>
  );
}

function Info({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="heyy-sidebar-info">
      <span className="heyy-sidebar-info-icon">{icon}</span>
      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.16em] text-slate-400">
          {title}
        </p>
        <p className="mt-1 truncate text-xs font-black capitalize text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function StatusRow({
  done,
  label,
  index,
}: {
  done: boolean;
  label: string;
  index: number;
}) {
  return (
    <div className="heyy-sidebar-status" data-done={done ? "true" : "false"}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="heyy-sidebar-status-number">
          {done ? "✓" : index + 1}
        </span>
        <span className="truncate text-[11px] font-black text-slate-700">
          {label}
        </span>
      </div>

      <span className="text-[7px] font-black uppercase tracking-[0.14em] text-slate-400">
        {done ? "Complete" : "Pending"}
      </span>
    </div>
  );
}

function AssetIcon({ type }: { type?: string }) {
  const safeType = String(type || "");

  if (safeType.includes("guidelines")) return <BookIcon />;
  if (safeType.includes("moodboard")) return <ImageIcon />;
  if (safeType.includes("logo")) return <DiamondIcon />;
  if (safeType.includes("export")) return <DownloadIcon />;

  return <FileIcon />;
}

export default function StudioSidebar() {
  const project = useProject();
  const { assets } = useAssets();

  const assetTypes = useMemo(
    () => new Set(assets.map((asset: any) => String(asset.asset_type || ""))),
    [assets],
  );

  const progressItems = [
    { label: "Brand System", done: true },
    {
      label: "Creative Direction",
      done: assetTypes.has("creative_direction_selected"),
    },
    {
      label: "Moodboard",
      done: [...assetTypes].some((type) => type.includes("moodboard")),
    },
    {
      label: "Logo",
      done: [...assetTypes].some((type) => type.includes("logo")),
    },
    {
      label: "Guidelines",
      done: [...assetTypes].some((type) => type.includes("guidelines")),
    },
    {
      label: "Export Ready",
      done: [...assetTypes].some(
        (type) => type.includes("export") || type.includes("guidelines"),
      ),
    },
  ];

  const completedCount = progressItems.filter((item) => item.done).length;
  const progress = Math.round((completedCount / progressItems.length) * 100);
  const swatches = getSwatches(assets);
  const recentAssets = assets.slice(0, 5);

  return (
    <aside className="heyy-studio-sidebar hidden space-y-3 lg:block lg:sticky lg:top-[164px] lg:h-fit lg:w-[330px] lg:self-start">
      <style>{`
        .heyy-studio-sidebar,
        .heyy-studio-sidebar * {
          box-sizing: border-box;
        }

        .heyy-sidebar-panel {
          position: relative;
          box-shadow: 0 12px 28px var(--sidebar-shadow);
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .heyy-sidebar-panel:hover {
          transform: translateY(-2px);
          box-shadow: 0 17px 34px var(--sidebar-shadow);
        }

        .heyy-sidebar-panel::after {
          content: "";
          position: absolute;
          right: -34px;
          top: -34px;
          width: 106px;
          height: 106px;
          border-radius: 999px;
          background: var(--sidebar-accent);
          opacity: .07;
          filter: blur(24px);
          pointer-events: none;
        }

        .heyy-sidebar-trigger {
          position: relative;
          z-index: 1;
          display: flex !important;
          width: 100% !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          background: transparent !important;
          padding: 15px !important;
          color: #17151f !important;
          -webkit-text-fill-color: #17151f !important;
          text-align: left !important;
        }

        .heyy-sidebar-trigger:hover {
          background: rgba(255,255,255,.36) !important;
          color: #17151f !important;
          -webkit-text-fill-color: #17151f !important;
        }

        .heyy-sidebar-panel-icon {
          display: flex;
          width: 39px;
          height: 39px;
          flex: 0 0 39px;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: var(--sidebar-accent);
          color: #ffffff;
          box-shadow: 0 9px 18px var(--sidebar-shadow);
        }

        .heyy-sidebar-panel-icon svg {
          width: 17px;
          height: 17px;
          stroke: currentColor;
        }

        .heyy-sidebar-chevron {
          display: flex;
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--sidebar-border);
          border-radius: 999px;
          background: #ffffff;
          color: var(--sidebar-accent);
          box-shadow: 0 6px 14px rgba(42, 31, 52, .06);
          transition: transform 180ms ease;
        }

        .heyy-sidebar-content {
          position: relative;
          z-index: 1;
          border-top: 1px solid var(--sidebar-border);
          background: rgba(255,255,255,.60);
          padding: 14px;
          backdrop-filter: blur(8px);
        }

        .heyy-sidebar-info {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(215, 209, 222, .9);
          border-radius: 15px;
          background: rgba(255,255,255,.90);
          padding: 11px;
          box-shadow: 0 7px 16px rgba(42, 31, 52, .04);
        }

        .heyy-sidebar-info-icon {
          display: flex;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: var(--sidebar-soft);
          color: var(--sidebar-accent);
        }

        .heyy-sidebar-info-icon svg {
          width: 14px;
          height: 14px;
        }

        .heyy-sidebar-progress-ring {
          position: relative;
          display: flex;
          width: 78px;
          height: 78px;
          flex: 0 0 78px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: conic-gradient(#0b9854 var(--progress), #dff6e9 0);
          box-shadow: 0 10px 22px rgba(11,152,84,.13);
        }

        .heyy-sidebar-progress-ring::after {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: inherit;
          background: #ffffff;
        }

        .heyy-sidebar-progress-ring strong {
          position: relative;
          z-index: 1;
          color: #0b7f47;
          font-size: 17px;
          font-weight: 950;
        }

        .heyy-sidebar-status {
          display: flex;
          min-height: 43px;
          align-items: center;
          justify-content: space-between;
          gap: 9px;
          border: 1px solid #dfe5e2;
          border-radius: 13px;
          background: rgba(255,255,255,.88);
          padding: 8px 10px;
          transition: transform 150ms ease, border-color 150ms ease;
        }

        .heyy-sidebar-status:hover {
          transform: translateX(2px);
        }

        .heyy-sidebar-status[data-done="true"] {
          border-color: #b7e6cb;
          background: linear-gradient(135deg,#edfff4,#ffffff);
        }

        .heyy-sidebar-status-number {
          display: flex;
          width: 24px;
          height: 24px;
          flex: 0 0 24px;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #eef0f3;
          color: #7d8490;
          font-size: 9px;
          font-weight: 950;
        }

        .heyy-sidebar-status[data-done="true"] .heyy-sidebar-status-number {
          background: #0fa75d;
          color: #ffffff;
          box-shadow: 0 6px 13px rgba(15,167,93,.18);
        }

        .heyy-sidebar-action {
          display: flex !important;
          min-height: 49px !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          border: 1px solid #c9ddfb !important;
          border-radius: 15px !important;
          background: rgba(255,255,255,.9) !important;
          padding: 9px 11px !important;
          color: #334155 !important;
          -webkit-text-fill-color: #334155 !important;
          box-shadow: 0 7px 17px rgba(36,99,217,.05) !important;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease !important;
        }

        .heyy-sidebar-action:hover {
          transform: translateY(-2px);
          border-color: #4f8df0 !important;
          background: #f4f8ff !important;
          color: #1f5fc9 !important;
          -webkit-text-fill-color: #1f5fc9 !important;
          box-shadow: 0 12px 23px rgba(36,99,217,.11) !important;
        }

        .heyy-sidebar-action-icon {
          display: flex;
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #e7f0ff;
          color: #2463d9;
        }

        .heyy-sidebar-asset {
          display: flex;
          gap: 10px;
          border: 1px solid #dfd2f1;
          border-radius: 15px;
          background: rgba(255,255,255,.9);
          padding: 10px;
          box-shadow: 0 7px 17px rgba(108,0,255,.05);
          transition: transform 160ms ease, border-color 160ms ease;
        }

        .heyy-sidebar-asset:hover {
          transform: translateX(2px);
          border-color: #a77aff;
        }

        .heyy-sidebar-suggestion {
          display: flex;
          gap: 10px;
          border: 1px solid #f0d9a8;
          border-radius: 14px;
          background: rgba(255,255,255,.86);
          padding: 11px;
        }
      `}</style>

      <SidebarPanel
        id="project"
        eyebrow="Project"
        title="Workspace Status"
        tone="purple"
        defaultOpen
      >
        <div className="grid grid-cols-2 gap-2">
          <Info title="Status" value={project.status} icon={<StatusIcon />} />
          <Info
            title="Version"
            value={`V${project.version}`}
            icon={<VersionIcon />}
          />
          <Info title="Studio" value={project.studio} icon={<StudioIcon />} />
          <Info
            title="Updated"
            value={formatDate(project.updatedAt)}
            icon={<CalendarIcon />}
          />
        </div>
      </SidebarPanel>

      <SidebarPanel
        id="progress"
        eyebrow="Progress"
        title="Brand System Progress"
        tone="green"
        defaultOpen
      >
        <div className="flex items-center gap-4 rounded-[17px] border border-emerald-100 bg-white/85 p-3">
          <div
            className="heyy-sidebar-progress-ring"
            style={{ "--progress": `${progress}%` } as React.CSSProperties}
          >
            <strong>{progress}%</strong>
          </div>

          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Completion
            </p>
            <p className="mt-1 text-base font-black text-slate-900">
              {completedCount} of {progressItems.length} ready
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Finish the remaining steps before final export.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {progressItems.map((item, index) => (
            <StatusRow
              key={item.label}
              done={item.done}
              label={item.label}
              index={index}
            />
          ))}
        </div>
      </SidebarPanel>

      <SidebarPanel
        id="actions"
        eyebrow="Quick Actions"
        title="Next Best Actions"
        tone="blue"
      >
        <div className="grid gap-2">
          <QuickAction
            href="#brand-book-colours"
            label="Review Brand Book"
            icon={<BookIcon />}
          />
          <QuickAction
            href="#brand-book-checklist"
            label="Check Export Readiness"
            icon={<CheckIcon />}
          />
          <QuickAction
            href="#brand-book-assets"
            label="Open Asset Library"
            icon={<GridIcon />}
          />
        </div>
      </SidebarPanel>

      {swatches.length > 0 && (
        <SidebarPanel
          id="palette"
          eyebrow="Palette"
          title="Brand Colours"
          tone="rose"
        >
          <div className="rounded-[17px] border border-rose-100 bg-white/85 p-3">
            <div className="flex gap-2">
              {swatches.map((colour, index) => (
                <div key={colour} className="min-w-0 flex-1">
                  <div
                    className="h-12 rounded-[13px] border border-white shadow-[0_7px_16px_rgba(40,25,50,.10)]"
                    style={{ backgroundColor: colour }}
                    title={colour}
                  />
                  <p className="mt-2 truncate text-center font-mono text-[7px] text-slate-400">
                    {index + 1}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </SidebarPanel>
      )}

      <SidebarPanel
        id="assets"
        eyebrow="Assets"
        title="Recent Outputs"
        tone="purple"
      >
        {recentAssets.length === 0 ? (
          <EmptySidebarState
            icon={<GridIcon />}
            title="No saved outputs yet"
            body="Generated moodboards, logos, guidelines and exports will appear here."
          />
        ) : (
          <div className="grid gap-2">
            {recentAssets.map((asset: any) => (
              <div key={asset.id} className="heyy-sidebar-asset">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-violet-100 text-violet-700">
                  <AssetIcon type={asset.asset_type} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-slate-800">
                    {asset.title || assetTypeLabel(asset.asset_type)}
                  </p>
                  <p className="mt-1 truncate text-[7px] font-black uppercase tracking-[0.14em] text-violet-500">
                    {assetTypeLabel(asset.asset_type)}
                  </p>
                </div>

                <span className="text-violet-600">→</span>
              </div>
            ))}
          </div>
        )}
      </SidebarPanel>

      <SidebarPanel
        id="suggestions"
        eyebrow="AI Suggestions"
        title="Polish Before Export"
        tone="amber"
      >
        <div className="grid gap-2">
          <Suggestion
            index={1}
            text="Confirm the final logo, moodboard and colour choices."
          />
          <Suggestion
            index={2}
            text="Keep only the strongest directions in the final Brand Book."
          />
        </div>
      </SidebarPanel>

      <SidebarPanel
        id="timeline"
        eyebrow="Activity"
        title="Project Timeline"
        tone="neutral"
      >
        <StudioTimeline />
      </SidebarPanel>
    </aside>
  );
}

function QuickAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a href={href} className="heyy-sidebar-action">
      <span className="flex min-w-0 items-center gap-3">
        <span className="heyy-sidebar-action-icon">{icon}</span>
        <span className="truncate text-[11px] font-black">{label}</span>
      </span>
      <span className="text-blue-600">→</span>
    </a>
  );
}

function Suggestion({ index, text }: { index: number; text: string }) {
  return (
    <div className="heyy-sidebar-suggestion">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-amber-100 text-[9px] font-black text-amber-700">
        {index}
      </span>
      <p className="text-[11px] font-bold leading-5 text-slate-600">{text}</p>
    </div>
  );
}

function EmptySidebarState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[16px] border border-dashed border-violet-200 bg-white/70 p-4 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[13px] bg-violet-100 text-violet-700">
        {icon}
      </span>
      <p className="mt-3 text-xs font-black text-slate-800">{title}</p>
      <p className="mt-1 text-[10px] leading-5 text-slate-500">{body}</p>
    </div>
  );
}

function PanelIcon({ id }: { id: string }) {
  if (id === "project") return <WorkspaceIcon />;
  if (id === "progress") return <ProgressIcon />;
  if (id === "actions") return <BoltIcon />;
  if (id === "palette") return <PaletteIcon />;
  if (id === "assets") return <GridIcon />;
  if (id === "suggestions") return <SparkleIcon />;
  return <ClockIcon />;
}

function SvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ChevronIcon() {
  return (
    <SvgIcon>
      <path d="m6 9 6 6 6-6" />
    </SvgIcon>
  );
}
function WorkspaceIcon() {
  return (
    <SvgIcon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h6" />
    </SvgIcon>
  );
}
function ProgressIcon() {
  return (
    <SvgIcon>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 3v9h9" />
    </SvgIcon>
  );
}
function BoltIcon() {
  return (
    <SvgIcon>
      <path d="m13 2-9 12h7l-1 8 9-12h-7z" />
    </SvgIcon>
  );
}
function PaletteIcon() {
  return (
    <SvgIcon>
      <circle cx="13.5" cy="6.5" r="1" />
      <circle cx="17.5" cy="10.5" r="1" />
      <circle cx="8.5" cy="7.5" r="1" />
      <circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 4-4 4h-1.5a2.5 2.5 0 0 0-2.5 2.5c0 1.4-.9 3.5-2 3.5z" />
    </SvgIcon>
  );
}
function GridIcon() {
  return (
    <SvgIcon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </SvgIcon>
  );
}
function SparkleIcon() {
  return (
    <SvgIcon>
      <path d="m12 3-1.8 4.2L6 9l4.2 1.8L12 15l1.8-4.2L18 9l-4.2-1.8z" />
      <path d="m5 15-.8 1.8L2.5 17.5l1.7.7L5 20l.8-1.8 1.7-.7-1.7-.7zM19 15l-.8 1.8-1.7.7 1.7.7L19 20l.8-1.8 1.7-.7-1.7-.7z" />
    </SvgIcon>
  );
}
function ClockIcon() {
  return (
    <SvgIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </SvgIcon>
  );
}
function StatusIcon() {
  return (
    <SvgIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="m9 12 2 2 4-4" />
    </SvgIcon>
  );
}
function VersionIcon() {
  return (
    <SvgIcon>
      <path d="M4 7h10M4 12h16M4 17h10" />
    </SvgIcon>
  );
}
function StudioIcon() {
  return (
    <SvgIcon>
      <path d="m12 3 8 6-8 6-8-6z" />
      <path d="m4 14 8 6 8-6" />
    </SvgIcon>
  );
}
function CalendarIcon() {
  return (
    <SvgIcon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </SvgIcon>
  );
}
function BookIcon() {
  return (
    <SvgIcon>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z" />
    </SvgIcon>
  );
}
function CheckIcon() {
  return (
    <SvgIcon>
      <path d="m5 12 4 4L19 6" />
    </SvgIcon>
  );
}
function FileIcon() {
  return (
    <SvgIcon>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
    </SvgIcon>
  );
}
function ImageIcon() {
  return (
    <SvgIcon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 20" />
    </SvgIcon>
  );
}
function DiamondIcon() {
  return (
    <SvgIcon>
      <path d="m12 3 8 9-8 9-8-9z" />
    </SvgIcon>
  );
}
function DownloadIcon() {
  return (
    <SvgIcon>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </SvgIcon>
  );
}
