import "server-only";

import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import { resolveCommunicationTemplate } from "./templates";
import { sendTrackedEmail } from "./send-email";

type ExpertPositionSummary = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
};

type ExpertApplicationEmailInput = {
  applicationId: string;
  name: string;
  email: string;
  location?: string | null;
  portfolioUrl?: string | null;
  linkedinUrl?: string | null;
  availability?: string | null;
  source?: string | null;
  position: ExpertPositionSummary;
};

export async function sendExpertNetworkApplicationEmails(input: ExpertApplicationEmailInput) {
  const results = await Promise.allSettled([
    retryApplicationEmail(() => sendApplicantConfirmation(input)),
    retryApplicationEmail(() => sendAdminNotification(input)),
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(index === 0
        ? "Expert Network applicant confirmation email failed:"
        : "Expert Network Admin notification email failed:", result.reason);
    }
  });

  return { applicant: results[0], admin: results[1] };
}

async function retryApplicationEmail<T>(send: () => Promise<T>) {
  try {
    return await send();
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    try {
      return await send();
    } catch {
      throw firstError;
    }
  }
}

// Backward-compatible alias for any older code paths.
export const sendCareerApplicationEmails = sendExpertNetworkApplicationEmails;

async function sendApplicantConfirmation(input: ExpertApplicationEmailInput) {
  const firstName = input.name.trim().split(/\s+/)[0] || "there";
  const resolved = await resolveCommunicationTemplate({
    templateKey: "career.application.received.client",
    fallback: {
      subject: "Expert Network application received — {{role_title}}",
      preheader: "We’ve received your Heyy Studio Expert Network application.",
      eyebrow: "Expert Network application",
      title: "Thanks for applying to the Heyy Studio Expert Network",
      body: "Thank you for applying for {{role_title}}, {{first_name}}. We’ve received your application and will review your experience, portfolio and availability. If you’re shortlisted, we’ll contact you directly about the next step.",
      ctaLabel: "View Expert Network",
    },
    variables: {
      first_name: firstName,
      role_title: input.position.title,
      applicant_name: input.name,
    },
  });

  if (!resolved.enabled) return { sent: false, duplicate: false };

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    status: "Application received",
    details: [
      { label: "Opportunity", value: input.position.title },
      input.position.department ? { label: "Studio", value: input.position.department } : null,
      input.position.location ? { label: "Work model", value: input.position.location } : null,
      input.availability ? { label: "Availability", value: input.availability } : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    detailsTitle: "Application details",
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/expertsnetwork"),
    supportingCopy: "This is a project-based freelance Expert Network, not a full-time employment offer. You do not need to submit the same application again.",
  };

  return sendTrackedEmail({
    eventKey: `expert-application:${input.applicationId}:applicant`,
    to: input.email,
    templateKey: "career.application.received.client",
    subject: resolved.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    relatedType: "career_application",
    relatedId: input.applicationId,
    metadata: { position_id: input.position.id, role_title: input.position.title, source: input.source || "direct" },
  });
}

async function sendAdminNotification(input: ExpertApplicationEmailInput) {
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
  if (!adminEmail) {
    console.warn("Expert Network Admin notification skipped because ADMIN_EMAIL is not configured.");
    return { sent: false, duplicate: false };
  }

  const resolved = await resolveCommunicationTemplate({
    templateKey: "career.application.received.admin",
    fallback: {
      subject: "New Expert Network application — {{role_title}}",
      preheader: "A new Expert Network candidate is ready for review.",
      eyebrow: "New Expert Network application",
      title: "A new expert candidate is ready for review",
      body: "{{applicant_name}} submitted an application for {{role_title}}. Review the CV, portfolio, availability and candidate details in Admin.",
      ctaLabel: "Review application",
    },
    variables: { role_title: input.position.title, applicant_name: input.name },
  });

  if (!resolved.enabled) return { sent: false, duplicate: false };

  const details = [
    { label: "Opportunity", value: input.position.title },
    { label: "Applicant", value: input.name },
    { label: "Email", value: input.email },
    input.location ? { label: "Current location", value: input.location } : null,
    input.availability ? { label: "Availability", value: input.availability } : null,
    input.portfolioUrl ? { label: "Portfolio", value: input.portfolioUrl } : null,
    input.linkedinUrl ? { label: "LinkedIn", value: input.linkedinUrl } : null,
    input.source ? { label: "Source", value: input.source } : null,
    { label: "Application ID", value: input.applicationId },
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    recipient: "admin" as const,
    status: "New candidate",
    details,
    detailsTitle: "Candidate details",
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath(`/admin/platform/applications?application=${encodeURIComponent(input.applicationId)}`),
    supportingCopy: "CV files remain private and are only available through the authenticated Admin download route.",
  };

  return sendTrackedEmail({
    eventKey: `expert-application:${input.applicationId}:admin`,
    to: adminEmail,
    templateKey: "career.application.received.admin",
    subject: resolved.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    relatedType: "career_application",
    relatedId: input.applicationId,
    metadata: {
      position_id: input.position.id,
      role_title: input.position.title,
      applicant_email: input.email,
      source: input.source || "direct",
    },
  });
}
