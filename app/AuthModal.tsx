"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
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

  async function handleEmailSubmit() {
    setLoading(true);
    setMessage("");
    setIsError(false);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setMessage(error.message); setIsError(true); }
      else { onClose(); }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setMessage(error.message); setIsError(true); }
      else { setMessage("Check your email to confirm your account!"); }
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
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
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 p-10 shadow-2xl" style={{ backgroundColor: "#0a0a0a" }}>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-black text-white">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition text-2xl leading-none">
            &times;
          </button>
        </div>

        <p className="text-white/40 mb-6">
          {mode === "login" ? "Sign in to your Heyy Studio account" : "Start your Heyy Studio journey"}
        </p>

        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            style={inputStyle(emailFocused)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            style={inputStyle(passwordFocused)}
          />

          {message && (
            <p style={{ fontSize: "14px", color: isError ? "#f87171" : "#c084fc" }}>{message}</p>
          )}

          <button
            onClick={handleEmailSubmit}
            disabled={loading}
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
            {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : (mode === "login" ? "Sign In" : "Create Account")}
          </button>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-sm text-white/30">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={handleGoogleLogin}
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
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}
              className="text-purple-400 hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
