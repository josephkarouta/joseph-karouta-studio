"use client";

import { use, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import BriefCard from "@/components/brief-card";
import { CREDIT_COSTS } from "@/lib/credits/config";
import { generationFetch } from "@/lib/client/generation-request";

function getProjectQuickActions(projectBrief: string) {
  const brief = (projectBrief || "").toLowerCase();

  const isInterior =
    brief.includes("interior") ||
    brief.includes("space design") ||
    brief.includes("furniture") ||
    brief.includes("material") ||
    brief.includes("lighting") ||
    brief.includes("fitout") ||
    brief.includes("fit-out") ||
    brief.includes("floor plan");

  const isArchitecture =
    brief.includes("architecture") ||
    brief.includes("architectural") ||
    brief.includes("facade") ||
    brief.includes("massing") ||
    brief.includes("building") ||
    brief.includes("spatial planning");

  const isEvent =
    brief.includes("event") ||
    brief.includes("activation") ||
    brief.includes("exhibition") ||
    brief.includes("festival") ||
    brief.includes("booth") ||
    brief.includes("stage");

  const isWebsite =
    brief.includes("website") ||
    brief.includes("landing page") ||
    brief.includes("web design") ||
    brief.includes("ui") ||
    brief.includes("ux") ||
    brief.includes("digital product");

  const isBranding =
    brief.includes("brand") ||
    brief.includes("branding") ||
    brief.includes("identity") ||
    brief.includes("logo") ||
    brief.includes("visual identity") ||
    brief.includes("packaging");

  if (isInterior) {
    return [
      "Create interior moodboard",
      "Suggest material palette",
      "Develop furniture direction",
      "Create lighting concept",
      "Suggest layout improvements",
    ];
  }

  if (isArchitecture) {
    return [
      "Create architecture concept",
      "Suggest facade directions",
      "Develop spatial planning ideas",
      "Create massing concept",
      "Prepare architecture next steps",
    ];
  }

  if (isEvent) {
    return [
      "Create event key visual ideas",
      "Suggest stage design directions",
      "Develop signage concepts",
      "Create social media asset ideas",
      "Prepare event branding checklist",
    ];
  }

  if (isWebsite) {
    return [
      "Suggest website structure",
      "Create homepage section ideas",
      "Write landing page copy direction",
      "Suggest UI design direction",
      "Prepare website next steps",
    ];
  }

  if (isBranding) {
    return [
      "Generate logo concepts",
      "Create brand identity directions",
      "Suggest colour palette ideas",
      "Write tagline options",
      "Prepare brand guidelines outline",
    ];
  }

  return [
    "Give me 5 creative directions",
    "Create a moodboard direction",
    "Suggest next steps",
    "Prepare expert brief",
  ];
}

type ProjectMessage = {
  id: number;
  project_id: number;
  role: "user" | "assistant";
  message: string;
  created_at: string;
};

export default function AIWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const supabase = createSupabaseBrowserClient();

  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState("");
  const [project, setProject] = useState<any>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
const [generatedImages, setGeneratedImages] = useState<string[]>([]);
const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    async function loadWorkspace() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      const token = sessionData.session?.access_token || "";

      if (!currentUser || !token) {
        window.location.href = "/login";
        return;
      }

      setUser(currentUser);
      setAccessToken(token);

      const response = await fetch("/api/project-ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "load",
          project_id: Number(id),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        console.error(data.error);
        setLoading(false);
        return;
      }

      setProject(data.project);
      setMessages(data.messages || []);
      setLoading(false);
    }

    loadWorkspace();
  }, [id]);

  async function sendMessage() {
    if (!input.trim() || !user || !accessToken || sending) return;

    const userMessage: ProjectMessage = {
      id: Date.now(),
      project_id: Number(id),
      role: "user",
      message: input.trim(),
      created_at: new Date().toISOString(),
    };

    const currentInput = input.trim();

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    const wantsImage =
  currentInput.toLowerCase().includes("generate") ||
  currentInput.toLowerCase().includes("moodboard") ||
  currentInput.toLowerCase().includes("image") ||
  currentInput.toLowerCase().includes("visual") ||
  currentInput.toLowerCase().includes("logo concept");

if (wantsImage) {
  await generateImage(`${currentInput}. Based on this project brief: ${project?.project_brief || ""}`);
  setSending(false);
  return;
}

    try {
      const response = await fetch("/api/project-ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "send",
          project_id: Number(id),
          message: currentInput,
        }),
      });

      const data = await response.json();

      if (!data.success) {
  const isUpgradeRequired = data.error === "Upgrade required";
  const isLimitReached = data.error?.includes("monthly AI chat limit");

  setMessages((prev) => [
    ...prev,
    {
      id: Date.now() + 1,
      project_id: Number(id),
      role: "assistant",
      message: isUpgradeRequired
        ? "To continue with AI, please choose a Starter or Pro plan. You can upgrade from the pricing section."
        : isLimitReached
        ? data.error
        : "Something went wrong. Please try again.",
      created_at: new Date().toISOString(),
    },
  ]);

  return;
}

setMessages((prev) => [...prev, data.message]);
    } catch (error: any) {
  console.error(error);

  const isUpgradeRequired =
    error?.message === "Upgrade required";

  setMessages((prev) => [
    ...prev,
    {
      id: Date.now() + 1,
      project_id: Number(id),
      role: "assistant",
      message: isUpgradeRequired
        ? "To continue with AI, please choose a Starter or Pro plan. You can upgrade from the pricing section."
        : "Something went wrong. Please try again.",
      created_at: new Date().toISOString(),
    },
  ]);
} finally {
      setSending(false);
    }
  }

async function generateImage(prompt: string) {
  if (!user || !project || !accessToken || generatingImage) return;

  setGeneratingImage(true);

  try {
    const response = await generationFetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        project_id: Number(id),
        prompt,
      }),
    }, {
      scope: "legacy-project-ai-image",
      payload: { projectId: Number(id), prompt },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          project_id: Number(id),
          role: "assistant",
          message:
            data.error ||
            `This visual needs ${CREDIT_COSTS.textToImagePreview} credits. Add credits or try again.`,
          created_at: new Date().toISOString(),
        },
      ]);

      return;
    }

    const jobId = String(data.jobId || "");
    if (!jobId) throw new Error("Image generation returned no job identifier.");

    let completed: any = null;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const statusResponse = await fetch(
        `/api/tools/text-to-image/status?job=${encodeURIComponent(jobId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
      );
      const statusPayload = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(statusPayload.error || "Could not check image status.");
      if (statusPayload.status === "succeeded") {
        completed = statusPayload;
        break;
      }
      if (statusPayload.status === "failed") {
        throw new Error(statusPayload.error || "Image generation failed. Your credits were returned.");
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    if (!completed?.imageUrl) {
      throw new Error("Image generation is still processing. Check the Assets Library shortly.");
    }

    setMessages((prev) => [
  ...prev,
  {
      id: Date.now(),
      project_id: Number(id),
      role: "assistant",
      message: `[IMAGE]${completed.imageUrl}`,
    created_at: new Date().toISOString(),
  },
]);
  } catch (error) {
    console.error(error);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        project_id: Number(id),
        role: "assistant",
        message: "Could not generate image. Please try again.",
        created_at: new Date().toISOString(),
      },
    ]);
  } finally {
    window.dispatchEvent(new Event("heyy:credits-changed"));
    setGeneratingImage(false);
  }
}

  function cleanBrief(text: string) {
    return text
      ?.replace("📋 PROJECT BRIEF", "")
      ?.replace("PROJECT BRIEF", "")
      ?.trim();
  }

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#f8f7fb", color: "#6c00ff" }}
      >
        Loading AI workspace...
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
            Workspace unavailable
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
      className="heyy-ai-workspace min-h-screen"
      style={{
        backgroundColor: "#f8f7fb",
        color: "#17151f",
        colorScheme: "light",
      }}
    >
      <style>{`
        .heyy-ai-workspace,
        .heyy-ai-workspace * { box-sizing: border-box; }

        .heyy-ai-workspace a { text-decoration: none; }

        .heyy-ai-shell {
          max-width: 1500px;
          margin: 0 auto;
          padding: 20px 24px 44px;
        }

        .heyy-ai-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid #d8c7f4;
          border-radius: 28px;
          background: linear-gradient(135deg,#ffffff 0%,#f5efff 58%,#e7d7ff 100%);
          padding: 26px 30px;
          box-shadow: 0 18px 42px rgba(70,38,111,.10);
        }

        .heyy-ai-surface {
          border: 1px solid #dfd8e8;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 12px 30px rgba(35,24,51,.055);
        }

        .heyy-ai-chat {
          min-height: 470px;
          max-height: 60vh;
          overflow-y: auto;
          border: 1px solid #e2dbea;
          border-radius: 20px;
          background: linear-gradient(180deg,#fbf9ff 0%,#f6f5f8 100%);
          padding: 16px;
        }

        .heyy-ai-message {
          max-width: 86%;
          border-radius: 19px;
          padding: 14px 16px;
          font-size: 14px;
          line-height: 1.75;
          white-space: pre-wrap;
        }

        .heyy-ai-message[data-role="user"] {
          margin-left: auto;
          background: linear-gradient(135deg,#5b00d6,#7c18ff);
          color: #fff;
          box-shadow: 0 10px 22px rgba(108,0,255,.18);
        }

        .heyy-ai-message[data-role="assistant"] {
          border: 1px solid #ddd5e7;
          background: #fff;
          color: #4b4453;
        }

        .heyy-ai-prompt {
          border: 1px solid #ded8e7;
          border-radius: 999px;
          background: #fff;
          color: #564e60;
          padding: 9px 13px;
          font-size: 11px;
          font-weight: 800;
          transition: all 180ms ease;
        }

        .heyy-ai-prompt:hover {
          transform: translateY(-1px);
          border-color: #8f52ff;
          background: #f2e9ff;
          color: #5b00d6;
        }

        .heyy-ai-input {
          min-width: 0;
          flex: 1;
          min-height: 52px;
          border: 1px solid #dcd5e5;
          border-radius: 17px;
          background: #fff;
          color: #17151f;
          padding: 0 16px;
          outline: none;
        }

        .heyy-ai-input:focus {
          border-color: #7c2cff;
          box-shadow: 0 0 0 4px rgba(124,44,255,.12);
        }

        @media (max-width: 720px) {
          .heyy-ai-shell { padding: 12px 12px 30px; }
          .heyy-ai-hero { padding: 22px 19px; }
          .heyy-ai-message { max-width: 96%; }
        }
      `}</style>

      <div className="heyy-ai-shell">
        <section className="heyy-ai-hero">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
                Heyy Studio AI
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                AI Workspace
              </h1>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                Develop ideas, creative directions and visual concepts from your
                saved project brief.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={`/dashboard/project/${project.id}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-violet-300 bg-white px-5 text-sm font-black text-violet-700 transition hover:border-violet-600 hover:bg-violet-600 hover:text-white"
              >
                ← Back to Brief
              </a>

              <a
                href="/dashboard"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-violet-600"
              >
                Dashboard
              </a>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="heyy-ai-surface p-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:self-start xl:overflow-y-auto">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-100 text-blue-700">
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
              </span>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Saved Brief
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {project.title || "AI Project Brief"}
                </h2>
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-blue-100 bg-blue-50/50 p-3">
              <BriefCard text={project.project_brief} />
            </div>
          </aside>

          <section className="heyy-ai-surface flex min-h-[760px] flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
                  Continue With AI
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">
                  Develop this project
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Ask for strategy, visual direction, copy, concepts or next steps.
                </p>
              </div>

              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-violet-600 text-white">
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
                  <path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5z" />
                </svg>
              </span>
            </div>

            <div className="heyy-ai-chat mt-5 flex-1 space-y-4">
              {messages.length === 0 && (
                <div className="rounded-[18px] border border-violet-200 bg-violet-50 p-5">
                  <p className="font-black text-violet-800">
                    Start from your saved brief.
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Try asking for five creative directions, a premium moodboard
                    direction or a practical set of next steps.
                  </p>
                </div>
              )}

              {messages.map((item) => (
                <div
                  key={`${item.id}-${item.created_at}`}
                  className={`flex ${
                    item.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className="heyy-ai-message"
                    data-role={item.role}
                  >
                    {item.message.startsWith("[IMAGE]") ? (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImage(
                              item.message.replace("[IMAGE]", ""),
                            )
                          }
                          className="block w-full"
                        >
                          <img
                            src={item.message.replace("[IMAGE]", "")}
                            alt="Generated visual concept"
                            className="w-full cursor-pointer rounded-[14px]"
                          />
                        </button>

                        <div className="flex flex-wrap gap-2">
                          <a
                            href={item.message.replace("[IMAGE]", "")}
                            download="heyy-studio-concept.png"
                            className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-violet-600"
                          >
                            Download
                          </a>

                          <button
                            type="button"
                            onClick={() =>
                              generateImage(
                                `Create a new variation of this visual concept. Keep it aligned with the same project brief: ${
                                  project?.project_brief || ""
                                }`,
                              )
                            }
                            className="inline-flex rounded-full border border-violet-300 bg-white px-4 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-600 hover:text-white"
                          >
                            Generate Variation · {CREDIT_COSTS.textToImagePreview} credits
                          </button>
                        </div>
                      </div>
                    ) : (
                      item.message
                    )}

                    {item.message.includes(
                      "please choose a Starter or Pro plan",
                    ) && (
                      <div className="mt-4">
                        <a
                          href="/#pricing"
                          className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-600"
                        >
                          View Plans
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(sending || generatingImage) && (
                <div className="flex items-center gap-3 rounded-full bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-violet-600" />
                  {generatingImage
                    ? "Heyy Studio is creating your visual concept..."
                    : "Heyy Studio AI is thinking..."}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {getProjectQuickActions(
                (() => {
                  const meaningfulUserMessages = messages
                    .filter((item) => item.role === "user")
                    .map((item) => item.message.toLowerCase())
                    .filter(
                      (message) =>
                        !message.includes("thank") &&
                        !message.includes("nice") &&
                        !message.includes("generate") &&
                        !message.includes("moodboard") &&
                        !message.includes("variation") &&
                        !message.includes("image"),
                    );

                  const latestDirection =
                    meaningfulUserMessages[meaningfulUserMessages.length - 1];

                  return latestDirection || project?.project_brief || "";
                })(),
              ).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    if (
                      prompt.toLowerCase().includes("generate") ||
                      prompt.toLowerCase().includes("moodboard")
                    ) {
                      void generateImage(
                        `${prompt}. Based on this project brief: ${
                          project?.project_brief || ""
                        }`,
                      );
                      return;
                    }

                    setInput(prompt);
                  }}
                  className="heyy-ai-prompt"
                >
                  {prompt}{(prompt.toLowerCase().includes("generate") || prompt.toLowerCase().includes("moodboard")) ? ` · ${CREDIT_COSTS.textToImagePreview} credits` : ""}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void sendMessage();
                  }
                }}
                placeholder="Ask AI to develop this project..."
                className="heyy-ai-input"
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="rounded-[17px] bg-slate-950 px-6 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-600 disabled:opacity-40"
              >
                {/generate|moodboard|image|visual|logo concept/i.test(input) ? `Generate · ${CREDIT_COSTS.textToImagePreview} credits` : "Send"}
              </button>
            </div>
          </section>
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-6 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="absolute right-6 top-6 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950"
          >
            ✕
          </button>

          <div className="max-w-5xl">
            <img
              src={selectedImage}
              alt="Generated concept preview"
              className="max-h-[80vh] w-auto rounded-[20px]"
            />

            <a
              href={selectedImage}
              download="heyy-studio-concept.png"
              className="mt-4 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-600 hover:text-white"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
