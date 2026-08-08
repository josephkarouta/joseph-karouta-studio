import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCTION_MESSAGE_BUCKET = "production-message-files";
export const MAX_MESSAGE_LENGTH = 3_000;
export const MAX_MESSAGE_FILES = 5;
export const MAX_MESSAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_MESSAGE_TOTAL_BYTES = 25 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  "app",
  "bat",
  "cmd",
  "com",
  "cpl",
  "dll",
  "dmg",
  "exe",
  "hta",
  "html",
  "jar",
  "js",
  "jse",
  "mjs",
  "msi",
  "php",
  "ps1",
  "scr",
  "sh",
  "vbs",
  "wsf",
]);

type CreateMessageArgs = {
  admin: SupabaseClient;
  jobId: string;
  senderType: "client" | "studio" | "system";
  senderName: string;
  senderUserId?: string | null;
  message: string;
  files?: File[];
};

export type ProductionMessageAttachment = {
  id: string;
  message_id: string;
  production_job_id: string;
  filename: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  download_url?: string | null;
};

export type ProductionMessageRecord = {
  id: string;
  production_job_id: string;
  sender_type: "client" | "studio" | "system" | string;
  sender_name: string | null;
  sender_user_id?: string | null;
  message: string;
  read_by_client_at?: string | null;
  read_by_admin_at?: string | null;
  attachment_count?: number | null;
  created_at: string;
  attachments: ProductionMessageAttachment[];
};

export function cleanMessage(value: unknown) {
  return String(value || "").trim();
}

export function extractMessageFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function validateMessage(message: string, files: File[]) {
  if (!message && files.length === 0) {
    throw new ProductionMessageInputError("Write a message or attach a file.");
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ProductionMessageInputError(
      `Messages can contain up to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
    );
  }

  if (files.length > MAX_MESSAGE_FILES) {
    throw new ProductionMessageInputError(
      `Attach up to ${MAX_MESSAGE_FILES} files per message.`,
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_MESSAGE_TOTAL_BYTES) {
    throw new ProductionMessageInputError(
      "The combined attachment size must be 25 MB or less.",
    );
  }

  for (const file of files) {
    if (file.size > MAX_MESSAGE_FILE_BYTES) {
      throw new ProductionMessageInputError(
        `${file.name || "An attachment"} is larger than 10 MB.`,
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (BLOCKED_EXTENSIONS.has(extension)) {
      throw new ProductionMessageInputError(
        `${file.name || "This file"} cannot be attached for security reasons.`,
      );
    }
  }
}

export async function createProductionMessage({
  admin,
  jobId,
  senderType,
  senderName,
  senderUserId = null,
  message,
  files = [],
}: CreateMessageArgs) {
  const cleanText = cleanMessage(message);
  validateMessage(cleanText, files);

  const now = new Date().toISOString();
  const { data: createdMessage, error: messageError } = await admin
    .from("production_messages")
    .insert({
      production_job_id: jobId,
      sender_type: senderType,
      sender_name: cleanMessage(senderName) || "Heyy Studio",
      sender_user_id: senderUserId,
      message: cleanText,
      attachment_count: files.length,
      read_by_client_at: senderType === "client" ? now : null,
      read_by_admin_at: senderType === "studio" || senderType === "system" ? now : null,
    })
    .select("*")
    .single();

  if (messageError || !createdMessage) {
    throw messageError || new Error("The message could not be created.");
  }

  const uploadedPaths: string[] = [];
  const attachmentRows: Record<string, unknown>[] = [];

  try {
    for (const file of files) {
      const safeName = safeFilename(file.name || "attachment");
      const storagePath = `${jobId}/${createdMessage.id}/${Date.now()}-${randomUUID()}-${safeName}`;
      const bytes = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from(PRODUCTION_MESSAGE_BUCKET)
        .upload(storagePath, bytes, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);

      attachmentRows.push({
        message_id: createdMessage.id,
        production_job_id: jobId,
        filename: safeName,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        storage_path: storagePath,
        uploaded_by: senderType,
      });
    }

    let attachments: ProductionMessageAttachment[] = [];

    if (attachmentRows.length > 0) {
      const { data, error } = await admin
        .from("production_message_attachments")
        .insert(attachmentRows)
        .select("*");

      if (error) throw error;
      attachments = (data || []) as ProductionMessageAttachment[];
    }

    return {
      ...(createdMessage as ProductionMessageRecord),
      attachments,
    };
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await admin.storage.from(PRODUCTION_MESSAGE_BUCKET).remove(uploadedPaths);
    }

    await admin
      .from("production_message_attachments")
      .delete()
      .eq("message_id", createdMessage.id);
    await admin.from("production_messages").delete().eq("id", createdMessage.id);

    throw error;
  }
}

export async function loadProductionMessages(
  admin: SupabaseClient,
  jobId: string,
) {
  const { data: messages, error: messageError } = await admin
    .from("production_messages")
    .select("*")
    .eq("production_job_id", jobId)
    .order("created_at", { ascending: true });

  if (messageError) throw messageError;

  const messageIds = (messages || []).map((item: any) => item.id).filter(Boolean);
  const attachmentsByMessage = new Map<string, ProductionMessageAttachment[]>();

  if (messageIds.length > 0) {
    const { data: attachments, error: attachmentError } = await admin
      .from("production_message_attachments")
      .select("*")
      .in("message_id", messageIds)
      .order("created_at", { ascending: true });

    if (attachmentError) throw attachmentError;

    await Promise.all(
      (attachments || []).map(async (attachment: any) => {
        const downloadName = safeFilename(attachment.filename || "attachment");
        const { data, error } = await admin.storage
          .from(PRODUCTION_MESSAGE_BUCKET)
          .createSignedUrl(attachment.storage_path, 60 * 5, {
            download: downloadName,
          });

        const enriched: ProductionMessageAttachment = {
          ...attachment,
          download_url: error ? null : data?.signedUrl || null,
        };

        const current = attachmentsByMessage.get(attachment.message_id) || [];
        current.push(enriched);
        attachmentsByMessage.set(attachment.message_id, current);
      }),
    );
  }

  return (messages || []).map((item: any) => ({
    ...item,
    attachments: attachmentsByMessage.get(item.id) || [],
  })) as ProductionMessageRecord[];
}

export class ProductionMessageInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return (normalized || "attachment").slice(0, 180);
}
