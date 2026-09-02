import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 5 * 1024 * 1024;
const CONTACT_ATTACHMENTS_BUCKET = "contact-attachments";
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt",
  "png", "jpg", "jpeg", "webp",
]);

const TOPIC_LABELS: Record<string, string> = {
  expert: "Expert / Project Request",
  general: "General Inquiry",
  billing: "Billing & Payments",
  technical: "Technical Support",
  careers: "Careers",
  partnership: "Partnership / Business",
  other: "Other",
};

type PreparedAttachment = {
  name: string;
  size: number;
  contentType: string;
  base64: string;
};

type StoredAttachment = {
  name: string;
  size: number;
  content_type: string;
  storage_path: string;
};

class ContactInputError extends Error {}

export async function POST(request: Request) {
  let admin: SupabaseClient | null = null;
  let submissionId = "";
  let storedAttachments: StoredAttachment[] = [];

  try {
    const parsed = await parseRequest(request);
    if (parsed.website) {
      return NextResponse.json({ success: true, id: "received" });
    }

    const name = cleanText(parsed.name, 120);
    const email = cleanText(parsed.email, 254).toLowerCase();
    const company = cleanText(parsed.company, 160);
    const topic = cleanText(parsed.topic, 40).toLowerCase();
    const subject = cleanText(parsed.subject, 160);
    const message = cleanMultiline(parsed.message, 5000);
    const topicLabel = TOPIC_LABELS[topic];

    if (!name) throw new ContactInputError("Enter your name before sending.");
    if (!isValidEmail(email)) throw new ContactInputError("Enter a valid email address before sending.");
    if (!topicLabel) throw new ContactInputError("Choose an inquiry type before sending.");
    if (subject.length < 3) throw new ContactInputError("Add a subject of at least 3 characters.");
    if (message.length < 10) {
      throw new ContactInputError("Please add a little more detail to your message — at least 10 characters.");
    }

    const attachments = await prepareAttachments(parsed.attachments);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Contact is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }

    admin = createClient(url, key, { auth: { persistSession: false } });
    const userId = await resolveAuthenticatedUserId(admin, request);

    const { data, error } = await admin
      .from("contact_submissions")
      .insert({
        user_id: userId,
        name,
        email,
        topic: topicLabel,
        message,
        metadata: {
          subject,
          company: company || null,
          topic_key: topic,
          attachment_count: attachments.length,
          attachment_names: attachments.map((attachment) => attachment.name),
          attachment_sizes: attachments.map((attachment) => attachment.size),
          attachments: [],
          source: "public_contact_page",
          user_agent: request.headers.get("user-agent"),
        },
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("Contact submission insert failed:", error);
      throw new Error("Contact submission could not be saved.");
    }

    submissionId = String(data.id);

    if (attachments.length) {
      storedAttachments = await storeContactAttachments(admin, submissionId, attachments);
      const { error: metadataError } = await admin
        .from("contact_submissions")
        .update({
          metadata: {
            subject,
            company: company || null,
            topic_key: topic,
            attachment_count: storedAttachments.length,
            attachment_names: storedAttachments.map((attachment) => attachment.name),
            attachment_sizes: storedAttachments.map((attachment) => attachment.size),
            attachments: storedAttachments,
            source: "public_contact_page",
            user_agent: request.headers.get("user-agent"),
          },
        })
        .eq("id", submissionId);

      if (metadataError) {
        throw new Error("Contact attachment details could not be saved.");
      }
    }

    await sendContactEmails({
      id: submissionId,
      name,
      email,
      company,
      topicLabel,
      subject,
      message,
      attachments,
    });

    return NextResponse.json({ success: true, id: submissionId });
  } catch (error) {
    if (error instanceof ContactInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (admin && submissionId) {
      if (storedAttachments.length) {
        try {
          await admin.storage
            .from(CONTACT_ATTACHMENTS_BUCKET)
            .remove(storedAttachments.map((attachment) => attachment.storage_path));
        } catch {}
      }
      try {
        await admin.from("contact_submissions").delete().eq("id", submissionId);
      } catch {}
    }

    console.error("Public contact error:", error);
    return NextResponse.json(
      { error: "We couldn’t send your request. Please try again." },
      { status: 500 },
    );
  }
}

async function parseRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      company: String(form.get("company") || ""),
      topic: String(form.get("topic") || ""),
      subject: String(form.get("subject") || ""),
      message: String(form.get("message") || ""),
      website: String(form.get("website") || ""),
      attachments: form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0),
    };
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    throw new ContactInputError("The contact request could not be read.");
  }
  return {
    name: String(body?.name || ""),
    email: String(body?.email || ""),
    company: String(body?.company || ""),
    topic: String(body?.topic || "general"),
    subject: String(body?.subject || body?.topic || "General inquiry"),
    message: String(body?.message || ""),
    website: String(body?.website || ""),
    attachments: [] as File[],
  };
}

async function prepareAttachments(files: File[]) {
  if (files.length > MAX_ATTACHMENTS) {
    throw new ContactInputError(`Attach no more than ${MAX_ATTACHMENTS} files.`);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
    throw new ContactInputError("Attachments can be up to 5 MB combined.");
  }

  const prepared: PreparedAttachment[] = [];
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new ContactInputError(`${safeFileName(file.name)} is larger than 5 MB.`);
    }
    const name = safeFileName(file.name);
    const extension = name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new ContactInputError(`${name} is not a supported file type.`);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    prepared.push({
      name,
      size: buffer.length,
      contentType: file.type || "application/octet-stream",
      base64: buffer.toString("base64"),
    });
  }
  return prepared;
}

async function ensureContactAttachmentsBucket(admin: SupabaseClient) {
  const { data, error } = await admin.storage.getBucket(CONTACT_ATTACHMENTS_BUCKET);
  if (data && !error) return;

  const { error: createError } = await admin.storage.createBucket(CONTACT_ATTACHMENTS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_ATTACHMENT_BYTES,
  });
  if (createError && !/already exists|duplicate/i.test(String(createError.message || ""))) {
    console.error("Contact attachment bucket could not be created:", createError);
    throw new Error("Contact attachment storage is unavailable.");
  }
}

async function storeContactAttachments(
  admin: SupabaseClient,
  submissionId: string,
  attachments: PreparedAttachment[],
) {
  await ensureContactAttachmentsBucket(admin);
  const stored: StoredAttachment[] = [];

  try {
    for (const attachment of attachments) {
      const storagePath = `${submissionId}/${randomUUID()}-${safeFileName(attachment.name)}`;
      const { error } = await admin.storage
        .from(CONTACT_ATTACHMENTS_BUCKET)
        .upload(storagePath, Buffer.from(attachment.base64, "base64"), {
          contentType: attachment.contentType,
          upsert: false,
        });
      if (error) throw error;
      stored.push({
        name: attachment.name,
        size: attachment.size,
        content_type: attachment.contentType,
        storage_path: storagePath,
      });
    }
    return stored;
  } catch (error) {
    if (stored.length) {
      try {
        await admin.storage
          .from(CONTACT_ATTACHMENTS_BUCKET)
          .remove(stored.map((attachment) => attachment.storage_path));
      } catch {}
    }
    console.error("Contact attachment upload failed:", error);
    throw new Error("One or more contact attachments could not be saved.");
  }
}

async function resolveAuthenticatedUserId(admin: SupabaseClient, request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

async function sendContactEmails({
  id,
  name,
  email,
  company,
  topicLabel,
  subject,
  message,
  attachments,
}: {
  id: string;
  name: string;
  email: string;
  company: string;
  topicLabel: string;
  subject: string;
  message: string;
  attachments: PreparedAttachment[];
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;

  const configuredFrom = process.env.RESEND_FROM_EMAIL?.trim() || "hello@heyystudio.com";
  const from = configuredFrom.includes("<") ? configuredFrom : `Heyy Studio <${configuredFrom}>`;
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "hello@heyystudio.com";
  const reference = id.slice(0, 8).toUpperCase();

  const adminTemplate = {
    eyebrow: "New contact request",
    title: "A new request is ready for review",
    intro: `${name} sent a ${topicLabel} request through the Heyy Studio Contact page. Review the full message, download any attachments and reply from Admin.`,
    preheader: `${topicLabel}: ${subject}`,
    recipient: "admin" as const,
    status: "New",
    details: [
      { label: "Name", value: name },
      { label: "Email", value: email },
      company ? { label: "Company", value: company } : null,
      { label: "Inquiry type", value: topicLabel },
      { label: "Subject", value: subject },
      { label: "Message", value: message },
      { label: "Reference", value: reference },
      attachments.length ? { label: "Attachments", value: attachments.map((item) => item.name).join(", ") } : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    detailsTitle: "Request details",
    ctaLabel: "Review request",
    ctaUrl: sitePath(`/admin/platform/contact?contact=${encodeURIComponent(id)}`),
  };

  const firstName = name.trim().split(/\s+/)[0] || "there";
  const clientTemplate = {
    eyebrow: "Request received",
    title: "We’ve received your request",
    intro: `Hi ${firstName}, thanks for contacting Heyy Studio. Your ${topicLabel} request has been received and will be routed to the right team.`,
    preheader: "Your Heyy Studio request has been received.",
    status: "Received",
    details: [
      { label: "Inquiry type", value: topicLabel },
      { label: "Subject", value: subject },
      { label: "Reference", value: reference },
      attachments.length ? { label: "Files received", value: `${attachments.length} attachment${attachments.length === 1 ? "" : "s"}` } : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    detailsTitle: "Your request",
    ctaLabel: "Visit Heyy Studio",
    ctaUrl: sitePath("/"),
    supportingCopy: "You don’t need to submit the same request again. Our team will contact you using the email address you provided.",
  };

  const requests = [
    sendResendEmail(apiKey, {
      from,
      to: [adminEmail],
      reply_to: email,
      subject: `[Heyy Contact] ${topicLabel}: ${subject}`,
      html: buildEmail(adminTemplate),
      text: buildPlainTextEmail(adminTemplate),
      attachments: attachments.map((item) => ({ filename: item.name, content: item.base64 })),
    }),
    sendResendEmail(apiKey, {
      from,
      to: [email],
      reply_to: adminEmail,
      subject: `We received your Heyy Studio request — ${reference}`,
      html: buildEmail(clientTemplate),
      text: buildPlainTextEmail(clientTemplate),
    }),
  ];

  const results = await Promise.allSettled(requests);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(index === 0 ? "Contact admin email failed:" : "Contact confirmation email failed:", result.reason);
    }
  });
}

async function sendResendEmail(apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`Resend request failed (${response.status})${responseText ? `: ${responseText.slice(0, 300)}` : ""}`);
  }
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanMultiline(value: unknown, maxLength: number) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeFileName(value: string) {
  return String(value || "attachment")
    .replace(/[\\/\0\r\n]+/g, "-")
    .replace(/[^A-Za-z0-9._() -]+/g, "-")
    .trim()
    .slice(0, 160) || "attachment";
}
