"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function PricingButtons() {
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    setLoading(null);
    const resetLoading = () => setLoading(null);
    window.addEventListener("pageshow", resetLoading);
    window.addEventListener("focus", resetLoading);

    return () => {
      window.removeEventListener("pageshow", resetLoading);
      window.removeEventListener("focus", resetLoading);
    };
  }, []);

  async function handleSubscribe(planName: "starter" | "pro") {
    try {
      setLoading(planName);

      const { data } = await supabase.auth.getUser();
      const userEmail = data.user?.email || "";
      const userId = data.user?.id || "";

      if (!userId) {
        window.location.href = "/login?redirect=/#pricing";
        return;
      }

      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail,
          userId,
          planName,
        }),
      });

      const payload = await response.json();

      if (response.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }

      throw new Error(payload.error || "Checkout could not be opened.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setLoading(null);
    }
  }

  function openFreeWorkspace() {
    window.location.href = "/signup";
  }

  return (
    <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
      <PlanCard
        eyebrow="Explore"
        title="Free"
        price="$0"
        description="Explore Heyy Studio, save one active project and test the guided workflows."
        features={[
          "30 one-time welcome credits",
          "1 active project",
          "Guided Studio workflows",
          "Saved project workspace",
        ]}
        buttonLabel="Start Free"
        onClick={openFreeWorkspace}
      />

      <PlanCard
        eyebrow="Most Popular"
        title="Starter"
        price="$35"
        description="For creators and small businesses building real projects with regular AI generation."
        features={[
          "1,500 monthly credits",
          "10 active projects",
          "Brand and Architecture workflows",
          "Standard image generations",
        ]}
        buttonLabel={
          loading === "starter" ? "Opening Checkout..." : "Choose Starter"
        }
        onClick={() => handleSubscribe("starter")}
        disabled={loading === "starter"}
        featured
      />

      <PlanCard
        eyebrow="Professional"
        title="Pro"
        price="$99"
        description="For professionals who need deeper workflows, more projects and heavier generation usage."
        features={[
          "5,000 monthly credits",
          "50 active projects",
          "Professional workflow controls",
          "High-quality generation access",
        ]}
        buttonLabel={loading === "pro" ? "Opening Checkout..." : "Choose Pro"}
        onClick={() => handleSubscribe("pro")}
        disabled={loading === "pro"}
      />
    </div>
  );
}

function PlanCard({
  eyebrow,
  title,
  price,
  description,
  features,
  buttonLabel,
  onClick,
  disabled = false,
  featured = false,
}: {
  eyebrow: string;
  title: string;
  price: string;
  description: string;
  features: string[];
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-[2rem] border p-8 ${
        featured
          ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/12 shadow-2xl shadow-purple-950/20"
          : "border-white/15 bg-white/5"
      }`}
    >
      <p
        className={`text-sm uppercase tracking-[0.3em] ${
          featured ? "text-[#C4B5FD]" : "text-white/45"
        }`}
      >
        {eyebrow}
      </p>

      <h3 className="mt-4 text-4xl font-black">{title}</h3>

      <p className="mt-2 text-3xl font-black">
        {price}
        {price !== "$0" && (
          <span className="text-lg font-normal text-white/50">/month</span>
        )}
      </p>

      <p className="mt-4 text-white/60">{description}</p>

      <ul className="mt-8 space-y-3 text-white/80">
        {features.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-8 inline-flex w-fit rounded-full px-6 py-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-50 ${
          featured
            ? "bg-white text-black hover:bg-purple-200"
            : "border border-white/20 text-white hover:bg-white hover:text-black"
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
