import "server-only";

import type { User } from "@supabase/supabase-js";
import { getHeyyEmailLogoPng } from "@/lib/communications/brand-assets";
import { resolveCommunicationTemplate } from "@/lib/communications/templates";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { resend } from "@/lib/notifications/resend";
import { sitePath } from "@/lib/site-url";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Heyy Studio <hello@heyystudio.com>";

export async function sendGoodbyeEmail(user: User) {
  if (!user.email) return { sent: false };

  const firstName = String(
    user.user_metadata?.full_name || user.user_metadata?.name || "there",
  )
    .trim()
    .split(/\s+/)[0] || "there";

  const resolved = await resolveCommunicationTemplate({
    templateKey: "account.goodbye",
    fallback: {
      subject: "Your Heyy Studio account has been deleted",
      preheader: "Your Heyy Studio account deletion is complete.",
      eyebrow: "Account deleted",
      title: "Thanks for creating with us",
      body: "Thanks for being part of Heyy Studio, {{first_name}}. Your account has been deleted and access to your workspace has ended. Limited payment or compliance records may be retained where required for billing, tax, fraud-prevention or legal obligations.",
      ctaLabel: "Visit Heyy Studio",
    },
    variables: { first_name: firstName },
  });

  if (!resolved.enabled) return { sent: false };

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/"),
    supportingCopy:
      "If you decide to return later, you can create a new account. One-time signup promotions are not reissued to an email address that has already claimed them.",
  };

  const logo = await getHeyyEmailLogoPng();
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject: resolved.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    ...(logo
      ? {
          attachments: [
            {
              filename: logo.filename,
              content: logo.buffer.toString("base64"),
              contentId: logo.contentId,
            },
          ],
        }
      : {}),
  });

  return { sent: true, id: result.data?.id || null };
}
