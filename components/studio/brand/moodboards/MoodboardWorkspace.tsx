"use client";

import { useState } from "react";
import BrandImageModal from "@/components/studio/brand/common/BrandImageModal";
import MoodboardToolbar from "./MoodboardToolbar";
import MoodboardGrid from "./MoodboardGrid";

export default function MoodboardWorkspace({
  loading,
  moodboards,
  selectedMoodboard,
  selecting,
  loadingDirection,
  variationLoading,
  error,
  onGenerate,
  onSelect,
  onGenerateVisual,
  onGenerateVariations,
  onChooseVariation,
  onDiscardVariation,
}: {
  loading: boolean;
  moodboards: any[];
  selectedMoodboard: number | null;
  selecting: number | null;
  loadingDirection: number | null;
  variationLoading: number | null;
  error?: string;
  onGenerate: () => void;
  onSelect: (index: number) => void;
  onGenerateVisual: (index: number, tier: "preview" | "final") => void;
  onGenerateVariations: (index: number) => void;
  onChooseVariation: (index: number) => void;
  onDiscardVariation: (index: number) => void;
}) {
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  return (
    <>
      <MoodboardToolbar loading={loading} onGenerate={onGenerate} />
      {error && <div className="mt-4 rounded-[16px] border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      <MoodboardGrid
        moodboards={moodboards}
        selectedMoodboard={selectedMoodboard}
        selecting={selecting}
        loadingDirection={loadingDirection}
        variationLoading={variationLoading}
        onSelect={onSelect}
        onGenerateVisual={onGenerateVisual}
        onGenerateVariation={onGenerateVariations}
        onChooseVariation={onChooseVariation}
        onDiscardVariation={onDiscardVariation}
        onOpenImage={(url, title) => setPreview({ url, title })}
      />
      <BrandImageModal imageUrl={preview?.url || null} title={preview?.title || "Creative direction"} onClose={() => setPreview(null)} />
    </>
  );
}
