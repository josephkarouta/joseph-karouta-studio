"use client";

import { useState } from "react";

type Message = {
  sender: "ai" | "user";
  text: string;
};

const firstReplies = [
  "Event Branding",
  "Restaurant Launch",
  "Campaign Design",
  "Presentation Design",
];

function AiSphere() {
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <div className="absolute h-44 w-44 animate-pulse rounded-full bg-[#FDDD00]/20 blur-3xl" />
      <div className="absolute h-32 w-32 animate-ping rounded-full bg-[#FDDD00]/10" />
      <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-white via-[#FDDD00] to-[#d8b900] shadow-2xl shadow-[#FDDD00]/40">
        <div className="absolute left-5 top-5 h-9 w-9 rounded-full bg-white/80 blur-sm" />
        <div className="absolute bottom-4 right-5 h-10 w-10 rounded-full bg-black/10 blur-md" />
      </div>
    </div>
  );
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [quickReplies, setQuickReplies] = useState(firstReplies);

  const [messages, setMessages] = useState<Message[]>([
  {
    sender: "ai",
    text: "👋 Hi, I'm Joseph AI Creative Director. What are you looking to create today?",
  },
]);

const generateResponse = (input: string) => {
  const lower = input.toLowerCase();

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

  return "Tell me more about your project.";
};

  const sendMessage = (text?: string) => {
    const finalMessage = text || message;
    if (!finalMessage.trim()) return;

    const aiText = generateResponse(finalMessage);

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: finalMessage },
      { sender: "ai", text: aiText },
    ]);

    setMessage("");
  };

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between bg-white/80 px-6 py-5 backdrop-blur-md md:px-12">
        <div>
          <p className="text-sm font-black tracking-[0.3em]">JOSEPH KAROUTA</p>
          <p className="text-xs uppercase tracking-[0.4em] text-black/45">Studio</p>
        </div>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#work">Work</a>
          <a href="#services">Services</a>
          <a href="#about">About</a>
        </nav>
      </header>

      <section className="flex min-h-screen flex-col items-center justify-center px-6 pb-20 pt-32">
        <AiSphere />

        <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
          What are you looking to create today?
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-black/60">
          Speak with Joseph AI Creative Director and explore ideas, strategy,
          branding, campaigns and creative direction.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
          {["Sports", "Events", "Government", "Healthcare", "Education", "Hospitality", "Retail", "Real Estate"].map(
            (industry) => (
              <span key={industry} className="rounded-full border border-black/10 px-4 py-2">
                {industry}
              </span>
            )
          )}
        </div>

        <div className="mt-10 w-full max-w-3xl rounded-[2rem] border border-black/10 bg-[#f7f7f7] p-4 shadow-2xl shadow-black/10">
          <div className="rounded-[1.5rem] bg-white p-5">
            <div className="mb-5 flex items-center gap-3 text-left">
              <div className="h-10 w-10 rounded-full bg-[#FDDD00]" />
              <div>
                <p className="font-bold">Joseph AI Creative Director</p>
                <p className="text-sm text-black/45">Online now · Friendly creative direction</p>
              </div>
            </div>

            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-2xl bg-[#fafafa] p-4">
              {messages.map((msg, index) => (
  <div key={index}>
    <div
      style={{
        backgroundColor:
          msg.sender === "ai" ? "#FFF4B8" : "#1f1f1f",
        color:
          msg.sender === "ai" ? "#000" : "#fff",
        padding: "12px 16px",
        borderRadius: "16px",
        marginBottom: "12px",
        maxWidth: "80%",
        marginLeft: msg.sender === "user" ? "auto" : "0",
      }}
    >
      {msg.text}
    </div>
  </div>
))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  onClick={() => sendMessage(reply)}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-left text-sm transition hover:border-black/30 hover:bg-[#FDDD00]"
                >
                  {reply}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-3">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Type your project idea..."
              />
              <button
                onClick={() => sendMessage()}
                className="rounded-full bg-[#1f1f1f] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#FDDD00] hover:text-black"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}