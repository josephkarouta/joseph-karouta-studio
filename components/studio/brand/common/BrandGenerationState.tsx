"use client";

import StudioLoader from "@/components/ui/StudioLoader";

const DEFAULT_STEPS = [
  "Reading the selected direction",
  "Preparing the visual prompt",
  "Generating the image",
  "Refining the visual",
  "Saving to the workspace",
];

export default function BrandGenerationState({
  title = "Heyy Studio is generating",
  steps = DEFAULT_STEPS,
  compact = false,
}: {
  title?: string;
  steps?: string[];
  compact?: boolean;
}) {
  return (
    <StudioLoader
      tone="brand"
      eyebrow="Generating"
      title={title}
      detail={compact ? undefined : "Keep this page open while Heyy Studio prepares and saves the result."}
      steps={compact ? undefined : steps}
      activeStep={0}
      variant="inline"
    />
  );
}
