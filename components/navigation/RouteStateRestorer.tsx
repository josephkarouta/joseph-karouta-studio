"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SCROLL_KEY_PREFIX = "heyy-scroll:";

function readSavedScroll(pathname: string) {
  try {
    const value = sessionStorage.getItem(`${SCROLL_KEY_PREFIX}${pathname}`);
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveScroll(pathname: string) {
  try {
    sessionStorage.setItem(
      `${SCROLL_KEY_PREFIX}${pathname}`,
      String(Math.max(0, Math.round(window.scrollY))),
    );
  } catch {
    // Storage can be unavailable in restricted browsing modes.
  }
}

export default function RouteStateRestorer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const target = readSavedScroll(pathname);
    let cancelled = false;
    let userInteracted = false;
    let restoreTimer: number | null = null;
    let saveTimer: number | null = null;
    let attempts = 0;

    const markInteraction = () => {
      userInteracted = true;
      if (restoreTimer !== null) window.clearTimeout(restoreTimer);
    };

    const restore = () => {
      if (cancelled || userInteracted || target <= 0) return;

      attempts += 1;
      const maximumScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      window.scrollTo({ top: Math.min(target, maximumScroll), behavior: "auto" });

      if (Math.abs(window.scrollY - target) <= 2 || attempts >= 50) return;
      restoreTimer = window.setTimeout(restore, 100);
    };

    const scheduleSave = () => {
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => saveScroll(pathname), 80);
    };

    const saveImmediately = () => saveScroll(pathname);

    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("pagehide", saveImmediately);
    window.addEventListener("beforeunload", saveImmediately);
    window.addEventListener("wheel", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);

    requestAnimationFrame(() => {
      restoreTimer = window.setTimeout(restore, 40);
    });

    return () => {
      cancelled = true;
      saveImmediately();
      if (restoreTimer !== null) window.clearTimeout(restoreTimer);
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      window.removeEventListener("scroll", scheduleSave);
      window.removeEventListener("pagehide", saveImmediately);
      window.removeEventListener("beforeunload", saveImmediately);
      window.removeEventListener("wheel", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [pathname]);

  return null;
}
