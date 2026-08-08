"use client";

import MoodboardWorkspace from "@/components/studio/brand/moodboards/MoodboardWorkspace";
import { useMoodboards } from "@/hooks/use-moodboards";

export default function BrandMoodboards({ project, brand }: { project: any; brand: any }) {
  const state = useMoodboards({ project, brand });

  return (
    <section className="brand-moodboards-workspace overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
      <header className="flex items-center gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-violet-700 to-fuchsia-500 text-xl font-black text-white shadow-lg shadow-violet-700/20">✦</span>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.19em] text-violet-600">Creative Directions</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Choose the concept before the image</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Each route explains a different strategic and visual idea. Images appear and load inside the selected direction card.</p>
        </div>
      </header>
      <div className="p-5 sm:p-6">
        <MoodboardWorkspace
          loading={state.loading}
          moodboards={state.moodboards}
          selectedMoodboard={state.selectedMoodboard}
          selecting={state.selecting}
          loadingDirection={state.loadingDirection}
          variationLoading={state.variationLoading}
          error={state.error}
          onGenerate={state.generateMoodboards}
          onSelect={state.selectDirection}
          onGenerateVisual={state.generateDirectionVisual}
          onGenerateVariations={state.generateVariations}
          onChooseVariation={state.chooseVariation}
          onDiscardVariation={state.discardVariation}
        />
      </div>
    </section>
  );
}
