"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [signInHover, setSignInHover] = useState(false);
  const [googleHover, setGoogleHover] = useState(false);

  const supabase = createSupabaseBrowserClient();

  function currentNextPath() {
    if (typeof window === "undefined") return "/dashboard";
    return `${window.location.pathname}${window.location.search}` || "/dashboard";
  }

  function signupUrl(verifyEmail?: string) {
    const params = new URLSearchParams({ next: currentNextPath() });
    if (verifyEmail) params.set("verify", verifyEmail.trim().toLowerCase());
    return `/signup?${params.toString()}`;
  }

  async function handleEmailSubmit() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (/email.*not.*confirmed|email.*confirmation/i.test(error.message || "")) {
        window.location.href = signupUrl(normalizedEmail);
        return;
      }
      setMessage(error.message);
      setIsError(true);
      setLoading(false);
      return;
    }

    onClose();
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setMessage("");

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", currentNextPath());

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setMessage(error.message);
      setIsError(true);
      setLoading(false);
    }
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: focused ? "1.5px solid #a855f7" : "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    padding: "12px 20px",
    color: "#fff",
    outline: "none",
    fontSize: "14px",
    boxShadow: focused ? "0 0 0 3px rgba(168,85,247,0.2)" : "none",
    transition: "all 0.2s",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 p-10 shadow-2xl"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-black text-white">Welcome back</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-white/30 transition hover:text-white"
            aria-label="Close sign in"
          >
            &times;
          </button>
        </div>

        <p className="mb-6 text-white/40">Sign in to your Heyy Studio account</p>

        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            style={inputStyle(emailFocused)}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleEmailSubmit();
            }}
            style={inputStyle(passwordFocused)}
            autoComplete="current-password"
          />

          {message && (
            <p style={{ fontSize: "14px", color: isError ? "#f87171" : "#c084fc" }}>
              {message}
            </p>
          )}

          <button
            onClick={() => void handleEmailSubmit()}
            disabled={loading || !email || !password}
            onMouseEnter={() => setSignInHover(true)}
            onMouseLeave={() => setSignInHover(false)}
            style={{
              borderRadius: "999px",
              padding: "12px",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s",
              backgroundColor: signInHover ? "#a855f7" : "#ffffff",
              color: signInHover ? "#ffffff" : "#000000",
              border: "none",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-sm text-white/30">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={() => void handleGoogleLogin()}
            disabled={loading}
            onMouseEnter={() => setGoogleHover(true)}
            onMouseLeave={() => setGoogleHover(false)}
            style={{
              borderRadius: "999px",
              padding: "12px",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s",
              backgroundColor: googleHover ? "#a855f7" : "transparent",
              color: "#ffffff",
              border: googleHover ? "1.5px solid #a855f7" : "1.5px solid rgba(255,255,255,0.15)",
            }}
          >
            Continue with Google
          </button>

          <p className="text-center text-sm text-white/40">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => {
                window.location.href = signupUrl();
              }}
              className="text-purple-400 hover:underline"
            >
              Create an account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
