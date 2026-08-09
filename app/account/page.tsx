"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  KeyRound,
  Laptop,
  LoaderCircle,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/components/auth-provider";
import { Button, Eyebrow, GlassCard } from "@/components/ui/heyy";
import { createSupabaseBrowserClient } from "@/lib/supabase";

async function accessToken() {
  const { data, error } = await createSupabaseBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Your session expired. Sign in again.");
  return token;
}

function browserLabel() {
  if (typeof navigator === "undefined") return "Current browser";
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent)
    ? "Microsoft Edge"
    : /Chrome\//.test(agent)
      ? "Chrome"
      : /Safari\//.test(agent) && !/Chrome\//.test(agent)
        ? "Safari"
        : /Firefox\//.test(agent)
          ? "Firefox"
          : "Web browser";
  const os = /Macintosh|Mac OS X/.test(agent)
    ? "macOS"
    : /Windows/.test(agent)
      ? "Windows"
      : /Android/.test(agent)
        ? "Android"
        : /iPhone|iPad/.test(agent)
          ? "iOS/iPadOS"
          : "Device";
  return `${browser} on ${os}`;
}

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [sessionBusy, setSessionBusy] = useState<"others" | "all" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const avatarUrl = useMemo(
    () =>
      String(
        user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "",
      ).trim(),
    [user],
  );
  const currentDevice = useMemo(() => browserLabel(), []);

  useEffect(() => {
    setName(String(user?.user_metadata?.full_name || user?.user_metadata?.name || ""));
    setEmail(String(user?.email || ""));
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const updates: {
        data: Record<string, unknown>;
        email?: string;
      } = {
        data: { ...user.user_metadata, full_name: name.trim() },
      };
      const nextEmail = email.trim();
      if (nextEmail && nextEmail !== user.email) updates.email = nextEmail;
      const { error: updateError } = await supabase.auth.updateUser(updates);
      if (updateError) throw updateError;
      await refreshUser();
      setMessage(
        nextEmail !== user.email
          ? "Profile saved. Check your email if confirmation is required before the new address becomes active."
          : "Profile updated.",
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : "Profile could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function removeStoredAvatar(path: string) {
    if (!path) return;
    try {
      const token = await accessToken();
      await fetch("/api/account/avatar", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      });
    } catch {
      // Storage cleanup is deliberately non-blocking. The account metadata has
      // already moved to the new avatar, so an old orphaned file is preferable
      // to breaking the user's profile update.
    }
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    setAvatarBusy(true);
    setMessage("");
    setError("");
    try {
      const previousPath = String(user.user_metadata?.heyy_avatar_path || "").trim();
      const token = await accessToken();
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = (await response.json()) as {
        error?: string;
        avatarUrl?: string;
        storagePath?: string;
      };
      if (!response.ok || !data.avatarUrl || !data.storagePath) {
        throw new Error(data.error || "Profile image could not be updated.");
      }

      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          avatar_url: data.avatarUrl,
          heyy_avatar_path: data.storagePath,
        },
      });
      if (updateError) throw updateError;

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      await refreshUser();

      if (previousPath && previousPath !== data.storagePath) {
        void removeStoredAvatar(previousPath);
      }

      setMessage("Profile image updated.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Profile image could not be updated.");
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!user) return;
    setAvatarBusy(true);
    setMessage("");
    setError("");
    try {
      const previousPath = String(user.user_metadata?.heyy_avatar_path || "").trim();
      const fallback = String(user.user_metadata?.picture || "").trim() || null;
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          avatar_url: fallback,
          heyy_avatar_path: null,
        },
      });
      if (updateError) throw updateError;

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      await refreshUser();

      if (previousPath) void removeStoredAvatar(previousPath);
      setMessage("Profile image removed.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Profile image could not be removed.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function sendPasswordReset() {
    setMessage("");
    setError("");
    try {
      if (!user?.email) throw new Error("No email address is connected to this account.");
      const { error: resetError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(
        user.email,
        { redirectTo: `${window.location.origin}/account` },
      );
      if (resetError) throw resetError;
      setMessage("Password reset email sent.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Password reset could not be sent.");
    }
  }

  async function signOutSessions(scope: "others" | "all") {
    setSessionBusy(scope);
    setMessage("");
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      if (scope === "others") {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
        if (signOutError) throw signOutError;
        setMessage("Other active sessions have been signed out. This browser remains signed in.");
      } else {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
        if (signOutError) throw signOutError;
        window.location.href = "/login";
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "Session action could not be completed.");
    } finally {
      setSessionBusy(null);
    }
  }

  return (
    <AccountLayout>
      <Eyebrow>Account</Eyebrow>
      <h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-5xl">
        Profile & security
      </h1>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
        Manage the identity shown across Heyy Studio and control access to your account sessions.
      </p>

      {(message || error) && (
        <div
          className={`mt-6 rounded-2xl border p-4 text-sm font-bold ${
            error
              ? "border-red-300/60 bg-red-500/10 text-red-600 dark:text-red-300"
              : "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="mt-7 grid gap-4 xl:grid-cols-2">
        <GlassCard className="p-7">
          <UserRound size={21} className="text-[var(--accent-strong)]" />
          <h2 className="mt-5 text-xl font-black">Profile</h2>

          <div className="mt-6 flex flex-wrap items-center gap-5">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-violet-600 to-fuchsia-500 text-3xl font-black text-white">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                String(name || email || "A").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={avatarBusy}
                onClick={() => fileRef.current?.click()}
              >
                {avatarBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Camera size={16} />}
                Change photo
              </Button>
              {avatarUrl && (
                <Button type="button" variant="ghost" disabled={avatarBusy} onClick={() => void removeAvatar()}>
                  <Trash2 size={15} /> Remove
                </Button>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-[var(--text-muted)]">
            JPG, PNG or WebP · maximum 5 MB. Your custom profile image appears in the account menu.
          </p>

          <label className="mt-6 block text-xs font-black uppercase tracking-[.14em] text-[var(--text-muted)]">
            Display name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="heyy-input mt-2 w-full"
            placeholder="Your name"
          />

          <label className="mt-5 block text-xs font-black uppercase tracking-[.14em] text-[var(--text-muted)]">
            Email
          </label>
          <div className="relative mt-2">
            <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="heyy-input w-full"
              style={{ paddingLeft: "2.75rem" }}
              placeholder="you@example.com"
            />
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">
            Depending on your Supabase authentication settings, changing email may require confirmation from the old or new address before it becomes active.
          </p>

          <Button onClick={() => void saveProfile()} disabled={saving} className="mt-6">
            {saving && <LoaderCircle size={16} className="animate-spin" />} Save profile
          </Button>
        </GlassCard>

        <GlassCard className="p-7">
          <ShieldCheck size={21} className="text-emerald-500" />
          <h2 className="mt-5 text-xl font-black">Security & sessions</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">
            Review this browser and revoke other Supabase sessions when a device is lost, shared or no longer trusted.
          </p>

          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Laptop size={18} />
              </span>
              <div>
                <p className="text-sm font-black">Current device</p>
                <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">{currentDevice}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">
                  Last account sign-in: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Not available"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => void sendPasswordReset()}>
              <KeyRound size={16} /> Password reset
            </Button>
            <Button
              variant="secondary"
              disabled={sessionBusy !== null}
              onClick={() => void signOutSessions("others")}
            >
              {sessionBusy === "others" ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}
              Sign out other sessions
            </Button>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-500/10 p-4">
            <p className="text-sm font-black text-amber-800 dark:text-amber-200">Sign out everywhere</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-700 dark:text-amber-300">
              Revokes all active Supabase sessions, including this browser. You will need to sign in again on every device.
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              disabled={sessionBusy !== null}
              onClick={() => void signOutSessions("all")}
            >
              {sessionBusy === "all" ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}
              Sign out from all sessions
            </Button>
          </div>
        </GlassCard>
      </div>
    </AccountLayout>
  );
}
