"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  sender: "ai" | "user";
  text: string;
  options?: string[];
  showContactForm?: boolean;
};

const firstReplies = [
  "Event Branding",
  "Restaurant Launch",
  "Campaign Design",
  "Presentation Design",
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
  const [message, setMessage] = useState("");
  const [quickReplies, setQuickReplies] = useState(firstReplies);
  const [isTyping, setIsTyping] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [chatTopic, setChatTopic] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);

useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop =
      chatContainerRef.current.scrollHeight;
  }
}, [messages, isTyping]);

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

  const userMessage: Message = {
    sender: "user",
    text: finalMessage,
  };

  const updatedMessages = [...messages, userMessage];
  const recentMessages = updatedMessages.slice(-8);

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
        messages: recentMessages.map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        })),
      }),
    });

    const data = await response.json();

    const shouldShowContactForm =
  data.showContactForm ||
  finalMessage.toLowerCase().includes("yes, contact me");

if (shouldShowContactForm) {
  setShowContactForm(true);
}

setMessages((prev) => [
  ...prev,
  {
    sender: "ai",
    text:
      data.message ||
      "Perfect. Please leave your details below and Joseph will review your project personally.",
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

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between bg-black/30 border-b border-white/5 px-6 py-5 backdrop-blur-md md:px-12">
        <div>
          <p className="text-sm font-black tracking-[0.3em]">JOSEPH KAROUTA</p>
          <p className="text-xs uppercase tracking-[0.4em] text-white/45">Studio</p>
        </div>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#work">Work</a>
          <a href="#services">Services</a>
          <a href="#about">About</a>
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
  Describe your idea. Joseph AI will guide the rest.
</p>

    <div className="mt-6 w-full max-w-6xl">
  <div>

        <div
          ref={chatContainerRef}
          className="mx-auto flex max-h-72 max-w-4xl flex-col gap-3 overflow-y-auto p-4"
        >
          {messages.map((msg, index) => (
            <div key={index}>
              <div
                style={{
                  backgroundColor: msg.sender === "ai" ? "#201A2E" : "#1f1f1f",
                  color: "#fff",
                  padding: "12px 16px",
                  borderRadius: "16px",
                  marginBottom: "12px",
                  maxWidth: "80%",
                  marginLeft: msg.sender === "user" ? "auto" : "0",
                }}
              >
                {msg.text}
                {msg.sender === "ai" &&
  msg.options &&
  msg.options.length > 0 && (
    <div className="mt-3 flex flex-wrap gap-2">
      {msg.options.map((option) => (
        <button
          key={option}
          onClick={() => sendMessage(option)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white hover:text-black"
        >
          {option}
        </button>
      ))}
    </div>
)}
              </div>
            </div>
          ))}

          {isTyping && (
            <div>
              <div
                style={{
                  backgroundColor: "#201A2E",
                  color: "#fff",
                  padding: "12px 16px",
                  borderRadius: "16px",
                  maxWidth: "180px",
                }}
              >
                Joseph AI is thinking...
              </div>
            </div>
          )}
          {showContactForm && (
  <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-left">
    <p className="mb-4 text-sm text-white/60">
      Leave your details and Joseph will get back to you.
    </p>

    <div className="grid gap-3 md:grid-cols-2">
      <input
        placeholder="Full Name"
        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
      />

      <input
        placeholder="Email Address"
        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
      />

      <input
        placeholder="Phone Number"
        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
      />

      <input
        placeholder="Company / Brand (optional)"
        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
      />
    </div>

    <textarea
      placeholder="Anything else Joseph should know?"
      className="mt-3 min-h-28 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
    />

    <button className="mt-4 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-[#8B5CF6] hover:text-white">
      Send Project
    </button>
  </div>
)}
        </div>

<div className="mx-auto mt-6 flex max-w-6xl items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur-xl">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            className="w-full bg-transparent text-base text-white outline-none"
            placeholder="Describe your project, event, campaign or business idea..."
          />
          <button
  onClick={() => sendMessage()}
  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1f1f1f] text-xl text-white transition hover:bg-white hover:text-black hover:text-black"
>
  ↑
</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => sendMessage(reply)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white transition hover:border-[#8B5CF6]/50 hover:bg-white hover:text-black hover:text-black"
            >
              {reply}
            </button>
          ))}
        </div>

        
      </div>
    </div>
  </div>
</section>

      <section id="work" className="border-t border-white/10 px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-black/40">
            Experience
          </p>

          <h2 className="max-w-4xl text-5xl font-black leading-tight">
            12+ years creating brands, events and campaigns across government,
            healthcare, retail, education and sport.
          </h2>

<div className="mt-16 grid gap-6 md:grid-cols-4">
  <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
    <p className="text-5xl font-black">12+</p>
    <p className="mt-2 text-white/50">Years Experience</p>
  </div>

  <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
    <p className="text-5xl font-black">150+</p>
    <p className="mt-2 text-white/50">Projects Delivered</p>
  </div>

  <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
    <p className="text-5xl font-black">20+</p>
    <p className="mt-2 text-white/50">Industries Served</p>
  </div>

  <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
    <p className="text-5xl font-black">3</p>
    <p className="mt-2 text-white/50">Countries</p>
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
      Selected work across brands, events and campaigns.
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
<section id="services" className="border-t border-white/10 px-6 py-24 text-white">
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
<section className="border-t border-white/10 px-6 py-24 text-white">
  <div className="mx-auto max-w-6xl rounded-[3rem] bg-[#8B5CF6] p-10 md:p-16">
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