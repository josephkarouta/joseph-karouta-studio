"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, KeyRound, LoaderCircle, LockKeyhole, MailCheck, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import HeyyLogo from "@/components/brand/HeyyLogo";
import OAuthButtons from "@/components/account/OAuthButtons";
import { useTheme } from "@/components/theme-provider";

type AuthMode = "signin" | "signup";

type AuthModalProps = {
  onClose: () => void;
  nextPath?: string;
  initialMode?: AuthMode;
};

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export default function AuthModal({ onClose, nextPath, initialMode = "signin" }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [emailMode, setEmailMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function currentNextPath() {
    if (nextPath?.startsWith("/") && !nextPath.startsWith("//")) return nextPath;
    if (typeof window === "undefined") return "/dashboard";
    return `${window.location.pathname}${window.location.search}` || "/dashboard";
  }

  function verificationRedirect() {
    const url = new URL("/signup", window.location.origin);
    url.searchParams.set("next", currentNextPath());
    return url.toString();
  }

  function resetFeedback() {
    setMessage("");
    setSuccess(false);
  }

  function showVerification(targetEmail: string, copy?: string) {
    const normalized = cleanEmail(targetEmail);
    setVerificationEmail(normalized);
    setEmail(normalized);
    setVerificationCode("");
    setAwaitingVerification(true);
    setEmailMode(true);
    setSuccess(true);
    setMessage(copy || `We sent a verification code to ${normalized}. Enter it below to activate your account.`);
  }

  async function handleEmailSubmit() {
    setLoading(true);
    resetFeedback();

    try {
      const normalizedEmail = cleanEmail(email);

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: verificationRedirect(),
          },
        });
        if (error) throw error;

        if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
          setMessage("An account already exists with this email. Sign in instead.");
          return;
        }

        if (data.session) {
          await supabase.auth.signOut({ scope: "local" });
          throw new Error(
            "Email verification is temporarily unavailable. Please try again later or contact support if the problem continues.",
          );
        }

        showVerification(normalizedEmail);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        if (/email.*not.*confirmed|email.*confirmation/i.test(error.message || "")) {
          showVerification(
            normalizedEmail,
            "Your account still needs email verification. Enter the code from your signup email or resend a new code.",
          );
          return;
        }
        throw error;
      }

      window.location.assign(currentNextPath());
    } catch (value) {
      setMessage(value instanceof Error ? value.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmail() {
    const normalizedEmail = cleanEmail(verificationEmail || email);
    const token = cleanCode(verificationCode);

    if (!normalizedEmail || token.length !== 8) {
      setSuccess(false);
      setMessage("Enter the verification code from your email.");
      return;
    }

    setLoading(true);
    resetFeedback();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: "email",
      });
      if (error) throw error;

      if (!data.session || !data.user?.email_confirmed_at) {
        throw new Error("Your email could not be verified. Request a new code and try again.");
      }

      try {
        await fetch("/api/account/welcome", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
      } catch {
        // Welcome email is non-blocking; the account is already verified.
      }

      window.location.assign(currentNextPath());
    } catch (value) {
      setMessage(value instanceof Error ? value.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    const normalizedEmail = cleanEmail(verificationEmail || email);
    if (!normalizedEmail) return;

    setResending(true);
    resetFeedback();

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: { emailRedirectTo: verificationRedirect() },
      });
      if (error) throw error;
      setVerificationCode("");
      setSuccess(true);
      setMessage(`A new verification code was sent to ${normalizedEmail}. Use the most recent code from your inbox.`);
    } catch (value) {
      setMessage(value instanceof Error ? value.message : "A new code could not be sent.");
    } finally {
      setResending(false);
    }
  }

  const title = mode === "signup" ? "Create your Heyy Studio account" : "Welcome back";
  const subtitle = mode === "signup"
    ? "Sign up when you are ready to save your work and start creating."
    : "Sign in to continue to your Heyy Studio workspace.";

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid min-h-dvh place-items-center overflow-y-auto p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "signup" ? "Create a Heyy Studio account" : "Sign in to Heyy Studio"}
    >
      <button
        className="fixed inset-0 bg-black/65 backdrop-blur-lg"
        onClick={onClose}
        aria-label="Close authentication"
      />

      <div className="relative z-10 grid w-full max-w-[390px] overflow-hidden rounded-[1.65rem] bg-[var(--surface-strong)] shadow-[0_40px_120px_rgba(0,0,0,.46)] md:max-w-5xl md:grid-cols-[.92fr_1.08fr] md:rounded-[2rem]">
        <div className="relative hidden min-h-[610px] overflow-hidden bg-[#090616] md:block">
          <video
            className="absolute inset-0 h-full w-full object-cover object-[76%_50%]"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/heyy-home-hero.webp"
            aria-hidden="true"
          >
            <source src="/hero-video-web.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="relative flex min-h-0 flex-col justify-start p-5 pt-7 sm:p-7 md:min-h-[560px] md:justify-center md:p-9 lg:p-11">
          <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center md:right-5 md:top-5 md:h-10 md:w-10 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]" aria-label="Close authentication">
            <X size={18} />
          </button>

          <div className="mx-auto w-full max-w-md">
            <HeyyLogo variant={resolvedTheme === "dark" ? "full-colour-light" : "full-colour-dark"} height={26} />

            <div className="mt-7 flex items-center gap-3 text-[var(--accent-strong)] md:mt-8">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent-soft)]">
                {awaitingVerification ? <MailCheck size={18} /> : <LockKeyhole size={18} />}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[.2em]">{awaitingVerification ? "Verify your email" : "Your workspace"}</span>
            </div>

            {awaitingVerification ? (
              <>
                <h1 className="mt-4 text-4xl font-black tracking-[-.055em] text-[var(--text-primary)]">Check your inbox</h1>
                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Enter the verification code sent to <span className="font-black text-[var(--text-primary)]">{verificationEmail || email}</span>.</p>

                <div className="mt-7 grid gap-3">
                  <div className="relative">
                    <KeyRound size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      className="heyy-input w-full !pl-11 text-center text-xl font-black tracking-[.28em]"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label="Email verification code"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(cleanCode(event.target.value))}
                      onKeyDown={(event) => { if (event.key === "Enter") void verifyEmail(); }}
                      placeholder="00000000"
                    />
                  </div>
                  <button type="button" onClick={() => void verifyEmail()} disabled={loading || verificationCode.length !== 8} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--button-primary)] px-4 text-sm font-black text-[var(--button-primary-text)] shadow-[var(--shadow-button)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-strong)] disabled:text-[var(--text-muted)] disabled:opacity-100">
                    {loading && <LoaderCircle size={16} className="animate-spin" />}
                    Verify email
                  </button>
                  <button type="button" onClick={() => void resendCode()} disabled={resending} className="min-h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-black text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--text-primary)] disabled:opacity-50">
                    {resending ? "Sending…" : "Resend code"}
                  </button>
                  <button type="button" onClick={() => { setAwaitingVerification(false); setVerificationCode(""); resetFeedback(); }} className="mx-auto mt-1 flex items-center gap-2 text-xs font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <ArrowLeft size={14} /> Back
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-4 text-[2rem] font-black leading-[.98] tracking-[-.055em] text-[var(--text-primary)] sm:text-4xl">{title}</h1>
                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{subtitle}</p>

                {!emailMode ? (
                  <div className="mt-7">
                    <OAuthButtons
                      nextPath={currentNextPath()}
                      disabled={loading}
                      onStart={() => { setLoading(true); resetFeedback(); }}
                      onError={(value) => { setMessage(value); setLoading(false); }}
                      onEmail={() => { setEmailMode(true); resetFeedback(); }}
                    />
                  </div>
                ) : (
                  <div className="mt-7 grid gap-3">
                    <button type="button" onClick={() => { setEmailMode(false); resetFeedback(); }} className="mb-1 flex w-fit items-center gap-2 text-xs font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                      <ArrowLeft size={14} /> Other options
                    </button>
                    {mode === "signup" && (
                      <input className="heyy-input" type="text" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
                    )}
                    <input className="heyy-input" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                    <input className="heyy-input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleEmailSubmit(); }} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                    <button type="button" onClick={() => void handleEmailSubmit()} disabled={loading || !email || !password || (mode === "signup" && !name.trim())} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--button-primary)] px-4 text-sm font-black text-[var(--button-primary-text)] shadow-[var(--shadow-button)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-strong)] disabled:text-[var(--text-muted)] disabled:opacity-100">
                      {loading && <LoaderCircle size={16} className="animate-spin" />}
                      {mode === "signup" ? "Create account with email" : "Sign in with email"}
                    </button>
                  </div>
                )}

                <p className="mt-3 text-center text-[11px] font-semibold leading-5 text-[var(--text-muted)]">By continuing, you agree to Heyy Studio&apos;s <a href="/terms" className="underline underline-offset-2 hover:text-[var(--text-primary)]">Terms &amp; Conditions</a> and acknowledge the <a href="/privacy" className="underline underline-offset-2 hover:text-[var(--text-primary)]">Privacy Policy</a>.</p>
              </>
            )}

            {message && <p className={`mt-4 rounded-2xl px-4 py-3 text-xs font-bold leading-5 ${success ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>{message}</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
