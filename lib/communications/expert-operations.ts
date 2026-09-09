import "server-only";

import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import { resolveCommunicationTemplate } from "./templates";
import { sendTrackedEmail } from "./send-email";

function clean(value: unknown, max = 12000) {
  return String(value ?? "").trim().slice(0, max);
}

function money(cents: number | null | undefined, currency = "USD") {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) return null;
  const amount = Number(cents) / 100;
  const code = clean(currency, 10).toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function studioLabel(studio?: string | null) {
  const value = clean(studio, 100).toLowerCase();
  if (value === "brand_studio" || value === "brand") return "Brand Studio";
  if (value === "marketing_studio" || value === "marketing") return "Marketing Studio";
  if (value === "architecture_studio" || value === "architecture") return "Architecture Studio";
  if (value === "interior_studio" || value === "interior") return "Interior Design Studio";
  return clean(studio, 100) || "Heyy Studio";
}

type SharedScope = {
  projectName?: string | null;
  service?: string | null;
  studio?: string | null;
  brief?: string | null;
  requestedDeadline?: string | null;
};

type ExpertRecipient = {
  id: string;
  user_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  role_title?: string | null;
};

export async function sendExpertQuoteRequestEmails(input: {
  requestId: string;
  sharedScope: SharedScope;
  experts: ExpertRecipient[];
}) {
  const recipients = input.experts.filter((expert) => clean(expert.email, 320));
  const results = await Promise.allSettled(
    recipients.map((expert) => sendExpertQuoteRequestEmail({
      requestId: input.requestId,
      sharedScope: input.sharedScope,
      expert,
    })),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Expert quote-request email failed for ${recipients[index]?.email || "unknown Expert"}:`,
        result.reason,
      );
    }
  });

  return results;
}

async function sendExpertQuoteRequestEmail(input: {
  requestId: string;
  sharedScope: SharedScope;
  expert: ExpertRecipient;
}) {
  const email = clean(input.expert.email, 320);
  if (!email) return { sent: false, duplicate: false };

  const projectName = clean(input.sharedScope.projectName, 300) || "Untitled project";
  const service = clean(input.sharedScope.service, 300) || "Production";
  const studio = clean(input.sharedScope.studio, 100);
  const expertName = clean(input.expert.full_name, 200) || "Expert";
  const deadline = clean(input.sharedScope.requestedDeadline, 200);
  const brief = clean(input.sharedScope.brief, 2500);

  const resolved = await resolveCommunicationTemplate({
    templateKey: "expert.quote_requested.expert",
    fallback: {
      subject: "New project quote request — {{project_name}}",
      preheader: "Heyy Studio has shared a new private project opportunity with you.",
      eyebrow: "New Expert opportunity",
      title: "Heyy Studio is requesting your quote",
      body: "A new {{studio_label}} opportunity for {{project_name}} is ready for you to review. Open your Expert Portal to check the shared scope and submit your private fee, turnaround and included revisions.",
      ctaLabel: "Review opportunity",
    },
    variables: {
      expert_name: expertName,
      project_name: projectName,
      service,
      studio: studio || "Heyy Studio",
      studio_label: studioLabel(studio),
    },
  });

  if (!resolved.enabled) return { sent: false, duplicate: false };

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    recipient: "expert" as const,
    studio,
    projectName,
    service,
    status: "Quote requested",
    details: [
      { label: "Expert", value: expertName },
      { label: "Studio", value: studioLabel(studio) },
      deadline ? { label: "Requested deadline", value: deadline } : null,
      { label: "Shared scope", value: brief || "Open the Expert Portal to review the shared production brief." },
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    detailsTitle: "Opportunity details",
    note: "This is a private Heyy Studio opportunity. Client billing, Heyy Studio margin and unrelated client information are not shared with Experts.",
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/expert"),
    supportingCopy: "Submit your quote inside the Expert Portal. Work does not begin until Heyy Studio confirms the assignment after client payment.",
  };

  return sendTrackedEmail({
    eventKey: `expert-quote-request:${input.requestId}:${input.expert.id}`,
    userId: input.expert.user_id || null,
    to: email,
    templateKey: "expert.quote_requested.expert",
    subject: resolved.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    relatedType: "studio_request",
    relatedId: input.requestId,
    metadata: {
      expert_profile_id: input.expert.id,
      project_name: projectName,
      service,
      studio,
    },
  });
}

export async function sendAdminExpertQuoteSubmittedEmail(input: {
  requestId: string;
  opportunityId: string;
  expertName: string;
  expertEmail?: string | null;
  projectName: string;
  service?: string | null;
  studio?: string | null;
  feeCents: number;
  currency?: string | null;
  turnaroundDays: number;
  includedRevisions: number;
  extraRevisionFeeCents?: number | null;
  notes?: string | null;
  isUpdate?: boolean;
  submittedAt: string;
}) {
  const adminEmail = clean(process.env.ADMIN_EMAIL, 320);
  if (!adminEmail) {
    console.warn("Expert quote Admin notification skipped because ADMIN_EMAIL is not configured.");
    return { sent: false, duplicate: false };
  }

  const amount = money(input.feeCents, input.currency || "USD") || "—";
  const resolved = await resolveCommunicationTemplate({
    templateKey: "expert.quote_submitted.admin",
    fallback: {
      subject: "Expert quote received — {{project_name}}",
      preheader: "An Expert has responded to a private Heyy Studio quote request.",
      eyebrow: "Expert quote received",
      title: "An Expert quote is ready to compare",
      body: "{{expert_name}} submitted a private production quote for {{project_name}}. Review the Expert fee, turnaround and included revisions before selecting a preferred Expert and preparing the client quote.",
      ctaLabel: "Review Expert quote",
    },
    variables: {
      expert_name: input.expertName,
      project_name: input.projectName,
      service: input.service || "Production",
      studio: input.studio || "Heyy Studio",
      amount,
    },
  });

  if (!resolved.enabled) return { sent: false, duplicate: false };

  const template = {
    eyebrow: input.isUpdate ? "Expert quote updated" : resolved.eyebrow,
    title: input.isUpdate ? "An Expert updated their quote" : resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    recipient: "admin" as const,
    studio: input.studio,
    projectName: input.projectName,
    service: input.service,
    status: input.isUpdate ? "Quote updated" : "Quote received",
    amount,
    details: [
      { label: "Expert", value: input.expertName },
      input.expertEmail ? { label: "Expert email", value: input.expertEmail } : null,
      { label: "Turnaround", value: `${input.turnaroundDays} day${input.turnaroundDays === 1 ? "" : "s"}` },
      { label: "Included revisions", value: String(input.includedRevisions) },
      input.extraRevisionFeeCents !== null && input.extraRevisionFeeCents !== undefined
        ? { label: "Expert fee per extra revision", value: money(input.extraRevisionFeeCents, input.currency || "USD") || "—" }
        : null,
      input.notes ? { label: "Expert notes", value: input.notes } : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    detailsTitle: "Private Expert costing",
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath(`/admin/studio-requests/${encodeURIComponent(input.requestId)}`),
    supportingCopy: "Expert fees are internal Heyy Studio costs and are never shown to the client.",
  };

  try {
    return await sendTrackedEmail({
      eventKey: `expert-quote-submitted:${input.opportunityId}:${input.submittedAt}`,
      to: adminEmail,
      templateKey: "expert.quote_submitted.admin",
      subject: input.isUpdate ? `Expert quote updated — ${input.projectName}` : resolved.subject,
      html: buildEmail(template),
      text: buildPlainTextEmail(template),
      relatedType: "expert_opportunity",
      relatedId: input.opportunityId,
      metadata: {
        studio_request_id: input.requestId,
        expert_name: input.expertName,
        expert_email: input.expertEmail || null,
        fee_cents: input.feeCents,
        currency: input.currency || "USD",
        turnaround_days: input.turnaroundDays,
        included_revisions: input.includedRevisions,
      },
    });
  } catch (error) {
    console.error("Expert quote Admin email failed:", error);
    return { sent: false, duplicate: false };
  }
}

export async function sendAdminExpertOpportunityDeclinedEmail(input: {
  requestId: string;
  opportunityId: string;
  expertName: string;
  projectName: string;
  service?: string | null;
  studio?: string | null;
}) {
  const adminEmail = clean(process.env.ADMIN_EMAIL, 320);
  if (!adminEmail) return { sent: false, duplicate: false };

  const template = {
    eyebrow: "Expert opportunity declined",
    title: "An Expert declined a quote request",
    intro: `${input.expertName} declined the private opportunity for ${input.projectName}. You can return to Expert Sourcing and request a quote from another available Expert.`,
    preheader: `${input.expertName} declined an Expert quote request.`,
    recipient: "admin" as const,
    studio: input.studio,
    projectName: input.projectName,
    service: input.service,
    status: "Declined",
    details: [{ label: "Expert", value: input.expertName }],
    detailsTitle: "Opportunity update",
    ctaLabel: "Open Expert Sourcing",
    ctaUrl: sitePath(`/admin/studio-requests/${encodeURIComponent(input.requestId)}`),
    supportingCopy: "The client is not notified about private Expert sourcing activity.",
  };

  try {
    return await sendTrackedEmail({
      eventKey: `expert-opportunity-declined:${input.opportunityId}`,
      to: adminEmail,
      templateKey: "expert.quote_declined.admin",
      subject: `Expert declined quote request — ${input.projectName}`,
      html: buildEmail(template),
      text: buildPlainTextEmail(template),
      relatedType: "expert_opportunity",
      relatedId: input.opportunityId,
      metadata: { studio_request_id: input.requestId, expert_name: input.expertName },
    });
  } catch (error) {
    console.error("Expert decline Admin email failed:", error);
    return { sent: false, duplicate: false };
  }
}

export async function sendPreferredExpertEmail(input: {
  requestId: string;
  opportunityId: string;
  expert: ExpertRecipient;
  projectName: string;
  service?: string | null;
  studio?: string | null;
  feeCents?: number | null;
  currency?: string | null;
  turnaroundDays?: number | null;
  includedRevisions?: number | null;
}) {
  const email = clean(input.expert.email, 320);
  if (!email) return { sent: false, duplicate: false };

  const resolved = await resolveCommunicationTemplate({
    templateKey: "expert.preferred.expert",
    fallback: {
      subject: "You’re the preferred Expert — {{project_name}}",
      preheader: "Heyy Studio has selected your quote as the preferred option, pending client payment.",
      eyebrow: "Preferred Expert",
      title: "Heyy Studio selected your quote",
      body: "Your quote for {{project_name}} has been selected as Heyy Studio’s preferred option. The project is not assigned yet; it will move to Assigned Projects only after the client approves the Heyy Studio quote and payment is confirmed.",
      ctaLabel: "Open Expert Portal",
    },
    variables: {
      expert_name: input.expert.full_name || "Expert",
      project_name: input.projectName,
      service: input.service || "Production",
      studio: input.studio || "Heyy Studio",
    },
  });

  if (!resolved.enabled) return { sent: false, duplicate: false };

  const template = {
    eyebrow: resolved.eyebrow,
    title: resolved.title,
    intro: resolved.body,
    preheader: resolved.preheader,
    recipient: "expert" as const,
    studio: input.studio,
    projectName: input.projectName,
    service: input.service,
    status: "Preferred — awaiting client payment",
    amount: money(input.feeCents, input.currency || "USD"),
    details: [
      input.turnaroundDays ? { label: "Your turnaround", value: `${input.turnaroundDays} days` } : null,
      input.includedRevisions !== null && input.includedRevisions !== undefined
        ? { label: "Included revisions", value: String(input.includedRevisions) }
        : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    detailsTitle: "Preferred quote",
    note: "Do not begin work yet. Heyy Studio will notify you when the client payment is confirmed and the project becomes an active assignment.",
    ctaLabel: resolved.ctaLabel,
    ctaUrl: sitePath("/expert"),
    supportingCopy: "Client pricing and Heyy Studio margin remain private and are not part of the Expert assignment.",
  };

  try {
    return await sendTrackedEmail({
      eventKey: `expert-preferred:${input.opportunityId}`,
      userId: input.expert.user_id || null,
      to: email,
      templateKey: "expert.preferred.expert",
      subject: resolved.subject,
      html: buildEmail(template),
      text: buildPlainTextEmail(template),
      relatedType: "expert_opportunity",
      relatedId: input.opportunityId,
      metadata: { studio_request_id: input.requestId, expert_profile_id: input.expert.id },
    });
  } catch (error) {
    console.error("Preferred Expert email failed:", error);
    return { sent: false, duplicate: false };
  }
}
