"use client";

import BrandGenerationState from "@/components/studio/brand/common/BrandGenerationState";
import { CREDIT_COSTS } from "@/lib/credits/config";

export default function MoodboardCard({
  moodboard,
  index,
  isSelected,
  selecting,
  loadingImage,
  variationLoading,
  onSelect,
  onGenerateVisual,
  onGenerateVariation,
  onChooseVariation,
  onDiscardVariation,
  onOpenImage,
}: {
  moodboard: any;
  index: number;
  isSelected: boolean;
  selecting: boolean;
  loadingImage: boolean;
  variationLoading: boolean;
  onSelect: () => void;
  onGenerateVisual: (tier: "preview" | "final") => void;
  onGenerateVariation: () => void;
  onChooseVariation: () => void;
  onDiscardVariation: () => void;
  onOpenImage: (url: string, title: string) => void;
}) {
  const tones = Array.isArray(moodboard.emotionalTone) ? moodboard.emotionalTone : [];
  const keywords = Array.isArray(moodboard.keywords) ? moodboard.keywords : [];
  const bestFor = Array.isArray(moodboard.bestFor) ? moodboard.bestFor : [];
  const tags = Array.from(
    new Set(
      [...tones, ...keywords]
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);

  return (
    <article className={`overflow-hidden rounded-[24px] border bg-white shadow-[0_15px_38px_rgba(48,29,67,.07)] transition ${isSelected ? "border-violet-600 shadow-[0_0_0_3px_rgba(161,61,240,.15)]" : "border-slate-200 hover:-translate-y-1 hover:border-violet-400"}`}>
      <div className="relative min-h-[210px] bg-gradient-to-br from-slate-100 via-white to-violet-100 p-3">
        <span className="absolute left-4 top-4 z-10 rounded-full border border-violet-100 bg-white/95 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.15em] text-violet-700 shadow-sm">Direction {index + 1}</span>
        {isSelected && <span className="absolute right-4 top-4 z-10 rounded-full bg-emerald-500 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.15em] text-white">✓ Selected</span>}

        {loadingImage ? (
          <div className="flex min-h-[210px] items-center justify-center rounded-[18px] border border-violet-200 bg-white p-4">
            <BrandGenerationState compact title="Generating this direction visual" />
          </div>
        ) : moodboard.imageUrl ? (
          <button type="button" onClick={() => onOpenImage(moodboard.imageUrl, moodboard.title)} className="block h-full w-full overflow-hidden rounded-[18px] border border-slate-200 bg-white">
            <img src={moodboard.imageUrl} alt={moodboard.title} className="aspect-square h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
            <span className="absolute bottom-5 right-5 rounded-full bg-slate-950/80 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">Open large visual</span>
          </button>
        ) : (
          <div className="flex aspect-square min-h-[210px] flex-col items-center justify-center rounded-[18px] border border-dashed border-violet-300 bg-white/75 p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-violet-100 text-xl text-violet-700">✦</span>
            <p className="mt-3 text-sm font-black text-slate-900">Text direction ready</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Select the route first, then generate its visual only when needed.</p>
          </div>
        )}
      </div>

      <div className="p-5">
        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-600">Creative concept</p>
        <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-slate-950">{moodboard.title}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{moodboard.conceptIdea}</p>

        <div className="mt-4 grid gap-3">
          <DirectionBlock label="Strategic role" value={moodboard.strategicRole} tone="violet" />
          <DirectionBlock label="Direction story" value={moodboard.brandStory} tone="rose" />
          <DirectionBlock label="Visual world" value={moodboard.visualWorld} tone="blue" />
          <DirectionBlock label="Image style" value={moodboard.imageStyle} tone="cyan" />
          <DirectionBlock label="Colour behaviour" value={moodboard.colourBehaviour} tone="amber" />
          <DirectionBlock label="Graphic language" value={moodboard.graphicLanguage} tone="emerald" />
          <DirectionBlock label="What makes it different" value={moodboard.differentiation} tone="slate" />
        </div>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((item, tagIndex) => (
              <span key={`${item}-${tagIndex}`} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[9px] font-black text-violet-700">{item}</span>
            ))}
          </div>
        )}

        {bestFor.length > 0 && (
          <div className="mt-4 rounded-[15px] border border-slate-200 bg-slate-50 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Best applications</p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-700">{bestFor.join(" · ")}</p>
          </div>
        )}

        {variationLoading && <div className="mt-4"><BrandGenerationState compact title="Refining inside this direction" /></div>}

        {moodboard.variation?.imageUrl && !variationLoading && (
          <div className="mt-4 overflow-hidden rounded-[18px] border border-fuchsia-200 bg-fuchsia-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.15em] text-fuchsia-600">Generated variation</p>
                <p className="mt-1 text-xs font-bold text-slate-700">Review it here without leaving the direction card.</p>
              </div>
              <button type="button" onClick={() => onOpenImage(moodboard.variation.imageUrl, `${moodboard.title} variation`)} className="rounded-full border border-fuchsia-300 bg-white px-3 py-1.5 text-[9px] font-black text-fuchsia-700">Open</button>
            </div>
            <img src={moodboard.variation.imageUrl} alt={`${moodboard.title} variation`} className="mt-3 aspect-square w-full rounded-[14px] object-cover" />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onChooseVariation} className="flex-1 rounded-full bg-fuchsia-600 px-4 py-2.5 text-[10px] font-black text-white">Use variation</button>
              <button type="button" onClick={onDiscardVariation} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-black text-slate-600">Keep current</button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onSelect} disabled={selecting} className={`min-h-10 rounded-full px-4 text-[10px] font-black text-white transition ${isSelected ? "bg-emerald-500" : "bg-slate-950 hover:bg-violet-700"}`}>
            {selecting ? "Selecting…" : isSelected ? "Selected Direction" : "Select Direction"}
          </button>
          <button type="button" onClick={() => onGenerateVisual("final")} disabled={!isSelected || loadingImage} className="min-h-10 rounded-full border border-violet-600 bg-violet-600 px-4 text-[10px] font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-35">
            {moodboard.imageUrl ? `Regenerate Visual · ${CREDIT_COSTS.brandProfessionalFinal} credits` : `Generate Visual · ${CREDIT_COSTS.brandProfessionalFinal} credits`}
          </button>
          <button type="button" onClick={onGenerateVariation} disabled={!isSelected || !moodboard.imageUrl || variationLoading} className="min-h-10 rounded-full border border-slate-300 bg-white px-4 text-[10px] font-black text-slate-700 transition hover:border-fuchsia-500 hover:text-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-35">{`Generate Variation · ${CREDIT_COSTS.brandVariation} credits`}</button>
        </div>
      </div>
    </article>
  );
}

function DirectionBlock({ label, value, tone }: { label: string; value?: string; tone: string }) {
  const tones: Record<string, string> = {
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <div className={`rounded-[15px] border p-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[8px] font-black uppercase tracking-[0.15em] opacity-75">{label}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-700">{value || "To be developed."}</p>
    </div>
  );
}
