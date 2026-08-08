"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/heyy";
import type { PlanId } from "@/lib/platform/plans";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function PricingAction({ planId, current }: { planId: PlanId; current?: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    if (planId === "free" || current) return;
    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await createSupabaseBrowserClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planName: planId }),
      });
      const result = await response.json();

      if (response.status === 409 && result.manageBilling) {
        window.location.href = "/billing";
        return;
      }

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Checkout could not be opened.");
      }
      window.location.href = result.url;
    } catch (value) {
      setError(value instanceof Error ? value.message : "Checkout could not be opened.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-7">
      <Button
        type="button"
        onClick={checkout}
        disabled={current || loading}
        variant={current ? "secondary" : "primary"}
        className="w-full"
      >
        {loading && <LoaderCircle size={16} className="animate-spin" />}
        {current
          ? "Current plan"
          : planId === "free"
            ? "Included when you sign up"
            : `Choose ${planId}`}
      </Button>
      {error && <p className="mt-3 text-xs font-bold text-red-500">{error}</p>}
    </div>
  );
}
