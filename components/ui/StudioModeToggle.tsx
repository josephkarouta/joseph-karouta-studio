"use client";

import { Compass, Loader2, SlidersHorizontal } from "lucide-react";
import { cx } from "@/components/ui/heyy";

export type StudioMode = "guided" | "professional";
export type StudioTone = "platform" | "brand" | "architecture" | "interior" | "marketing";

export default function StudioModeToggle({
  value,
  onChange,
  tone = "platform",
  compact = false,
  disabled = false,
  saving = false,
  guidedDescription = "Simple language and smart recommendations",
  professionalDescription = "More detailed controls and production-ready structure",
  className,
}: {
  value: StudioMode;
  onChange: (value: StudioMode) => void;
  tone?: StudioTone;
  compact?: boolean;
  disabled?: boolean;
  saving?: boolean;
  guidedDescription?: string;
  professionalDescription?: string;
  className?: string;
}) {
  const options = [
    {
      id: "guided" as const,
      label: "Guided",
      description: guidedDescription,
      icon: Compass,
    },
    {
      id: "professional" as const,
      label: "Professional",
      description: professionalDescription,
      icon: SlidersHorizontal,
    },
  ];

  return (
    <div
      className={cx("studio-mode-toggle", compact && "studio-mode-toggle--compact", className)}
      data-tone={tone}
      role="group"
      aria-label="Working mode"
      aria-busy={saving}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className="studio-mode-toggle__option"
            data-selected={selected ? "true" : "false"}
            aria-pressed={selected}
            disabled={disabled || saving}
            onClick={() => onChange(option.id)}
          >
            <span className="studio-mode-toggle__icon" aria-hidden="true">
              {saving && selected ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} strokeWidth={2.2} />}
            </span>
            <span className="studio-mode-toggle__copy">
              <strong>{option.label}</strong>
              {!compact && <small>{option.description}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
