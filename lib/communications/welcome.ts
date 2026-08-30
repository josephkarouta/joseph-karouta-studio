import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import { resolveCommunicationTemplate } from "./templates";
import { sendTrackedEmail } from "./send-email";
import { getWelcomeCreditAmount } from "@/lib/credits/welcome";

export async function sendWelcomeEmail(user: User) {
  if (!user.email) return { sent: false, duplicate: false };

  // Provision the verified account before sending the welcome message. This
  // function is idempotent in Supabase, so refreshes or repeated callbacks
  // cannot grant the one-time welcome balance twice. Set HEYY_WELCOME_CREDITS
  // to 0 later to end the launch promotion without another code change.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: welcomeCreditError } = await admin.rpc(
    "heyy_grant_verified_signup_credits",
    {
      p_user_id: user.id,
      p_amount: getWelcomeCreditAmount(),
    },
  );
  if (welcomeCreditError) {
    throw new Error(`Welcome credits could not be provisioned: ${welcomeCreditError.message}`);
  }

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
