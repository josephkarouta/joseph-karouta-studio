"use client";

import AuthModal from "./AuthModal";
import PricingButtons from "./PricingButtons";
import { createSupabaseBrowserClient } from "@/lib/supabase";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import BriefCard from "@/components/brief-card";

type Message = {
  sender: "ai" | "user";
  text: string;
  options?: string[];
  showContactForm?: boolean;
};

const firstReplies = [
  "Branding & Identity",
  "Website & Digital",
  "Architecture",
  "Interior Design",
];

function AiSphere({ isThinking = false }: { isThinking?: boolean }) {
  return (
    <div
      className={`relative flex h-200 w-200 items-center justify-center transition-all duration-500 ${
        isThinking ? "scale-110" : "scale-100"
      }`}
    >
      <div
  className={`absolute rounded-full blur-[120px] transition-all duration-500 ${
    isThinking
      ? "h-[620px] w-[620px] opacity-90"
      : "h-[520px] w-[520px] opacity-60"
  }`}
  style={{
    background:
      "radial-gradient(circle, rgba(255,255,255,0.20), rgba(168,85,247,0.35), rgba(59,130,246,0.22), rgba(236,72,153,0.14), transparent 70%)",
  }}
/>

      <video
  src="/ai-orb.webm"
  autoPlay
  muted
  loop
  playsInline
  className={`relative h-full w-full object-contain mix-blend-screen transition-all duration-500 ${
  isThinking ? "scale-110 brightness-125 saturate-150" : "scale-100 brightness-100 saturate-100"
}`}
/>
    </div>
  );
}

export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<any>(null);
  const supabaseClient = createSupabaseBrowserClient();

  useEffect(() => {
    supabaseClient.auth.getUser().then(async ({ data }) => {
  setUser(data.user);

  const pendingBrief = localStorage.getItem("pendingProjectBrief");

if (data.user && pendingBrief) {
    const saveResponse = await fetch("/api/save-project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: data.user.id,
        title: "AI Project Brief",
        project_brief: pendingBrief,
      }),
    });

    const saveData = await saveResponse.json();

    if (saveData.project?.id) {
      setSavedProjectId(saveData.project.id);
    }

    setProjectBrief(pendingBrief);
    setBriefGenerated(true);

    setMessages([
      {
        sender: "ai",
        text: pendingBrief,
        options: ["Continue with AI", "Get Expert Review", "Start again"],
      },
    ]);

    setTimeout(() => {
  chatContainerRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}, 400);

    localStorage.removeItem("pendingProjectBrief");
  }
});
  }, []);
  const [message, setMessage] = useState("");
  const [quickReplies, setQuickReplies] = useState(firstReplies);
  const [isTyping, setIsTyping] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [chatTopic, setChatTopic] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lockedBriefRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [questionStep, setQuestionStep] = useState(0);
  const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [phone, setPhone] = useState("");
const [company, setCompany] = useState("");
const [notes, setNotes] = useState("");
const [isSubmittingLead, setIsSubmittingLead] = useState(false);
const [files, setFiles] = useState<File[]>([]);
const [isDragging, setIsDragging] = useState(false);
const [isInputFocused, setIsInputFocused] = useState(false);
const [projectBrief, setProjectBrief] = useState("");
const [savedProjectId, setSavedProjectId] = useState<number | null>(null);
const [briefGenerated, setBriefGenerated] = useState(false);
const [discoveryStarted, setDiscoveryStarted] = useState(false);
const [waitingForCustomAnswer, setWaitingForCustomAnswer] = useState(false);
const [customAnswerMessageIndex, setCustomAnswerMessageIndex] = useState<number | null>(null);
const userMessageCount = messages.filter(
  (msg) => msg.sender === "user"
).length;

const currentStep = Math.min(userMessageCount, 5);
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  

useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop =
      chatContainerRef.current.scrollHeight;
  }
}, [messages, isTyping, briefGenerated]);

useEffect(() => {
  if (briefGenerated && !user && lockedBriefRef.current) {
    setTimeout(() => {
      lockedBriefRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 300);
  }
}, [briefGenerated, user]);

async function getUserPlan(userId: string) {
  const response = await fetch("/api/get-user-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });

  const data = await response.json();

  return data.plan || "free";
}

const generateResponse = (input: string) => {
  const lower = input.toLowerCase();
  if (
  lower === "hi" ||
  lower === "hello" ||
  lower === "hey" ||
  lower === "good morning" ||
  lower === "good afternoon"
) {
  setQuickReplies([
    "Brand Identity",
    "Website Design",
    "Event Branding",
    "Campaign Design",
  ]);

  return "Hi 👋 I'm Joseph AI Creative Director. What would you like help creating today?";
}

if (
  lower.includes("how are you")
) {
  return "Doing great, thanks for asking. I'm here to help shape your next creative project. What are you working on?";
}

if (
  lower === "thanks" ||
  lower === "thank you"
) {
  return "You're welcome. Let me know if you'd like help with branding, websites, campaigns, events or presentations.";
}

  if (chatTopic === "website") {
  setQuickReplies([
    "New Website",
    "Website Redesign",
    "Portfolio Website",
    "Landing Page",
  ]);

  return "Great. For the business website, do you need a new website, a redesign, a landing page, or a full website direction?";
}

  // START
  if (
    lower.includes("event branding") ||
    lower === "event branding"
  ) {
    setQuickReplies([
      "Sports Event",
      "Corporate Event",
      "Festival",
      "Exhibition",
      "Awards Ceremony",
      "Other",
    ]);

    return "Great choice. What type of event are you planning?";
  }

  // EVENT TYPE
  if (
    lower.includes("sports event") ||
    lower.includes("corporate event") ||
    lower.includes("festival") ||
    lower.includes("exhibition")
  ) {
    setQuickReplies([
      "Under 500",
      "500–2,000",
      "2,000–5,000",
      "5,000+",
    ]);

    return "Excellent. Approximately how many attendees are expected?";
  }

  // ATTENDEES
  if (
    lower.includes("under 500") ||
    lower.includes("500–2,000") ||
    lower.includes("2,000–5,000") ||
    lower.includes("5,000+")
  ) {
    setQuickReplies([
      "Event Identity",
      "Key Visual Design",
      "Venue Branding",
      "Social Media Assets",
      "Everything",
    ]);

    return `Based on your audience size, Joseph has worked on similar projects such as:

🏆 Sheikh Mansour Bin Zayed Football Cup

⚽ Reem League

🦅 Emirates Falconers Club

What areas would you like help with?`;
  }

  // SERVICES
  if (
    lower.includes("event identity") ||
    lower.includes("key visual") ||
    lower.includes("venue branding") ||
    lower.includes("social media assets") ||
    lower.includes("everything")
  ) {
    setQuickReplies([
      "Premium",
      "Energetic",
      "Modern",
      "Corporate",
      "Luxury",
      "Family Friendly",
    ]);

    return "What visual direction best describes your event?";
  }

  // VISUAL STYLE
  if (
    lower.includes("premium") ||
    lower.includes("energetic") ||
    lower.includes("modern") ||
    lower.includes("corporate") ||
    lower.includes("luxury") ||
    lower.includes("family")
  ) {
    setQuickReplies([
      "Yes, Contact Me",
      "Continue Exploring",
    ]);

    return `Great choice.

Based on your selections I would recommend:

✓ Event Identity

✓ Key Visual System

✓ Venue Branding

✓ Social Media Toolkit

✓ Wayfinding & Signage

Would you like Joseph to review this project personally?`;
  }

  // CONTACT
  if (
    lower.includes("yes, contact me") ||
    lower.includes("contact me")
  ) {
    setQuickReplies([]);

    return `Perfect.

Please leave your:

• Name
• Email
• Phone Number

and Joseph will review your project personally.`;
  }

  if (
  lower.includes("logo") ||
  lower.includes("brand") ||
  lower.includes("identity")
) {
  setQuickReplies([
    "Logo Design",
    "Full Brand Identity",
    "Brand Guidelines",
    "Brand Refresh",
  ]);

  return "Absolutely. Are you looking for a logo only, or a full brand identity system?";
}

if (
  lower.includes("website") ||
  lower.includes("web")
) {
  setChatTopic("website");

  setQuickReplies([
    "Portfolio Website",
    "Business Website",
    "Landing Page",
    "Website Redesign",
  ]);

  return "Yes, Joseph can help shape the website direction. Is this for a personal brand, business, campaign or service?";
}

if (
  lower.includes("presentation") ||
  lower.includes("deck") ||
  lower.includes("proposal")
) {
  setQuickReplies([
    "Pitch Deck",
    "Company Profile",
    "Proposal Design",
    "Sales Presentation",
  ]);

  return "Great. What type of presentation do you need, and who is the audience?";
}

if (
  lower.includes("social") ||
  lower.includes("instagram") ||
  lower.includes("tiktok")
) {
  setQuickReplies([
    "Social Media Templates",
    "Campaign Posts",
    "Launch Content",
    "Content Direction",
  ]);

  return "Nice. Are you looking for social media design, content direction, or a campaign system?";
}

setQuickReplies([
  "Brand Identity",
  "Campaign Design",
  "Website Direction",
  "Presentation Design",
]);

setQuickReplies([
  "Brand Identity",
  "Website Design",
  "Event Branding",
  "Campaign Design",
]);

return "Tell me a little more about what you're trying to create and I'll point you in the right direction.";
};

  const sendMessage = async (text?: string) => {
  const finalMessage = text || message;

  if (!finalMessage.trim()) return;
  if (
  finalMessage.toLowerCase().trim() === "something else" ||
  finalMessage.toLowerCase().trim() === "other"
) {
  setWaitingForCustomAnswer(true);

  const lastAiIndex = messages
    .map((msg, index) => ({ msg, index }))
    .filter((item) => item.msg.sender === "ai")
    .at(-1)?.index;

  setCustomAnswerMessageIndex(lastAiIndex ?? null);
  setMessage("");
  return;
}

if (finalMessage.toLowerCase().trim() === "continue with ai") {
  if (!user) {
    setShowAuth(true);
    return;
  }

  const plan = await getUserPlan(user.id);

  if (plan === "free") {
  if (savedProjectId) {
    localStorage.setItem(
      "afterSubscribeRedirect",
      `/dashboard/project/${savedProjectId}/ai`
    );
  }

  document.getElementById("pricing")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  return;
}

  if (savedProjectId) {
    window.location.href = `/dashboard/project/${savedProjectId}/ai`;
    return;
  }

  window.location.href = "/dashboard";
  return;
}

  if (finalMessage.toLowerCase().trim() === "start again") {
  setMessages([]);
  setFiles([]);
  setMessage("");
  setName("");
  setEmail("");
  setPhone("");
  setCompany("");
  setNotes("");
  setShowContactForm(false);
  setBriefGenerated(false);
  setDiscoveryStarted(false);
  return;
}
  setDiscoveryStarted(true);

  if (waitingForCustomAnswer) {
  setWaitingForCustomAnswer(false);
  setCustomAnswerMessageIndex(null);
}

  const userMessage: Message = {
    sender: "user",
    text: finalMessage,
  };

  const updatedMessages = [...messages, userMessage];
  const recentMessages = updatedMessages.slice(-8);
  const userMessageCount = updatedMessages.filter(
  (msg) => msg.sender === "user"
).length;
setQuestionStep(Math.min(Math.max(userMessageCount - 1, 0), 5));

const forceSummary = userMessageCount >= 6;
const messagesToSend = forceSummary ? updatedMessages : recentMessages;

  setMessages(updatedMessages);
  setMessage("");
  setIsTyping(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  messages: messagesToSend.map((msg) => ({
    role: msg.sender === "user" ? "user" : "assistant",
    content: msg.text,
  })),
  forceSummary,
  userId: user?.id || null,
}),
    });

    const data = await response.json();
    if (data.message?.includes("PROJECT BRIEF")) {
  setBriefGenerated(true);
}

    const clickedExpertReview =
  finalMessage.toLowerCase().trim() === "get expert review";

const shouldShowContactForm = clickedExpertReview;

if (shouldShowContactForm) {
  setShowContactForm(true);
}

if (forceSummary && data.message) {
  setProjectBrief(data.message);
  localStorage.setItem("pendingProjectBrief", data.message);

  const { data: userData } = await supabaseClient.auth.getUser();

  if (userData.user) {
    const saveResponse = await fetch("/api/save-project", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    user_id: userData.user.id,
    title: "AI Project Brief",
    project_brief: data.message,
  }),
});

const saveData = await saveResponse.json();

if (saveData.project?.id) {
  setSavedProjectId(saveData.project.id);
}
  }
}

setMessages((prev) => [
  ...prev,
  {
    sender: "ai",
    text:
  clickedExpertReview
    ? "Perfect. Please leave your details below and a Heyy Studio expert will review your project."
    : data.message || "Something went wrong. Please try again.",
    options: data.options || [],
    showContactForm: shouldShowContactForm,
  },
]);

  } catch (error) {
    console.error(error);

    setMessages((prev) => [
      ...prev,
      {
        sender: "ai",
        text: "Something went wrong. Please try again.",
      },
    ]);
  }

  setIsTyping(false);
};
const addFiles = (selectedFiles: File[]) => {
  const validFiles = selectedFiles.filter((file) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `⚠️ ${file.name} is too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB.`,
        },
      ]);

      return false;
    }

    return true;
  });

  setFiles((prev) => [...prev, ...validFiles]);
};
const submitLead = async () => {
  if (!name.trim() || !email.trim() || !phone.trim()) {
    setMessages((prev) => [
      ...prev,
      {
        sender: "ai",
        text: "Please add your name, email and phone number before sending.",
      },
    ]);
    return;
  }

  try {
    setIsSubmittingLead(true);

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const safeName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, "-")
        .replace(/-+/g, "-");

      const fileName = `${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from("project-files")
        .upload(fileName, file);

      if (error) {
        console.error(error);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-files").getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    const currentBrief =
      projectBrief ||
      messages
        .filter((msg) => msg.text.includes("PROJECT BRIEF"))
        .map((msg) => msg.text)
        .join("\n");

    const { data: userData } = await supabaseClient.auth.getUser();

    const response = await fetch("/api/expert-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userData.user?.id || null,
        name,
        email,
        phone,
        company,
        notes,
        attachments: uploadedUrls,
        project_brief: currentBrief,
      }),
    });

    const data = await response.json();

    if (data.success) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "✅ Thank you. Your expert request has been received. Our team will review your brief and get back to you shortly.",
        },
      ]);

      setName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setNotes("");
      setFiles([]);
      setShowContactForm(false);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Something went wrong while sending your request. Please try again.",
        },
      ]);
    }
  } catch (error) {
    console.error(error);

    setMessages((prev) => [
      ...prev,
      {
        sender: "ai",
        text: "Something went wrong while sending your request. Please try again.",
      },
    ]);
  } finally {
    setIsSubmittingLead(false);
  }
};

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between bg-black/30 border-b border-white/5 px-6 py-5 backdrop-blur-md md:px-12">
        <div>
          <p className="text-sm font-black tracking-[0.3em]">HEYY STUDIO</p>
          <p className="text-xs uppercase tracking-[0.4em] text-white/45">
  AI + Experts
          </p>
        </div>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#work">Projects</a>
          <a href="#experts">Experts</a>
          <a href="#services">Services</a>
          <a href="#pricing">Pricing</a>{user ? <a href="/dashboard" className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-white hover:bg-white hover:text-black transition-all duration-200">Dashboard</a> : <button onClick={() => setShowAuth(true)} className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-white hover:bg-white hover:text-black">Sign In</button>}
          
        </nav>
      </header>

      <section className="relative min-h-screen overflow-hidden px-6 pb-16 pt-0">
        <div
  className="absolute inset-0 -z-10"
  style={{
    background:
      "radial-gradient(circle at center, rgba(168,85,247,0.18) 0%, rgba(59,130,246,0.10) 30%, rgba(236,72,153,0.08) 55%, transparent 75%)",
  }}
/>

  <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
    <div className="-mt-32">
  <AiSphere isThinking={isTyping} />
</div>

    <h1 className="-mt-40 relative z-10 max-w-3xl text-6xl font-black leading-[0.9] tracking-tight md:text-8xl">
      What are you looking to create today?
    </h1>

    <p className="mt-6 max-w-xl text-center text-xl leading-8 text-white/60">
  Create ideas, concepts and project briefs with AI. Continue with AI tools or connect with expert professionals.
</p>

{!briefGenerated && (
<div className="mx-auto mt-4 max-w-md">
  <div className="mb-2 flex justify-between text-xs text-white/40">
    <span>Project Discovery</span>
    <span>{Math.min(Math.max(questionStep, 0), 5)}/5</span>
  </div>

  <div className="h-2 overflow-hidden rounded-full bg-white/10">
    <div
      className="h-full rounded-full bg-[#8B5CF6] transition-all duration-500"
      style={{
        width: `${(Math.min(Math.max(questionStep, 0), 5) / 5) * 100}%`,
      }}
    />
  </div>
</div>
)}
    <div className="mt-6 w-full max-w-6xl">
  <div>

        <div
          ref={chatContainerRef}
          className={`mx-auto flex w-full flex-col gap-3 overflow-y-auto p-4 ${
  briefGenerated ? "max-h-[620px] max-w-6xl" : "max-h-72 max-w-4xl"
}`}
        >
          {messages.map((msg, index) => (
            <div key={index}>
              <div
                style={{
  backgroundColor: msg.text.includes("PROJECT BRIEF")
    ? "transparent"
    : msg.sender === "ai"
    ? "#201A2E"
    : "#1f1f1f",
  color: "#fff",
  padding: msg.text.includes("PROJECT BRIEF") ? "0" : "12px 16px",
  borderRadius: "16px",
  marginBottom: "12px",
  maxWidth: msg.text.includes("PROJECT BRIEF") ? "100%" : "80%",
  marginLeft: msg.sender === "user" ? "auto" : "0",
  width: msg.text.includes("PROJECT BRIEF") ? "100%" : "auto",
}}
              >
                <div className="whitespace-pre-line">
  <div className="whitespace-pre-line text-left">
  {msg.text.includes("PROJECT BRIEF") ? (
  user ? (
    <BriefCard text={msg.text} />
  ) : (
    <div
  ref={lockedBriefRef}
  className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#120B1F] p-8 text-left"
>
      <div className="pointer-events-none select-none blur-sm opacity-40">
        <BriefCard text={msg.text} />
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-black/80 p-8 text-center shadow-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-[#A78BFA]">
            Brief Ready
          </p>

          <h3 className="mt-4 text-3xl font-black text-white">
            Sign in to unlock your project brief.
          </h3>

          <p className="mt-4 text-sm leading-6 text-white/60">
            Your AI-generated brief is ready. Sign in to view it, save it, continue with AI or request expert review.
          </p>

          <button
            type="button"
            onClick={() => setShowAuth(true)}
            className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-[#8B5CF6] hover:text-white"
          >
            Sign in to unlock
          </button>
        </div>
      </div>
    </div>
  )
) : (
  msg.text
)}
</div>
</div>
                {msg.sender === "ai" &&
  msg.options &&
  msg.options.length > 0 &&
  index === messages.length - 1 && (
    <div className="mt-3 flex flex-wrap gap-2">
      {msg.options.map((option, optionIndex) => {
  const isCustomOption =
    option.toLowerCase() === "something else" ||
    option.toLowerCase() === "other";

  const isSelectedCustomOption =
    waitingForCustomAnswer &&
    customAnswerMessageIndex === index &&
    isCustomOption;

  return (
    <button
      key={`${option}-${optionIndex}`}
      onClick={() => sendMessage(option)}
      disabled={isSelectedCustomOption}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        isSelectedCustomOption
          ? "border-[#8B5CF6] bg-[#8B5CF6] text-white"
          : "border-white/15 bg-white/5 text-white hover:bg-white hover:text-black"
      }`}
    >
      {isSelectedCustomOption ? "Type your answer below ↓" : option}
    </button>
  );
})}
    </div>
)}
              </div>
            </div>
          ))}

          {isTyping && (
            <div>
              <div className="flex items-center gap-3">
  <div className="h-3 w-3 animate-pulse rounded-full bg-[#8B5CF6]"></div>

  <span className="text-sm text-white/60">
    Analyzing project...
  </span>
</div>
            </div>
          )}
          {showContactForm && (
  <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-left">
    <p className="mb-4 text-sm text-white/60">
      Leave your details and a Heyy Studio expert will get back to you.
    </p>

    <div className="grid gap-3 md:grid-cols-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full Name"
        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none"
      />

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email Address"
        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none"
      />

      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone Number"
        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none"
      />

      <input
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company / Brand (optional)"
        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none"
      />
    </div>

    <textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      placeholder="Anything else our experts should know?"
      className="mt-3 min-h-28 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none"
    />

    <button
      onClick={submitLead}
      disabled={isSubmittingLead}
      className="mt-4 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-[#8B5CF6] hover:text-white disabled:opacity-50"
    >
      {isSubmittingLead ? "Sending..." : "Send Project"}
    </button>
  </div>
)}
        </div>
        {files.length > 0 && (
  <p className="mx-auto mb-2 max-w-6xl text-xs text-white/50">
    {files.length} file{files.length > 1 ? "s" : ""} selected
  </p>
)}
{files.length > 0 && (
  <div className="mx-auto mb-3 flex max-w-6xl flex-wrap gap-2">
    {files.map((file, index) => (
      <div
        key={`${file.name}-${index}`}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70"
      >
        <span>📎 {file.name}</span>

        <button
          type="button"
          onClick={() => {
            setFiles((prev) => prev.filter((_, i) => i !== index));
          }}
          className="text-white/40 transition hover:text-white"
        >
          ×
        </button>
      </div>
    ))}
  </div>
)}
<div
  id="start-project"
  onDragOver={(e) => {
    e.preventDefault();
    setIsDragging(true);
  }}
  onDragLeave={() => setIsDragging(false)}
  onDrop={(e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }}
  className={`mx-auto mt-6 flex max-w-6xl items-center gap-3 rounded-full border px-4 py-3 shadow-xl shadow-black/40 backdrop-blur-xl transition ${
    isDragging || isInputFocused
  ? "border-purple-400 bg-purple-500/20"
  : "border-white/10 bg-white/5"
  }`}
>

<label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white transition hover:bg-white hover:text-black">
  📎
  <input
    type="file"
    multiple
    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
    className="hidden"
    onChange={(e) => {
  if (!e.target.files) return;

  addFiles(Array.from(e.target.files));

  e.target.value = "";
}}
  />
</label>
          <input
            value={message}
            disabled={briefGenerated}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            className="w-full bg-transparent text-base text-white outline-none"
            placeholder={
  briefGenerated
    ? "Project brief completed. Choose an option above."
    : waitingForCustomAnswer
    ? "Type your custom answer..."
    : "Describe your brand, website, interior, architecture or creative idea..."
}
          />
          <button
  onClick={() => sendMessage()}
  disabled={briefGenerated}
  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1f1f1f] text-xl text-white transition hover:bg-white hover:text-black disabled:opacity-50"
>
  ↑
</button>
        </div>

        {!discoveryStarted && !briefGenerated && (
  <div className="mt-4 grid gap-3 md:grid-cols-4">
    {quickReplies.map((reply) => (
      <button
        key={reply}
        onClick={() => sendMessage(reply)}
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white transition hover:border-[#8B5CF6]/50 hover:bg-white hover:text-black"
      >
        {reply}
      </button>
    ))}
  </div>
)}

        
      </div>
    </div>
  </div>
</section>

<section className="border-t border-white/10 px-6 py-24 text-white">
  <div className="mx-auto max-w-6xl">

    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/35">
      How It Works
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      Start with AI. Continue with experts when you need them.
    </h2>

    <div className="mt-16 grid gap-6 md:grid-cols-3">

      <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          Step 01
        </p>

        <h3 className="mt-4 text-2xl font-black">
          Describe Your Project
        </h3>

        <p className="mt-4 text-white/50 leading-7">
          Tell Heyy Studio AI what you want to create, whether it's a brand, website, interior space, architectural concept or event.
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          Step 02
        </p>

        <h3 className="mt-4 text-2xl font-black">
          Build Your Brief
        </h3>

        <p className="mt-4 text-white/50 leading-7">
          AI asks smart questions, shapes your requirements and generates a structured project brief with recommendations.
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          Step 03
        </p>

        <h3 className="mt-4 text-2xl font-black">
          Continue Your Way
        </h3>

        <p className="mt-4 text-white/50 leading-7">
          Keep creating with AI tools and subscriptions or connect with a human expert for professional support.
        </p>
      </div>

    </div>
  </div>
</section>

      <section id="work" className="border-t border-white/10 px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-black/40">
            Collective Experience
          </p>

          <h2 className="max-w-4xl text-5xl font-black leading-tight">
            10+ years of creative, architecture and interior design experience across brands, spaces and digital projects.
          </h2>

<div className="mt-16 grid gap-6 md:grid-cols-4">
  <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
    <p className="text-5xl font-black">10+</p>
    <p className="mt-2 text-white/50">Years Experience</p>
  </div>

  <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
    <p className="text-5xl font-black">200+</p>
    <p className="mt-2 text-white/50">Projects Delivered</p>
  </div>

  <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
    <p className="text-5xl font-black">3</p>
    <p className="mt-2 text-white/50">Core Disciplines</p>
  </div>

  <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
    <p className="text-5xl font-black">AI</p>
    <p className="mt-2 text-white/50">Powered Workflow</p>
  </div>
</div>

        </div>
      </section>
      <section className="border-t border-white/10 px-6 py-24 text-white">
  <div className="mx-auto max-w-6xl">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/35">
      Featured Projects
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      Selected work across creative, architecture and interior design.
    </h2>

    <div className="mt-12 space-y-14">
      {[
        {
          number: "01",
          category: "Sports Event Branding",
          title: "Sheikh Mansour Bin Zayed Football Cup",
          image: "/projects/sheikh-mansour.jpg",
          description:
            "A large-scale football event identity with a premium sports visual system.",
        },
        {
          number: "02",
          category: "Retail Activation",
          title: "The Reem League",
          image: "/projects/reem-league.jpg",
          description:
            "A vibrant football activation created for Reem Mall during the World Cup season.",
        },
        {
          number: "03",
          category: "Education Campaign",
          title: "Sorbonne Abu Dhabi",
          image: "/projects/sorbonne.jpg",
          description:
            "An open day campaign designed to promote student discovery and campus engagement.",
        },
        {
          number: "04",
          category: "Restaurant Branding",
          title: "Jabbour Lebanese Restaurant",
          image: "/projects/jabbour.jpg",
          description:
            "A hospitality campaign celebrating authentic Lebanese taste and tradition.",
        },
      ].map((project, index) => (
        <div
          key={project.title}
          className={`grid items-center gap-10 ${
            index % 2 === 1 ? "md:grid-cols-[0.85fr_1.15fr]" : "md:grid-cols-[1.15fr_0.85fr]"
          }`}
        >
          <div className={`${index % 2 === 1 ? "md:order-2" : ""}`}>
            <div className="overflow-hidden rounded-[2rem] bg-[#f3f3f3]">
              <img
                src={project.image}
                alt={project.title}
                className="h-[340px] w-full object-cover transition duration-700 hover:scale-105"
              />
            </div>
          </div>

          <div className={`${index % 2 === 1 ? "md:order-1" : ""}`}>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/35">
              {project.number} / {project.category}
            </p>

            <h3 className="mt-5 text-4xl font-black leading-tight">
              {project.title}
            </h3>

            <p className="mt-5 text-lg leading-8 text-white/50">
              {project.description}
            </p>

            <button className="mt-8 rounded-full border border-white/15 px-6 py-3 text-sm font-bold transition hover:bg-white hover:text-black">
              View Case Study
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

<section id="experts" className="border-t border-white/10 px-6 py-24 text-white">
  <div className="mx-auto max-w-6xl">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/35">
      Experts
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      Continue with AI or connect with the right expert for your project.
    </h2>

    <div className="mt-16 grid gap-6 md:grid-cols-3">
      {[
        {
          title: "Creative Expert",
          description:
            "Branding, identity systems, campaigns, websites, presentations and visual direction.",
        },
        {
          title: "Architecture Expert",
          description:
            "Architectural concepts, spatial planning, residential, commercial and early-stage design support.",
        },
        {
          title: "Interior Design Expert",
          description:
            "Interior concepts, material palettes, furniture direction, moodboards and space styling.",
        },
      ].map((expert) => (
        <div
          key={expert.title}
          className="rounded-[2rem] border border-white/15 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-white/30"
        >
          <h3 className="text-2xl font-black">{expert.title}</h3>

          <p className="mt-4 leading-7 text-white/50">
            {expert.description}
          </p>

          <button className="mt-8 rounded-full border border-white/15 px-5 py-3 text-sm font-bold transition hover:bg-white hover:text-black">
            Get Expert Review
          </button>
        </div>
      ))}
    </div>
  </div>
</section>

<section id="services" className="border-t border-white/10 px-6 py-24 text-white">
  <div className="mx-auto max-w-6xl">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-black/40">
      Services
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      AI-powered creative and spatial services designed to turn ideas into brands, interiors, architecture and experiences.
    </h2>

    <div className="mt-16 grid gap-6 md:grid-cols-3">

      {[
  {
    title: "Branding & Identity",
    description:
      "Logo systems, visual identity, brand direction and complete creative foundations.",
  },
  {
    title: "Website & Digital",
    description:
      "Website direction, landing pages, digital experiences and AI-assisted content structure.",
  },
  {
    title: "Architecture Concepts",
    description:
      "Early-stage spatial thinking, concept development, planning ideas and visual references.",
  },
  {
    title: "Interior Design",
    description:
      "Interior concepts, material palettes, furniture direction, moodboards and space styling.",
  },
  {
    title: "Events & Experiences",
    description:
      "Event branding, activations, spatial graphics, wayfinding and campaign environments.",
  },
  {
    title: "AI Creative Tools",
    description:
      "AI-assisted project discovery, idea generation, visual exploration and creative briefing.",
  },
      ].map((service) => (
        <div
          key={service.title}
          className="rounded-[2rem] border border-white/15 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-white/30"
        >
          <h3 className="text-2xl font-black">
            {service.title}
          </h3>

          <p className="mt-4 text-white/50 leading-7">
            {service.description}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>

<section id="pricing" className="border-t border-white/10 px-6 py-24 text-white">
  <div className="mx-auto max-w-6xl">

    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/35">
      Choose Your Path
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      Start with AI or work directly with an expert.
    </h2>

    <PricingButtons />
  </div>
</section>

<section id="about" className="bg-black px-6 py-24 text-white">
  <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
    <div>
      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/40">
        About
      </p>

      <h2 className="text-5xl font-black leading-tight">
        Creative direction, design thinking and AI-powered workflows.
      </h2>
    </div>

    <div className="space-y-6 text-lg leading-8 text-white/70">
      <p>
  Heyy Studio is an AI-powered creative and spatial platform built to help people shape ideas, generate directions and move projects forward.
</p>

<p>
  The studio connects AI discovery tools with expert support across branding, websites, architecture, interior design and experiences.
</p>

<p>
  Users can explore ideas with AI, generate concepts, build project briefs and choose to continue with AI tools or connect with a human expert.
</p>
    </div>
  </div>
</section>
<section className="border-t border-white/10 px-6 py-24 text-white">
  <div className="mx-auto max-w-6xl rounded-[3rem] bg-[#8B5CF6] p-10 md:p-16">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-black/50">
      Start a Project
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      Have an idea in mind? Start with Heyy Studio AI.
    </h2>

    <p className="mt-6 max-w-2xl text-lg leading-8 text-black/70">
      Describe what you are trying to create and Heyy Studio AI will help shape your brief before you choose to continue with AI or connect with an expert.
    </p>

    <div className="mt-10 flex flex-wrap gap-4">
      <a
        href="#"
        className="rounded-full bg-black px-7 py-4 text-sm font-bold text-white transition hover:bg-white hover:text-black"
      >
        Start with AI
      </a>

      <a
        href="mailto:forever.doodleau@gmail.com"
        className="rounded-full border border-black/20 px-7 py-4 text-sm font-bold text-black transition hover:bg-black hover:text-white"
      >
        Contact the Studio
      </a>
    </div>
  </div>
</section>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </main>
  );
}