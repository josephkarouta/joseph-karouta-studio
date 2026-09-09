import "server-only";

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

const MAX_FILE_SIZE = 75 * 1024 * 1024;
const STORAGE_ATTEMPTS = 3;

function safeFilename(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._()\- ]+/g, "-").replace(/\s+/g, " ").trim();
  return (cleaned || "deliverable").slice(0, 180);
}

function storageStatus(error: any) {
  const raw = error?.statusCode ?? error?.status ?? error?.status_code;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function isTransientStorageError(error: any) {
  const status = storageStatus(error);
  if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  const message = String(error?.message || error || "").toLowerCase();
  return /bad gateway|gateway timeout|temporar|timeout|timed out|network|fetch failed|connection|socket/.test(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadWithRetry(
  admin: SupabaseClient,
  storagePath: string,
  buffer: Buffer,
  contentType: string,
) {
  let lastError: any = null;
  for (let attempt = 1; attempt <= STORAGE_ATTEMPTS; attempt += 1) {
    const { error } = await admin.storage
      .from("production-files")
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });
    if (!error) return;
    lastError = error;
    if (!isTransientStorageError(error) || attempt === STORAGE_ATTEMPTS) break;
    console.warn(`Expert deliverable storage upload attempt ${attempt} failed; retrying.`, {
      status: storageStatus(error),
      message: error.message,
    });
    await delay(450 * 2 ** (attempt - 1));
  }
  throw lastError || new Error("File storage upload failed.");
}

async function removeWithRetry(admin: SupabaseClient, storagePath: string) {
  let lastError: any = null;
  for (let attempt = 1; attempt <= STORAGE_ATTEMPTS; attempt += 1) {
    const { error } = await admin.storage.from("production-files").remove([storagePath]);
    if (!error) return;
    lastError = error;
    if (!isTransientStorageError(error) || attempt === STORAGE_ATTEMPTS) break;
    await delay(350 * 2 ** (attempt - 1));
  }
  throw lastError || new Error("File storage deletion failed.");
}

async function activeExpert(admin: SupabaseClient, userId: string) {
  const { data: profile, error } = await admin
    .from("expert_profiles")
    .select("id,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return profile;
}

function storageUnavailableResponse() {
  return NextResponse.json(
    {
      error:
        "File storage is temporarily unavailable after several retries. Your file was not submitted. Please try Upload again in a moment.",
    },
    { status: 503 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const profile = await activeExpert(admin, user.id);
    if (!profile) return NextResponse.json({ error: "Active Expert profile not found." }, { status: 403 });

    const formData = await request.formData();
    const assignmentId = String(formData.get("assignmentId") || "").trim();
    const notes = String(formData.get("notes") || "").trim().slice(0, 5000) || null;
    const requestedBatchId = String(formData.get("batchId") || "").trim();
    const batchId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedBatchId)
      ? requestedBatchId
      : crypto.randomUUID();
    const file = formData.get("file") as File | null;

    if (!assignmentId || !file) return NextResponse.json({ error: "Assigned project and file are required." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Each Expert deliverable must be between 1 byte and 75 MB." }, { status: 400 });
    }

    const { data: assignment, error: assignmentError } = await admin
      .from("expert_assignments")
      .select("id,production_job_id,status")
      .eq("id", assignmentId)
      .eq("expert_profile_id", profile.id)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment || !["assigned", "in_progress", "submitted"].includes(assignment.status)) {
      return NextResponse.json({ error: "This project is not open for Expert submissions." }, { status: 409 });
    }

    let batchSequence = 1;
    const { data: existingBatch, error: existingBatchError } = await admin
      .from("expert_submissions")
      .select("batch_sequence")
      .eq("assignment_id", assignment.id)
      .eq("batch_id", batchId)
      .limit(1)
      .maybeSingle();
    if (existingBatchError) throw existingBatchError;

    if (existingBatch?.batch_sequence) {
      batchSequence = Number(existingBatch.batch_sequence);
    } else {
      const { data: latestBatch, error: latestBatchError } = await admin
        .from("expert_submissions")
        .select("batch_sequence")
        .eq("assignment_id", assignment.id)
        .order("batch_sequence", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestBatchError) throw latestBatchError;
      batchSequence = Number(latestBatch?.batch_sequence || 0) + 1;
    }

    const filename = safeFilename(file.name);
    const { data: previous, error: previousError } = await admin
      .from("expert_submissions")
      .select("version")
      .eq("assignment_id", assignment.id)
      .eq("filename", filename)
      .order("version", { ascending: false })
      .limit(1);
    if (previousError) throw previousError;
    const version = previous?.length ? Number(previous[0].version || 0) + 1 : 1;

    const storagePath = `experts/${assignment.id}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      await uploadWithRetry(admin, storagePath, buffer, file.type || "application/octet-stream");
    } catch (storageError) {
      console.error("Expert deliverable storage upload failed after retries:", storageError);
      if (isTransientStorageError(storageError)) return storageUnavailableResponse();
      throw storageError;
    }

    const now = new Date().toISOString();
    const { data: submission, error: insertError } = await admin
      .from("expert_submissions")
      .insert({
        assignment_id: assignment.id,
        production_job_id: assignment.production_job_id,
        expert_profile_id: profile.id,
        filename,
        batch_id: batchId,
        batch_sequence: batchSequence,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        version,
        notes,
        status: "submitted",
        submitted_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertError) {
      try {
        await removeWithRetry(admin, storagePath);
      } catch (cleanupError) {
        console.error("Expert upload cleanup failed after submission insert error:", cleanupError);
      }
      throw insertError;
    }

    return NextResponse.json({ success: true, submissionId: submission.id, filename, version, batchId, batchSequence });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Expert deliverable upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert deliverable could not be uploaded." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const profile = await activeExpert(admin, user.id);
    if (!profile) return NextResponse.json({ error: "Active Expert profile not found." }, { status: 403 });

    const body = (await request.json()) as { submissionId?: unknown };
    const submissionId = String(body.submissionId || "").trim();
    if (!submissionId) return NextResponse.json({ error: "Submission is required." }, { status: 400 });

    const { data: submission, error: submissionError } = await admin
      .from("expert_submissions")
      .select("id,assignment_id,expert_profile_id,storage_path,status,reviewed_at,published_at")
      .eq("id", submissionId)
      .eq("expert_profile_id", profile.id)
      .maybeSingle();
    if (submissionError) throw submissionError;
    if (!submission) return NextResponse.json({ error: "Expert submission not found." }, { status: 404 });

    if (submission.status !== "submitted" || submission.reviewed_at || submission.published_at) {
      return NextResponse.json(
        { error: "This file is locked because Heyy Studio has already reviewed or processed it." },
        { status: 409 },
      );
    }

    if (submission.storage_path) {
      try {
        await removeWithRetry(admin, submission.storage_path);
      } catch (storageError) {
        console.error("Expert submission storage deletion failed:", storageError);
        if (isTransientStorageError(storageError)) return storageUnavailableResponse();
        throw storageError;
      }
    }

    const { error: deleteError } = await admin
      .from("expert_submissions")
      .delete()
      .eq("id", submission.id)
      .eq("expert_profile_id", profile.id);
    if (deleteError) throw deleteError;

    const { data: remaining, error: remainingError } = await admin
      .from("expert_submissions")
      .select("id")
      .eq("assignment_id", submission.assignment_id)
      .eq("expert_profile_id", profile.id)
      .limit(1);
    if (remainingError) throw remainingError;

    if (!remaining?.length) {
      const now = new Date().toISOString();
      const { error: assignmentError } = await admin
        .from("expert_assignments")
        .update({ status: "in_progress", submitted_at: null, updated_at: now })
        .eq("id", submission.assignment_id)
        .eq("expert_profile_id", profile.id)
        .eq("status", "submitted");
      if (assignmentError) throw assignmentError;
    }

    return NextResponse.json({ success: true, deletedSubmissionId: submission.id });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Delete Expert deliverable error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert deliverable could not be deleted." },
      { status: 500 },
    );
  }
}
