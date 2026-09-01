"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import AuthRequired from "@/components/auth-required";
import { useAuth } from "@/components/auth-provider";

export default function StudioAccessGate({ children, path }: { children: ReactNode; path: string }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user) return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, path, user]);

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="heyy-page flex min-h-screen items-center justify-center pt-[var(--header-height)]">
          <div className="text-center">
            <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
            <p className="mt-4 text-sm font-bold text-[var(--text-secondary)]">Opening your workspace…</p>
          </div>
        </main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <SiteHeader />
        <div className="pt-[var(--header-height)]">
          <AuthRequired nextPath={path} />
          <SiteFooter />
        </div>
      </>
    );
  }

  return <>{children}</>;
}
