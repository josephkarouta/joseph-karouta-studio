"use client";

import { useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import AuthModal from "@/app/AuthModal";
import SiteHeader from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";

function isGuestProtectedField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("header, nav, footer, [data-guest-allowed='true']")) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function isGuestProtectedTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  // Header/navigation, normal links and browsing controls remain available.
  if (target.closest("header, nav, footer, a[href], [data-guest-allowed='true']")) return false;
  if (target.closest("button[role='tab'], [role='tablist'] button")) return false;

  if (target.closest("input, textarea, select, [contenteditable='true']")) return true;

  const button = target.closest("button");
  if (!button) return false;

  const label = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`.toLowerCase();
  if (/close|preview|enlarge|lightbox|previous image|next image|view image/.test(label)) return false;

  return true;
}

export default function StudioAccessGate({ children, path }: { children: ReactNode; path: string }) {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  function requestAuth() {
    if (!user) setShowAuth(true);
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (user || !isGuestProtectedTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    requestAuth();
  }

  function handleFocusCapture(event: FocusEvent<HTMLDivElement>) {
    if (user || !isGuestProtectedField(event.target)) return;
    event.preventDefault();
    (event.target as HTMLElement).blur?.();
    requestAuth();
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="heyy-page flex min-h-screen items-center justify-center pt-[var(--header-height)]">
          <div className="text-center">
            <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
            <p className="mt-4 text-sm font-bold text-[var(--text-secondary)]">Opening the experience…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <div onClickCapture={handleClickCapture} onFocusCapture={handleFocusCapture} data-guest-preview={!user ? "true" : undefined}>
        {children}
      </div>
      {!user && showAuth && <AuthModal onClose={() => setShowAuth(false)} nextPath={path} />}
    </>
  );
}
