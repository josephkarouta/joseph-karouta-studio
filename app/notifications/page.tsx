"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { Button, Eyebrow, GlassCard } from "@/components/ui/heyy";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { resolveStoredNotificationHref } from "@/lib/notifications/content";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  href?: string | null;
  read_at?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (error || !token) {
    throw new Error("Your session expired. Sign in again.");
  }

  return token;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read_at).length,
    [items],
  );

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/account/notifications?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load notifications.");
      }

      setItems(data.notifications || []);
    } catch (error) {
      console.error("Load notifications failed:", error);
      setItems([]);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markAll() {
    if (unreadCount === 0) return;

    setMarkingAll(true);
    const previous = items;
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at || readAt })),
    );

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ all: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update notifications.");
      }

      window.dispatchEvent(new Event("heyy:notifications-changed"));
    } catch (error) {
      setItems(previous);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update notifications.",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    const destination = resolveStoredNotificationHref(item);

    if (!item.read_at) {
      const readAt = new Date().toISOString();
      const previous = items;
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, read_at: readAt } : entry,
        ),
      );

      try {
        const token = await getAccessToken();
        const response = await fetch("/api/account/notifications", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: item.id }),
        });

        if (!response.ok) throw new Error("Unable to mark notification as read.");
        window.dispatchEvent(new Event("heyy:notifications-changed"));
      } catch (error) {
        console.error("Mark notification read failed:", error);
        setItems(previous);
      }
    }

    router.push(destination);
  }

  return (
    <AccountLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Updates</Eyebrow>
          <h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-5xl">
            Notifications
          </h1>
          {!loading && !errorMessage && (
            <p className="mt-3 text-sm font-bold text-[var(--text-muted)]">
              {unreadCount === 0
                ? "You have no unread updates."
                : `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}.`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={() => void markAll()}
            disabled={markingAll || unreadCount === 0 || Boolean(errorMessage)}
          >
            {markingAll ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <CheckCheck size={16} />
            )}
            Mark all read
          </Button>
        </div>
      </div>

      <GlassCard className="mt-7 overflow-hidden">
        {loading ? (
          <div className="grid place-items-center p-16">
            <LoaderCircle className="animate-spin text-[var(--accent-strong)]" />
          </div>
        ) : errorMessage ? (
          <div className="grid place-items-center p-10 text-center sm:p-16">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-red-500">
              <TriangleAlert size={24} />
            </span>
            <h2 className="mt-5 text-xl font-black tracking-[-.03em]">
              Notifications could not load
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
              {errorMessage}
            </p>
            <Button className="mt-6" onClick={() => void load()}>
              <RefreshCw size={16} /> Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center p-14 text-center">
            <Bell className="text-[var(--text-muted)]" />
            <p className="mt-4 text-sm font-bold text-[var(--text-muted)]">
              You are all caught up.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openNotification(item)}
                className={`block w-full p-6 text-left transition hover:bg-[var(--surface-hover)] ${
                  item.read_at ? "" : "bg-[var(--accent-soft)]/40"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      item.read_at
                        ? "bg-[var(--border-strong)]"
                        : "bg-[var(--accent)]"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-black">{item.title}</p>
                    {item.message && (
                      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                        {item.message}
                      </p>
                    )}
                    <p className="mt-2 text-xs font-bold text-[var(--text-muted)]">
                      {new Date(item.created_at).toLocaleString("en-US")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </GlassCard>
    </AccountLayout>
  );
}
