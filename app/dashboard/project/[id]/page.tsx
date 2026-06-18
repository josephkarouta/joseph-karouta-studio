"use client";

import { use, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import BriefCard from "@/components/brief-card";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [user, setUser] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [submittingExpert, setSubmittingExpert] = useState(false);
  const [expertStatus, setExpertStatus] = useState("");

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function loadProject() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setUser(userData.user);
      setEmail(userData.user.email || "");

      const { data, error } = await supabase
        .from("user_projects")
        .select("*")
        .eq("id", id)
        .eq("user_id", userData.user.id)
        .single();

      if (error) {
        console.error("Project detail error:", error);
      }

      setProject(data);
      setLoading(false);
    }

    loadProject();
  }, [id]);

  function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

  async function submitExpertRequest() {
    if (!project || !user) return;

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setExpertStatus("Please add your name, email and phone number.");
      return;
    }

    setSubmittingExpert(true);
    setExpertStatus("");

    try {
      const response = await fetch("/api/expert-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id,
          name,
          email,
          phone,
          company,
          notes,
          project_brief: project.project_brief,
          attachments: [],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Could not submit expert request");
      }

      setExpertStatus("Expert request sent successfully.");
      setPhone("");
      setCompany("");
      setNotes("");
    } catch (error) {
      console.error(error);
      setExpertStatus("Could not send expert request. Please try again.");
    } finally {
      setSubmittingExpert(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-white/50">Loading project...</p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <div className="mx-auto max-w-4xl">
          <p>Project not found.</p>

          <a
            href="/dashboard"
            className="mt-6 inline-block rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
          >
            Back to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <a
          href="/dashboard"
          className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
        >
          Back to Dashboard
        </a>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-purple-300">
            Saved Brief
          </p>

          <h1 className="mt-4 text-4xl font-black">
            {project.title || "AI Project Brief"}
          </h1>

          <p className="mt-2 text-sm text-white/40">
            {project.created_at ? formatDate(project.created_at) : "—"}
          </p>

          <div className="mt-8">
  <BriefCard text={project.project_brief} />
</div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`/dashboard/project/${project.id}/ai`}
              className="inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:opacity-90"
            >
              Continue With AI
            </a>

            <a
              href="#expert-review"
              className="inline-flex rounded-full bg-purple-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-purple-400"
            >
              Request Expert Review
            </a>
          </div>
        </div>

        <div
          id="expert-review"
          className="mt-6 rounded-3xl border border-purple-500/20 bg-purple-500/10 p-8"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-purple-300">
            Expert Review
          </p>

          <h2 className="mt-3 text-3xl font-black">
            Send this project to a Heyy Studio expert.
          </h2>

          <p className="mt-3 text-white/60">
            Your saved brief will be included automatically.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
            />

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone Number"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
            />

            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company / Brand optional"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
            />
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else our experts should know?"
            className="mt-3 min-h-28 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
          />

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submitExpertRequest}
              disabled={submittingExpert}
              className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {submittingExpert ? "Sending..." : "Send Expert Request"}
            </button>

            {expertStatus && (
              <p className="text-sm text-white/60">{expertStatus}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
