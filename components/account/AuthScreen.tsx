"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import HeyyLogo from "@/components/brand/HeyyLogo";
import ThemeToggle from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { Button, ButtonLink, GlassCard } from "@/components/ui/heyy";

export default function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const next = useMemo(() => {
    const value = searchParams.get("next") || "/dashboard";
    return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
  }, [searchParams]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(searchParams.get("authError") || "");
  const [success, setSuccess] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const { resolvedTheme } = useTheme();
  const signup = mode === "signup";

  async function submit() {
    setLoading(true); setMessage(""); setSuccess(false);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        if (data.session) window.location.href = next;
        else { setSuccess(true); setMessage("Check your email to confirm your account, then return to Heyy Studio."); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = next;
      }
    } catch (value) {
      setMessage(value instanceof Error ? value.message : "Authentication failed.");
    } finally { setLoading(false); }
  }

  async function google() {
    setLoading(true); setMessage("");

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) { setMessage(error.message); setLoading(false); }
  }

  return <main className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(239,63,180,.17),transparent_28rem),radial-gradient(circle_at_82%_14%,rgba(46,124,246,.18),transparent_30rem),radial-gradient(circle_at_54%_88%,rgba(111,45,255,.16),transparent_34rem)]"/>
    <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8"><Link href="/"><HeyyLogo variant={resolvedTheme === "dark" ? "full-colour-light" : "full-colour-dark"} height={31}/></Link><div className="flex items-center gap-2"><ThemeToggle compact/><ButtonLink href="/" variant="ghost" size="sm"><ArrowLeft size={15}/>Home</ButtonLink></div></header>
    <div className="relative z-10 mx-auto grid min-h-[calc(100vh-84px)] max-w-6xl items-center gap-8 px-5 pb-12 lg:grid-cols-[1.05fr_.75fr] lg:px-8">
      <section className="hidden lg:block"><p className="text-[.66rem] font-black uppercase tracking-[.22em] text-[var(--accent-strong)]">Heyy Studio workspace</p><h1 className="mt-5 max-w-2xl text-6xl font-black leading-[.92] tracking-[-.07em]">Your creative work stays connected from idea to delivery.</h1><div className="mt-8 grid max-w-xl gap-3">{["Four specialist Studios and four focused AI tools","Credits shown before every paid generation","Expert quotes, production, revisions and delivery in one workspace"].map(item=><div key={item} className="flex items-center gap-3 text-sm font-bold text-[var(--text-secondary)]"><CheckCircle2 size={18} className="text-emerald-500"/>{item}</div>)}</div></section>
      <GlassCard className="mx-auto w-full max-w-lg p-6 sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-[var(--shadow-button)]"><Sparkles size={21}/></span><h2 className="mt-6 text-4xl font-black tracking-[-.055em]">{signup ? "Create your account" : "Welcome back"}</h2><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{signup ? "Start with testing credits and save every useful output." : "Sign in to continue your projects and production activity."}</p>
        <div className="mt-7 grid gap-4">{signup&&<input className="heyy-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" autoComplete="name"/>}<input className="heyy-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" autoComplete="email"/><input className="heyy-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" autoComplete={signup?"new-password":"current-password"} onKeyDown={e=>{if(e.key==='Enter')void submit()}}/>{message&&<p className={`rounded-2xl px-4 py-3 text-xs font-bold ${success?'bg-emerald-500/10 text-emerald-600':'bg-red-500/10 text-red-500'}`}>{message}</p>}<Button onClick={submit} disabled={loading||!email||!password||(signup&&!name)} className="w-full">{loading&&<LoaderCircle size={16} className="animate-spin"/>}{signup?"Create account":"Sign in"}</Button><div className="flex items-center gap-4"><span className="h-px flex-1 bg-[var(--border)]"/><span className="text-xs font-bold text-[var(--text-muted)]">or</span><span className="h-px flex-1 bg-[var(--border)]"/></div><Button onClick={google} disabled={loading} variant="secondary" className="w-full">Continue with Google</Button></div>
        <p className="mt-6 text-center text-sm font-semibold text-[var(--text-secondary)]">{signup?"Already have an account?":"New to Heyy Studio?"} <Link className="font-black text-[var(--accent-strong)] hover:underline" href={`${signup?'/login':'/signup'}?next=${encodeURIComponent(next)}`}>{signup?"Sign in":"Create an account"}</Link></p>
      </GlassCard>
    </div>
  </main>;
}
