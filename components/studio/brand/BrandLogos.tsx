"use client";

import { useState } from "react";
import { ArrowRight, BadgeCheck, FileOutput, ImageIcon, PenTool } from "lucide-react";
import { normaliseBrandJourney } from "@/lib/brand/project-templates";
import { useLogos } from "@/hooks/use-logos";
import BrandGenerationState from "@/components/studio/brand/common/BrandGenerationState";
import { CREDIT_COSTS } from "@/lib/credits/config";
import BrandImageModal from "@/components/studio/brand/common/BrandImageModal";

export default function BrandLogos({ project, brand }: { project: any; brand: any }) {
  const journey = normaliseBrandJourney(brand, project);
  const state = useLogos({ project, brand });
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const directions = Array.isArray(brand?.logoDirections) ? brand.logoDirections : [];
  const logoWorkRequested = journey.logoAction === "create" || journey.logoAction === "refine";

  if (!logoWorkRequested) {
    return (
      <section className="brand-logos-workspace overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
        <header className="flex items-center gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-violet-700 text-white"><BadgeCheck size={22} strokeWidth={2.2} /></span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Existing Logo</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">The current logo is being retained</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">This project builds around the supplied mark. It does not force a new logo or unrelated rebrand.</p>
          </div>
        </header>
        <div className="grid gap-5 p-5 lg:grid-cols-[360px_minmax(0,1fr)] sm:p-6">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            {state.existingLogoUrl ? (
              <button type="button" onClick={() => setPreview({ url: state.existingLogoUrl, title: "Current logo" })} className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-white p-8">
                <img src={state.existingLogoUrl} alt="Current logo" className="max-h-full max-w-full object-contain" />
              </button>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-[18px] border border-dashed border-violet-300 bg-white text-center text-sm font-black text-violet-700">Current logo file not found</div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <HealthCard title="Recognition" copy="Preserve recognisable brand equity and customer familiarity." />
            <HealthCard title="Usage system" copy="Create clear spacing, size, colour and background rules around the current mark." />
            <HealthCard title="Required variants" copy="Identify primary, reversed, mono, icon and small-size variants needed for real use." />
            <HealthCard title="Professional production" copy="Vector redraw, kerning, trademark review and production files remain expert tasks." />
            {journey.preserveNotes && <HealthCard title="Must preserve" copy={journey.preserveNotes} />}
            {journey.changeNotes && <HealthCard title="Needs attention" copy={journey.changeNotes} />}
            <div className="sm:col-span-2 rounded-[18px] border border-violet-200 bg-violet-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-violet-700 text-white"><FileOutput size={18} /></span>
                  <div>
                    <p className="text-sm font-black text-slate-950">Need clean logo master files?</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Request vector redraw, colour variants and final AI, EPS, SVG, PDF, PNG and JPG files.</p>
                  </div>
                </div>
                <a href="?tab=production&scope=logo" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet-700 px-5 text-xs font-black text-white transition hover:bg-violet-800">Prepare final files <ArrowRight size={15} /></a>
              </div>
            </div>
          </div>
        </div>
        <BrandImageModal imageUrl={preview?.url || null} title={preview?.title || "Current logo"} onClose={() => setPreview(null)} contain />
      </section>
    );
  }

  return (
    <section className="brand-logos-workspace overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
      <header className="flex items-center gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br from-violet-700 to-fuchsia-500 text-white"><PenTool size={22} strokeWidth={2.2} /></span>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Logo Directions</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Choose the idea before generating the mark</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Each card explains the logo logic. Generation and refinements stay inside that same direction card.</p>
        </div>
      </header>

      <div className="p-5 sm:p-6">
        {state.error && <div className="mb-4 rounded-[16px] border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{state.error}</div>}
        {journey.logoAction === "refine" && state.existingLogoUrl && (
          <div className="mb-5 flex items-center gap-4 rounded-[18px] border border-blue-200 bg-blue-50 p-4">
            <button type="button" onClick={() => setPreview({ url: state.existingLogoUrl, title: "Existing logo reference" })} className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[14px] border border-blue-200 bg-white p-3">
              <img src={state.existingLogoUrl} alt="Existing logo reference" className="max-h-full max-w-full object-contain" />
            </button>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-700">Rebrand reference locked</p>
              <p className="mt-1 text-sm font-black text-slate-900">The current logo is supplied to refinement generations.</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">The prompt preserves brand equity and prevents an unrelated replacement.</p>
            </div>
          </div>
        )}

        {directions.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-violet-300 bg-violet-50 p-8 text-center text-sm font-black text-violet-800">No logo directions are saved yet. Refresh the Brand Studio blueprint to prepare them.</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {directions.map((direction: any, index: number) => {
              const concept = state.concepts[index];
              const selected = state.selectedLogoDirection === index;
              const loading = state.loadingDirection === index;
              const variationLoading = state.variationLoading === index;
              return (
                <article key={`${direction.title}-${index}`} className={`overflow-hidden rounded-[23px] border bg-white shadow-[0_13px_32px_rgba(45,29,62,.065)] transition ${selected ? "border-2 border-violet-600 shadow-violet-600/15" : "border-slate-200 hover:-translate-y-1 hover:border-violet-400"}`}>
                  <div className="relative bg-gradient-to-br from-slate-100 via-white to-violet-100 p-3">
                    <span className="absolute left-4 top-4 z-10 rounded-full bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-violet-700 shadow">Direction {index + 1}</span>
                    {selected && <span className="absolute right-4 top-4 z-10 rounded-full bg-emerald-500 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-white">✓ Selected</span>}
                    {loading ? (
                      <div className="flex aspect-square items-center justify-center rounded-[18px] border border-violet-200 bg-white p-4"><BrandGenerationState compact title="Generating this logo direction" /></div>
                    ) : concept?.imageUrl ? (
                      <button type="button" onClick={() => setPreview({ url: concept.imageUrl, title: direction.title })} className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-white p-5">
                        <img src={concept.imageUrl} alt={direction.title} className="max-h-full max-w-full object-contain transition hover:scale-[1.02]" />
                      </button>
                    ) : (
                      <div className="flex aspect-square flex-col items-center justify-center rounded-[18px] border border-dashed border-violet-300 bg-white/80 p-6 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-violet-100 text-violet-700"><ImageIcon size={22} /></span>
                        <p className="mt-3 text-sm font-black text-slate-900">Direction brief ready</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Select the route, then generate the concept inside this card.</p>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">Logo concept</p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-slate-950">{direction.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{direction.conceptIdea || direction.description}</p>
                    <div className="mt-4 grid gap-2">
                      <LogoDetail label="Recommended type" value={direction.recommendedType} />
                      <LogoDetail label="Symbol logic" value={direction.symbolLogic} />
                      <LogoDetail label="Wordmark behaviour" value={direction.wordmarkBehaviour} />
                      <LogoDetail label="Shape language" value={direction.shapeLanguage} />
                      <LogoDetail label="Scalability" value={direction.scalability} />
                    </div>
                    {Array.isArray(direction.avoid) && direction.avoid.length > 0 && (
                      <div className="mt-3 rounded-[14px] border border-rose-200 bg-rose-50 p-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.15em] text-rose-600">Avoid</p>
                        <p className="mt-1 text-xs font-bold leading-5 text-slate-700">{direction.avoid.join(" · ")}</p>
                      </div>
                    )}

                    {variationLoading && <div className="mt-4"><BrandGenerationState compact title="Refining this logo concept" /></div>}
                    {concept?.variation?.imageUrl && !variationLoading && (
                      <div className="mt-4 rounded-[18px] border border-fuchsia-200 bg-fuchsia-50 p-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.15em] text-fuchsia-600">Variation inside this direction</p>
                        <button type="button" onClick={() => setPreview({ url: concept.variation.imageUrl, title: `${direction.title} variation` })} className="mt-3 flex aspect-square w-full items-center justify-center rounded-[14px] bg-white p-4"><img src={concept.variation.imageUrl} alt="Logo variation" className="max-h-full max-w-full object-contain" /></button>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => state.chooseLogoVariation(index)} className="flex-1 rounded-full bg-fuchsia-600 px-4 py-2.5 text-[10px] font-black text-white">Use variation</button>
                          <button type="button" onClick={() => state.discardLogoVariation(index)} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-black text-slate-600">Keep current</button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <button type="button" onClick={() => state.selectLogoDirection(index)} className={`min-h-10 rounded-full px-4 text-[10px] font-black text-white ${selected ? "bg-emerald-500" : "bg-slate-950 hover:bg-violet-700"}`}>{selected ? "Selected Direction" : "Select Direction"}</button>
                      <button type="button" onClick={() => state.generateLogos(direction, index, "final")} disabled={!selected || loading} className="min-h-10 rounded-full bg-violet-700 px-4 text-[10px] font-black text-white disabled:opacity-35">{concept?.imageUrl ? `Regenerate Logo · ${CREDIT_COSTS.brandProfessionalFinal} credits` : `Generate Logo · ${CREDIT_COSTS.brandProfessionalFinal} credits`}</button>
                      <button type="button" onClick={() => state.generateLogoVariations(index, direction)} disabled={!selected || !concept?.imageUrl || variationLoading} className="min-h-10 rounded-full border border-slate-300 bg-white px-4 text-[10px] font-black text-slate-700 disabled:opacity-35">{`Generate Variation · ${CREDIT_COSTS.brandVariation} credits`}</button>
                    </div>
                    <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">One best-quality concept is generated on a 1024 × 1024 canvas. It does not replace final vector production.</p>
                    {selected && concept?.imageUrl && (
                      <div className="mt-4 rounded-[16px] border border-violet-200 bg-violet-50 p-4">
                        <div className="grid min-w-0 gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-violet-700 text-white"><FileOutput size={16} /></span>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-950">AI concept selected. Prepare the real logo package.</p>
                              <p className="mt-1 break-words text-[11px] font-semibold leading-5 text-slate-600">Vector redraw, optical refinement, RGB/CMYK variants and AI, EPS, SVG, PDF, PNG and JPG master files.</p>
                            </div>
                          </div>
                          <a href="?tab=production&scope=logo" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-violet-700 px-4 text-[11px] font-black text-white transition hover:bg-violet-800">Prepare final files <ArrowRight size={14} /></a>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <BrandImageModal imageUrl={preview?.url || null} title={preview?.title || "Logo visual"} onClose={() => setPreview(null)} contain />
    </section>
  );
}

function LogoDetail({ label, value }: { label: string; value?: string }) {
  return <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 text-xs font-bold leading-5 text-slate-700">{value || "To be developed."}</p></div>;
}

function HealthCard({ title, copy }: { title: string; copy: string }) {
  return <div className="rounded-[18px] border border-slate-200 bg-white p-4"><p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">{title}</p><p className="mt-2 text-sm font-bold leading-6 text-slate-700">{copy}</p></div>;
}
