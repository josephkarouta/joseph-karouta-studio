"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, Settings2, X } from "lucide-react";

const STORAGE_KEY = "heyy-cookie-consent-v1";

type Consent = {
  version: 1;
  analytics: boolean;
  updatedAt: string;
};

function persistConsent(analytics: boolean) {
  const value: Consent = { version: 1, analytics, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Consent can still be respected for the current page if storage is unavailable.
  }
  document.documentElement.dataset.analyticsConsent = analytics ? "granted" : "denied";
  window.dispatchEvent(new CustomEvent("heyy:cookie-consent", { detail: value }));
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Consent;
        if (saved?.version === 1) {
          document.documentElement.dataset.analyticsConsent = saved.analytics ? "granted" : "denied";
          return;
        }
      }
    } catch {
      // If the preference cannot be read, ask again rather than assuming consent.
    }

    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  function finish(value: boolean) {
    persistConsent(value);
    setVisible(false);
    setPreferences(false);
  }

  return (
    <aside
      className="fixed bottom-3 left-4 z-[70] w-[calc(100%-2rem)] max-w-[390px] rounded-[1.6rem] border border-white/10 bg-[#15131b]/95 p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,.38)] backdrop-blur-2xl sm:bottom-5 sm:left-5 sm:p-5"
      aria-label="Cookie notice"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/8 text-violet-300">
            <Cookie size={18} />
          </span>
          <h2 className="text-base font-black tracking-[-.025em]">Cookie notice</h2>
        </div>

        <button
          type="button"
          onClick={() => finish(false)}
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-white/50 transition hover:bg-white/8 hover:text-white"
          aria-label="Reject non-essential cookies and close"
        >
          <X size={15} />
        </button>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-white/62">
        Essential cookies keep Heyy Studio secure and signed in. Optional analytics stays off unless you allow it.
      </p>

      {preferences && (
        <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black">Essential</p>
              <p className="mt-0.5 text-[11px] leading-4 text-white/50">Sign-in, security and core site functions.</p>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-white/70">
              Always on
            </span>
          </div>
          <div className="h-px bg-white/8" />
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black">Analytics</p>
              <p className="mt-0.5 text-[11px] leading-4 text-white/50">Helps us understand how Heyy Studio is used.</p>
            </div>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
              className="h-4 w-4 cursor-pointer accent-violet-500"
            />
          </label>
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {preferences ? (
          <button
            type="button"
            onClick={() => finish(analytics)}
            className="min-h-10 cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-xs font-black text-white transition hover:brightness-110"
          >
            Save preferences
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => finish(true)}
              className="min-h-10 cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-xs font-black text-white transition hover:brightness-110"
            >
              Accept optional analytics
            </button>
            <button
              type="button"
              onClick={() => finish(false)}
              className="min-h-10 cursor-pointer rounded-xl border border-white/12 bg-white/6 px-4 text-xs font-black text-white transition hover:bg-white/10"
            >
              Reject non-essential
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setPreferences((current) => !current)}
          className="flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-black text-white/70 transition hover:bg-white/6 hover:text-white"
        >
          <Settings2 size={14} /> Cookie preferences
        </button>
      </div>

      <p className="mt-3 text-[10px] font-semibold leading-4 text-white/42">
        Read our{" "}
        <Link
          href="/privacy"
          className="cursor-pointer underline decoration-white/25 underline-offset-2 hover:text-white"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </aside>
  );
}
