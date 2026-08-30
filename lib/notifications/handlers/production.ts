import { buildClientProjectHref, buildNotificationKey } from "../content";
import { NotificationPayload } from "../types";
import { buildEmail, buildPlainTextEmail } from "../templates";
import { sitePath } from "@/lib/site-url";
import { productionTemplateKey, resolveCommunicationTemplate } from "@/lib/communications/templates";
import { sendTrackedEmail } from "@/lib/communications/send-email";


export async function handleProductionNotification(payload: NotificationPayload) {
  switch (payload.event) {
    case "production.requested":
      await sendProductionRequested(payload);
      break;
    case "quote.ready":
      await sendQuoteReady(payload);
      break;
    case "quote.replied":
      await sendQuoteReply(payload);
      break;
    case "production.message.client":
      await sendClientProductionMessage(payload);
      break;
    case "production.message.studio":
      await sendStudioProductionMessage(payload);
      break;
    case "payment.received":
      await sendPaymentReceived(payload);
      break;
    case "revision.requested":
      await sendRevisionRequested(payload);
      break;
    case "revision.ready":
      await sendRevisionReady(payload);
      break;
    case "revision.approved":
      await sendRevisionApproved(payload);
      break;
    case "production.assigned":
    case "production.started":
    case "production.review":
    case "deliverables.uploaded":
    case "project.completed":
      await sendProductionStatusUpdate(payload);
      break;
    default:
      return;
  }
}

async function sendProductionRequested(payload: NotificationPayload) {
  try {
    const requestId = stringValue(payload.metadata?.requestId);
    const adminUrl = requestId ? sitePath(`/admin/studio-requests/${requestId}`) : sitePath("/admin/studio-requests");

    await sendAdminEmail(payload, {
      subject: `New ${payload.service || "production"} request — ${payload.projectName || "Untitled project"}`,
      eyebrow: "New production request",
      title: "A project is ready for review",
      intro: "A client submitted a production request with the connected Studio context. Review the brief, generated outputs and notes before preparing the quote.",
      status: "New request",
      details: [
        { label: "Client", value: payload.clientName || "Not provided" },
        { label: "Client email", value: payload.clientEmail || "Not provided" },
        { label: "Request ID", value: requestId },
      ],
      ctaLabel: "Review request",
      ctaUrl: adminUrl,
    });

    await sendClientEmail(payload, {
      subject: "We received your production request",
      eyebrow: "Production request received",
      title: "Your request is with the Heyy Studio team",
      intro: "Your production request was received successfully. Our team will review the selected concept, project context and requested scope before preparing a clear quote.",
      status: "Under review",
      note: "Production does not begin until you review the quote and complete payment.",
      ctaLabel: "Open your dashboard",
      ctaUrl: sitePath(buildClientProjectHref(payload)),
    });
  } catch (error) {
    console.error("Production notification failed", error);
  }
}

async function sendQuoteReady(payload: NotificationPayload) {
  try {
    const amount = formatAmount(payload.metadata?.amount, payload.metadata?.currency);
    const requestId = stringValue(payload.metadata?.requestId);
    const quoteId = stringValue(payload.metadata?.quoteId);
    const estimatedDays = stringValue(payload.metadata?.estimatedDays);
    const includedRevisions = stringValue(payload.metadata?.includedRevisions);

    await sendClientEmail(payload, {
      subject: `Your ${payload.service || "production"} quote is ready`,
      eyebrow: "Quote ready",
      title: "Review your production proposal",
      intro: "Your Heyy Studio quote is ready. Open the project workspace to review the scope, price, delivery estimate and included revisions before continuing to payment.",
      status: "Action required",
      amount,
      details: [
        { label: "Estimated delivery", value: estimatedDays ? `${estimatedDays} days` : null },
        { label: "Included revisions", value: includedRevisions },
        { label: "Quote ID", value: quoteId },
      ],
      ctaLabel: "Review quote",
      ctaUrl: sitePath(buildClientProjectHref(payload)),
    });

    await sendAdminEmail(payload, {
      subject: `Quote sent — ${payload.projectName || "Untitled project"}`,
      eyebrow: "Quote sent",
      title: "The client can now review the quote",
      intro: "The quote was created and connected to the Studio request. The client has been notified and can review the proposal from their workspace.",
      status: "Sent",
      amount,
      details: [
        { label: "Estimated delivery", value: estimatedDays ? `${estimatedDays} days` : null },
        { label: "Included revisions", value: includedRevisions },
        { label: "Quote ID", value: quoteId },
      ],
      ctaLabel: "Open request",
      ctaUrl: requestId ? sitePath(`/admin/studio-requests/${requestId}`) : sitePath("/admin/studio-requests"),
    });
  } catch (error) {
    console.error("Quote Ready notification failed", error);
  }
}

async function sendQuoteReply(payload: NotificationPayload) {
  try {
    const replyMessage = stringValue(payload.metadata?.replyMessage);
    const questionMessage = stringValue(payload.metadata?.questionMessage);

    await sendClientEmail(payload, {
      subject: `Heyy Studio replied to your ${payload.service || "production"} quote question`,
      eyebrow: "Quote question answered",
      title: "A new reply is waiting in your workspace",
      intro: "The Heyy Studio team answered your question about the production quote. Open the project workspace to review the reply and continue when you are ready.",
      status: "Answered",
      details: [
        { label: "Your question", value: questionMessage || null },
        { label: "Heyy Studio reply", value: replyMessage || null },
      ],
      ctaLabel: "View quote conversation",
      ctaUrl: sitePath(buildClientProjectHref(payload)),
    });
  } catch (error) {
    console.error("Quote reply notification failed", error);
  }
}

async function sendClientProductionMessage(payload: NotificationPayload) {
  try {
    const productionJobId = stringValue(payload.metadata?.productionJobId);
    const message = stringValue(payload.metadata?.message);
    const attachmentCount = Number(payload.metadata?.attachmentCount || 0);

    await sendAdminEmail(payload, {
      subject: `New client message — ${payload.projectName || "Untitled project"}`,
      eyebrow: "Client message",
      title: "A client sent a production message",
      intro:
        "A new message was added to the paid production workspace. Open the job to reply and keep the conversation inside Heyy Studio.",
      status: "Reply needed",
      details: [
        { label: "Client", value: payload.clientName || payload.clientEmail || "Client" },
        { label: "Message", value: message || null },
        {
          label: "Attachments",
          value: attachmentCount > 0 ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}` : null,
        },
        { label: "Production job", value: productionJobId },
      ],
      ctaLabel: "Reply in production",
      ctaUrl: productionJobId
        ? sitePath(`/admin/production/${productionJobId}?tab=Communication`)
        : sitePath("/admin?tab=production"),
    });
  } catch (error) {
    console.error("Client production message notification failed", error);
  }
}

async function sendStudioProductionMessage(payload: NotificationPayload) {
  try {
    const productionJobId = stringValue(payload.metadata?.productionJobId);
    const message = stringValue(payload.metadata?.message);
    const attachmentCount = Number(payload.metadata?.attachmentCount || 0);
    const senderName = stringValue(payload.metadata?.senderName) || "Heyy Studio";

    await sendClientEmail(payload, {
      subject: `New production message for ${payload.projectName || "your project"}`,
      eyebrow: "Production message",
      title: `${senderName} sent you a message`,
      intro:
        "A new message was added to your production workspace. Open the project to read it, download any attached references and reply.",
      status: "New message",
      details: [
        { label: "Message", value: message || null },
        {
          label: "Attachments",
          value: attachmentCount > 0 ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}` : null,
        },
        { label: "Production job", value: productionJobId },
      ],
      ctaLabel: "Open conversation",
      ctaUrl: `${sitePath(buildClientProjectHref(payload))}#production-messages`,
    });
  } catch (error) {
    console.error("Studio production message notification failed", error);
  }
}

async function sendPaymentReceived(payload: NotificationPayload) {
  try {
    const amount = formatAmount(payload.metadata?.amount, payload.metadata?.currency);
    const productionJobId = stringValue(payload.metadata?.productionJobId);

    await sendClientEmail(payload, {
      subject: `Payment received for ${payload.service || "your project"}`,
      eyebrow: "Payment confirmed",
      title: "Your production job is now active",
      intro: "Your payment was confirmed successfully. Heyy Studio has created the production job and the team can now begin working from the approved project context.",
      status: "Production started",
      amount,
      details: [{ label: "Production job", value: productionJobId }],
      ctaLabel: "Track production",
      ctaUrl: sitePath(buildClientProjectHref(payload)),
    });

    await sendAdminEmail(payload, {
      subject: `Payment received — ${payload.projectName || "Untitled project"}`,
      eyebrow: "Payment received",
      title: "A paid production job is ready",
      intro: "The quote payment was confirmed and the production job was created automatically. Open the job to review the complete brief and begin assignment.",
      status: "Assigned",
      amount,
      details: [{ label: "Production job", value: productionJobId }],
      ctaLabel: "Open production job",
      ctaUrl: productionJobId ? sitePath(`/admin/production/${productionJobId}`) : sitePath("/admin/production"),
    });
  } catch (error) {
    console.error("Payment Received notification failed", error);
  }
}

async function sendProductionStatusUpdate(payload: NotificationPayload) {
  try {
    const status = stringValue(payload.metadata?.status) || statusLabel(payload.event);
    const productionJobId = stringValue(payload.metadata?.productionJobId);
    const fileCount = stringValue(payload.metadata?.fileCount);
    const deliveryMessage = stringValue(payload.metadata?.deliveryMessage);

    const content = productionStatusContent(payload.event, status);
    await sendClientEmail(payload, {
      subject: content.subject(payload.service),
      eyebrow: content.eyebrow,
      title: content.title,
      intro: content.intro,
      status,
      details: [
        { label: "Files ready", value: fileCount ? `${fileCount} file${fileCount === "1" ? "" : "s"}` : null },
        { label: "Production job", value: productionJobId },
      ],
      note: deliveryMessage || null,
      ctaLabel: content.ctaLabel,
      ctaUrl: sitePath(buildClientProjectHref(payload)),
    });
  } catch (error) {
    console.error("Production status notification failed", error);
  }
}

async function sendRevisionRequested(payload: NotificationPayload) {
  try {
    const revisionNumber = stringValue(payload.metadata?.revisionNumber);
    const productionJobId = stringValue(payload.metadata?.productionJobId);
    const message = stringValue(payload.metadata?.message) || "No additional message was provided.";
    const isAnotherRevision = Boolean(payload.metadata?.isAnotherRevision);

    await sendAdminEmail(payload, {
      subject: `${isAnotherRevision ? "Another revision" : "Revision"} requested — ${payload.projectName || "Untitled project"}`,
      eyebrow: "Revision requested",
      title: "Client feedback needs review",
      intro: "The client submitted a revision request. Review the requested changes against the approved scope and included revision allowance before responding.",
      status: revisionNumber ? `Revision #${revisionNumber}` : "Revision requested",
      details: [
        { label: "Client message", value: message },
        { label: "Production job", value: productionJobId },
      ],
      ctaLabel: "Open production job",
      ctaUrl: productionJobId ? sitePath(`/admin/production/${productionJobId}`) : sitePath("/admin/production"),
    });

    await sendClientEmail(payload, {
      subject: `Revision ${revisionNumber ? `#${revisionNumber} ` : ""}received`,
      eyebrow: "Revision request received",
      title: "Your feedback has been sent to the team",
      intro: "Your revision request is now attached to the production job. The Heyy Studio team will review the changes and update the workspace when revised files are ready.",
      status: revisionNumber ? `Revision #${revisionNumber}` : "Under review",
      note: message,
      ctaLabel: "Open project",
      ctaUrl: sitePath(buildClientProjectHref(payload)),
    });
  } catch (error) {
    console.error("Revision requested notification failed", error);
  }
}

async function sendRevisionReady(payload: NotificationPayload) {
  try {
    const revisionNumber = stringValue(payload.metadata?.revisionNumber);
    const productionJobId = stringValue(payload.metadata?.productionJobId);

    await sendClientEmail(payload, {
      subject: `Revision ${revisionNumber ? `#${revisionNumber} ` : ""}is ready for review`,
      eyebrow: "Revision ready",
      title: "Your revised files are available",
      intro: "The Heyy Studio team uploaded revised files to your project. Open the workspace to compare, download, approve or request another revision.",
      status: "Ready for review",
      details: [
        { label: "Revision", value: revisionNumber ? `#${revisionNumber}` : null },
        { label: "Production job", value: productionJobId },
      ],
      ctaLabel: "Review revision",
      ctaUrl: sitePath(buildClientProjectHref(payload)),
    });
  } catch (error) {
    console.error("Revision ready notification failed", error);
  }
}

async function sendRevisionApproved(payload: NotificationPayload) {
  try {
    const revisionNumber = stringValue(payload.metadata?.revisionNumber);
    const productionJobId = stringValue(payload.metadata?.productionJobId);

    await sendAdminEmail(payload, {
      subject: `Revision approved — ${payload.projectName || "Untitled project"}`,
      eyebrow: "Client approval",
      title: "The client approved the revision",
      intro: "The latest revision was approved. Continue the production workflow or prepare final deliverables from the approved version.",
      status: revisionNumber ? `Revision #${revisionNumber} approved` : "Approved",
      details: [{ label: "Production job", value: productionJobId }],
      ctaLabel: "Open production job",
      ctaUrl: productionJobId ? sitePath(`/admin/production/${productionJobId}`) : sitePath("/admin/production"),
    });
  } catch (error) {
    console.error("Revision approved notification failed", error);
  }
}

type EmailOptions = {
  subject: string;
  eyebrow: string;
  title: string;
  intro: string;
  status?: string | null;
  amount?: string | null;
  details?: Array<{ label: string; value?: string | number | null }>;
  note?: string | null;
  ctaLabel: string;
  ctaUrl: string;
};

async function sendClientEmail(payload: NotificationPayload, options: EmailOptions) {
  if (!payload.clientEmail) return;
  const delivery = payload.deliveryPreferences;
  if (delivery) {
    const isBilling =
      payload.event === "quote.ready" ||
      payload.event === "quote.replied" ||
      payload.event === "payment.received";
    if (isBilling && !delivery.billingEmail) return;
    if (!isBilling && !delivery.productionEmail) return;
  }

  const key = productionTemplateKey(payload.event, "client");
  const resolved = key
    ? await resolveCommunicationTemplate({
        templateKey: key,
        fallback: {
          subject: options.subject,
          preheader: options.intro,
          eyebrow: options.eyebrow,
          title: options.title,
          body: options.intro,
          ctaLabel: options.ctaLabel,
        },
        variables: productionTemplateVariables(payload, options),
      })
    : null;
  if (resolved && !resolved.enabled) return;

  const finalOptions = resolved
    ? { ...options, subject: resolved.subject, eyebrow: resolved.eyebrow, title: resolved.title, intro: resolved.body, ctaLabel: resolved.ctaLabel }
    : options;
  const template = {
    ...finalOptions,
    recipient: "client" as const,
    studio: payload.studio,
    projectName: payload.projectName,
    service: payload.service,
    preheader: resolved?.preheader || finalOptions.intro,
  };
  const notificationKey = buildNotificationKey(payload) || `${payload.event}:${payload.projectId || payload.projectName || "project"}`;
  await sendTrackedEmail({
    eventKey: `production-email:${notificationKey}:client`,
    userId: payload.userId || null,
    to: payload.clientEmail,
    templateKey: key || `production.${payload.event}.client`,
    subject: finalOptions.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    relatedType: "production",
    relatedId: stringValue(payload.metadata?.productionJobId || payload.metadata?.requestId || payload.projectId) || null,
    metadata: { event: payload.event },
  });
}

async function sendAdminEmail(payload: NotificationPayload, options: EmailOptions) {
  if (!process.env.ADMIN_EMAIL) return;
  const key = productionTemplateKey(payload.event, "admin");
  const resolved = key
    ? await resolveCommunicationTemplate({
        templateKey: key,
        fallback: {
          subject: options.subject,
          preheader: options.intro,
          eyebrow: options.eyebrow,
          title: options.title,
          body: options.intro,
          ctaLabel: options.ctaLabel,
        },
        variables: productionTemplateVariables(payload, options),
      })
    : null;
  if (resolved && !resolved.enabled) return;

  const finalOptions = resolved
    ? { ...options, subject: resolved.subject, eyebrow: resolved.eyebrow, title: resolved.title, intro: resolved.body, ctaLabel: resolved.ctaLabel }
    : options;
  const template = {
    ...finalOptions,
    recipient: "admin" as const,
    studio: payload.studio,
    projectName: payload.projectName,
    service: payload.service,
    preheader: resolved?.preheader || finalOptions.intro,
  };
  const notificationKey = buildNotificationKey(payload) || `${payload.event}:${payload.projectId || payload.projectName || "project"}`;
  await sendTrackedEmail({
    eventKey: `production-email:${notificationKey}:admin`,
    userId: null,
    to: process.env.ADMIN_EMAIL,
    templateKey: key || `production.${payload.event}.admin`,
    subject: finalOptions.subject,
    html: buildEmail(template),
    text: buildPlainTextEmail(template),
    relatedType: "production",
    relatedId: stringValue(payload.metadata?.productionJobId || payload.metadata?.requestId || payload.projectId) || null,
    metadata: { event: payload.event },
  });
}

function productionTemplateVariables(payload: NotificationPayload, options: EmailOptions) {
  return {
    project_name: payload.projectName || "your project",
    service: payload.service || "production",
    studio: payload.studio || "Heyy Studio",
    client_name: payload.clientName || "Client",
    amount: options.amount || "",
    status: options.status || "",
  };
}

function productionStatusContent(event: NotificationPayload["event"], status: string) {
  if (event === "deliverables.uploaded") {
    return {
      subject: (service?: string) => `Your ${service || "project"} files are ready`,
      eyebrow: "Deliverables ready",
      title: "Your final files are available",
      intro: "The Heyy Studio team published approved deliverables to your production workspace. Review the delivery note and download the files from your project.",
      ctaLabel: "View deliverables",
    };
  }
  if (event === "project.completed") {
    return {
      subject: (service?: string) => `${service || "Your project"} is complete`,
      eyebrow: "Project completed",
      title: "Your production project is complete",
      intro: "The production workflow has been completed. Your project, files, approvals and production history remain available inside Heyy Studio.",
      ctaLabel: "Open completed project",
    };
  }
  if (event === "production.review") {
    return {
      subject: (service?: string) => `${service || "Your project"} is ready for review`,
      eyebrow: "Client review",
      title: "Your project is ready for review",
      intro: "A new production version is ready. Open the workspace to review the latest work and respond with approval or revision feedback.",
      ctaLabel: "Review project",
    };
  }
  return {
    subject: (service?: string) => `Update on your ${service || "production project"}`,
    eyebrow: "Production update",
    title: status || "Your project has a new update",
    intro: "The production status changed. Open the project workspace to see the latest timeline, messages and next actions.",
    ctaLabel: "Track production",
  };
}

function statusLabel(event: NotificationPayload["event"]) {
  const labels: Partial<Record<NotificationPayload["event"], string>> = {
    "production.assigned": "Assigned",
    "production.started": "In progress",
    "production.review": "Ready for review",
    "deliverables.uploaded": "Deliverables ready",
    "project.completed": "Completed",
  };
  return labels[event] || "Updated";
}


function stringValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function formatAmount(amount: unknown, currency: unknown) {
  const numeric = Number(amount);
  const currencyCode = stringValue(currency).toUpperCase() || "USD";
  if (!Number.isFinite(numeric)) return stringValue(amount) ? `${stringValue(amount)} ${currencyCode}` : null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currencyCode}`;
  }
}
