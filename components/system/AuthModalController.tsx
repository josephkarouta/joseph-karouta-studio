"use client";

import { useEffect, useState } from "react";
import AuthModal from "@/app/AuthModal";
import type { HeyyAuthMode } from "@/lib/auth-modal";

type AuthRequest = {
  mode: HeyyAuthMode;
  nextPath?: string;
};

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export default function AuthModalController({ allowSignup = true }: { allowSignup?: boolean }) {
  const [request, setRequest] = useState<AuthRequest | null>(null);

  useEffect(() => {
    const initialUrl = new URL(window.location.href);
    const initialAuth = initialUrl.searchParams.get("auth");

    if (initialAuth === "signin" || (allowSignup && initialAuth === "signup")) {
      setRequest({
        mode: initialAuth,
        nextPath:
          safeNextPath(initialUrl.searchParams.get("next")) ||
          safeNextPath(initialUrl.searchParams.get("redirect")),
      });

      // Keep the address bar clean once the modal state has been captured.
      initialUrl.searchParams.delete("auth");
      initialUrl.searchParams.delete("next");
      initialUrl.searchParams.delete("redirect");
      const cleanUrl =
        `${initialUrl.pathname}${initialUrl.search}${initialUrl.hash}` || "/";
      window.history.replaceState(window.history.state, "", cleanUrl);
    }

    function openFromEvent(event: Event) {
      const custom = event as CustomEvent<AuthRequest>;
      const requestedMode = custom.detail?.mode === "signup" ? "signup" : "signin";
      if (requestedMode === "signup" && !allowSignup) return;

      setRequest({
        mode: requestedMode,
        nextPath: safeNextPath(custom.detail?.nextPath || null),
      });
    }

    function interceptLegacyAuthLink(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname !== "/login" && url.pathname !== "/signup") return;
      if (url.pathname === "/signup" && !allowSignup) return;

      event.preventDefault();

      const nextPath =
        safeNextPath(url.searchParams.get("next")) ||
        safeNextPath(url.searchParams.get("redirect")) ||
        `${window.location.pathname}${window.location.search}`;

      setRequest({
        mode: url.pathname === "/signup" ? "signup" : "signin",
        nextPath,
      });
    }

    window.addEventListener("heyy:open-auth", openFromEvent as EventListener);
    document.addEventListener("click", interceptLegacyAuthLink, true);

    return () => {
      window.removeEventListener("heyy:open-auth", openFromEvent as EventListener);
      document.removeEventListener("click", interceptLegacyAuthLink, true);
    };
  }, [allowSignup]);

  if (!request) return null;

  return (
    <AuthModal
      initialMode={request.mode}
      nextPath={request.nextPath}
      onClose={() => setRequest(null)}
    />
  );
}
