"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  ImageIcon,
  Loader2,
  Megaphone,
  Presentation,
  Send,
  Sofa,
  Sparkles,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { cx } from "@/components/ui/heyy";

type AssistantAction = {
  label: string;
  href: string;
  kind?: "primary" | "secondary";
};

type AssistantReply = {
  answer: string;
  route?: string;
  routeLabel?: string;
  actions?: AssistantAction[];
  suggestions?: string[];
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  actions?: AssistantAction[];
  suggestions?: string[];
};

const quickStarts = [
  { label: "Create a brand", icon: WandSparkles },
  { label: "Plan an interior", icon: Sofa },
  { label: "Build a campaign", icon: Megaphone },
  { label: "Generate an image", icon: ImageIcon },
];

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "What would you like to create today? Describe the outcome in your own words and I’ll guide you to the best Studio, AI tool or expert workflow.",
  suggestions: quickStarts.map((item) => item.label),
};

export default function HeyyAssistant() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hidden = useMemo(
    () => pathname.startsWith("/admin") || pathname === "/login" || pathname === "/signup",
    [pathname],
  );

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener("heyy-assistant-open", openAssistant);
    return () => window.removeEventListener("heyy-assistant-open", openAssistant);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (hidden) return null;

  async function sendMessage(value: string) {
    const content = value.trim();
    if (!content || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: nextMessages.slice(-8).map(({ role, content: text }) => ({ role, content: text })),
          signedIn: Boolean(user),
        }),
      });
      const data = (await response.json()) as AssistantReply & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to reach Heyy AI.");

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          actions: data.actions,
          suggestions: data.suggestions,
        },
      ]);
    } catch {
      const fallback = localRoute(content, Boolean(user));
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fallback.answer,
          actions: fallback.actions,
          suggestions: fallback.suggestions,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "fixed bottom-5 right-5 z-[70] flex h-14 items-center gap-2 rounded-full border border-white/20 bg-[linear-gradient(135deg,#6f2dff,#d83cb8)] px-4 font-black text-white shadow-[0_22px_55px_rgba(93,37,183,.35)] transition hover:-translate-y-1 hover:shadow-[0_28px_65px_rgba(93,37,183,.46)]",
          open && "pointer-events-none scale-90 opacity-0",
        )}
        aria-label="Open Heyy AI"
      >
        <Sparkles size={18} />
        <span className="hidden sm:inline">Ask Heyy AI</span>
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Heyy AI assistant"
          className="fixed inset-x-3 bottom-3 z-[80] flex max-h-[min(720px,calc(100vh-24px))] flex-col overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-[0_35px_110px_rgba(25,12,45,.32)] backdrop-blur-3xl sm:left-auto sm:right-5 sm:w-[430px]"
        >
          <header className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,#2d1152_0%,#6f2dff_50%,#d83cb8_100%)] p-5 text-white">
            <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full border-[22px] border-white/10" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-xl">
                  <Bot size={21} />
                </span>
                <div>
                  <p className="text-sm font-black">Heyy AI</p>
                  <p className="mt-0.5 text-xs font-semibold text-white/70">
                    Creative guide & platform router
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/20"
                aria-label="Close assistant"
              >
                <X size={17} />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="heyy-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.map((message) => (
              <div key={message.id} className={cx("flex", message.role === "user" && "justify-end")}>
                <div className={cx("max-w-[91%]", message.role === "user" && "text-right")}>
                  <div
                    className={cx(
                      "inline-block rounded-2xl px-4 py-3 text-left text-sm font-semibold leading-6",
                      message.role === "assistant"
                        ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                        : "bg-[var(--button-primary)] text-[var(--button-primary-text)]",
                    )}
                  >
                    {message.content}
                  </div>

                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 grid gap-2 text-left">
                      {message.actions.map((action) => (
                        <Link
                          key={`${message.id}-${action.href}`}
                          href={action.href}
                          className={cx(
                            "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-xs font-black transition",
                            action.kind === "primary"
                              ? "border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
                              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]",
                          )}
                        >
                          {action.label} <ArrowRight size={14} />
                        </Link>
                      ))}
                    </div>
                  )}

                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-left">
                      {message.suggestions.slice(0, 4).map((suggestion) => (
                        <button
                          key={`${message.id}-${suggestion}`}
                          type="button"
                          onClick={() => void sendMessage(suggestion)}
                          className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-[0.7rem] font-black text-[var(--accent-strong)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-strong)]"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="grid grid-cols-2 gap-2">
                {quickStarts.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => void sendMessage(label)}
                    className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"
                  >
                    <Icon size={17} className="text-[var(--accent-strong)]" />
                    <span className="mt-3 text-xs font-black text-[var(--text-primary)]">{label}</span>
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                <Loader2 size={15} className="animate-spin text-[var(--accent)]" />
                Finding the clearest next step…
              </div>
            )}
          </div>

          <form onSubmit={submit} className="border-t border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-2 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--focus-ring)]">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                rows={1}
                placeholder="Tell me what you need…"
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-40"
                aria-label="Send message"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="mt-2 text-center text-[0.62rem] font-semibold text-[var(--text-muted)]">
              AI guidance may be imperfect. Review important project decisions.
            </p>
          </form>
        </section>
      )}
    </>
  );
}

function localRoute(message: string, signedIn: boolean): AssistantReply {
  const text = message.toLowerCase();
  const guard = signedIn ? "" : " Sign in first so your work can be saved to your workspace.";
  const route = (label: string, href: string, answer: string): AssistantReply => ({
    answer: `${answer}${guard}`,
    actions: [
      { label: signedIn ? `Open ${label}` : "Sign in to continue", href: signedIn ? href : `/login?next=${encodeURIComponent(href)}`, kind: "primary" },
      { label: "View all Studios", href: "/#studios", kind: "secondary" },
    ],
    suggestions: ["What will it create?", "How do credits work?"],
  });

  if (/interior|room|furniture|lighting|kitchen|bathroom/.test(text)) {
    return route("Interior Design Studio", "/interior-studio", "Interior Design Studio is the clearest fit for layouts, materials, furniture, lighting and room concepts.");
  }
  if (/architect|house|building|floor plan|site|facade/.test(text)) {
    return route("Architecture Studio", "/architecture-studio", "Architecture Studio is the best place to develop a site, brief, plan assumptions, materials and concept visuals.");
  }
  if (/campaign|marketing|social|ads|content|launch/.test(text)) {
    return route("Marketing Studio", "/marketing-studio", "Marketing Studio can turn your objective into campaign strategy, audience angles, channels, content and a production brief.");
  }
  if (/brand|logo|identity|packag|business card/.test(text)) {
    return route("Brand Studio", "/brand-studio", "Brand Studio will structure the strategy, voice, visual direction, identity and practical applications.");
  }
  if (/adapt|resize|all sizes|key visual|campaign sizes|digital sizes|social sizes|banner sizes/.test(text)) {
    return route("Digital Adaptations", "/tools/digital-adaptations", "Digital Adaptations turns one approved key visual into coordinated social, web and display sizes while protecting the campaign identity.");
  }
  if (/video|animate|motion/.test(text)) {
    return route("Image to Video", "/tools/image-to-video", "Image to Video is best when you already have a still image and want controlled movement, camera direction and a short clip.");
  }
  if (/upscale|resolution|enhance|blurry/.test(text)) {
    return route("AI Upscaler", "/tools/ai-upscaler", "AI Upscaler is the fastest route for increasing resolution and recovering image detail.");
  }
  if (/powerpoint|presentation|deck|slides/.test(text)) {
    return route("PowerPoint Generator", "/tools/powerpoint-generator", "PowerPoint Generator will structure the story, create slide content and export an editable presentation.");
  }
  if (/image|picture|visual|render/.test(text)) {
    return route("Text to Image", "/tools/text-to-image", "Text to Image is the direct tool for producing a visual from a written prompt.");
  }
  if (/price|plan|credit|billing/.test(text)) {
    return {
      answer: "Plans and credits are separated from custom expert production. Every paid generation shows its credit cost before it runs.",
      actions: [{ label: "View plans & credits", href: "/pricing", kind: "primary" }],
      suggestions: ["What uses credits?", "How does expert production work?"],
    };
  }

  return {
    answer: "I can route that once I understand the outcome. Are you trying to create a brand, space, campaign, image, video or presentation?",
    suggestions: quickStarts.map((item) => item.label),
    actions: [{ label: "Explore all Studios", href: "/#studios", kind: "secondary" }],
  };
}
