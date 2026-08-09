import { createClient } from "@supabase/supabase-js";
import {
  buildInAppNotification,
  buildNotificationKey,
} from "./content";
import { handleProductionNotification } from "./handlers/production";
import type { NotificationPayload } from "./types";
import {
  getAccountPreferences,
  inAppNotificationEnabled,
} from "@/lib/account/preferences";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

class NotificationEngine {
  async emit(payload: NotificationPayload) {
    const enrichedPayload = await this.enrichPayload(payload);

    let shouldDeliverExternalChannels = true;

    try {
      shouldDeliverExternalChannels =
        await this.storeInAppNotification(enrichedPayload);
    } catch (error) {
      console.error("Notification in-app delivery failed:", error);
    }

    // A notification key represents one business event. If another webhook or
    // reconciliation request already stored it, do not send a duplicate email.
    if (shouldDeliverExternalChannels) {
      try {
        await handleProductionNotification(enrichedPayload);
      } catch (error) {
        console.error("Notification email delivery failed:", error);
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔔 Notification Event");
    console.log(enrichedPayload.event);
    console.log(enrichedPayload);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  private async storeInAppNotification(payload: NotificationPayload) {
    const content = buildInAppNotification(payload);
    if (!content || !payload.userId) return true;

    const delivery = payload.deliveryPreferences;
    if (delivery) {
      const enabled = inAppNotificationEnabled(
        {
          marketing_email: false,
          billing_email: delivery.billingEmail,
          production_email: delivery.productionEmail,
          in_app_production: delivery.inAppProduction,
          in_app_billing: delivery.inAppBilling,
          in_app_messages: delivery.inAppMessages,
        },
        payload.event,
      );
      if (!enabled) return true;
    }

    const notificationKey = buildNotificationKey(payload);
    const metadata = {
      ...content.metadata,
      ...(notificationKey ? { notification_key: notificationKey } : {}),
    };

    if (notificationKey) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", payload.userId)
        .contains("metadata", { notification_key: notificationKey })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return false;
    }

    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: payload.userId,
      type: content.type,
      title: content.title,
      message: content.message,
      href: content.href,
      metadata,
    });

    if (error?.code === "23505") return false;
    if (error) throw error;
    return true;
  }

  private async enrichPayload(payload: NotificationPayload) {
    let next = payload;

    if (payload.userId) {
      const preferences = await getAccountPreferences(supabaseAdmin, payload.userId);
      next = {
        ...next,
        deliveryPreferences: {
          billingEmail: preferences.billing_email,
          productionEmail: preferences.production_email,
          inAppProduction: preferences.in_app_production,
          inAppBilling: preferences.in_app_billing,
          inAppMessages: preferences.in_app_messages,
        },
      };
    }

    if (next.clientEmail || !next.userId) {
      return next;
    }

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(
      next.userId,
    );

    if (error) {
      console.error("Notification user lookup failed:", error);
      return next;
    }

    return {
      ...next,
      clientEmail: data.user?.email || null,
      clientName:
        data.user?.user_metadata?.full_name ||
        data.user?.user_metadata?.name ||
        next.clientName ||
        null,
    };
  }
}

export const Notifications = new NotificationEngine();
