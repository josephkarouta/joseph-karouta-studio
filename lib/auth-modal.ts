"use client";

export type HeyyAuthMode = "signin" | "signup";

export function openHeyyAuthModal(mode: HeyyAuthMode = "signin", nextPath?: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("heyy:open-auth", {
      detail: {
        mode,
        nextPath:
          nextPath ||
          `${window.location.pathname}${window.location.search}` ||
          "/",
      },
    }),
  );
}
