"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type CreditSummary = {
  available: number;
  monthly: number;
  purchased: number;
  reserved: number;
  periodEnd: string | null;
};

type CachedAccountSummary = {
  plan: string;
  credits: CreditSummary;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  plan: string;
  credits: CreditSummary;
  refreshUser: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
};

const defaultCredits: CreditSummary = {
  available: 0,
  monthly: 0,
  purchased: 0,
  reserved: 0,
  periodEnd: null,
};

const ACCOUNT_CACHE_PREFIX = "heyy-account-summary:";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normaliseCredits(value: Partial<CreditSummary> | null | undefined): CreditSummary {
  return {
    ...defaultCredits,
    ...(value || {}),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState("FREE");
  const [credits, setCredits] = useState<CreditSummary>(defaultCredits);
  const [loading, setLoading] = useState(true);

  const resetAccount = useCallback(() => {
    setPlan("FREE");
    setCredits(defaultCredits);
  }, []);

  const applyCachedAccount = useCallback((userId: string) => {
    try {
      const raw = window.localStorage.getItem(`${ACCOUNT_CACHE_PREFIX}${userId}`);
      if (!raw) return;

      const cached = JSON.parse(raw) as CachedAccountSummary;
      if (!cached?.plan || !cached?.credits) return;

      setPlan(String(cached.plan).toUpperCase());
      setCredits(normaliseCredits(cached.credits));
    } catch {
      // A stale cache must never block authentication.
    }
  }, []);

  const cacheAccount = useCallback((userId: string, nextPlan: string, nextCredits: CreditSummary) => {
    try {
      window.localStorage.setItem(
        `${ACCOUNT_CACHE_PREFIX}${userId}`,
        JSON.stringify({ plan: nextPlan, credits: nextCredits } satisfies CachedAccountSummary),
      );
    } catch {
      // Storage may be unavailable in private browsing; live state still works.
    }
  }, []);

  const loadAccount = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const token = session?.access_token;
    const currentUser = session?.user;

    if (!token || !currentUser) {
      resetAccount();
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch("/api/account/summary", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Unable to load account summary");
      const result = await response.json();
      const nextPlan = String(result.plan || "free").toUpperCase();
      const nextCredits = normaliseCredits(result.credits);

      setPlan(nextPlan);
      setCredits(nextCredits);
      cacheAccount(currentUser.id, nextPlan, nextCredits);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Unable to load account summary:", error);
      }

      try {
        const response = await fetch("/api/get-user-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
        const fallback = await response.json();
        const fallbackPlan = String(fallback?.plan || "free");
        const nextPlan = fallbackPlan.toUpperCase();

        setPlan(nextPlan);
      } catch {
        // Keep the cached account summary already shown in the interface.
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }, [cacheAccount, resetAccount]);

  const refreshUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentUser = session?.user || null;
    setUser(currentUser);

    if (currentUser) {
      applyCachedAccount(currentUser.id);
      setLoading(false);
      void loadAccount();
    } else {
      resetAccount();
      setLoading(false);
    }
  }, [applyCachedAccount, loadAccount, resetAccount]);

  const refreshAccount = useCallback(async () => {
    if (user) await loadAccount();
  }, [loadAccount, user]);

  const signOut = useCallback(async () => {
    if (user) {
      try {
        window.localStorage.removeItem(`${ACCOUNT_CACHE_PREFIX}${user.id}`);
      } catch {
        // Ignore storage cleanup failures.
      }
    }
    await supabase.auth.signOut();
    setUser(null);
    resetAccount();
  }, [resetAccount, user]);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    let next = `${window.location.pathname}${window.location.search}${window.location.hash}` || "/dashboard";

    if (redirectTo) {
      try {
        const destination = new URL(redirectTo, window.location.origin);
        if (destination.origin === window.location.origin) {
          next = `${destination.pathname}${destination.search}${destination.hash}` || "/dashboard";
        }
      } catch {
        // Keep the current same-origin destination.
      }
    }

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next.startsWith("/") ? next : "/dashboard");

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: "select_account" },
      },
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    let lastBackgroundRefresh = 0;

    const refreshCredits = () => {
      lastBackgroundRefresh = Date.now();
      void loadAccount();
    };

    const refreshOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      // Focus + visibilitychange can fire together when returning from Stripe.
      // Refresh immediately, but coalesce the duplicate browser events.
      if (Date.now() - lastBackgroundRefresh < 1_500) return;
      refreshCredits();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshOnReturn();
    };

    window.addEventListener("heyy:credits-changed", refreshCredits as EventListener);
    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(refreshCredits, 5 * 60_000);

    return () => {
      window.removeEventListener("heyy:credits-changed", refreshCredits as EventListener);
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [loadAccount, user]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        applyCachedAccount(currentUser.id);
        setLoading(false);
        void loadAccount();
      } else {
        resetAccount();
        setLoading(false);
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user || null;
        setUser(currentUser);
        setLoading(false);

        if (!currentUser) {
          resetAccount();
          return;
        }

        applyCachedAccount(currentUser.id);
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          void loadAccount();
        }
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applyCachedAccount, loadAccount, resetAccount]);

  const value = useMemo(
    () => ({
      user,
      loading,
      plan,
      credits,
      refreshUser,
      refreshAccount,
      signOut,
      signInWithGoogle,
    }),
    [
      user,
      loading,
      plan,
      credits,
      refreshUser,
      refreshAccount,
      signOut,
      signInWithGoogle,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
