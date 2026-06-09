"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        window.location.href = "/login";
      } else {
        setUser(data.user);
      }
      setLoading(false);
    }
    getUser();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-white/50">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/40">Heyy Studio</p>
            <h1 className="mt-2 text-5xl font-black">My Dashboard</h1>
          </div>
          <div className="flex gap-3">
            <a
              href="/"
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-white hover:bg-white hover:text-black transition-all duration-200"
            >
              Home
            </a>
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-white hover:bg-white hover:text-black transition-all duration-200"
            >
              Log Out
            </button>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-bold">Account</h2>
          <p className="mt-2 text-white/50">{user?.email}</p>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-bold">My Projects</h2>
          <p className="mt-2 text-white/50">Your saved projects will appear here soon.</p>
        </div>
      </div>
    </main>
  );
}
