"use client";

import { use, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import BriefCard from "@/components/brief-card";

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
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setUser(userData.user);

      const response = await fetch("/api/project-ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "load",
          project_id: Number(id),
          user_id: userData.user.id,
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
      setGeneratedImages((data.images || []).map((image: any) => image.image_url));
      setLoading(false);
    }

    loadWorkspace();
  }, [id]);

  async function sendMessage() {
    if (!input.trim() || !user || sending) return;

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
        },
        body: JSON.stringify({
          action: "send",
          project_id: Number(id),
          user_id: user.id,
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
  if (!user || !project || generatingImage) return;

  setGeneratingImage(true);

  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        project_id: Number(id),
        prompt,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          project_id: Number(id),
          role: "assistant",
          message:
            data.error ||
            "Image generation is available on Pro only. Upgrade to Pro to generate visual concepts.",
          created_at: new Date().toISOString(),
        },
      ]);

      return;
    }

    setGeneratedImages((prev) => [data.image_url, ...prev]);
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
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-white/50">Loading AI workspace...</p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <div className="mx-auto max-w-5xl">
          <p>Project not found.</p>

          <a
            href="/dashboard"
            className="mt-6 inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
          >
            Back to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/40">
              Heyy Studio AI
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              AI Workspace
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/dashboard/project/${project.id}`}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
            >
              Back to Brief
            </a>

            <a
              href="/dashboard"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
            >
              Dashboard
            </a>

          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <p className="text-sm uppercase tracking-[0.3em] text-purple-300">
              Saved Brief
            </p>

            <h2 className="mt-4 text-2xl font-black">
              {project.title || "AI Project Brief"}
            </h2>

            <div className="mt-6">
  <BriefCard text={project.project_brief} />
</div>
          </aside>

          <section className="flex min-h-[75vh] flex-col rounded-3xl border border-white/10 bg-white/5 p-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/40">
                Continue With AI
              </p>

              <h2 className="mt-3 text-2xl font-black">
                Ask for ideas, directions, concepts or next steps.
              </h2>
            </div>

            <div className="mt-6 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
                  <p className="font-bold text-purple-200">
                    Start from your saved brief.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Try asking: “Give me 5 creative directions”, “Create a premium moodboard direction”, or “What should I do next?”
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
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-5 py-4 text-sm leading-7 ${
                      item.role === "user"
                        ? "bg-white text-black"
                        : "border border-white/10 bg-white/5 text-white/80"
                    }`}
                  >
                    {item.message}

{item.message.includes("please choose a Starter or Pro plan") && (
  <div className="mt-4">
    <a
      href="/#pricing"
      className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-[#8B5CF6] hover:text-white"
    >
      View Plans
    </a>
  </div>
)}
                  </div>
                </div>
              ))}

              {(sending || generatingImage) && (
  <div className="flex items-center gap-3 text-sm text-white/50">
    <div className="h-3 w-3 animate-pulse rounded-full bg-purple-400" />
    {generatingImage
      ? "Heyy Studio is creating your visual concept..."
      : "Heyy Studio AI is thinking..."}
  </div>
)}

              <div ref={messagesEndRef} />
            </div>

            {generatedImages.length > 0 && (
  <div className="mt-4 grid grid-cols-1 gap-4">
    {generatedImages.map((imageUrl, index) => (
      <div
        key={`${imageUrl}-${index}`}
        className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3"
      >
        <button
          type="button"
          onClick={() => setSelectedImage(imageUrl)}
          className="block w-full"
        >
          <img
            src={imageUrl}
            alt={`Generated concept ${index + 1}`}
            className="w-full cursor-pointer rounded-xl"
          />
        </button>

        <a
          href={imageUrl}
          download={`heyy-studio-concept-${index + 1}.png`}
          className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-black hover:bg-[#8B5CF6] hover:text-white"
        >
          Download
        </a>
        <button
  type="button"
  onClick={() =>
    generateImage(
      `Create a new variation of this visual concept. Keep it aligned with the same project brief: ${
        project?.project_brief || ""
      }`
    )
  }
  className="ml-2 mt-3 inline-flex rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white hover:text-black"
>
  Generate Variation
</button>
      </div>
    ))}
  </div>
)}

<div className="mt-4 flex flex-wrap gap-2">
{getProjectQuickActions(
  `${project?.project_brief || ""} ${messages
    .filter((item) => item.role === "user")
    .slice(-3)
    .map((item) => item.message)
    .join(" ")}`
).map((prompt) => (
    <button
      key={prompt}
      onClick={() => {
  if (prompt.toLowerCase().includes("generate") || prompt.toLowerCase().includes("moodboard")) {
    generateImage(`${prompt}. Based on this project brief: ${project?.project_brief || ""}`);
    return;
  }

  setInput(prompt);
}}
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white hover:bg-white hover:text-black transition"
    >
      {prompt}
    </button>
  ))}
</div>
            <div className="mt-4 flex gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder="Ask AI to develop this project..."
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-5 py-4 text-white outline-none focus:border-purple-400"
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="rounded-full bg-white px-6 py-4 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </section>
        </div>
      </div>
      {selectedImage && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6">
    <button
      type="button"
      onClick={() => setSelectedImage(null)}
      className="absolute right-6 top-6 rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
    >
      ✕
    </button>

    <div className="max-w-5xl">
      <img
        src={selectedImage}
        alt="Generated concept preview"
        className="max-h-[80vh] w-auto rounded-2xl"
      />

      <a
        href={selectedImage}
        download="heyy-studio-concept.png"
        className="mt-4 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-black hover:bg-[#8B5CF6] hover:text-white"
      >
        Download
      </a>
    </div>
  </div>
)}
    </main>
  );
}
