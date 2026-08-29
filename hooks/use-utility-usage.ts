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

const USAGE_CACHE_PREFIX = "heyy-utility-usage:";
const usageMemoryCache = new Map<string, UsageState>();

function usageCacheKey(userId: string, tool: UtilityTool) {
  return `${userId}:${tool}`;
}

function readCachedUsage(userId: string, tool: UtilityTool): UsageState | null {
  const key = usageCacheKey(userId, tool);
  const memory = usageMemoryCache.get(key);
  if (memory) return memory;
  try {
    const raw = window.sessionStorage.getItem(`${USAGE_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UsageState;
    if (!parsed || typeof parsed.freeRemaining !== "number") return null;
    usageMemoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedUsage(userId: string, tool: UtilityTool, usage: UsageState) {
  const key = usageCacheKey(userId, tool);
  usageMemoryCache.set(key, usage);
  try {
    window.sessionStorage.setItem(`${USAGE_CACHE_PREFIX}${key}`, JSON.stringify(usage));
  } catch {
    // The in-memory cache still prevents a visible reload in this tab.
  }
}

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

  const refreshUsage = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      setUsage(DEFAULT_USAGE);
      setLoadingUsage(false);
      return;
    }

    const silent = Boolean(options?.silent);
    if (!silent) setLoadingUsage(true);
    setUsageError("");

    try {
      const accessToken = await token();
      const response = await fetch(`/api/tools/utility/usage?tool=${encodeURIComponent(tool)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "Daily usage could not be loaded.");
      const nextUsage = { ...DEFAULT_USAGE, ...payload } as UsageState;
      setUsage(nextUsage);
      writeCachedUsage(user.id, tool, nextUsage);
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : "Daily usage could not be loaded.");
    } finally {
      setLoadingUsage(false);
    }
  }, [token, tool, user]);

  useEffect(() => {
    if (!user) {
      setUsage(DEFAULT_USAGE);
      setLoadingUsage(false);
      return;
    }

    const cached = readCachedUsage(user.id, tool);
    if (cached) {
      setUsage(cached);
      setLoadingUsage(false);
      void refreshUsage({ silent: true });
    } else {
      void refreshUsage();
    }
  }, [refreshUsage, tool, user]);

  const authorize = useCallback(async (operation: string): Promise<Authorization> => {
    const accessToken = await token();
    const response = await fetch("/api/tools/utility/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ tool, operation }),
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload.error || "This operation could not be started.");

    setUsage((current) => {
      const nextUsage: UsageState = {
        ...current,
        unlimited: Boolean(payload.unlimited),
        freeRemaining: Number(payload.freeRemaining ?? current.freeRemaining),
        freeUsed: payload.unlimited
          ? current.freeUsed
          : Math.max(0, current.dailyLimit - Number(payload.freeRemaining ?? current.freeRemaining)),
      };
      if (user) writeCachedUsage(user.id, tool, nextUsage);
      return nextUsage;
    });

    return payload as Authorization;
  }, [token, tool, user]);

  const complete = useCallback(async (
    operationId: string,
    metadata: Record<string, unknown> = {},
    options?: { refresh?: boolean },
  ) => {
    const accessToken = await token();
    const response = await fetch("/api/tools/utility/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ operationId, metadata }),
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload.error || "The completed file could not be released.");
    if (options?.refresh !== false) {
      await refreshAccount();
      await refreshUsage({ silent: true });
    }
    return payload;
  }, [refreshAccount, refreshUsage, token]);

  const fail = useCallback(async (operationId: string, reason: string, options?: { refresh?: boolean }) => {
    try {
      const accessToken = await token();
      await fetch("/api/tools/utility/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ operationId, reason }),
      });
    } finally {
      if (options?.refresh !== false) {
        await refreshAccount();
        await refreshUsage({ silent: true });
      }
    }
  }, [refreshAccount, refreshUsage, token]);

  const syncUsage = useCallback(async () => {
    await refreshAccount();
    await refreshUsage({ silent: true });
  }, [refreshAccount, refreshUsage]);

  return {
    usage,
    loadingUsage,
    usageError,
    refreshUsage: () => refreshUsage(),
    authorize,
    complete,
    fail,
    syncUsage,
  };
}
