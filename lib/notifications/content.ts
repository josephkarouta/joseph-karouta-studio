import { buildProductionWorkspaceHref } from "@/lib/production/service-registry";
import type { NotificationPayload } from "./types";

export type InAppNotificationContent = {
  type: string;
  title: string;
  message: string;
  href: string;
  metadata: Record<string, unknown>;
};

export function buildClientProjectHref(payload: NotificationPayload) {
  return buildProductionWorkspaceHref({
    projectId: payload.projectId,
    studio: payload.studio,
    serviceId: payload.metadata?.serviceId,
    service: payload.service,
  });
}


const PRODUCTION_NOTIFICATION_TYPES = new Set([
  "production.requested",
  "quote.ready",
  "quote.replied",
  "payment.received",
  "production.assigned",
  "production.started",
  "production.review",
  "production.message.studio",
  "revision.requested",
  "revision.ready",
  "revision.approved",
  "deliverables.uploaded",
  "project.completed",
]);

export function resolveStoredNotificationHref(notification: {
  type?: unknown;
  href?: unknown;
  metadata?: Record<string, unknown> | null;
}) {
  const type = String(notification.type || "");
  const metadata = notification.metadata || {};
  const projectId = metadata.project_id || metadata.projectId;

  if (projectId && PRODUCTION_NOTIFICATION_TYPES.has(type)) {
    return buildProductionWorkspaceHref({
      projectId,
      studio: metadata.studio,
      serviceId: metadata.serviceId || metadata.service_id,
      service: metadata.service,
    });
  }

  return typeof notification.href === "string" && notification.href.trim()
    ? notification.href
    : "/dashboard";
}

export function buildNotificationKey(payload: NotificationPayload) {
  if (!payload.userId) return null;

  const metadata = payload.metadata || {};
  const reference = firstValue(
    metadata.replyId,
    metadata.paymentId,
    metadata.revisionId,
    metadata.quoteId,
    metadata.requestId,
    metadata.productionJobId,
    payload.projectId,
  );

  if (!reference) return null;
  return `${payload.event}:${payload.userId}:${reference}`;
}

export function buildInAppNotification(
  payload: NotificationPayload,
): InAppNotificationContent | null {
  if (!payload.userId) return null;

  const projectName = clean(payload.projectName) || "your project";
  const service = clean(payload.service) || "production service";
  const href = buildClientProjectHref(payload);
  const metadata = {
    ...(payload.metadata || {}),
    event: payload.event,
    project_id: payload.projectId || null,
    project_name: payload.projectName || null,
    studio: payload.studio || null,
    service: payload.service || null,
  };

  switch (payload.event) {
    case "production.requested":
      return {
        type: payload.event,
        title: "Production request received",
        message: `Your ${service} request for ${projectName} is being reviewed. We will notify you when the quote is ready.`,
        href,
        metadata,
      };

    case "quote.ready": {
      const amount = formatAmount(
        payload.metadata?.amount,
        payload.metadata?.currency,
      );
      return {
        type: payload.event,
        title: "Your quote is ready",
        message: `Review the scope${amount ? `, ${amount}` : ""}, delivery estimate and included revisions for ${projectName}.`,
        href,
        metadata,
      };
    }

    case "quote.replied": {
      const reply = truncate(clean(payload.metadata?.replyMessage), 260);
      return {
        type: payload.event,
        title: "Heyy Studio replied to your quote question",
        message: reply || `A new answer is available for the ${service} quote on ${projectName}.`,
        href,
        metadata,
      };
    }

    case "payment.received":
      return {
        type: payload.event,
        title: "Payment confirmed",
        message: `Your payment for ${service} was received and the production job for ${projectName} is now active.`,
        href,
        metadata,
      };

    case "production.message.studio": {
      const senderName = clean(payload.metadata?.senderName) || "Heyy Studio";
      const message = truncate(clean(payload.metadata?.message), 220);
      return {
        type: payload.event,
        title: `${senderName} sent a production message`,
        message: message || `A new production message is available for ${projectName}.`,
        href: `${href}#production-messages`,
        metadata,
      };
    }


    case "production.assigned":
      return {
        type: payload.event,
        title: "Production job assigned",
        message: `${projectName} has entered the production queue.`,
        href,
        metadata,
      };

    case "production.started":
      return {
        type: payload.event,
        title: "Production has started",
        message: `The Heyy Studio team has started working on ${service} for ${projectName}.`,
        href,
        metadata,
      };

    case "production.review":
      return {
        type: payload.event,
        title: "Your project is ready for review",
        message: `A new ${service} production version is ready. Open ${projectName} to review the latest work.`,
        href,
        metadata,
      };

    case "revision.requested": {
      const revisionNumber = clean(payload.metadata?.revisionNumber);
      return {
        type: payload.event,
        title: revisionNumber
          ? `Revision #${revisionNumber} received`
          : "Revision request received",
        message: `Your feedback for ${projectName} was sent to the Heyy Studio team.`,
        href,
        metadata,
      };
    }

    case "revision.ready": {
      const revisionNumber = clean(payload.metadata?.revisionNumber);
      return {
        type: payload.event,
        title: revisionNumber
          ? `Revision #${revisionNumber} is ready`
          : "Your revised files are ready",
        message: `Open ${projectName} to review, download or approve the revised files.`,
        href,
        metadata,
      };
    }

    case "revision.approved": {
      const revisionNumber = clean(payload.metadata?.revisionNumber);
      return {
        type: payload.event,
        title: revisionNumber
          ? `Revision #${revisionNumber} approved`
          : "Revision approved",
        message: `Your approval for ${projectName} was recorded successfully.`,
        href,
        metadata,
      };
    }

    case "deliverables.uploaded": {
      const fileCount = Number(payload.metadata?.fileCount || 0);
      return {
        type: payload.event,
        title: "Your final deliverables are ready",
        message:
          clean(payload.metadata?.deliveryMessage) ||
          `${fileCount > 0 ? `${fileCount} final file${fileCount === 1 ? " is" : "s are"}` : "Final files are"} ready to download for ${projectName}.`,
        href,
        metadata,
      };
    }

    case "project.completed":
      return {
        type: payload.event,
        title: "Production project completed",
        message: `${projectName} is complete. Your files and production history remain available in the workspace.`,
        href,
        metadata,
      };

    default:
      return null;
  }
}

function slugify(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstValue(...values: unknown[]) {
  for (const value of values) {
    const normalised = clean(value);
    if (normalised) return normalised;
  }
  return "";
}

function clean(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function formatAmount(amount: unknown, currency: unknown) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "";

  const currencyCode = clean(currency).toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currencyCode}`;
  }
}
