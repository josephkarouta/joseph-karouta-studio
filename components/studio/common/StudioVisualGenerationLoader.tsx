"use client";

import StudioLoader from "@/components/ui/StudioLoader";
import type { StudioTone } from "@/components/ui/StudioModeToggle";

export default function StudioVisualGenerationLoader({
  tone,
  title = "Generating visual",
  detail = "Applying the approved project direction and saving the result to your workspace.",
  placement = "overlay",
}: {
  tone: StudioTone;
  title?: string;
  detail?: string;
  placement?: "overlay" | "inline";
}) {
  return (
    <StudioLoader
      tone={tone}
      eyebrow="Generating"
      title={title}
      detail={detail}
      variant={placement}
    />
  );
}
