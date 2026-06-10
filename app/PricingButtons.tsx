"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const STARTER_PRICE_ID = "price_1TgbX1FQVAkKlXnOIIZG68y1";
const PRO_PRICE_ID = "price_1TgbXCFQVAkKlXnO5Tdvms2W";

export default function PricingButtons() {
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

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

  async function handleSubscribe(priceId: string, planName: string) {
    try {
      setLoading(planName);

      const { data } = await supabase.auth.getUser();
      const userEmail = data.user?.email || "";

      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, userEmail }),
      });

      const json = await res.json();

      if (json.url) {
        window.location.href = json.url;
        return;
      }

      alert("Something went wrong. Please try again.");
      setLoading(null);
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  function goToQuote() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="rounded-[2rem] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-[#A78BFA]">
          AI Studio
        </p>

        <h3 className="mt-4 text-4xl font-black">Starter</h3>

        <p className="mt-2 text-3xl font-black">
          A$9
          <span className="text-lg font-normal text-white/50">/month</span>
        </p>

        <p className="mt-4 text-white/60">
          Generate ideas, briefs and creative directions with AI.
        </p>

        <ul className="mt-8 space-y-3 text-white/80">
          <li>✓ AI chat</li>
          <li>✓ Project brief generator</li>
          <li>✓ Creative ideas</li>
          <li>✓ Saved briefs</li>
        </ul>

        <button
          type="button"
          onClick={() => handleSubscribe(STARTER_PRICE_ID, "starter")}
          disabled={loading === "starter"}
          className="mt-8 inline-flex w-fit rounded-full bg-white px-6 py-3 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-50"
        >
          {loading === "starter" ? "Loading..." : "Start for A$9"}
        </button>
      </div>

      <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          AI Studio
        </p>

        <h3 className="mt-4 text-4xl font-black">Pro</h3>

        <p className="mt-2 text-3xl font-black">
          A$19
          <span className="text-lg font-normal text-white/50">/month</span>
        </p>

        <p className="mt-4 text-white/60">
          More usage, advanced tools and future generation features.
        </p>

        <ul className="mt-8 space-y-3 text-white/80">
          <li>✓ Everything in Starter</li>
          <li>✓ More AI usage</li>
          <li>✓ Future image generation</li>
          <li>✓ Future file analysis</li>
        </ul>

        <button
          type="button"
          onClick={() => handleSubscribe(PRO_PRICE_ID, "pro")}
          disabled={loading === "pro"}
          className="mt-8 inline-flex w-fit rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white hover:text-black disabled:opacity-50"
        >
          {loading === "pro" ? "Loading..." : "Start Pro"}
        </button>
      </div>

      <div className="rounded-[2rem] border border-white/15 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          Expert Services
        </p>

        <h3 className="mt-4 text-4xl font-black">Custom Quote</h3>

        <p className="mt-4 text-white/60">
          Work directly with experts for branding, websites, interiors,
          architecture or events.
        </p>

        <ul className="mt-8 space-y-3 text-white/80">
          <li>✓ Human expert review</li>
          <li>✓ Custom proposal</li>
          <li>✓ Project delivery</li>
          <li>✓ Tailored scope</li>
        </ul>

        <button
          type="button"
          onClick={goToQuote}
          className="mt-8 inline-flex w-fit rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white hover:text-black"
        >
          Request Quote
        </button>
      </div>
    </div>
  );
}