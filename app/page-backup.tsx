"use client";

import { useState } from "react";

const prompts = [
  "I need branding for an event",
  "I am opening a restaurant",
  "I need a campaign for my business",
  "I need help building my brand",
];

export default function Home() {
  const [message, setMessage] = useState("");

const [messages, setMessages] = useState([
  {
    sender: "ai",
    text: "👋 Hi there. I'm Joseph AI Creative Director. What are you looking to create today?",
  },
]);

const handleSend = () => {
  if (!message.trim()) return;

  const userMessage = {
    sender: "user",
    text: message,
  };

  let aiResponse =
    "Tell me a little more about your project so I can guide you.";

  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("event") ||
    lowerMessage.includes("branding")
  ) {
    aiResponse =
      "Great. What type of event are you organizing? Sports Event, Corporate Event, Festival, Exhibition or Other?";
  }

  if (
    lowerMessage.includes("restaurant")
  ) {
    aiResponse =
      "Excellent. Are you looking for branding, menu design, packaging, signage or social media assets?";
  }

  if (
    lowerMessage.includes("campaign")
  ) {
    aiResponse =
      "Who is your target audience and what is the main objective of the campaign?";
  }

  setMessages((prev) => [
    ...prev,
    userMessage,
    {
      sender: "ai",
      text: aiResponse,
    },
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
          <a
            href="#ai"
            className="rounded-full bg-black px-5 py-2 text-white transition hover:bg-[#FDDD00] hover:text-black"
          >
            Chat with AI
          </a>
        </nav>
      </header>

      <section
        id="ai"
        className="flex min-h-screen flex-col items-center justify-center px-6 pb-20 pt-32 text-center md:px-12"
      >
        <div className="relative mb-10 flex h-40 w-40 items-center justify-center">
          <div className="absolute h-40 w-40 animate-ping rounded-full bg-[#FDDD00]/20" />
          <div className="absolute h-32 w-32 rounded-full bg-[#FDDD00]/40 blur-2xl" />
          <div className="relative h-28 w-28 rounded-full bg-[#FDDD00] shadow-2xl shadow-[#FDDD00]/40">
            <div className="absolute left-5 top-5 h-8 w-8 rounded-full bg-white/70 blur-sm" />
            <div className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-black/15 blur-md" />
          </div>
        </div>

        <div className="mb-5 inline-flex rounded-full bg-[#FDDD00] px-4 py-2 text-sm font-bold">
          AI-Powered Creative Direction
        </div>

        <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
          Meet Joseph AI Creative Director.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-black/60">
          Tell me what you’re trying to create, and I’ll help shape the idea,
          define the scope, explore directions and connect you with Joseph.
        </p>

        <div className="mt-8 grid w-full max-w-3xl gap-3 rounded-[2rem] border border-black/10 bg-[#f7f7f7] p-4 shadow-2xl shadow-black/10">
          <div className="flex items-center gap-3 rounded-[1.5rem] bg-white px-5 py-4 text-left">
            <div className="h-10 w-10 rounded-full bg-[#FDDD00]" />
            <div>
              <p className="font-bold">Joseph AI Creative Director</p>
              <p className="text-sm text-black/50">Online now · Friendly creative direction</p>
            </div>
          </div>

<div className="max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-white p-4">
  {messages.map((msg, index) => (
    <div
      key={index}
      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
        msg.sender === "ai"
          ? "bg-[#FDDD00] text-black"
          : "ml-auto bg-black text-white"
      }`}
    >
      {msg.text}
    </div>
  ))}
</div>

          <div className="grid gap-3 md:grid-cols-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setMessage(prompt)}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-left text-sm transition hover:border-black hover:bg-black hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Type your project idea..."
            />
            <button
  onClick={handleSend}
  className="rounded-full bg-black px-5 py-2 text-sm font-bold text-white transition hover:bg-[#FDDD00] hover:text-black"
>
  Send
</button>
          </div>
        </div>
      </section>

      <section id="work" className="px-6 py-20 md:px-12">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-black/40">
          Featured Work
        </p>
        <h2 className="max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
          Selected projects across brands, events and campaigns.
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {[
            "Sheikh Mansour bin Zayed Football Cup",
            "Reem League",
            "Jabbour Restaurant",
            "Dubai Airport Freezone",
          ].map((project) => (
            <div
              key={project}
              className="group min-h-72 rounded-[2rem] bg-black p-6 text-white transition hover:bg-[#FDDD00] hover:text-black"
            >
              <p className="text-sm uppercase tracking-[0.2em] opacity-60">
                Project
              </p>
              <h3 className="mt-28 text-2xl font-black">{project}</h3>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="bg-black px-6 py-20 text-white md:px-12">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-white/40">
          Services
        </p>
        <h2 className="max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
          Not just design files. Creative systems that help brands launch,
          communicate and grow.
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {[
            "Brand & Marketing Design",
            "Event Branding & Experiences",
            "Digital & Print Design",
            "Creative Direction",
          ].map((service) => (
            <div
              key={service}
              className="rounded-[2rem] border border-white/10 p-6"
            >
              <h3 className="text-xl font-bold">{service}</h3>
              <p className="mt-4 text-sm leading-6 text-white/55">
                Strategy, concepts and design execution tailored to your project
                goals.
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}