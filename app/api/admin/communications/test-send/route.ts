import "server-only";

import { NextResponse } from "next/server";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";
import { communicationTemplateDefinition } from "@/lib/communications/catalog";
import { resolveCommunicationTemplate } from "@/lib/communications/templates";
import { sendTrackedEmail } from "@/lib/communications/send-email";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminApiCapability } from "@/lib/server/admin-api";

type EmailDetail = { label: string; value?: string | number | null };

type TestContext = {
  recipient?: "client" | "admin";
  studio?: string | null;
  projectName?: string | null;
  service?: string | null;
  status?: string | null;
  amount?: string | null;
  details?: EmailDetail[];
  note?: string | null;
};

const SAMPLE_VARIABLES = {
  first_name: "Joseph",
  description: "Heyy Studio Pro",
  amount: "$249.00",
  invoice_number: "HS-TEST-0001",
  project_name: "Sample Brand Project",
  service: "Logo Finalisation and Master Files",
  studio: "Brand Studio",
  client_name: "Test Client",
  status: "Ready for review",
};

export async function POST(request: Request) {
  const access = await requireAdminApiCapability("communications");
  if (access.response) return access.response;

  try {
    const body = await request.json();
    const templateKey = String(body.templateKey || "").trim();
    const to = String(body.email || "").trim().toLowerCase();
    const definition = communicationTemplateDefinition(templateKey);
    if (!definition || !to.includes("@")) {
      return NextResponse.json({ success: false, error: "Choose a template and valid test email." }, { status: 400 });
    }

    const resolved = await resolveCommunicationTemplate({
      templateKey,
      fallback: {
        subject: definition.defaultSubject || `Heyy Studio test — ${definition.name}`,
        preheader: definition.defaultPreheader || definition.description,
        eyebrow: definition.defaultEyebrow || "Heyy Studio",
        title: definition.defaultTitle || definition.name,
        body: definition.defaultBody || definition.description,
        ctaLabel: definition.defaultCtaLabel || "Open Heyy Studio",
      },
      variables: SAMPLE_VARIABLES,
    });

    const context = testContext(templateKey);
    const template = {
      eyebrow: resolved.eyebrow,
      title: resolved.title,
      intro: resolved.body,
      preheader: resolved.preheader,
      recipient: context.recipient,
      studio: context.studio,
      projectName: context.projectName,
      service: context.service,
      status: context.status,
      amount: context.amount,
      details: context.details,
      note: context.note,
      ctaLabel: resolved.ctaLabel,
      // Test messages deliberately use a safe destination. Live transactional
      // messages keep the real project/quote/production URL supplied by the event.
      ctaUrl: sitePath("/dashboard"),
    };

    await sendTrackedEmail({
      eventKey: `admin-test:${templateKey}:${to}:${Date.now()}`,
      to,
      templateKey,
      subject: `[TEST] ${resolved.subject}`,
      html: buildEmail(template),
      text: buildPlainTextEmail(template),
      relatedType: "admin_test",
      relatedId: templateKey,
      metadata: { test: true, safe_cta: "/dashboard" },
    });

    await recordAdminAudit({
      actorUserId: access.user?.id || null,
      action: "communication_template.test_sent",
      entityType: "communication_template",
      entityId: templateKey,
      summary: `Sent a test of ${templateKey} to ${to}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Test communication send error:", error);
    return NextResponse.json({ success: false, error: "Test email could not be sent." }, { status: 500 });
  }
}

function testContext(templateKey: string): TestContext {
  if (templateKey === "welcome" || templateKey === "announcement") return {};

  if (templateKey === "payment.receipt") {
    return {
      amount: "$99.00",
      details: [
        { label: "Invoice", value: "HS-TEST-0001" },
        { label: "Payment status", value: "Paid" },
      ],
    };
  }

  const adminRecipient = templateKey.endsWith(".admin");
  const base: TestContext = {
    recipient: adminRecipient ? "admin" : "client",
    studio: "Brand Studio",
    projectName: "Sample Brand Project",
    service: "Logo Finalisation and Master Files",
  };

  switch (templateKey) {
    case "production.requested.client":
      return {
        ...base,
        status: "Under review",
        note: "Production does not begin until you review the quote and complete payment.",
      };
    case "production.requested.admin":
      return {
        ...base,
        status: "New request",
        details: [
          { label: "Client", value: "Test Client" },
          { label: "Client email", value: "client@example.com" },
          { label: "Request ID", value: "REQ-TEST-1001" },
        ],
      };
    case "quote.ready.client":
      return {
        ...base,
        status: "Action required",
        amount: "$249.00",
        details: [
          { label: "Estimated delivery", value: "5 days" },
          { label: "Included revisions", value: "2" },
          { label: "Quote ID", value: "QUOTE-TEST-1001" },
        ],
      };
    case "quote.ready.admin":
      return {
        ...base,
        status: "Sent",
        amount: "$249.00",
        details: [
          { label: "Estimated delivery", value: "5 days" },
          { label: "Included revisions", value: "2" },
          { label: "Quote ID", value: "QUOTE-TEST-1001" },
        ],
      };
    case "quote.replied.client":
      return {
        ...base,
        status: "Answered",
        details: [
          { label: "Your question", value: "Does the quote include editable master files?" },
          { label: "Heyy Studio reply", value: "Yes. The approved master files are included in the quoted scope." },
        ],
      };
    case "production.message.client.admin":
      return {
        ...base,
        status: "Reply needed",
        details: [
          { label: "Client", value: "Test Client" },
          { label: "Message", value: "Could we make the secondary logo slightly smaller on the final layout?" },
          { label: "Attachments", value: "1 file" },
          { label: "Production job", value: "JOB-TEST-1001" },
        ],
      };
    case "production.message.studio.client":
      return {
        ...base,
        status: "New message",
        details: [
          { label: "Message", value: "We updated the layout and uploaded a new proof for your review." },
          { label: "Attachments", value: "1 file" },
          { label: "Production job", value: "JOB-TEST-1001" },
        ],
      };
    case "payment.received.client":
      return {
        ...base,
        status: "Production started",
        amount: "$249.00",
        details: [{ label: "Production job", value: "JOB-TEST-1001" }],
      };
    case "payment.received.admin":
      return {
        ...base,
        status: "Assigned",
        amount: "$249.00",
        details: [{ label: "Production job", value: "JOB-TEST-1001" }],
      };
    case "revision.requested.client":
      return {
        ...base,
        status: "Revision #1",
        note: "Please reduce the secondary logo size and keep the approved typography unchanged.",
      };
    case "revision.requested.admin":
      return {
        ...base,
        status: "Revision #1",
        details: [
          { label: "Client message", value: "Please reduce the secondary logo size and keep the approved typography unchanged." },
          { label: "Production job", value: "JOB-TEST-1001" },
        ],
      };
    case "revision.ready.client":
      return {
        ...base,
        status: "Ready for review",
        details: [
          { label: "Revision", value: "#1" },
          { label: "Production job", value: "JOB-TEST-1001" },
        ],
      };
    case "revision.approved.admin":
      return {
        ...base,
        status: "Revision #1 approved",
        details: [{ label: "Production job", value: "JOB-TEST-1001" }],
      };
    case "production.status.client":
      return {
        ...base,
        status: "Ready for review",
        details: [
          { label: "Files ready", value: "2 files" },
          { label: "Production job", value: "JOB-TEST-1001" },
        ],
      };
    default:
      return base;
  }
}
