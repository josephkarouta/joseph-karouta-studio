"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createSupabaseBrowserClient();

  async function handleEmailLogin() {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
    } else {
      window.location.href = "/dashboard";
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-8 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-10">
        <a href="/" className="text-sm text-white/40 hover:text-white">← Back to Home</a>
        <h1 className="mt-4 text-3xl font-black">Welcome back</h1>
        <p className="mt-2 text-white/50">Sign in to your Heyy Studio account</p>

        <div className="mt-8 flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-white outline-none placeholder:text-white/30 focus:border-purple-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-white outline-none placeholder:text-white/30 focus:border-purple-400"
          />

          {message && <p className="text-sm text-red-400">{message}</p>}

          <button
            onClick={handleEmailLogin}
            disabled={loading}
            className="rounded-full bg-white py-3 font-bold text-black hover:bg-white/80 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-sm text-white/30">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={handleGoogleLogin}
            className="rounded-full border border-white/15 py-3 font-bold text-white hover:bg-white/10"
          >
            Continue with Google
          </button>

          <p className="text-center text-sm text-white/40">
            Don't have an account?{" "}
            <a href="/signup" className="text-purple-400 hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
