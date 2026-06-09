"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createSupabaseBrowserClient();

  async function handleSignup() {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email to confirm your account!");
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
        <h1 className="text-3xl font-black">Create an account</h1>
        <p className="mt-2 text-white/50">Start your Heyy Studio journey</p>

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

          {message && (
            <p className="text-sm text-purple-400">{message}</p>
          )}

          <button
            onClick={handleSignup}
            disabled={loading}
            className="rounded-full bg-white py-3 font-bold text-black hover:bg-white/80 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
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
            Already have an account?{" "}
            <a href="/login" className="text-purple-400 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
