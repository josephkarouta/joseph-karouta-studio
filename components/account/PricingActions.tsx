"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/heyy";
import { normalizePlan, PLANS, type PlanId } from "@/lib/platform/plans";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const PLAN_ORDER: Record<PlanId, number> = { free: 0, starter: 1, pro: 2 };

export default function PricingAction({ planId, current, featured }: { planId: PlanId; current?: boolean; featured?: boolean }) {
  const { plan, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentPlan = normalizePlan(plan);
  const definition = PLANS.find((item) => item.id === planId) || PLANS[0];
  const isUpgrade = PLAN_ORDER[planId] > PLAN_ORDER[currentPlan];

  async function checkout() {
    if (current) {
      window.location.href = planId === "free" ? "/credits" : "/billing";
      return;
    }
    if (planId === "free") {
      window.location.href = user ? "/credits" : "/signup";
      return;
    }
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
    <div>
      <Button
        type="button"
        onClick={checkout}
        disabled={loading}
        variant={current || (Boolean(user) && !isUpgrade) ? "secondary" : featured || isUpgrade ? "primary" : "secondary"}
        className="w-full"
      >
        {loading && <LoaderCircle size={16} className="animate-spin" />}
        {!user
          ? planId === "free"
            ? "Create free account"
            : `Choose ${definition.name}`
          : current
            ? planId === "free"
              ? "Buy credits"
              : "Manage current plan"
            : planId === "free"
              ? "Buy credits"
              : isUpgrade
                ? `Upgrade to ${definition.name}`
                : "Manage plan"}
      </Button>
      {error && <p className="mt-3 text-xs font-bold text-red-500">{error}</p>}
    </div>
  );
}
