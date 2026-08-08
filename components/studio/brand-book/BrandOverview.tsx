"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Check,
  Compass,
  Lightbulb,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import DisclosureChevron from "@/components/studio/ui/DisclosureChevron";

function getText(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.description) return value.description;
  if (value.positioning) return value.positioning;
  if (value.headline) return value.headline;
  return JSON.stringify(value);
}

function asArray(value: any): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function pick(...values: any[]) {
  return values.find((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return value !== undefined && value !== null;
  });
}

function stringify(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

type PanelTone =
  "violet" | "blue" | "rose" | "amber" | "emerald" | "cyan" | "slate";

const toneMap: Record<
  PanelTone,
  { accent: string; border: string; soft: string; Icon: LucideIcon }
> = {
  violet: { accent: "#6c00ff", border: "#d7c0ff", soft: "#f3eaff", Icon: Compass },
  blue: { accent: "#1766c2", border: "#bdd8ff", soft: "#edf6ff", Icon: Target },
  rose: { accent: "#c51f7c", border: "#f2bfdc", soft: "#fff0f8", Icon: ShieldCheck },
  amber: { accent: "#a45c00", border: "#efd395", soft: "#fff7df", Icon: MessageCircle },
  emerald: { accent: "#0b8f4d", border: "#b6e5ca", soft: "#ebfbf2", Icon: BadgeCheck },
  cyan: { accent: "#087e9d", border: "#b6e6ef", soft: "#ebfbff", Icon: Compass },
  slate: { accent: "#52606f", border: "#d7dee6", soft: "#f5f7fa", Icon: Tags },
};

export default function BrandOverview({
  brand,
}: {
  project?: any;
  brand: any;
}) {
  const foundation = brand?.foundation || {};
  const guidelines = brand?.generatedGuidelines || {};

  const strategyTitle =
    pick(
      foundation?.positioning,
      brand?.brandStrategy?.positioning,
      guidelines?.positioning,
      brand?.positioning,
    ) || "Brand Strategy";

  const strategyText =
    pick(
      foundation?.strategy,
      brand?.brandStrategy?.description,
      guidelines?.brandOverview,
      getText(brand?.brandStrategy),
      foundation?.summary,
      brand?.summary,
    ) || "Brand strategy will appear here.";

  const mission =
    pick(
      foundation?.mission,
      brand?.mission,
      guidelines?.mission,
      brand?.brandStrategy?.mission,
    ) || "Mission will appear after the next Brand Studio generation.";

  const vision =
    pick(
      foundation?.vision,
      brand?.vision,
      guidelines?.vision,
      brand?.brandStrategy?.vision,
    ) || "Vision will appear after the next Brand Studio generation.";

  const brandPromise =
    pick(
      foundation?.brandPromise,
      brand?.brandPromise,
      brand?.brandStrategy?.brandPromise,
      guidelines?.brandPromise,
    ) || "Brand promise will appear after the next Brand Studio generation.";

  const voiceTitle =
    pick(
      foundation?.brandVoice?.headline,
      brand?.brandVoice?.headline,
      guidelines?.toneOfVoice?.headline,
    ) || "Brand Voice";

  const voiceText =
    pick(
      foundation?.brandVoice?.description,
      brand?.brandVoice?.description,
      guidelines?.toneOfVoice?.description,
      getText(brand?.brandVoice),
    ) || "Brand voice will appear here.";

  const tone = asArray(
    pick(
      foundation?.toneOfVoice,
      foundation?.brandVoice?.toneWords,
      brand?.toneOfVoice,
      brand?.brandVoice?.toneWords,
      guidelines?.toneOfVoice?.principles,
      guidelines?.toneOfVoice?.traits,
    ),
  );

  const audience =
    pick(
      foundation?.targetAudience,
      brand?.targetAudience,
      guidelines?.targetAudience,
      brand?.audience,
    ) || "Target audience details will appear here.";

  const traits = asArray(
    pick(
      foundation?.personality?.traits,
      brand?.personality?.traits,
      guidelines?.personality,
      brand?.personality,
    ),
  );

  const personalityTitle =
    pick(foundation?.personality?.headline, brand?.personality?.headline) ||
    "Personality";

  const keywords = asArray(
    pick(
      foundation?.keywords,
      brand?.keywords,
      guidelines?.keywords,
      guidelines?.brandKeywords,
    ),
  );

  const coreValues = asArray(
    pick(foundation?.coreValues, brand?.coreValues, guidelines?.coreValues),
  );

  const recommendations = asArray(
    pick(
      foundation?.recommendations,
      guidelines?.recommendations,
      brand?.recommendations,
      brand?.aiRecommendations,
    ),
  );

  return (
    <section className="heyy-foundation overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_20px_50px_rgba(61,31,92,.09)]">
      <style>{`
        .heyy-foundation,
        .heyy-foundation * {
          box-sizing: border-box;
        }

        .heyy-foundation-hero {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 92% 10%, rgba(166, 81, 255, .18), transparent 27%),
            linear-gradient(135deg, #f4ecff, #ffffff 68%);
        }

        .heyy-foundation-hero::after {
          content: "/";
          position: absolute;
          right: 34px;
          top: -54px;
          color: rgba(108, 0, 255, .055);
          font-size: 205px;
          font-weight: 950;
          line-height: 1;
          pointer-events: none;
        }

        .heyy-foundation-summary-card {
          border: 1px solid #e4d8f4;
          border-radius: 18px;
          background: rgba(255, 255, 255, .84);
          padding: 15px;
          box-shadow: 0 9px 24px rgba(61, 31, 92, .06);
          backdrop-filter: blur(8px);
        }

        .heyy-foundation-panel {
          --panel-accent: #6c00ff;
          --panel-border: #d7c0ff;
          --panel-soft: #f3eaff;
          position: relative;
          overflow: hidden;
          border: 1px solid var(--panel-border);
          border-radius: 19px;
          background: linear-gradient(135deg, var(--panel-soft), #ffffff 70%);
          box-shadow: 0 8px 22px rgba(48, 31, 68, .045);
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .heyy-foundation-panel:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 29px rgba(48, 31, 68, .09);
        }

        .heyy-foundation-panel[data-open="true"] {
          box-shadow: 0 16px 34px rgba(48, 31, 68, .10);
        }

        .heyy-foundation-panel::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--panel-accent);
        }

        .heyy-foundation-trigger {
          display: flex !important;
          width: 100% !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 14px !important;
          background: transparent !important;
          padding: 16px 16px 16px 18px !important;
          color: #17151f !important;
          -webkit-text-fill-color: #17151f !important;
          text-align: left !important;
        }

        .heyy-foundation-trigger:hover {
          background: rgba(255, 255, 255, .48) !important;
          color: #17151f !important;
          -webkit-text-fill-color: #17151f !important;
        }

        .heyy-foundation-icon {
          display: flex;
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: var(--panel-accent);
          color: #ffffff;
          font-size: 15px;
          font-weight: 950;
          box-shadow: 0 9px 18px color-mix(in srgb, var(--panel-accent) 26%, transparent);
        }

        .heyy-foundation-content {
          border-top: 1px solid var(--panel-border);
          background: rgba(255, 255, 255, .92);
          padding: 16px 18px 18px;
        }

        .heyy-foundation-content p,
        .heyy-foundation-content li {
          color: #475569 !important;
          -webkit-text-fill-color: #475569 !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .heyy-foundation-chip {
          display: inline-flex !important;
          min-height: 30px !important;
          align-items: center !important;
          border: 1px solid #d9c8ef !important;
          border-radius: 999px !important;
          background: linear-gradient(180deg, #ffffff, #f3ebff) !important;
          padding: 0 12px !important;
          color: #641bc0 !important;
          -webkit-text-fill-color: #641bc0 !important;
          font-size: 10px !important;
          font-weight: 900 !important;
          box-shadow: 0 5px 13px rgba(108, 0, 255, .07);
        }

        .heyy-foundation-guidance {
          display: flex;
          gap: 11px;
          border: 1px solid #e5deeb;
          border-radius: 15px;
          background: #ffffff;
          padding: 13px 14px;
          box-shadow: 0 6px 16px rgba(44, 29, 61, .04);
        }

        .heyy-foundation-guidance-mark {
          display: flex;
          width: 27px;
          height: 27px;
          flex: 0 0 27px;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #ede2ff;
          color: #6c00ff;
          font-size: 11px;
          font-weight: 950;
        }
      `}</style>

      <header className="heyy-foundation-hero border-b border-violet-100 p-5 md:p-7">
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-violet-700 to-fuchsia-500 text-white shadow-[0_12px_25px_rgba(108,0,255,.24)]">
                <Compass size={22} strokeWidth={2.1} />
              </span>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-600">
                  Brand Foundation
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-4xl">
                  Brand Strategy
                </h2>
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              This foundation defines the strategic direction for the brand. It
              guides the logo, colour, typography, applications and future
              expert production work.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[390px]">
            <SummaryCard label="Direction" value={strategyTitle} />
            <SummaryCard label="Voice" value={voiceTitle} />
            <SummaryCard label="Audience" value={stringify(audience)} />
          </div>
        </div>
      </header>

      <div className="p-5 md:p-6">
        <FoundationPanel
          title={strategyTitle}
          label="Strategy"
          tone="violet"
          defaultOpen
        >
          <p className="text-sm leading-7 text-slate-600">{strategyText}</p>
        </FoundationPanel>

        <div className="mt-3 grid gap-3 md:grid-cols-2 md:items-start">
          <div className="grid content-start gap-3">
            <FoundationPanel title="Mission" label="Purpose" tone="blue">
              <p className="text-sm leading-7 text-slate-600">{mission}</p>
            </FoundationPanel>

            <FoundationPanel
              title="Brand Promise"
              label="Commitment"
              tone="rose"
            >
              <p className="text-sm leading-7 text-slate-600">{brandPromise}</p>
            </FoundationPanel>

            <FoundationPanel title={voiceTitle} label="Voice" tone="amber">
              <p className="text-sm leading-7 text-slate-600">{voiceText}</p>

              {asArray(
                foundation?.brandVoice?.toneWords ||
                  brand?.brandVoice?.toneWords,
              ).length > 0 && (
                <div className="mt-4">
                  <ChipGrid
                    items={asArray(
                      foundation?.brandVoice?.toneWords ||
                        brand?.brandVoice?.toneWords,
                    )}
                  />
                </div>
              )}
            </FoundationPanel>

            <FoundationPanel
              title="Target Audience"
              label="Audience"
              tone="blue"
            >
              <p className="text-sm leading-7 text-slate-600">
                {stringify(audience)}
              </p>
            </FoundationPanel>

            <FoundationPanel
              title="Core Values"
              label="Values"
              tone="emerald"
            >
              {coreValues.length > 0 ? (
                <GuidanceList items={coreValues} />
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  Core values will appear after the next Brand Studio generation.
                </p>
              )}
            </FoundationPanel>
          </div>

          <div className="grid content-start gap-3">
            <FoundationPanel title="Vision" label="Future" tone="cyan">
              <p className="text-sm leading-7 text-slate-600">{vision}</p>
            </FoundationPanel>

            <FoundationPanel
              title="Tone of Voice"
              label="Communication"
              tone="violet"
            >
              {tone.length > 0 ? (
                <GuidanceList items={tone} />
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  Tone of voice principles will appear after the next Brand
                  Studio generation.
                </p>
              )}
            </FoundationPanel>

            <FoundationPanel
              title={personalityTitle}
              label="Traits"
              tone="rose"
            >
              {traits.length > 0 ? (
                <ChipGrid items={traits} />
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  Personality traits will appear after the next Brand Studio
                  generation.
                </p>
              )}
            </FoundationPanel>

            <FoundationPanel
              title="Brand Keywords"
              label="Keywords"
              tone="slate"
            >
              {keywords.length > 0 ? (
                <ChipGrid items={keywords} />
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  Brand keywords will appear after the next Brand Studio
                  generation.
                </p>
              )}
            </FoundationPanel>
          </div>
        </div>

        <div className="mt-3">
          <FoundationPanel
            title="AI Recommendations"
            label="Next steps"
            tone="amber"
          >
            {recommendations.length > 0 ? (
              <GuidanceList items={recommendations} />
            ) : (
              <p className="text-sm leading-7 text-slate-600">
                Recommendations will appear after the next Brand Studio
                generation.
              </p>
            )}
          </FoundationPanel>
        </div>
      </div>
    </section>
  );
}

function panelIcon(label: string, fallback: LucideIcon): LucideIcon {
  const value = label.toLowerCase();
  if (value.includes("strategy")) return Compass;
  if (value.includes("purpose")) return Target;
  if (value.includes("commitment")) return ShieldCheck;
  if (value.includes("voice")) return MessageCircle;
  if (value.includes("audience")) return Users;
  if (value.includes("values")) return BadgeCheck;
  if (value.includes("future")) return Compass;
  if (value.includes("communication")) return MessageCircle;
  if (value.includes("traits")) return Sparkles;
  if (value.includes("keywords")) return Tags;
  if (value.includes("next steps")) return Lightbulb;
  return fallback;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="heyy-foundation-summary-card min-w-0">
      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-xs font-black leading-5 text-slate-800">
        {value}
      </p>
    </div>
  );
}

function FoundationPanel({
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
  const palette = toneMap[tone];
  const Icon = panelIcon(label, palette.Icon);

  return (
    <div
      className="heyy-foundation-panel"
      data-open={open ? "true" : "false"}
      style={
        {
          "--panel-accent": palette.accent,
          "--panel-border": palette.border,
          "--panel-soft": palette.soft,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="heyy-foundation-trigger"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="heyy-foundation-icon" aria-hidden="true">
            <Icon size={18} strokeWidth={2.15} />
          </span>

          <div className="min-w-0">
            <p
              className="text-[8px] font-black uppercase tracking-[0.18em]"
              style={{ color: palette.accent }}
            >
              {label}
            </p>
            <h3 className="mt-1 text-base font-black leading-5 tracking-[-0.02em] text-slate-950">
              {title}
            </h3>
          </div>
        </div>

        <DisclosureChevron open={open} />
      </button>

      {open && (
        <div className="heyy-foundation-content" aria-hidden="false">
          {children}
        </div>
      )}
    </div>
  );
}

function ChipGrid({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="heyy-foundation-chip">
          {item}
        </span>
      ))}
    </div>
  );
}

function GuidanceList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="heyy-foundation-guidance">
          <span className="heyy-foundation-guidance-mark"><Check size={14} strokeWidth={2.4} /></span>
          <p className="min-w-0 text-sm leading-6 text-slate-600">{item}</p>
        </div>
      ))}
    </div>
  );
}
