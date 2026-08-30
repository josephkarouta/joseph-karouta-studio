import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Records important Admin activity without becoming a dependency of the action
 * itself. The business operation is the source of truth; a temporary audit-log
 * outage must never make an already-completed quote/message/status change look
 * like it failed to the Admin user.
 */
export async function recordAdminAudit({
  actorUserId,
  action,
  entityType,
  entityId,
  summary,
  metadata = {},
}: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      console.warn("Admin audit log skipped because the server database is not configured.");
      return false;
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { error } = await admin.from("admin_audit_log").insert({
      actor_user_id: actorUserId || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      summary,
      metadata,
    });

    if (error) {
      console.error("Admin audit log write failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Admin audit log write failed:", error);
    return false;
  }
}
