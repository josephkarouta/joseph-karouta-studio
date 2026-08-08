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
      setName(
        userData.user.user_metadata?.full_name ||
          userData.user.user_metadata?.name ||
          "",
      );

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

    void loadProject();
  }, [id]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("en-US", {
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
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#f8f7fb", color: "#6c00ff" }}
      >
        Loading project...
      </main>
    );
  }

  if (!project) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={{ backgroundColor: "#f8f7fb", color: "#17151f" }}
      >
        <div className="max-w-md rounded-[26px] border border-violet-200 bg-white p-7 text-center shadow-xl shadow-violet-900/10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
            Project unavailable
          </p>
          <h1 className="mt-3 text-3xl font-black">Project not found.</h1>
          <a
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-600"
          >
            Back to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      className="heyy-project-detail min-h-screen"
      style={{
        backgroundColor: "#f8f7fb",
        color: "#17151f",
        colorScheme: "light",
      }}
    >
      <style>{`
        .heyy-project-detail,
        .heyy-project-detail * { box-sizing: border-box; }

        .heyy-project-detail a { text-decoration: none; }

        .heyy-project-shell {
          max-width: 1320px;
          margin: 0 auto;
          padding: 28px 24px 60px;
        }

        .heyy-project-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid #d8c7f4;
          border-radius: 28px;
          background: linear-gradient(135deg,#ffffff 0%,#f5efff 58%,#e7d7ff 100%);
          padding: 28px 30px;
          box-shadow: 0 18px 42px rgba(70,38,111,.10);
        }

        .heyy-project-surface {
          border: 1px solid #dfd8e8;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 12px 30px rgba(35,24,51,.055);
        }

        .heyy-project-input {
          width: 100%;
          min-height: 48px;
          border: 1px solid #ded8e7;
          border-radius: 14px;
          background: #fff;
          color: #17151f;
          padding: 0 14px;
          outline: none;
          transition: all 180ms ease;
        }

        .heyy-project-input:focus,
        .heyy-project-textarea:focus {
          border-color: #7c2cff;
          box-shadow: 0 0 0 4px rgba(124,44,255,.12);
        }

        .heyy-project-textarea {
          width: 100%;
          min-height: 130px;
          border: 1px solid #ded8e7;
          border-radius: 14px;
          background: #fff;
          color: #17151f;
          padding: 14px;
          outline: none;
          resize: vertical;
          transition: all 180ms ease;
        }

        @media (max-width: 700px) {
          .heyy-project-shell { padding: 14px 12px 38px; }
          .heyy-project-hero { padding: 23px 20px; }
        }
      `}</style>

      <div className="heyy-project-shell">
        <section className="heyy-project-hero">
          <a
            href="/dashboard"
            className="text-sm font-black text-slate-500 transition hover:text-violet-600"
          >
            ← Back to Dashboard
          </a>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
                Saved Project Brief
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                {project.title || "AI Project Brief"}
              </h1>

              <p className="mt-3 text-sm text-slate-500">
                {project.created_at ? formatDate(project.created_at) : "—"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={`/dashboard/project/${project.id}/ai`}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-600"
              >
                Continue With AI →
              </a>

              <a
                href="#expert-review"
                className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-violet-300 bg-white px-5 text-sm font-black text-violet-700 transition hover:-translate-y-0.5 hover:border-violet-600 hover:bg-violet-600 hover:text-white"
              >
                Request Expert Review
              </a>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="heyy-project-surface p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-100 text-blue-700">
                <BriefIcon />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Project Content
                </p>
                <h2 className="mt-1 text-xl font-black">Your Saved Brief</h2>
              </div>
            </div>

            <div className="mt-5 rounded-[20px] border border-blue-100 bg-blue-50/50 p-3">
              <BriefCard text={project.project_brief} />
            </div>
          </section>

          <aside
            id="expert-review"
            className="heyy-project-surface border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 sm:p-6 xl:sticky xl:top-5 xl:self-start"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-amber-400 text-amber-950">
                <ExpertIcon />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-700">
                  Expert Support
                </p>
                <h2 className="mt-1 text-xl font-black">Request Expert Review</h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-600">
              Send this saved brief to the Heyy Studio production team. Your
              project brief is included automatically.
            </p>

            <div className="mt-5 grid gap-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Full Name"
                className="heyy-project-input"
              />

              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email Address"
                className="heyy-project-input"
              />

              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone Number"
                className="heyy-project-input"
              />

              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Company / Brand optional"
                className="heyy-project-input"
              />

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything else our experts should know?"
                className="heyy-project-textarea"
              />
            </div>

            <button
              type="button"
              onClick={submitExpertRequest}
              disabled={submittingExpert}
              className="mt-4 min-h-[50px] w-full rounded-[15px] bg-slate-950 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-600 disabled:cursor-wait disabled:opacity-50"
            >
              {submittingExpert ? "Sending..." : "Send Expert Request →"}
            </button>

            {expertStatus && (
              <p
                className={`mt-3 rounded-2xl p-3 text-xs font-bold ${
                  expertStatus.includes("successfully")
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {expertStatus}
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function BriefIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 12h5M10 16h5" />
    </svg>
  );
}

function ExpertIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 4.5 7v5c0 4.7 3 7.4 7.5 9 4.5-1.6 7.5-4.3 7.5-9V7z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
