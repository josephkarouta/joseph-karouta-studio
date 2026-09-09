"use client";

import StudioProjectHero from "@/components/studio/common/StudioProjectHero";

type Props = {
  projectTypeLabel: string;
  projectName: string;
  statusLabel: string;
  metaItems: string[];
  progress?: number | null;
  mode?: "guided" | "professional";
  onModeChange?: (mode: "guided" | "professional") => void;
  savingMode?: boolean;
};

export default function StudioHeader({
  projectTypeLabel,
  projectName,
  statusLabel,
  metaItems,
  progress,
  mode,
  onModeChange,
  savingMode = false,
}: Props) {
  return (
    <StudioProjectHero
      tone="brand"
      eyebrow={projectTypeLabel}
      title={projectName}
      description={metaItems.length > 0 ? metaItems.join(" · ") : "Brand project"}
      statusLabel={statusLabel}
      progress={progress}
      mode={mode}
      onModeChange={onModeChange}
      saving={savingMode}
    />
  );
}
