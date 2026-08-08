export type NotificationEvent =
  | "production.requested"
  | "quote.ready"
  | "quote.replied"
  | "production.message.client"
  | "production.message.studio"
  | "payment.received"
  | "production.assigned"
  | "production.started"
  | "production.review"
  | "revision.requested"
  | "revision.ready"
  | "revision.approved"
  | "deliverables.uploaded"
  | "project.completed";

export interface NotificationPayload {
  event: NotificationEvent;

  projectId?: string;
  projectName?: string;

  service?: string;
  studio?: string;

  userId?: string;

  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;

  amount?: number;

  metadata?: Record<string, any>;
}
