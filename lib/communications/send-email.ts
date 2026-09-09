import "server-only";

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { resend } from "@/lib/notifications/resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Heyy Studio <hello@heyystudio.com>";

function providerIdempotencyKey(eventKey: string) {
  // Resend accepts idempotency keys for 24 hours. Hash the internal event key
  // so retries stay under the provider's 256-character limit.
  const digest = createHash("sha256").update(eventKey).digest("hex");
  return `heyy/${digest}`;
}

function resendErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Resend email delivery failed.");
  }
  return String(error || "Resend email delivery failed.");
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function sendTrackedEmail({
  eventKey,
  userId,
  to,
  templateKey,
  subject,
  html,
  text,
  attachments,
  relatedType,
  relatedId,
  metadata = {},
}: {
  eventKey: string;
  userId?: string | null;
  to: string;
  templateKey: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentId?: string }>;
  relatedType?: string | null;
  relatedId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = adminClient();
  let claimId: string | null = null;

  try {
    const { data, error } = await admin.rpc("heyy_claim_communication_send", {
      p_event_key: eventKey,
      p_user_id: userId || null,
      p_recipient_email: to,
      p_template_key: templateKey,
      p_subject: subject,
      p_related_type: relatedType || null,
      p_related_id: relatedId || null,
      p_metadata: metadata,
    });
    if (error) throw error;
    claimId = typeof data === "string" ? data : null;
  } catch (error) {
    // Before the Phase 9 migration is installed, preserve existing email
    // delivery rather than making transactional notifications fail entirely.
    console.warn("Communication send tracking unavailable; sending without log:", error);
  }

  if (claimId === null) {
    // If the claim RPC exists, null means this business event was already sent
    // or is currently being delivered. If the migration is not installed yet,
    // the lookup itself fails and we keep the pre-migration delivery behaviour.
    const { data: existing, error: tableError } = await admin
      .from("communication_sends")
      .select("id")
      .eq("event_key", eventKey)
      .limit(1);
    if (!tableError && (existing || []).length > 0) {
      return { sent: false, duplicate: true };
    }
  }

  try {
    const finalAttachments = [...(attachments || [])];

    const payload = {
      from: FROM_EMAIL,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(finalAttachments.length
        ? {
            attachments: finalAttachments.map((attachment) => ({
              filename: attachment.filename,
              content:
                typeof attachment.content === "string"
                  ? attachment.content
                  : attachment.content.toString("base64"),
              ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
            })),
          }
        : {}),
    };

    const idempotencyKey = providerIdempotencyKey(eventKey);
    let result: any = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await resend.emails.send(payload, { idempotencyKey });
        if (response.error) {
          throw new Error(resendErrorMessage(response.error));
        }
        result = response;
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }

    if (!result) {
      throw lastError instanceof Error
        ? lastError
        : new Error(resendErrorMessage(lastError));
    }

    if (claimId) {
      await admin
        .from("communication_sends")
        .update({
          status: "sent",
          provider_message_id: result.data?.id || null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimId);
    }

    return { sent: true, duplicate: false, id: result.data?.id || null };
  } catch (error) {
    if (claimId) {
      await admin
        .from("communication_sends")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimId);
    }
    throw error;
  }
}
