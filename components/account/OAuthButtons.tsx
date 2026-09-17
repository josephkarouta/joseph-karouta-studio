"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { cx } from "@/components/ui/heyy";

type OAuthButtonsProps = {
  nextPath: string;
  disabled?: boolean;
  onStart?: () => void;
  onError?: (message: string) => void;
  onEmail?: () => void;
  showEmail?: boolean;
  className?: string;
};

function safeNextPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.23-.2-1.78H12v3.44h5.52a4.74 4.74 0 0 1-2.05 3.02l-.03.12 2.98 2.31.21.02c1.91-1.76 2.97-4.36 2.97-7.13Z"/>
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.89 6.63-2.64l-3.16-2.45c-.85.58-1.98.98-3.47.98a6.02 6.02 0 0 1-5.7-4.16l-.12.01-3.1 2.4-.04.11A10 10 0 0 0 12 22Z"/>
      <path fill="#FBBC05" d="M6.3 13.73A6.2 6.2 0 0 1 5.98 12c0-.6.1-1.19.3-1.73v-.12L3.13 7.7l-.1.05A10 10 0 0 0 2 12c0 1.53.35 2.98 1.04 4.25l3.26-2.52Z"/>
      <path fill="#EA4335" d="M12 6.11c1.88 0 3.15.81 3.88 1.49l2.82-2.75C16.97 3.24 14.7 2 12 2a10 10 0 0 0-8.96 5.75l3.25 2.52A6.03 6.03 0 0 1 12 6.11Z"/>
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[19px] w-[19px] shrink-0 fill-current">
      <path d="M17.05 12.54c-.03-2.63 2.15-3.91 2.25-3.97a4.84 4.84 0 0 0-3.82-2.07c-1.61-.17-3.17.97-3.99.97-.84 0-2.11-.95-3.47-.92a5.06 5.06 0 0 0-4.25 2.59c-1.85 3.2-.47 7.91 1.3 10.5.89 1.27 1.92 2.69 3.28 2.64 1.33-.06 1.83-.85 3.44-.85 1.59 0 2.07.85 3.46.82 1.43-.03 2.33-1.27 3.19-2.55a10.48 10.48 0 0 0 1.46-2.98 4.56 4.56 0 0 1-2.85-4.18ZM14.43 4.79A4.6 4.6 0 0 0 15.49 1.5a4.68 4.68 0 0 0-3.02 1.56 4.38 4.38 0 0 0-1.09 3.17 3.88 3.88 0 0 0 3.05-1.44Z"/>
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/>
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/>
    </svg>
  );
}

export default function OAuthButtons({
  nextPath,
  disabled = false,
  onStart,
  onError,
  onEmail,
  showEmail = true,
  className,
}: OAuthButtonsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [providerAvailability, setProviderAvailability] = useState({ apple: false, azure: false });

  useEffect(() => {
    let cancelled = false;

    async function loadProviderAvailability() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) return;

      try {
        const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
          headers: { apikey: anonKey },
          cache: "no-store",
        });
        if (!response.ok) return;

        const settings = await response.json() as {
          external?: Record<string, boolean>;
        };
        if (cancelled) return;

        setProviderAvailability({
          apple: settings.external?.apple === true,
          azure: settings.external?.azure === true,
        });
      } catch {
        // Keep optional providers hidden if Supabase settings cannot be read.
      }
    }

    void loadProviderAvailability();
    return () => { cancelled = true; };
  }, []);

  const appleEnabled = providerAvailability.apple;
  const microsoftEnabled = providerAvailability.azure;

  async function oauth(provider: "google" | "apple" | "azure") {
    onStart?.();
    onError?.("");

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", safeNextPath(nextPath));

    const options: {
      redirectTo: string;
      queryParams?: Record<string, string>;
      scopes?: string;
    } = { redirectTo: callbackUrl.toString() };

    if (provider === "google") options.queryParams = { prompt: "select_account" };
    if (provider === "azure") options.scopes = "email";

    const { error } = await supabase.auth.signInWithOAuth({ provider, options });
    if (error) onError?.(error.message);
  }

  const buttonClass =
    "flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-black text-[var(--text-primary)] shadow-sm transition hover:border-[var(--accent-border)] hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className={cx("grid gap-3", className)}>
      <button type="button" disabled={disabled} className={buttonClass} onClick={() => void oauth("google")}>
        <GoogleMark /> Continue with Google
      </button>

      {appleEnabled && (
        <button type="button" disabled={disabled} className={buttonClass} onClick={() => void oauth("apple")}>
          <AppleMark /> Continue with Apple
        </button>
      )}

      {microsoftEnabled && (
        <button type="button" disabled={disabled} className={buttonClass} onClick={() => void oauth("azure")}>
          <MicrosoftMark /> Continue with Microsoft
        </button>
      )}

      {showEmail && onEmail && (
        <button type="button" disabled={disabled} className={buttonClass} onClick={onEmail}>
          <Mail size={18} /> Continue with email
        </button>
      )}
    </div>
  );
}
