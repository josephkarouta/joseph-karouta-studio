"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { UtilityTool } from "@/lib/tools/utility-policy";

type UsageState = {
  plan: string;
  unlimited: boolean;
  dailyLimit: number;
  freeUsed: number;
  freeRemaining: number;
  creditCostAfterFree: number;
  subscriptionStatus: string;
};

type Authorization = {
  operationId: string;
  chargeType: "free" | "credit" | "subscriber";
  creditsReserved: number;
  unlimited: boolean;
  freeRemaining: number;
};

const DEFAULT_USAGE: UsageState = {
  plan: "free",
  unlimited: false,
  dailyLimit: 5,
  freeUsed: 0,
  freeRemaining: 5,
  creditCostAfterFree: 1,
  subscriptionStatus: "",
};

async function readPayload(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export function useUtilityUsage(tool: UtilityTool) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, refreshAccount } = useAuth();
  const [usage, setUsage] = useState<UsageState>(DEFAULT_USAGE);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [usageError, setUsageError] = useState("");

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Your session expired. Sign in again.");
    return accessToken;
  }, [supabase]);

  const refreshUsage = useCallback(async () => {
    if (!user) return;
    setLoadingUsage(true);
    setUsageError("");
    try {
      const accessToken = await token();
      const response = await fetch(`/api/tools/utility/usage?tool=${encodeURIComponent(tool)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "Daily usage could not be loaded.");
      setUsage({ ...DEFAULT_USAGE, ...payload });
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : "Daily usage could not be loaded.");
    } finally {
      setLoadingUsage(false);
    }
  }, [token, tool, user]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const authorize = useCallback(async (operation: string): Promise<Authorization> => {
    const accessToken = await token();
    const response = await fetch("/api/tools/utility/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ tool, operation }),
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload.error || "This operation could not be started.");
    setUsage((current) => ({
      ...current,
      unlimited: Boolean(payload.unlimited),
      freeRemaining: Number(payload.freeRemaining ?? current.freeRemaining),
      freeUsed: payload.unlimited
        ? current.freeUsed
        : Math.max(0, current.dailyLimit - Number(payload.freeRemaining ?? current.freeRemaining)),
    }));
    return payload as Authorization;
  }, [token, tool]);

  const complete = useCallback(async (operationId: string, metadata: Record<string, unknown> = {}) => {
    const accessToken = await token();
    const response = await fetch("/api/tools/utility/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ operationId, metadata }),
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload.error || "The completed file could not be released.");
    await refreshAccount();
    await refreshUsage();
    return payload;
  }, [refreshAccount, refreshUsage, token]);

  const fail = useCallback(async (operationId: string, reason: string) => {
    try {
      const accessToken = await token();
      await fetch("/api/tools/utility/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ operationId, reason }),
      });
    } finally {
      await refreshAccount();
      await refreshUsage();
    }
  }, [refreshAccount, refreshUsage, token]);

  return { usage, loadingUsage, usageError, refreshUsage, authorize, complete, fail };
}
