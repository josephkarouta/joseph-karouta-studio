import { createClient } from "@supabase/supabase-js";
import {
  buildInAppNotification,
  buildNotificationKey,
} from "./content";
import { handleProductionNotification } from "./handlers/production";
import type { NotificationPayload } from "./types";

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
    if (payload.clientEmail || !payload.userId) {
      return payload;
    }

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(
      payload.userId,
    );

    if (error) {
      console.error("Notification user lookup failed:", error);
      return payload;
    }

    return {
      ...payload,
      clientEmail: data.user?.email || null,
      clientName:
        data.user?.user_metadata?.full_name ||
        data.user?.user_metadata?.name ||
        payload.clientName ||
        null,
    };
  }
}

export const Notifications = new NotificationEngine();
