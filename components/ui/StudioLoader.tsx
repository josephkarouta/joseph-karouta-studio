"use client";

import { Check, Loader2 } from "lucide-react";
import { cx } from "@/components/ui/heyy";
import type { StudioTone } from "@/components/ui/StudioModeToggle";

export default function StudioLoader({
  tone = "platform",
  title,
  detail,
  eyebrow,
  steps,
  activeStep = 0,
  variant = "inline",
  className,
}: {
  tone?: StudioTone;
  title: string;
  detail?: string;
  eyebrow?: string;
  steps?: string[];
  activeStep?: number;
  variant?: "inline" | "overlay" | "fullscreen";
  className?: string;
}) {
  return (
    <div
      className={cx("studio-loader", `studio-loader--${variant}`, className)}
      data-tone={tone}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="studio-loader__panel">
        <div className="studio-loader__head">
          <span className="studio-loader__spinner" aria-hidden="true"><Loader2 size={22} /></span>
          <div>
            {eyebrow && <p className="studio-loader__eyebrow">{eyebrow}</p>}
            <strong className="studio-loader__title">{title}</strong>
            {detail && <p className="studio-loader__detail">{detail}</p>}
          </div>
        </div>
        <div className="studio-loader__progress" aria-hidden="true"><span /></div>
        {steps?.length ? (
          <div className="studio-loader__steps">
            {steps.map((step, index) => {
              const complete = index < activeStep;
              const current = index === activeStep;
              return (
                <div key={step} className="studio-loader__step" data-state={complete ? "complete" : current ? "current" : "upcoming"}>
                  <span>{complete ? <Check size={13} strokeWidth={3} /> : index + 1}</span>
                  <p>{step}</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
