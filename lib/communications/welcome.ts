import "server-only";

import type { User } from "@supabase/supabase-js";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import { resolveCommunicationTemplate } from "./templates";
import { sendTrackedEmail } from "./send-email";

export async function sendWelcomeEmail(user: User) {
  if (!user.email) return { sent: false, duplicate: false };
  const firstName = String(
    user.user_metadata?.full_name || user.user_metadata?.name || "there",
  )
    .trim()
    .split(/\s+/)[0] || "there";

  const resolved = await resolveCommunicationTemplate({
    templateKey: "welcome",
    fallback: {
      subject: "Welcome to Heyy Studio",
      preheader: "Your Heyy Studio workspace is ready.",
      eyebrow: "Welcome",
      title: "Your creative workspace is ready",
      body: "Welcome {{first_name}}. Explore Studios, use the creative tools and bring in expert production whenever an idea is ready to become a finished asset.",
      ctaLabel: "Start creating",
    },
    variables: { first_name: firstName },
  });

  if (!resolved.enabled) return { sent: false, duplicate: false };

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/dashboard"),
  };

  return sendTrackedEmail({
    eventKey: `welcome:${user.id}`,
    userId: user.id,
    to: user.email,
    templateKey: "welcome",
    subject: resolved.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    relatedType: "account",
    relatedId: user.id,
  });
}
