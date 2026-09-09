import "server-only";

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";

const BUCKET = "expert-payout-proofs";
const MAX_BYTES = 10 * 1024 * 1024;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function safeFilename(value: string) {
  return String(value || "payout-proof")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "payout-proof";
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAdminApiCapability("operations");
    if (access.response) return access.response;

    const formData = await request.formData();
    const assignmentId = String(formData.get("assignmentId") || "").trim();
    const file = formData.get("file");
    if (!assignmentId || !(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Choose a payout proof file." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Payout proof must be 10 MB or smaller." }, { status: 400 });
    }
    const allowed = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) {
      return NextResponse.json({ error: "Use an image or PDF for payout proof." }, { status: 400 });
    }

    const admin = adminClient();
    const { data: assignment, error: assignmentError } = await admin
      .from("expert_assignments")
      .select("id,payout_proof_path")
      .eq("id", assignmentId)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) return NextResponse.json({ error: "Expert assignment not found." }, { status: 404 });

    const path = `${assignmentId}/${Date.now()}-${randomUUID()}-${safeFilename(file.name)}`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await admin
      .from("expert_assignments")
      .update({ payout_proof_path: path, updated_at: new Date().toISOString() })
      .eq("id", assignmentId);
    if (updateError) {
      await admin.storage.from(BUCKET).remove([path]);
      throw updateError;
    }

    if (assignment.payout_proof_path && assignment.payout_proof_path !== path) {
      await admin.storage.from(BUCKET).remove([assignment.payout_proof_path]);
    }

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return NextResponse.json({ success: true, path, url: signed?.signedUrl || null });
  } catch (error) {
    console.error("Expert payout proof upload failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payout proof could not be uploaded." }, { status: 500 });
  }
}
