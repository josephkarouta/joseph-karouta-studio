"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  MailCheck,
  Sparkles,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import HeyyLogo from "@/components/brand/HeyyLogo";
import ThemeToggle from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { Button, ButtonLink, GlassCard } from "@/components/ui/heyy";

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export default function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const next = useMemo(() => {
    const value = searchParams.get("next") || "/dashboard";
    return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
  }, [searchParams]);

  const requestedVerificationEmail = cleanEmail(searchParams.get("verify") || "");

  const [name, setName] = useState("");
  const [email, setEmail] = useState(requestedVerificationEmail);
  const [password, setPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState(requestedVerificationEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [existingAccountEmail, setExistingAccountEmail] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(Boolean(requestedVerificationEmail));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(
    requestedVerificationEmail
      ? "Enter the verification code from your email, or resend a new code."
      : searchParams.get("authError") || "",
  );
  const [success, setSuccess] = useState(Boolean(requestedVerificationEmail));

  const supabase = createSupabaseBrowserClient();
  const { resolvedTheme } = useTheme();
  const signup = mode === "signup";

  useEffect(() => {
    if (signup) return;
    let active = true;

    void (async () => {
      const result = await supabase.auth.getSession();
      if (!active || !result.data.session) return;
      // If an OAuth callback has already established the session, do not leave
      // the user looking at an empty sign-in form while the browser catches up.
      window.location.replace(next);
    })();

    return () => {
      active = false;
    };
  }, [next, signup, supabase]);

  function verificationRedirect() {
    const url = new URL("/signup", window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  }

  function showVerification(targetEmail: string, copy?: string) {
    const normalized = cleanEmail(targetEmail);
    setVerificationEmail(normalized);
    setEmail(normalized);
    setVerificationCode("");
    setAwaitingVerification(true);
    setSuccess(true);
    setMessage(copy || `We sent a verification code to ${normalized}. Enter it below to activate your account.`);
  }

  async function submit() {
    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const normalizedEmail = cleanEmail(email);

      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: verificationRedirect(),
          },
        });
        if (error) throw error;

        // Supabase deliberately obfuscates confirmed duplicate signups when
        // email confirmation is enabled. In the current response shape, the
        // fake duplicate user has no identities. Stop here instead of sending
        // the user into a verification screen that can never succeed.
        if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
          setExistingAccountEmail(normalizedEmail);
          setSuccess(false);
          setMessage("An account already exists with this email. Sign in instead.");
          return;
        }

        setExistingAccountEmail("");

        // With Supabase "Confirm email" enabled, a password signup must NOT
        // receive a session until the verification code has been confirmed.
        // Refuse to continue if the project is accidentally configured to
        // auto-confirm email addresses before the public beta.
        if (data.session) {
          await supabase.auth.signOut({ scope: "local" });
          throw new Error(
            "Email verification is not enabled for this Supabase project. Turn on Confirm email before public beta testing.",
          );
        }

        showVerification(normalizedEmail);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

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

        window.location.href = next;
      }
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
    setMessage("");
    setSuccess(false);

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

      // The verified session is now active. The shared credit server will grant
      // the Free allowance on the first authenticated account/generation call.
      window.location.href = next;
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
    setMessage("");
    setSuccess(false);

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

  async function google() {
    setLoading(true);
    setMessage("");

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  const authMessage = message ? (
    <p
      className={`rounded-2xl px-4 py-3 text-xs font-bold leading-5 ${
        success ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"
      }`}
    >
      {message}
    </p>
  ) : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(239,63,180,.17),transparent_28rem),radial-gradient(circle_at_82%_14%,rgba(46,124,246,.18),transparent_30rem),radial-gradient(circle_at_54%_88%,rgba(111,45,255,.16),transparent_34rem)]" />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <HeyyLogo
            variant={resolvedTheme === "dark" ? "full-colour-light" : "full-colour-dark"}
            height={31}
          />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <ButtonLink href="/" variant="ghost" size="sm">
            <ArrowLeft size={15} />
            Home
          </ButtonLink>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-84px)] max-w-6xl items-center gap-8 px-5 pb-12 lg:grid-cols-[1.05fr_.75fr] lg:px-8">
        <section className="hidden lg:block">
          <p className="text-[.66rem] font-black uppercase tracking-[.22em] text-[var(--accent-strong)]">
            Heyy Studio workspace
          </p>
          <h1 className="mt-5 max-w-2xl text-6xl font-black leading-[.92] tracking-[-.07em]">
            Your creative work stays connected from idea to delivery.
          </h1>
          <div className="mt-8 grid max-w-xl gap-3">
            {[
              "Four specialist Studios and five focused AI tools",
              "Credits shown before every paid generation",
              "Expert quotes, production, revisions and delivery in one workspace",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm font-bold text-[var(--text-secondary)]"
              >
                <CheckCircle2 size={18} className="text-emerald-500" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <GlassCard className="mx-auto w-full max-w-lg p-6 sm:p-9">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-[var(--shadow-button)]">
            {awaitingVerification ? <MailCheck size={21} /> : <Sparkles size={21} />}
          </span>

          {awaitingVerification ? (
            <>
              <h2 className="mt-6 text-4xl font-black tracking-[-.055em]">Verify your email</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                Free credits stay locked until this email address is verified.
              </p>

              <div className="mt-7 grid gap-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">
                    Verification email
                  </p>
                  <p className="mt-1 break-all text-sm font-black">{verificationEmail || email}</p>
                </div>

                <div className="relative">
                  <KeyRound
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    className="heyy-input w-full !pl-11 text-center text-xl font-black tracking-[.28em]"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label="Email verification code"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(cleanCode(event.target.value))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void verifyEmail();
                    }}
                    placeholder="00000000"
                    maxLength={8}
                  />
                </div>

                {authMessage}

                <Button
                  onClick={verifyEmail}
                  disabled={loading || verificationCode.length !== 8}
                  className="w-full"
                >
                  {loading && <LoaderCircle size={16} className="animate-spin" />}
                  Verify email & continue
                </Button>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => void resendCode()}
                    disabled={resending}
                    className="text-[var(--accent-strong)] hover:underline disabled:opacity-50"
                  >
                    {resending ? "Sending…" : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAwaitingVerification(false);
                      setVerificationCode("");
                      setMessage("");
                      setSuccess(false);
                    }}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-6 text-4xl font-black tracking-[-.055em]">
                {signup ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                {signup
                  ? "Verify your email first, then your Free credits and saved workspace become available."
                  : "Sign in to continue your projects and production activity."}
              </p>

              <div className="mt-7 grid gap-4">
                {signup && (
                  <input
                    className="heyy-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                )}
                <input
                  className="heyy-input"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setExistingAccountEmail("");
                  }}
                  placeholder="Email address"
                  autoComplete="email"
                />
                <input
                  className="heyy-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submit();
                  }}
                />

                {authMessage}

                {existingAccountEmail && (
                  <ButtonLink
                    href={`/login?next=${encodeURIComponent(next)}`}
                    variant="secondary"
                    className="w-full"
                  >
                    Sign in instead
                  </ButtonLink>
                )}

                <Button
                  onClick={submit}
                  disabled={loading || !email || !password || (signup && !name.trim())}
                  className="w-full"
                >
                  {loading && <LoaderCircle size={16} className="animate-spin" />}
                  {signup ? "Create account" : "Sign in"}
                </Button>

                <div className="flex items-center gap-4">
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  <span className="text-xs font-bold text-[var(--text-muted)]">or</span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>

                <Button onClick={google} disabled={loading} variant="secondary" className="w-full">
                  Continue with Google
                </Button>
              </div>

              <p className="mt-6 text-center text-sm font-semibold text-[var(--text-secondary)]">
                {signup ? "Already have an account?" : "New to Heyy Studio?"}{" "}
                <Link
                  className="font-black text-[var(--accent-strong)] hover:underline"
                  href={`${signup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`}
                >
                  {signup ? "Sign in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
