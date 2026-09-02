"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  Loader2,
  Send,
  Sparkles,
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
  { label: "Which Studio should I use?", icon: Building2 },
  { label: "Find the right tool", icon: Zap },
  { label: "Help with this page", icon: Bot },
  { label: "How do credits work?", icon: Sparkles },
];

function pageLabel(pathname: string) {
  if (pathname === "/") return "the Heyy Studio homepage";
  if (pathname.startsWith("/brand-studio")) return "Brand Studio";
  if (pathname.startsWith("/marketing-studio")) return "Marketing Studio";
  if (pathname.startsWith("/architecture-studio")) return "Architecture Studio";
  if (pathname.startsWith("/interior-studio")) return "Interior Design Studio";
  if (pathname.startsWith("/tools/text-to-image")) return "Text to Image";
  if (pathname.startsWith("/tools/image-to-video")) return "Image to Video";
  if (pathname.startsWith("/tools/digital-adaptations")) return "Digital Adaptations";
  if (pathname.startsWith("/tools/ai-upscaler")) return "AI Upscaler";
  if (pathname.startsWith("/tools/powerpoint-generator")) return "PowerPoint Generator";
  if (pathname.startsWith("/tools/pdf-tools")) return "PDF Tools";
  if (pathname.startsWith("/tools/file-converter")) return "File Converter";
  if (pathname.startsWith("/tools")) return "Heyy Studio Tools";
  if (pathname.startsWith("/pricing")) return "Plans & Credits";
  if (pathname.startsWith("/billing")) return "Billing";
  if (pathname.startsWith("/account/payments")) return "Payment History";
  if (pathname.startsWith("/credits")) return "Credits";
  if (pathname.startsWith("/credit-guide")) return "Credit Guide";
  if (pathname.startsWith("/production")) return "Production";
  if (pathname.startsWith("/dashboard")) return "your workspace";
  if (pathname.startsWith("/help")) return "Help Center";
  return "";
}

function welcomeMessage(pathname: string): ChatMessage {
  const context = pageLabel(pathname);
  return {
    id: "welcome",
    role: "assistant",
    content: context
      ? `Hi! How can I help? I can help with ${context}, recommend the right Studio or tool, explain how Heyy Studio works, or guide you to the next step.`
      : "Hi! How can I help? I can recommend the right Studio or tool, explain how Heyy Studio works, or guide you through what you’re working on.",
  };
}

export default function HeyyAssistant() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(pathname)]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const latestAssistantId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant")?.id,
    [messages],
  );
  const lastMessageIsAssistant = messages[messages.length - 1]?.role === "assistant";

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
    setMessages((current) =>
      current.length === 1 && current[0]?.id === "welcome" ? [welcomeMessage(pathname)] : current,
    );
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
          currentPath: pathname,
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
      const fallback = localRoute(content, Boolean(user), pathname, nextMessages);
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
                    Your Heyy Studio assistant
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

                  {message.id === latestAssistantId &&
                    lastMessageIsAssistant &&
                    message.suggestions &&
                    message.suggestions.length > 0 && (
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
                Working out the best next step…
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
                placeholder="Ask about this page or Heyy Studio…"
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
              Heyy AI can make mistakes. Review important project and production decisions.
            </p>
          </form>
        </section>
      )}
    </>
  );
}

function localRoute(
  message: string,
  signedIn: boolean,
  currentPath: string,
  history: ChatMessage[] = [],
): AssistantReply {
  const text = message.toLowerCase();

  if (/help with this page|what is this page|what does this page do|where am i|what can i do here/.test(text)) {
    const contextual = localPageHelp(currentPath);
    if (contextual) return contextual;
  }

  if (/which studio|what studio|recommend (a )?studio|studio should i use|right studio/.test(text)) {
    return {
      answer:
        "I can choose the best Studio once I know what you’re creating. Is it mainly a brand or identity, a marketing campaign, a building or architectural concept, or an interior space?",
      suggestions: [
        "A brand or identity",
        "A marketing campaign",
        "A building or floor plan",
        "An interior space",
      ],
    };
  }

  if (/find the right tool|which tool|what tool|recommend (a )?tool|right tool/.test(text)) {
    return {
      answer:
        "Tell me the task, not the software. For example: generate an image, animate an image, resize a design, upscale an image, create a presentation, work with a PDF, or convert a file.",
      suggestions: [
        "Generate an image",
        "Animate an image",
        "Resize a design",
        "Convert a file",
      ],
    };
  }

  if (/quote|quotation|how do quotes work|expert quote/.test(text)) {
    return {
      answer:
        "Expert production is quoted separately from Heyy credits. You send the production request, Heyy reviews the scope and sends you a quote. You review it before paying; once payment is completed, the work moves into the production workflow for delivery, feedback and revisions.",
      actions: [
        {
          label: "Ask about expert production",
          href: "/contact?topic=expert-production",
          kind: "primary",
        },
      ],
      suggestions: ["When should I use an expert?", "What happens after I pay?"],
    };
  }

  const guard = signedIn ? "" : " Sign in first when you are ready to create or save account-linked work.";
  const route = (label: string, href: string, answer: string): AssistantReply => ({
    answer: `${answer}${guard}`,
    actions: [
      {
        label: signedIn ? `Open ${label}` : "Sign in to continue",
        href: signedIn ? href : `/login?next=${encodeURIComponent(href)}`,
        kind: "primary",
      },
      { label: "View all Studios", href: "/#create", kind: "secondary" },
    ],
    suggestions: ["How do credits work?", "How does expert production work?"],
  });

  if (/studio.*tool|tool.*studio|difference.*studio|difference.*tool/.test(text)) {
    return {
      answer:
        "Studios guide a larger creative project from brief to direction and production. Tools handle one focused task quickly, such as generating, adapting, upscaling, presenting or converting a file.",
      actions: [
        { label: "Explore Studios", href: "/#create", kind: "primary" },
        { label: "View all tools", href: "/tools", kind: "secondary" },
      ],
      suggestions: ["Which Studio should I use?", "Find the right tool"],
    };
  }

  if (/price|plan|credit|billing|subscription|top.?up/.test(text)) {
    return {
      answer:
        "Heyy credits cover paid AI generation. Subscription credits reset each billing period and are used before purchased credits; purchased credits do not expire. Expert production is quoted separately.",
      actions: [
        { label: "View plans & credits", href: "/pricing", kind: "primary" },
        ...(signedIn
          ? [{ label: "Open billing", href: "/billing", kind: "secondary" as const }]
          : []),
      ],
      suggestions: ["What uses credits?", "How do purchased credits work?", "How does expert production work?"],
    };
  }

  if (/invoice|receipt|payment history/.test(text)) {
    return {
      answer: signedIn
        ? "Your Heyy Studio payment records and invoice downloads are available in Payment History."
        : "Sign in to view your Heyy Studio payment records and invoice downloads.",
      actions: [
        {
          label: signedIn ? "Open Payment History" : "Sign in to continue",
          href: signedIn ? "/account/payments" : `/login?next=${encodeURIComponent("/account/payments")}`,
          kind: "primary",
        },
      ],
      suggestions: ["How does billing work?", "How do credits work?"],
    };
  }

  if (/pdf|compress|split|combine|merge|protect pdf/.test(text)) {
    return route(
      "PDF Tools",
      "/tools/pdf-tools",
      "PDF Tools is the quickest option for common PDF tasks such as compressing, splitting, combining or protecting a PDF.",
    );
  }

  if (/convert|converter|jpg.*png|png.*jpg|pdf.*image|image.*pdf|heic/.test(text)) {
    return route(
      "File Converter",
      "/tools/file-converter",
      "File Converter is the direct option for switching between supported PDF and image formats.",
    );
  }

  if (/interior|room|furniture|lighting|kitchen|bathroom/.test(text)) {
    return route(
      "Interior Design Studio",
      "/interior-studio",
      "Interior Design Studio is the clearest fit for layouts, materials, furniture, lighting and room concepts.",
    );
  }

  if (/architect|house|building|floor plan|site|facade/.test(text)) {
    return route(
      "Architecture Studio",
      "/architecture-studio",
      "Architecture Studio is the best place to develop a site, brief, plan assumptions, materials and concept visuals.",
    );
  }

  if (/campaign|marketing|social|ads|content|launch/.test(text)) {
    return route(
      "Marketing Studio",
      "/marketing-studio",
      "Marketing Studio can turn your objective into campaign strategy, audience angles, content, creative direction and production.",
    );
  }

  if (/brand|logo|identity|packag|business card/.test(text)) {
    return route(
      "Brand Studio",
      "/brand-studio",
      "Brand Studio will structure your strategy, voice, visual direction, identity concepts, applications and expert-production path.",
    );
  }

  if (/adapt|resize|all sizes|key visual|campaign sizes|digital sizes|social sizes|banner sizes/.test(text)) {
    return route(
      "Digital Adaptations",
      "/tools/digital-adaptations",
      "Digital Adaptations turns one approved creative into coordinated social, web and display sizes while protecting the campaign identity.",
    );
  }

  if (/video|animate|motion/.test(text)) {
    return route(
      "Image to Video",
      "/tools/image-to-video",
      "Image to Video is best when you already have a still image and want controlled movement and a short clip.",
    );
  }

  if (/upscale|resolution|enhance|blurry/.test(text)) {
    return route(
      "AI Upscaler",
      "/tools/ai-upscaler",
      "AI Upscaler is the fastest route for increasing image resolution and recovering detail.",
    );
  }

  if (/powerpoint|presentation|deck|slides/.test(text)) {
    return route(
      "PowerPoint Generator",
      "/tools/powerpoint-generator",
      "PowerPoint Generator helps structure content and create an editable presentation.",
    );
  }

  if (/image|picture|visual|render/.test(text)) {
    return route(
      "Text to Image",
      "/tools/text-to-image",
      "Text to Image is the direct tool for producing a visual from a written prompt.",
    );
  }

  if (/what happens after i pay|after i pay|after payment/.test(text)) {
    return {
      answer:
        "After an expert-production quote is paid, the request moves into production. That is where the job can progress through communication, deliverables, feedback, revisions and final approval.",
      actions: signedIn
        ? [{ label: "Open Production", href: "/production", kind: "primary" }]
        : [],
      suggestions: ["How do revisions work?", "When should I use an expert?"],
    };
  }

  if (/expert|professional production|final files|production/.test(text)) {
    return {
      answer:
        "Expert production is the human-production path for turning an approved concept into professional final assets. It is quoted separately before you pay.",
      actions: [
        {
          label: "Ask about expert production",
          href: "/contact?topic=expert-production",
          kind: "primary",
        },
      ],
      suggestions: ["When should I use an expert?", "How do quotes work?"],
    };
  }

  if (/tool|quick tool|what tools/.test(text)) {
    return {
      answer:
        "Heyy Studio has focused tools for image generation, video, adaptations, upscaling, presentations, PDFs and file conversion. Tell me the task and I can point you to the best one.",
      actions: [{ label: "View all tools", href: "/tools", kind: "primary" }],
      suggestions: ["Generate an image", "Resize a design", "Convert a file", "Work with a PDF"],
    };
  }

  const previousAssistant = [...history]
    .reverse()
    .find((item) => item.role === "assistant" && item.id !== "welcome");

  return {
    answer: previousAssistant
      ? "I’m not fully sure what you mean from that message. Tell me the outcome you want in one sentence and I’ll give you the clearest next step."
      : "Tell me what you want to achieve in one sentence and I’ll recommend the clearest Studio, tool or support path.",
    suggestions: ["I need help choosing where to start", "Explain how Heyy Studio works"],
  };
}

function localPageHelp(currentPath: string): AssistantReply | null {
  if (currentPath === "/") {
    return {
      answer:
        "This is the Heyy Studio homepage. Choose a specialist Studio for a larger project, use a quick tool for one focused task, compare plans and credits, or ask me where to start.",
      suggestions: ["Which Studio should I use?", "Find the right tool", "How do credits work?"],
    };
  }

  if (currentPath.startsWith("/brand-studio")) {
    return {
      answer:
        "You’re in Brand Studio. It helps develop brand strategy, voice, visual direction, identity concepts, brand applications and a path to expert finalization.",
      suggestions: ["What should I do next?", "What can Brand Studio create?", "How does expert production work?"],
    };
  }

  if (currentPath.startsWith("/marketing-studio")) {
    return {
      answer:
        "You’re in Marketing Studio. It helps shape campaign strategy, audience and messaging, content, creative directions, campaign visuals and expert production.",
      suggestions: ["What should I do next?", "Can I connect a Brand project?", "How do credits work?"],
    };
  }

  if (currentPath.startsWith("/architecture-studio")) {
    return {
      answer:
        "You’re in Architecture Studio. It supports project and site briefs, design directions, materials, plans, concept visuals and estimates. Generated work is concept guidance, not engineering or permit documentation.",
      suggestions: ["What should I do next?", "What can Architecture Studio create?", "What needs professional review?"],
    };
  }

  if (currentPath.startsWith("/interior-studio")) {
    return {
      answer:
        "You’re in Interior Design Studio. It supports room direction, materials, furniture and layout thinking, visuals and an expert-production path.",
      suggestions: ["What should I do next?", "Can I connect an Architecture project?", "How do credits work?"],
    };
  }

  if (currentPath.startsWith("/tools/text-to-image")) {
    return {
      answer:
        "Text to Image turns a written prompt into a visual. It is best for a focused image-generation task when you do not need a full Studio project.",
      suggestions: ["Help me write a prompt", "Which Studio should I use instead?", "How do credits work?"],
    };
  }

  if (currentPath.startsWith("/tools/image-to-video")) {
    return {
      answer:
        "Image to Video adds motion to an existing still image. Use it when you already have the visual and want a short animated result.",
      suggestions: ["What kind of image works best?", "How do credits work?", "Find another tool"],
    };
  }

  if (currentPath.startsWith("/tools/digital-adaptations")) {
    return {
      answer:
        "Digital Adaptations takes an existing creative and adapts it into coordinated sizes or aspect families for different digital placements.",
      suggestions: ["What should I upload?", "How do credits work?", "Find another tool"],
    };
  }

  if (currentPath.startsWith("/tools/ai-upscaler")) {
    return {
      answer:
        "AI Upscaler improves image resolution and detail. Use it when the image is already right but needs a cleaner or larger output.",
      suggestions: ["Should I use 2× or 4×?", "How do credits work?", "Find another tool"],
    };
  }

  if (currentPath.startsWith("/tools/powerpoint-generator")) {
    return {
      answer:
        "PowerPoint Generator helps turn your content into an editable presentation. It is a focused tool rather than a full Studio project.",
      suggestions: ["What should I prepare first?", "How do credits work?", "Find another tool"],
    };
  }

  if (currentPath.startsWith("/tools/pdf-tools")) {
    return {
      answer:
        "PDF Tools handles common PDF tasks such as compression, splitting, combining and protection. It is designed for quick file work rather than creative generation.",
      suggestions: ["How does the free allowance work?", "Convert a file instead", "Find another tool"],
    };
  }

  if (currentPath.startsWith("/tools/file-converter")) {
    return {
      answer:
        "File Converter switches between supported PDF and image formats. Choose the output format and Heyy Studio detects the source type for you.",
      suggestions: ["How does the free allowance work?", "Work with a PDF instead", "Find another tool"],
    };
  }

  if (currentPath.startsWith("/pricing")) {
    return {
      answer:
        "This page compares Heyy Studio plans and credit options. AI generation uses Heyy credits, while expert production is quoted separately.",
      suggestions: ["How do credits work?", "Do purchased credits expire?", "What is included with a plan?"],
    };
  }

  if (currentPath.startsWith("/billing")) {
    return {
      answer:
        "This is your billing area for subscription management and related account billing actions. I can explain the rules, but I cannot read or change your live billing account from this chat.",
      suggestions: ["How do subscription credits work?", "Where are my invoices?", "How do purchased credits work?"],
    };
  }

  if (currentPath.startsWith("/account/payments")) {
    return {
      answer:
        "This is Payment History, where your Heyy Studio payment records and invoice downloads are kept. I can explain the page, but I cannot inspect a specific payment from this chat.",
      suggestions: ["How do invoices work?", "How does billing work?", "How do credits work?"],
    };
  }

  if (currentPath.startsWith("/credits")) {
    return {
      answer:
        "This is your Credits area. It shows credit activity and helps you understand how Heyy credits are used. I can explain the rules, but I cannot read your live balance from this chat.",
      suggestions: ["Do purchased credits expire?", "Which credits are used first?", "What uses credits?"],
    };
  }

  if (currentPath.startsWith("/tools")) {
    return {
      answer:
        "You’re in Heyy Studio Tools. These are focused utilities for one task at a time, including generation, video, adaptations, upscaling, presentations, PDFs and file conversion.",
      suggestions: ["Find the right tool", "Studio or tool?", "How do credits work?"],
    };
  }

  if (currentPath.startsWith("/dashboard")) {
    return {
      answer:
        "You’re in your Heyy Studio workspace. This is where your projects and connected work come together. I can guide you around the platform, but I cannot inspect private project data from this chat yet.",
      suggestions: ["Which Studio should I use?", "Find the right tool", "How does expert production work?"],
    };
  }

  if (currentPath.startsWith("/help")) {
    return {
      answer:
        "You’re in the Help Center. Use it for product guidance and support information, or ask me a question and I’ll point you to the right place.",
      suggestions: ["How do credits work?", "How does expert production work?", "Find the right tool"],
    };
  }

  return null;
}
