import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationEvent } from "@/lib/notifications/types";

export type AccountPreferences = {
  marketing_email: boolean;
  billing_email: boolean;
  production_email: boolean;
  in_app_production: boolean;
  in_app_billing: boolean;
  in_app_messages: boolean;
};

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  marketing_email: false,
  billing_email: true,
  production_email: true,
  in_app_production: true,
  in_app_billing: true,
  in_app_messages: true,
};

const BILLING_EVENTS = new Set<NotificationEvent>([
  "quote.ready",
  "quote.replied",
  "payment.received",
]);

const MESSAGE_EVENTS = new Set<NotificationEvent>([
  "production.message.client",
  "production.message.studio",
]);

export async function getAccountPreferences(
  admin: SupabaseClient,
  userId: string,
): Promise<AccountPreferences> {
  const { data, error } = await admin
    .from("account_preferences")
    .select(
      "marketing_email,billing_email,production_email,in_app_production,in_app_billing,in_app_messages",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Preferences must never break transactional product flows. If the migration
    // is not installed yet, default to the existing notification behaviour.
    console.warn("Account preferences lookup failed; using defaults:", error.message);
    return DEFAULT_ACCOUNT_PREFERENCES;
  }

  return {
    ...DEFAULT_ACCOUNT_PREFERENCES,
    ...(data || {}),
  };
}

export function inAppNotificationEnabled(
  preferences: AccountPreferences,
  event: NotificationEvent,
) {
  if (BILLING_EVENTS.has(event)) return preferences.in_app_billing;
  if (MESSAGE_EVENTS.has(event)) return preferences.in_app_messages;
  return preferences.in_app_production;
}

export function clientEmailEnabled(
  preferences: AccountPreferences,
  event: NotificationEvent,
) {
  if (BILLING_EVENTS.has(event)) return preferences.billing_email;
  return preferences.production_email;
}
