"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button, GlassCard } from "@/components/ui/heyy";

export default function ExpertActivation() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading: authLoading } = useAuth();
  const [activating, setActivating] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [message, setMessage] = useState("");
  const next = useMemo(() => `/expert/activate?token=${encodeURIComponent(token)}`, [token]);

  async function activate() {
    if (!token || !user) return;
    setActivating(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sign in again to activate your Expert profile.");
      const response = await fetch("/api/expert/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Expert profile could not be activated.");
      setAlreadyActive(Boolean(result.alreadyActive));
      await supabase.auth.refreshSession();
      setDone(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Expert profile could not be activated.");
    } finally {
      setActivating(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user || !token || done || activating || message) return;
    void activate();
  }, [authLoading, user, token, done, activating, message]);

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-16 text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl">
        <GlassCard className="p-7 sm:p-10">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"><Sparkles size={23}/></span>
          <p className="mt-6 text-[.62rem] font-black uppercase tracking-[.2em] text-[var(--accent-strong)]">Heyy Studio Expert Network</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-5xl">Activate your Expert Portal.</h1>

          {!token ? (
            <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm font-bold text-red-600">This activation link is incomplete. Open the invitation email from Heyy Studio again.</p>
          ) : authLoading ? (
            <div className="mt-7 flex items-center gap-3 text-sm font-bold text-[var(--text-secondary)]"><Loader2 className="animate-spin" size={18}/>Checking your account…</div>
          ) : !user ? (
            <>
              <p className="mt-5 text-sm font-semibold leading-7 text-[var(--text-secondary)]">Sign in or create a Heyy Studio account using the same email address you used for your Expert Network application. Your Expert access is private and does not provide Admin access.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={`/login?next=${encodeURIComponent(next)}`} className="inline-flex h-11 items-center rounded-full bg-[var(--text-primary)] px-5 text-xs font-black text-[var(--surface-strong)]">Sign in to activate</Link>
                <Link href={`/signup?next=${encodeURIComponent(next)}`} className="inline-flex h-11 items-center rounded-full border border-[var(--border)] px-5 text-xs font-black">Create account</Link>
              </div>
            </>
          ) : done ? (
            <div className="mt-7 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="flex items-center gap-3"><CheckCircle2 className="text-emerald-600" size={22}/><p className="font-black text-emerald-700 dark:text-emerald-300">{alreadyActive ? "Your Expert Portal is already active." : "Expert Portal activated."}</p></div>
              <p className="mt-3 text-sm font-semibold leading-6 text-emerald-800/80 dark:text-emerald-200/80">You can open it anytime from your Heyy Studio account menu. The invitation email is only needed for the first activation.</p>
              <Link href="/expert" className="mt-5 inline-flex h-11 items-center rounded-full bg-emerald-700 px-5 text-xs font-black text-white">Open Expert Portal →</Link>
            </div>
          ) : (
            <>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><ShieldCheck className="mt-0.5 shrink-0 text-[var(--accent-strong)]" size={19}/><p className="text-sm font-semibold leading-6 text-[var(--text-secondary)]">Signed in as <strong className="text-[var(--text-primary)]">{user.email}</strong>. This email must match the approved application.</p></div>
              {message && <p className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm font-bold text-red-600">{message}</p>}
              <Button className="mt-6" onClick={() => void activate()} disabled={activating}>{activating ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>} {activating ? "Activating…" : "Activate Expert Portal"}</Button>
            </>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
