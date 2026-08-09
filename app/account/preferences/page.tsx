"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BellRing,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Mail,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { Button, Eyebrow, GlassCard } from "@/components/ui/heyy";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Preferences = {
  marketing_email: boolean;
  billing_email: boolean;
  production_email: boolean;
  in_app_production: boolean;
  in_app_billing: boolean;
  in_app_messages: boolean;
};

const defaults: Preferences = {
  marketing_email: false,
  billing_email: true,
  production_email: true,
  in_app_production: true,
  in_app_billing: true,
  in_app_messages: true,
};

async function token() {
  const { data, error } = await createSupabaseBrowserClient().auth.getSession();
  const value = data.session?.access_token;
  if (error || !value) throw new Error("Your session expired. Sign in again.");
  return value;
}

export default function AccountPreferencesPage() {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const access = await token();
      const response = await fetch("/api/account/preferences", {
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Preferences could not be loaded.");
      setPreferences({ ...defaults, ...(data.preferences || {}) });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Preferences could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update(key: keyof Preferences, value: boolean) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const access = await token();
      const response = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Preferences could not be saved.");
      setPreferences({ ...defaults, ...(data.preferences || {}) });
      setMessage("Preferences saved.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Account</Eyebrow>
          <h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-5xl">Preferences</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">
            Control optional email communication and which Heyy Studio updates appear as in-app notifications.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading || saving}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-emerald-300/60 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}

      {loading ? (
        <GlassCard className="mt-7 grid min-h-64 place-items-center p-10">
          <LoaderCircle className="animate-spin text-[var(--accent-strong)]" />
        </GlassCard>
      ) : (
        <div className="mt-7 grid gap-5">
          <GlassCard className="p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Mail size={20} />
              </span>
              <div>
                <h2 className="text-xl font-black">Email preferences</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                  Choose the Heyy Studio email categories you want to receive.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <PreferenceRow
                icon={<Megaphone size={17} />}
                title="Marketing emails"
                description="Product announcements, launch news, tips and optional promotional communication. Off by default."
                checked={preferences.marketing_email}
                onChange={(value) => update("marketing_email", value)}
              />
              <PreferenceRow
                icon={<CreditCard size={17} />}
                title="Billing & quote emails"
                description="Heyy Studio quote, payment and billing-status notifications. Stripe receipts or legally required service notices may still be sent separately."
                checked={preferences.billing_email}
                onChange={(value) => update("billing_email", value)}
              />
              <PreferenceRow
                icon={<Sparkles size={17} />}
                title="Production emails"
                description="Production status, files ready, revision and completed-project emails."
                checked={preferences.production_email}
                onChange={(value) => update("production_email", value)}
              />
            </div>
          </GlassCard>

          <GlassCard className="p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <BellRing size={20} />
              </span>
              <div>
                <h2 className="text-xl font-black">In-app notifications</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                  These settings control the notification bell and Notifications page. They do not change saved production history.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <PreferenceRow
                icon={<Sparkles size={17} />}
                title="Production updates"
                description="Production requested, started, ready for review, revisions, deliverables and completion."
                checked={preferences.in_app_production}
                onChange={(value) => update("in_app_production", value)}
              />
              <PreferenceRow
                icon={<CreditCard size={17} />}
                title="Quotes & payments"
                description="Quote-ready, quote-reply and payment-confirmation notifications."
                checked={preferences.in_app_billing}
                onChange={(value) => update("in_app_billing", value)}
              />
              <PreferenceRow
                icon={<MessageSquareText size={17} />}
                title="Production messages"
                description="Message-related alerts when the production team adds communication to your project."
                checked={preferences.in_app_messages}
                onChange={(value) => update("in_app_messages", value)}
              />
            </div>
          </GlassCard>

          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              Save preferences
            </Button>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent-border)]">
      <span className="flex min-w-0 gap-3">
        <span className="mt-0.5 text-[var(--accent-strong)]">{icon}</span>
        <span>
          <span className="block text-sm font-black text-[var(--text-primary)]">{title}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--text-secondary)]">{description}</span>
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-violet-600"
      />
    </label>
  );
}
