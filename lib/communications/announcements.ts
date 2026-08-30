import "server-only";

import { createClient } from "@supabase/supabase-js";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import { getAccountPreferences } from "@/lib/account/preferences";
import { sendTrackedEmail } from "./send-email";

export type AnnouncementAudience = "everyone" | "free" | "starter" | "pro" | "subscribers";
export type AnnouncementChannel = "email" | "in_app" | "both";

type AnnouncementRow = {
  id: string;
  title: string;
  subject: string;
  preheader?: string | null;
  body: string;
  cta_label?: string | null;
  cta_path?: string | null;
  audience: AnnouncementAudience;
  channel: AnnouncementChannel;
};

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function listAllUsers() {
  const admin = adminClient();
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

function activePaid(status: unknown) {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

export async function sendAnnouncement(announcement: AnnouncementRow) {
  const admin = adminClient();
  const users = await listAllUsers();
  const ids = users.map((user) => user.id);
  const fallbackId = "00000000-0000-0000-0000-000000000000";
  const { data: subscriptions, error: subscriptionError } = await admin
    .from("user_subscriptions")
    .select("user_id,plan,status")
    .in("user_id", ids.length ? ids : [fallbackId]);
  if (subscriptionError) throw subscriptionError;

  const subscriptionMap = new Map((subscriptions || []).map((row) => [row.user_id, row]));
  let sentCount = 0;
  let failedCount = 0;

  for (const user of users) {
    if (!user.email) continue;
    const subscription = subscriptionMap.get(user.id) as { plan?: string; status?: string } | undefined;
    const plan = activePaid(subscription?.status) ? String(subscription?.plan || "free").toLowerCase() : "free";
    if (!matchesAudience(plan, announcement.audience)) continue;

    const preferences = await getAccountPreferences(admin, user.id);
    const firstName = String(user.user_metadata?.full_name || user.user_metadata?.name || "there").trim().split(/\s+/)[0] || "there";
    const destination = sitePath(normalizePath(announcement.cta_path || "/dashboard"));
    const intro = announcement.body.replace(/\{\{\s*first_name\s*\}\}/gi, firstName);

    if (announcement.channel === "email" || announcement.channel === "both") {
      if (preferences.marketing_email) {
        try {
          const template = {
            eyebrow: "Heyy Studio update",
            title: announcement.title,
            intro,
            preheader: announcement.preheader || announcement.subject,
            ctaLabel: announcement.cta_label || "Open Heyy Studio",
            ctaUrl: destination,
          };
          const result = await sendTrackedEmail({
            eventKey: `announcement:${announcement.id}:${user.id}:email`,
            userId: user.id,
            to: user.email,
            templateKey: "announcement",
            subject: announcement.subject.replace(/\{\{\s*first_name\s*\}\}/gi, firstName),
            html: buildEmail(template),
            text: buildPlainTextEmail(template),
            relatedType: "announcement",
            relatedId: announcement.id,
            metadata: { audience: announcement.audience },
          });
          if (result.sent || result.duplicate) sentCount += 1;
        } catch (error) {
          failedCount += 1;
          console.error("Announcement email failed:", error);
        }
      }
    }

    if (announcement.channel === "in_app" || announcement.channel === "both") {
      try {
        const { data: existing } = await admin
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .contains("metadata", { announcement_id: announcement.id })
          .limit(1)
          .maybeSingle();
        if (!existing) {
          const { error } = await admin.from("notifications").insert({
            user_id: user.id,
            type: "announcement",
            title: announcement.title,
            message: intro,
            href: normalizePath(announcement.cta_path || "/dashboard"),
            metadata: { announcement_id: announcement.id, audience: announcement.audience },
          });
          if (error) throw error;
          sentCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        console.error("Announcement in-app delivery failed:", error);
      }
    }
  }

  return { sentCount, failedCount };
}

function matchesAudience(plan: string, audience: AnnouncementAudience) {
  if (audience === "everyone") return true;
  if (audience === "subscribers") return plan === "starter" || plan === "pro";
  return plan === audience;
}

function normalizePath(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "/dashboard";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return `${url.pathname}${url.search}${url.hash}` || "/dashboard";
    } catch {
      return "/dashboard";
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
