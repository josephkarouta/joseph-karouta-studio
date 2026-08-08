"use client";

import MoodboardCard from "./MoodboardCard";

export default function MoodboardGrid({
  moodboards,
  selectedMoodboard,
  selecting,
  loadingDirection,
  variationLoading,
  onSelect,
  onGenerateVisual,
  onGenerateVariation,
  onChooseVariation,
  onDiscardVariation,
  onOpenImage,
}: {
  moodboards: any[];
  selectedMoodboard: number | null;
  selecting: number | null;
  loadingDirection: number | null;
  variationLoading: number | null;
  onSelect: (index: number) => void;
  onGenerateVisual: (index: number, tier: "preview" | "final") => void;
  onGenerateVariation: (index: number) => void;
  onChooseVariation: (index: number) => void;
  onDiscardVariation: (index: number) => void;
  onOpenImage: (url: string, title: string) => void;
}) {
  if (!moodboards.length) {
    return (
      <div className="mt-5 rounded-[20px] border border-dashed border-violet-300 bg-violet-50 p-8 text-center">
        <p className="text-sm font-black text-violet-800">Generate three text-first directions to start the creative process.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-3">
      {moodboards.map((moodboard, index) => (
        <MoodboardCard
          key={`${moodboard.title}-${index}`}
          moodboard={moodboard}
          index={index}
          isSelected={selectedMoodboard === index}
          selecting={selecting === index}
          loadingImage={loadingDirection === index}
          variationLoading={variationLoading === index}
          onSelect={() => onSelect(index)}
          onGenerateVisual={(tier) => onGenerateVisual(index, tier)}
          onGenerateVariation={() => onGenerateVariation(index)}
          onChooseVariation={() => onChooseVariation(index)}
          onDiscardVariation={() => onDiscardVariation(index)}
          onOpenImage={onOpenImage}
        />
      ))}
    </div>
  );
}
