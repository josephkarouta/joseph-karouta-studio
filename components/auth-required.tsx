"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, ButtonLink, GlassCard } from "@/components/ui/heyy";

export default function AuthRequired({
  children,
  title = "Sign in to enter the Studio",
  description = "Your projects, generations, credits and production requests need a secure workspace so nothing is lost.",
  nextPath,
}: {
  children?: ReactNode;
  title?: string;
  description?: string;
  nextPath?: string;
}) {
  const { user, loading, signInWithGoogle } = useAuth();
  if (children && loading) return <main className="grid min-h-screen place-items-center bg-[var(--background)]"><LoaderCircle className="animate-spin text-[var(--accent-strong)]"/></main>;
  if (children && user) return <>{children}</>;
  const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";

  return (
    <main className="heyy-page heyy-page-grid flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-5 py-16">
      <GlassCard className="w-full max-w-2xl p-7 text-center sm:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6f2dff,#d83cb8)] text-white shadow-[0_18px_40px_rgba(111,45,255,.28)]"><LockKeyhole size={23} /></span>
        <p className="mt-6 text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Secure creative workspace</p>
        <h1 className="mx-auto mt-3 max-w-xl text-3xl font-black tracking-[-0.045em] text-[var(--text-primary)] sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm font-semibold leading-7 text-[var(--text-secondary)]">{description}</p>
        <div className="mx-auto mt-8 grid max-w-md gap-3 sm:grid-cols-2">
          <Button onClick={() => signInWithGoogle(`${window.location.origin}${nextPath || "/dashboard"}`)} size="lg" className="w-full"><Sparkles size={16} /> Continue with Google</Button>
          <ButtonLink href={`/signup${next}`} variant="secondary" size="lg" className="w-full">Create account</ButtonLink>
        </div>
        <p className="mt-5 text-xs font-semibold text-[var(--text-muted)]">Already have an account? <Link href={`/login${next}`} className="font-black text-[var(--accent-strong)] hover:underline">Sign in with email</Link></p>
      </GlassCard>
    </main>
  );
}
