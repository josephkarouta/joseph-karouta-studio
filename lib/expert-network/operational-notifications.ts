import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sendTrackedEmail } from "@/lib/communications/send-email";
import { sitePath } from "@/lib/site-url";

function clean(value: unknown, max = 10000) {
  return String(value ?? "").trim().slice(0, max);
}

async function insertInAppNotification(
  admin: SupabaseClient,
  input: {
    userId?: string | null;
    key: string;
    type: string;
    title: string;
    message: string;
    href: string;
    metadata?: Record<string, unknown>;
  },
) {
  const userId = clean(input.userId, 200);
  if (!userId) return;

  const metadata = {
    ...(input.metadata || {}),
    notification_key: input.key,
  };

  const { data: existing, error: existingError } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .contains("metadata", { notification_key: input.key })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return;

  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type: input.type,
    title: input.title,
    message: input.message,
    href: input.href,
    metadata,
  });

  if (error?.code !== "23505" && error) throw error;
}

let cachedAdminRecipient:
  | { userIds: string[]; email: string | null; expiresAt: number }
  | null = null;

function isAdminAuthUser(user: any) {
  const metadata = user?.app_metadata || {};
  const primaryRole = String(metadata.role || "").trim().toLowerCase();
  const roles = Array.isArray(metadata.roles)
    ? metadata.roles.map((value: unknown) => String(value || "").trim().toLowerCase())
    : [];
  return (
    metadata.is_admin === true ||
    primaryRole === "admin" ||
    primaryRole === "business_admin" ||
    roles.includes("admin") ||
    roles.includes("business_admin")
  );
}

async function resolveAdminRecipient(admin: SupabaseClient) {
  const configuredEmail = clean(process.env.ADMIN_EMAIL, 320).toLowerCase() || null;

  if (cachedAdminRecipient && cachedAdminRecipient.expiresAt > Date.now()) {
    return {
      userIds: cachedAdminRecipient.userIds,
      email: cachedAdminRecipient.email,
    };
  }

  const userIds = new Set<string>();
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (!error) {
      for (const user of data.users) {
        const email = String(user.email || "").trim().toLowerCase();
        if (isAdminAuthUser(user) || (configuredEmail && email === configuredEmail)) {
          userIds.add(user.id);
        }
      }
    }
  } catch (error) {
    console.warn("Could not resolve Admin users for in-app Expert notification:", error);
  }

  cachedAdminRecipient = {
    userIds: Array.from(userIds),
    email: configuredEmail,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  return { userIds: Array.from(userIds), email: configuredEmail };
}

function buildOperationalTemplate(input: {
  recipient: "admin" | "expert";
  eyebrow: string;
  title: string;
  intro: string;
  projectName?: string | null;
  service?: string | null;
  studio?: string | null;
  status?: string | null;
  details?: Array<{ label: string; value: string | null | undefined }>;
  ctaLabel: string;
  ctaUrl: string;
  note?: string | null;
}) {
  return {
    eyebrow: input.eyebrow,
    title: input.title,
    intro: input.intro,
    preheader: input.intro,
    recipient: input.recipient,
    studio: input.studio,
    projectName: input.projectName,
    service: input.service,
    status: input.status,
    details: (input.details || []).filter(
      (item): item is { label: string; value: string } => Boolean(clean(item.value, 5000)),
    ),
    detailsTitle: "Project update",
    note: input.note || undefined,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
  };
}

export async function notifyExpertOperationalEvent(
  admin: SupabaseClient,
  input: {
    key: string;
    type: string;
    expertUserId?: string | null;
    expertEmail?: string | null;
    expertName?: string | null;
    projectName?: string | null;
    service?: string | null;
    studio?: string | null;
    title: string;
    message: string;
    status?: string | null;
    details?: Array<{ label: string; value: string | null | undefined }>;
    href?: string;
    attachments?: Array<{ filename: string; content: Buffer | string; contentId?: string }>;
  },
) {
  const href = input.href || "/expert?section=projects";
  try {
    await insertInAppNotification(admin, {
      userId: input.expertUserId,
      key: input.key,
      type: input.type,
      title: input.title,
      message: input.message,
      href,
      metadata: {
        project_name: input.projectName || null,
        service: input.service || null,
        studio: input.studio || null,
      },
    });
  } catch (error) {
    // Email and in-app delivery are separate channels. A database issue in one
    // channel must not suppress the other.
    console.error("Expert operational in-app notification failed:", error);
  }

  const email = clean(input.expertEmail, 320);
  if (!email) return;

  const template = buildOperationalTemplate({
    recipient: "expert",
    eyebrow: "Expert project update",
    title: input.title,
    intro: input.message,
    projectName: input.projectName,
    service: input.service,
    studio: input.studio,
    status: input.status,
    details: input.details,
    ctaLabel: "Open Expert Portal",
    ctaUrl: sitePath(href),
    note: "This is a private Heyy Studio project update. Client billing and Heyy Studio margin are not shared with Experts.",
  });

  try {
    await sendTrackedEmail({
      eventKey: input.key,
      userId: input.expertUserId || null,
      to: email,
      templateKey: "expert.project.operational",
      subject: `${input.title}${input.projectName ? ` — ${input.projectName}` : ""}`,
      html: buildEmail(template),
      text: buildPlainTextEmail(template),
      relatedType: "expert_project",
      relatedId: input.key,
      attachments: input.attachments,
      metadata: {
        project_name: input.projectName || null,
        service: input.service || null,
        studio: input.studio || null,
      },
    });
  } catch (error) {
    console.error("Expert operational email failed:", error);
  }
}

export async function notifyAdminOperationalEvent(
  admin: SupabaseClient,
  input: {
    key: string;
    type: string;
    projectName?: string | null;
    service?: string | null;
    studio?: string | null;
    title: string;
    message: string;
    status?: string | null;
    details?: Array<{ label: string; value: string | null | undefined }>;
    href: string;
    sendEmail?: boolean;
    ctaLabel?: string;
  },
) {
  const recipient = await resolveAdminRecipient(admin);

  for (const userId of recipient.userIds) {
    try {
      await insertInAppNotification(admin, {
        userId,
        key: input.key,
        type: input.type,
        title: input.title,
        message: input.message,
        href: input.href,
        metadata: {
          project_name: input.projectName || null,
          service: input.service || null,
          studio: input.studio || null,
        },
      });
    } catch (error) {
      console.error("Admin operational in-app notification failed:", error);
    }
  }

  if (!recipient.email || input.sendEmail === false) return;

  const template = buildOperationalTemplate({
    recipient: "admin",
    eyebrow: "Expert operations",
    title: input.title,
    intro: input.message,
    projectName: input.projectName,
    service: input.service,
    studio: input.studio,
    status: input.status,
    details: input.details,
    ctaLabel: input.ctaLabel || "Open production job",
    ctaUrl: sitePath(input.href),
  });

  try {
    await sendTrackedEmail({
      eventKey: input.key,
      userId: recipient.userIds[0] || null,
      to: recipient.email,
      templateKey: "expert.project.operational.admin",
      subject: `${input.title}${input.projectName ? ` — ${input.projectName}` : ""}`,
      html: buildEmail(template),
      text: buildPlainTextEmail(template),
      relatedType: "expert_project",
      relatedId: input.key,
      metadata: {
        project_name: input.projectName || null,
        service: input.service || null,
        studio: input.studio || null,
      },
    });
  } catch (error) {
    console.error("Admin Expert-operations email failed:", error);
  }
}
