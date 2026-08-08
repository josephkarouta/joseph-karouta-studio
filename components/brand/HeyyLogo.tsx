"use client";

import type { CSSProperties } from "react";
import { HEYY_LOGO_ASSETS, type HeyyLogoVariant } from "@/lib/brand/heyy-logo-assets";

export type { HeyyLogoVariant };

type HeyyLogoProps = {
  variant?: HeyyLogoVariant;
  showStudio?: boolean;
  height?: number;
  className?: string;
  studioColour?: string;
  style?: CSSProperties;
};

export default function HeyyLogo({
  variant = "full-colour-dark",
  showStudio = true,
  height = 30,
  className,
  studioColour,
  style,
}: HeyyLogoProps) {
  const isLight = variant === "full-colour-light" || variant === "white";
  const resolvedStudioColour =
    studioColour || (isLight ? "#A78BFA" : "#7C3AED");

  return (
    <span
      className={className}
      aria-label={showStudio ? "Heyy Studio" : "Heyy"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(5, Math.round(height * 0.18)),
        lineHeight: 1,
        ...style,
      }}
    >
      <img
        src={HEYY_LOGO_ASSETS[variant]}
        alt=""
        aria-hidden="true"
        crossOrigin="anonymous"
        loading="eager"
        style={{
          display: "block",
          width: "auto",
          height,
          objectFit: "contain",
          flex: "0 0 auto",
        }}
      />

      {showStudio && (
        <span
          aria-hidden="true"
          style={{
            color: resolvedStudioColour,
            fontFamily: "Inter, Arial, Helvetica, sans-serif",
            fontSize: Math.max(7, Math.round(height * 0.29)),
            fontWeight: 900,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            transform: "translateY(1px)",
          }}
        >
          Studio
        </span>
      )}
    </span>
  );
}
