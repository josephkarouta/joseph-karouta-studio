"use client";

import BrandGenerationState from "@/components/studio/brand/common/BrandGenerationState";

export default function MoodboardToolbar({ loading, onGenerate }: { loading: boolean; onGenerate: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-[18px] border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm leading-6 text-slate-600">
            Directions are generated as text first. Compare the central idea, strategy, story and visual world before spending image credits on a visual board.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Generating a visual or variation happens inside its own direction card.
          </p>
        </div>
        <button type="button" onClick={onGenerate} disabled={loading} className="min-h-11 rounded-full border border-violet-300 bg-white px-5 text-xs font-black text-violet-700 transition hover:-translate-y-0.5 hover:border-violet-700 hover:bg-violet-700 hover:text-white disabled:cursor-wait disabled:opacity-50">
          {loading ? "Generating 3 Directions…" : "Generate 3 Directions"}
        </button>
      </div>
      {loading && (
        <BrandGenerationState
          title="Creating three genuinely different directions"
          steps={[
            "Reading the project journey",
            "Separating three strategic routes",
            "Writing direction stories",
            "Defining visual worlds",
            "Saving the text directions",
          ]}
        />
      )}
    </div>
  );
}
