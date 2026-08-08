export type HeyyLogoVariant =
  | "full-colour-dark"
  | "full-colour-light"
  | "white"
  | "black";

export const HEYY_LOGO_ASSETS: Record<HeyyLogoVariant, string> = {
  "full-colour-dark": "/brand/heyy/heyy-full-colour-dark.svg",
  "full-colour-light": "/brand/heyy/heyy-full-colour-light.svg",
  white: "/brand/heyy/heyy-white.svg",
  black: "/brand/heyy/heyy-black.svg",
};

export const HEYY_LOGO_EXPORT_ASSETS = {
  dark: "/brand/heyy/heyy-full-colour-dark-export.png",
  light: "/brand/heyy/heyy-full-colour-light-export.png",
} as const;
