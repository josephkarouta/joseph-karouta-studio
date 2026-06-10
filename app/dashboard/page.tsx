"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function getUserAndProjects() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        window.location.href = "/login";
        return;
      }

      setUser(data.user);

      const { data: savedProjects } = await supabase
        .from("user_projects")
        .select("*")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false });

      setProjects(savedProjects || []);
      setLoading(false);
    }

    getUserAndProjects();
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
            <p className="text-sm uppercase tracking-[0.3em] text-white/40">
              Heyy Studio
            </p>
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

        <div className="mt-4 rounded-3xl border border-purple-500/20 bg-purple-500/10 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-purple-300">
            Subscription
          </p>

          <h2 className="mt-3 text-2xl font-black">AI Studio Plan</h2>

          <p className="mt-2 text-white/60">
            Your subscription status will appear here after checkout is connected to your account.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/#pricing"
              className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black hover:bg-white/90"
            >
              View Plans
            </a>

            <button
              type="button"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white opacity-50"
              disabled
            >
              Manage Subscription Soon
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-bold">My Projects</h2>

          {projects.length === 0 ? (
            <p className="mt-2 text-white/50">
              Your saved projects will appear here soon.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold">
                        {project.title || "AI Project Brief"}
                      </h3>

                      <p className="mt-1 text-xs text-white/40">
                        {project.created_at
                          ? new Date(project.created_at).toLocaleDateString(
                              "en-AU",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/75">
                    {project.project_brief}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}