"use client";

import StudioLoader from "@/components/ui/StudioLoader";
import type { StudioTone } from "@/components/ui/StudioModeToggle";

const DEFAULT_STEPS = [
  "Reading project context",
  "Understanding creative direction",
  "Building visual logic",
  "Preparing output",
  "Saving to workspace",
];

export default function AIGenerationLoader({
  title = "Heyy Studio is working",
  steps = DEFAULT_STEPS,
  tone = "platform",
}: {
  title?: string;
  steps?: string[];
  tone?: StudioTone;
}) {
  return (
    <StudioLoader
      tone={tone}
      eyebrow="Generating"
      title={title}
      detail="Keep this page open while Heyy Studio prepares and saves the result."
      steps={steps}
      activeStep={0}
      variant="inline"
    />
  );
}
