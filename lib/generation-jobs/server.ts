import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditAction } from "@/lib/credits/config";
import { getCreditCost } from "@/lib/credits/config";
import {
  CreditError,
  ensureCreditWallet,
} from "@/lib/credits/server";
import { failGenerationJob } from "@/lib/credits/lifecycle";

export type GenerationJobStatus =
  | "queued"
  | "processing"
  | "finalizing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type GenerationJobStart = {
  jobId: string;
  reservationId: string | null;
  creditsReserved: number;
  created: boolean;
  status: GenerationJobStatus;
};

export async function startGenerationJob({
  admin,
  userId,
  request,
  scope,
  dedupe,
  projectId = null,
  tool,
  provider,
  action,
  input,
  metadata = {},
  amountOverride,
}: {
  admin: SupabaseClient;
  userId: string;
  request: Request;
  scope: string;
  dedupe: unknown;
  projectId?: string | null;
  tool: string;
  provider: string;
  action?: CreditAction;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  amountOverride?: number;
}): Promise<GenerationJobStart> {
  const configuredAmount = action ? getCreditCost(action) : 0;
  const amount =
    action && Number.isInteger(amountOverride) && Number(amountOverride) > 0
      ? Number(amountOverride)
      : configuredAmount;

  const cleanScope = safeKeySegment(scope);
  const suppliedRequestKey = cleanRequestKey(
    request.headers.get("Idempotency-Key") ||
      request.headers.get("X-Heyy-Request-Key"),
  );
  const requestKey = `${cleanScope}:${suppliedRequestKey || randomUUID()}`.slice(0, 240);
  const activeKey = `${cleanScope}:${digest(stableSerialize(dedupe))}`.slice(0, 240);

  if (amount > 0) {
    const ensured = await ensureCreditWallet({ admin, userId });
    if (ensured.renewalPending) {
      const existing = await findExistingGenerationJob(admin, userId, requestKey, activeKey);
      if (existing) return existing;
      throw new CreditError(
        "Your monthly credits are refreshing. Please try again shortly.",
        "CREDIT_OPERATION_FAILED",
        409,
      );
    }
  }

  const { data, error } = await admin.rpc("heyy_start_generation_job", {
    p_user_id: userId,
    p_request_key: requestKey,
    p_active_key: activeKey,
    p_project_id: projectId,
    p_tool: tool,
    p_provider: provider,
    p_action: action || null,
    p_amount: amount,
    p_input: input,
    p_metadata: metadata,
  });

  if (error) {
    const message = String(error.message || "");
    if (/insufficient/i.test(message)) {
      throw new CreditError(
        `You need ${amount} credits for this action. Buy more credits or choose a lower-cost mode.`,
        "INSUFFICIENT_CREDITS",
        402,
      );
    }
    if (/does not exist|schema cache|heyy_start_generation_job|generation_jobs/i.test(message)) {
      throw new CreditError(
        "The generation idempotency migration has not been applied correctly.",
        "CREDIT_SYSTEM_UNAVAILABLE",
        503,
      );
    }
    throw new CreditError(message || "The generation job could not be started.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  const jobId = String(row?.job_id || "").trim();
  if (!jobId) {
    throw new CreditError("Generation job creation returned no identifier.");
  }

  return {
    jobId,
    reservationId: row?.reservation_id ? String(row.reservation_id) : null,
    creditsReserved: Number(row?.credits_reserved || 0),
    created: row?.created === true,
    status: normalizeStatus(row?.job_status),
  };
}

async function findExistingGenerationJob(
  admin: SupabaseClient,
  userId: string,
  requestKey: string,
  activeKey: string,
): Promise<GenerationJobStart | null> {
  const requestResult = await admin
    .from("generation_jobs")
    .select("id,credit_reservation_id,status")
    .eq("user_id", userId)
    .eq("request_key", requestKey)
    .maybeSingle();
  if (requestResult.error) return null;

  let job = requestResult.data;
  if (!job) {
    const activeResult = await admin
      .from("generation_jobs")
      .select("id,credit_reservation_id,status")
      .eq("user_id", userId)
      .eq("active_key", activeKey)
      .in("status", ["queued", "processing", "finalizing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeResult.error) return null;
    job = activeResult.data;
  }
  if (!job) return null;

  let creditsReserved = 0;
  if (job.credit_reservation_id) {
    const { data: reservation } = await admin
      .from("credit_reservations")
      .select("amount")
      .eq("id", job.credit_reservation_id)
      .maybeSingle();
    creditsReserved = Number(reservation?.amount || 0);
  }

  return {
    jobId: String(job.id),
    reservationId: job.credit_reservation_id ? String(job.credit_reservation_id) : null,
    creditsReserved,
    created: false,
    status: normalizeStatus(job.status),
  };
}

export async function cleanupGenerationStart({
  admin,
  job,
  reason,
  publicError,
}: {
  admin: SupabaseClient;
  job: GenerationJobStart;
  reason: string;
  publicError: string;
}) {
  // A duplicate request never owns the original job or reservation and must
  // never fail/refund them because its own dispatch response was lost.
  if (job.created) {
    try {
      const failed = await failGenerationJob(admin, {
        jobId: job.jobId,
        expectedStatus: "queued",
        reason,
        publicError,
      });
      if (failed) {
        return "failed" as GenerationJobStatus;
      }
    } catch (error) {
      console.error("Generation start cleanup failed:", error);
    }
  }

  const { data } = await admin
    .from("generation_jobs")
    .select("status")
    .eq("id", job.jobId)
    .maybeSingle();

  return normalizeStatus(data?.status || job.status);
}

export function isActiveGenerationStatus(status: GenerationJobStatus) {
  return status === "queued" || status === "processing" || status === "finalizing";
}

function normalizeStatus(value: unknown): GenerationJobStatus {
  const status = String(value || "queued") as GenerationJobStatus;
  return ["queued", "processing", "finalizing", "succeeded", "failed", "cancelled"].includes(status)
    ? status
    : "queued";
}

function cleanRequestKey(value: string | null) {
  const key = String(value || "").trim();
  if (!key || key.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(key)) return null;
  return key;
}

function safeKeySegment(value: string) {
  return String(value || "generation")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "generation";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}
