"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, LoaderCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
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

type NotificationBellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(difference / 60000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function NotificationBell({
  open,
  onOpenChange,
}: NotificationBellProps) {
  const router = useRouter();
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (showLoader = false) => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      setErrorMessage("");
      return;
    }

    if (showLoader) setLoading(true);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/account/notifications?limit=8", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load notifications.");
      }

      const notifications = (data.notifications || []) as NotificationItem[];
      setItems(notifications);
      setUnreadCount(
        typeof data.unreadCount === "number"
          ? data.unreadCount
          : notifications.filter((item) => !item.read_at).length,
      );
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load notifications.",
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    void load(false);

    const refresh = () => void load(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("heyy:notifications-changed", refresh as EventListener);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(refresh, 30000);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "heyy:notifications-changed",
        refresh as EventListener,
      );
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [load, user]);

  useEffect(() => {
    if (open) void load(true);
  }, [load, open]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onOpenChange]);

  async function markRead(id: string) {
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read_at: item.read_at || readAt } : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error("Unable to update notification.");
    } catch {
      void load(false);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;

    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at || readAt })),
    );
    setUnreadCount(0);

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

      if (!response.ok) throw new Error("Unable to update notifications.");
    } catch {
      void load(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.read_at) await markRead(item.id);
    onOpenChange(false);
    router.push(resolveStoredNotificationHref(item));
  }

  function openAllNotifications() {
    onOpenChange(false);
    router.push("/notifications");
  }

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-[var(--surface-strong)] bg-[var(--accent)] px-1 text-[0.56rem] font-black leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow-card-hover)] backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-sm font-black text-[var(--text-primary)]">
                Notifications
              </p>
              <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">
                {unreadCount === 0
                  ? "You are all caught up"
                  : `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.68rem] font-black text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)]"
              >
                <CheckCheck size={14} /> Mark read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="grid place-items-center py-12">
                <LoaderCircle
                  size={21}
                  className="animate-spin text-[var(--accent-strong)]"
                />
              </div>
            ) : errorMessage ? (
              <div className="p-5 text-center">
                <p className="text-sm font-bold leading-6 text-red-500">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={() => void load(true)}
                  className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 py-2 text-xs font-black text-[var(--accent-strong)]"
                >
                  <RefreshCw size={13} /> Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="grid place-items-center px-6 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <Bell size={20} />
                </span>
                <p className="mt-4 text-sm font-black text-[var(--text-primary)]">
                  No notifications yet
                </p>
                <p className="mt-1 max-w-64 text-xs font-semibold leading-5 text-[var(--text-muted)]">
                  Quotes, replies, production updates and deliveries will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openNotification(item)}
                    className={`block w-full px-5 py-4 text-left transition hover:bg-[var(--surface-hover)] ${
                      item.read_at ? "" : "bg-[var(--accent-soft)]/45"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                          item.read_at
                            ? "bg-[var(--border-strong)]"
                            : "bg-[var(--accent)]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-black leading-5 text-[var(--text-primary)]">
                            {item.title}
                          </p>
                          <span className="shrink-0 text-[0.62rem] font-bold text-[var(--text-muted)]">
                            {formatRelativeDate(item.created_at)}
                          </span>
                        </div>
                        {item.message && (
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">
                            {item.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openAllNotifications}
            className="block w-full border-t border-[var(--border)] px-5 py-3.5 text-center text-xs font-black text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)]"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
