import "server-only";

import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import { resolveCommunicationTemplate } from "./templates";
import { sendTrackedEmail } from "./send-email";

type CareerPositionSummary = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
};

type CareerApplicationEmailInput = {
  applicationId: string;
  name: string;
  email: string;
  location?: string | null;
  portfolioUrl?: string | null;
  linkedinUrl?: string | null;
  position: CareerPositionSummary;
};

export async function sendCareerApplicationEmails(input: CareerApplicationEmailInput) {
  const results = await Promise.allSettled([
    sendApplicantConfirmation(input),
    sendAdminNotification(input),
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        index === 0
          ? "Career applicant confirmation email failed:"
          : "Career Admin notification email failed:",
        result.reason,
      );
    }
  });

  return {
    applicant: results[0],
    admin: results[1],
  };
}

async function sendApplicantConfirmation(input: CareerApplicationEmailInput) {
  const firstName = input.name.trim().split(/\s+/)[0] || "there";
  const resolved = await resolveCommunicationTemplate({
    templateKey: "career.application.received.client",
    fallback: {
      subject: "Application received — {{role_title}}",
      preheader: "We’ve received your application to Heyy Studio.",
      eyebrow: "Application received",
      title: "Thanks for applying to Heyy Studio",
      body: "Thank you for applying for {{role_title}}, {{first_name}}. We’ve received your application. Our team will review it and we’ll contact you if you’re shortlisted for the next stage.",
      ctaLabel: "View careers",
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
      { label: "Role", value: input.position.title },
      input.position.department ? { label: "Department", value: input.position.department } : null,
      input.position.location ? { label: "Role location", value: input.position.location } : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    detailsTitle: "Application details",
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/careers"),
    supportingCopy: "You do not need to submit the same application again. We’ll contact you only if you’re shortlisted for the next stage.",
  };

  return sendTrackedEmail({
    eventKey: `career-application:${input.applicationId}:applicant`,
    to: input.email,
    templateKey: "career.application.received.client",
    subject: resolved.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    relatedType: "career_application",
    relatedId: input.applicationId,
    metadata: {
      position_id: input.position.id,
      role_title: input.position.title,
    },
  });
}

async function sendAdminNotification(input: CareerApplicationEmailInput) {
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
  if (!adminEmail) {
    console.warn("Career Admin notification skipped because ADMIN_EMAIL is not configured.");
    return { sent: false, duplicate: false };
  }

  const resolved = await resolveCommunicationTemplate({
    templateKey: "career.application.received.admin",
    fallback: {
      subject: "New career application — {{role_title}}",
      preheader: "A new candidate application is ready for review.",
      eyebrow: "New career application",
      title: "A new candidate is ready for review",
      body: "{{applicant_name}} submitted an application for {{role_title}}. Review the application, CV and candidate links in Admin.",
      ctaLabel: "Review application",
    },
    variables: {
      role_title: input.position.title,
      applicant_name: input.name,
    },
  });

  if (!resolved.enabled) return { sent: false, duplicate: false };

  const details = [
    { label: "Role", value: input.position.title },
    { label: "Applicant", value: input.name },
    { label: "Email", value: input.email },
    input.location ? { label: "Current location", value: input.location } : null,
    input.portfolioUrl ? { label: "Portfolio", value: input.portfolioUrl } : null,
    input.linkedinUrl ? { label: "LinkedIn", value: input.linkedinUrl } : null,
    { label: "Application ID", value: input.applicationId },
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    recipient: "admin" as const,
    status: "New",
    details,
    detailsTitle: "Candidate details",
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/admin/platform/applications"),
    supportingCopy: "The CV remains private and is available only through the authenticated Admin download route.",
  };

  return sendTrackedEmail({
    eventKey: `career-application:${input.applicationId}:admin`,
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
    },
  });
}
