"use client";

import { useEffect, useRef, useState } from "react";

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
    <div className="relative flex h-64 w-64 items-center justify-center">
      <div className="absolute h-64 w-64 rounded-full bg-[#FDDD00]/10 blur-3xl animate-pulse" />

      <div className="absolute h-32 w-32 rounded-full bg-[#FDDD00]/20 blur-xl ai-breathe" />

      <div className="relative h-28 w-28 overflow-hidden rounded-full bg-black shadow-[0_0_80px_rgba(253,221,0,0.8)]">
        <div className="absolute inset-0 bg-[#FDDD00]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,white,transparent_35%)] opacity-80" />
        <div className="absolute left-[-20%] top-[35%] h-10 w-[140%] rotate-[-18deg] rounded-full bg-white/35 blur-sm ai-wave" />
        <div className="absolute left-[-20%] top-[52%] h-8 w-[140%] rotate-[15deg] rounded-full bg-black/20 blur-sm ai-wave-reverse" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.45),transparent)] ai-shine" />
      </div>
    </div>
  );
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [quickReplies, setQuickReplies] = useState(firstReplies);
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
  {
    sender: "ai",
    text: "👋 Hi, I'm Joseph AI Creative Director. What are you looking to create today?",
  },
]);

useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop =
      chatContainerRef.current.scrollHeight;
  }
}, [messages, isTyping]);

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

  setMessages((prev) => [
    ...prev,
    { sender: "user", text: finalMessage },
  ]);

  setMessage("");

  setIsTyping(true);

  const aiText = generateResponse(finalMessage);

  setTimeout(() => {
    setMessages((prev) => [
      ...prev,
      { sender: "ai", text: aiText },
    ]);

    setIsTyping(false);
  }, 1200);
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

      <section className="flex flex-col items-center px-6 pb-20 pt-32">
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

            <div
  ref={chatContainerRef}
  className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-2xl bg-[#fafafa] p-4"
>
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

{isTyping && (
  <div>
    <div
      style={{
        backgroundColor: "#FFF4B8",
        color: "#000",
        padding: "12px 16px",
        borderRadius: "16px",
        maxWidth: "180px",
      }}
    >
      Joseph AI is thinking...
    </div>
  </div>
)}

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

      <section id="work" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-black/40">
            Experience
          </p>

          <h2 className="max-w-4xl text-5xl font-black leading-tight">
            12+ years creating brands, events and campaigns across government,
            healthcare, retail, education and sport.
          </h2>

          <div className="mt-16 grid gap-6 md:grid-cols-4">
  <div className="rounded-[2rem] border border-black/10 bg-white p-8">
    <p className="text-5xl font-black">12+</p>
    <p className="mt-2 text-black/60">Years Experience</p>
  </div>

  <div className="rounded-[2rem] border border-black/10 bg-white p-8">
    <p className="text-5xl font-black">150+</p>
    <p className="mt-2 text-black/60">Projects Delivered</p>
  </div>

  <div className="rounded-[2rem] border border-black/10 bg-white p-8">
    <p className="text-5xl font-black">20+</p>
    <p className="mt-2 text-black/60">Industries Served</p>
  </div>

  <div className="rounded-[2rem] border border-black/10 bg-white p-8">
    <p className="text-5xl font-black">3</p>
    <p className="mt-2 text-black/60">Countries</p>
  </div>
</div>
        </div>
      </section>
      <section className="px-6 py-24">
  <div className="mx-auto max-w-6xl">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-black/40">
      Featured Projects
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      Selected work across brands, events and campaigns.
    </h2>

    <div className="mt-16 space-y-10">
      {[
        "Sheikh Mansour Bin Zayed Football Cup",
        "Reem League",
        "Dubai Airport Freezone",
        "Jabbour Restaurant",
      ].map((project) => (
        <div
          key={project}
          className="overflow-hidden rounded-[2rem] border border-black/10 bg-white"
        >
          <div className="h-[250px] bg-[#f3f3f3]" />

          <div className="p-8">
            <h3 className="text-3xl font-black">{project}</h3>

            <p className="mt-3 max-w-2xl text-black/60">
              Project case study coming soon.
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
<section id="services" className="px-6 py-24">
  <div className="mx-auto max-w-6xl">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-black/40">
      Services
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      Creative services designed to turn ideas into brands, campaigns and experiences.
    </h2>

    <div className="mt-16 grid gap-6 md:grid-cols-3">

      {[
        {
          title: "Creative Direction",
          description:
            "Strategic creative thinking, concepts and visual direction for brands and campaigns.",
        },
        {
          title: "Brand Identity",
          description:
            "Logos, visual systems, brand guidelines and complete identity design.",
        },
        {
          title: "Event Branding",
          description:
            "Key visuals, venue branding, wayfinding, signage and event experiences.",
        },
        {
          title: "Campaign Design",
          description:
            "Integrated campaigns across print, digital, social and outdoor media.",
        },
        {
          title: "Presentation Design",
          description:
            "Corporate presentations, pitch decks and executive communication materials.",
        },
        {
          title: "AI Creative Systems",
          description:
            "Combining AI workflows with design thinking to accelerate creative production.",
        },
      ].map((service) => (
        <div
          key={service.title}
          className="rounded-[2rem] border border-black/10 bg-white p-8 transition hover:-translate-y-1 hover:shadow-xl"
        >
          <h3 className="text-2xl font-black">
            {service.title}
          </h3>

          <p className="mt-4 text-black/60 leading-7">
            {service.description}
          </p>
        </div>
      ))}
    </div>
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
        Joseph Karouta is a multidisciplinary creative designer with 12+ years
        of experience creating branding, campaigns, event identities and visual
        communication systems.
      </p>

      <p>
        His work spans government, healthcare, sport, retail, education,
        hospitality and real estate, combining strategic thinking with clean,
        effective and memorable design.
      </p>

      <p>
        Joseph Karouta Studio brings together human creative direction and
        emerging AI workflows to help clients shape ideas, define scope and
        create stronger brand experiences.
      </p>
    </div>
  </div>
</section>
<section className="px-6 py-24">
  <div className="mx-auto max-w-6xl rounded-[3rem] bg-[#FDDD00] p-10 md:p-16">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-black/50">
      Start a Project
    </p>

    <h2 className="max-w-4xl text-5xl font-black leading-tight">
      Have a project in mind? Start with Joseph AI Creative Director.
    </h2>

    <p className="mt-6 max-w-2xl text-lg leading-8 text-black/70">
      Describe what you are trying to create and Joseph AI Creative Director
      will help shape your brief before Joseph reviews it personally.
    </p>

    <div className="mt-10 flex flex-wrap gap-4">
      <a
        href="#"
        className="rounded-full bg-black px-7 py-4 text-sm font-bold text-white transition hover:bg-white hover:text-black"
      >
        Start Conversation
      </a>

      <a
        href="mailto:forever.doodleau@gmail.com"
        className="rounded-full border border-black/20 px-7 py-4 text-sm font-bold text-black transition hover:bg-black hover:text-white"
      >
        Email Joseph
      </a>
    </div>
  </div>
</section>
    </main>
  );
}