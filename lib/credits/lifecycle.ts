import type { SupabaseClient } from "@supabase/supabase-js";

export async function creditReservationStatus(
  admin: SupabaseClient,
  reservationId: string,
) {
  const { data, error } = await admin
    .from("credit_reservations")
    .select("status")
    .eq("id", reservationId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Credit reservation could not be checked.");
  return data?.status ? String(data.status) : null;
}

export async function commitReservedCredits(
  admin: SupabaseClient,
  reservationId: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await admin.rpc("heyy_commit_credits", {
    p_reservation_id: reservationId,
    p_metadata: metadata,
  });
  if (!error) return;

  // A lost HTTP response can report an RPC error after PostgreSQL committed.
  // Verify the durable reservation before any caller deletes a saved asset or
  // tries to refund it.
  const status = await creditReservationStatus(admin, reservationId);
  if (status === "committed") return;
  throw new Error(error.message || "Credits could not be committed.");
}

export async function refundReservedCredits(
  admin: SupabaseClient,
  reservationId: string,
  reason: string,
) {
  const status = await creditReservationStatus(admin, reservationId);
  if (status !== "reserved") return status;

  const { error } = await admin.rpc("heyy_refund_credits", {
    p_reservation_id: reservationId,
    p_reason: reason.slice(0, 500),
  });
  if (error) throw new Error(error.message || "Credits could not be refunded.");
  return "refunded";
}

export async function completeGenerationJob(
  admin: SupabaseClient,
  jobId: string,
  output: Record<string, unknown>,
  metadata: Record<string, unknown>,
) {
  let lastMessage = "Generation job could not be completed.";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await admin.rpc("heyy_complete_generation_job", {
      p_job_id: jobId,
      p_output: output,
      p_metadata: metadata,
    });
    if (!error) return;
    lastMessage = error.message || lastMessage;

    const { data: job, error: loadError } = await admin
      .from("generation_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();
    if (!loadError && job?.status === "succeeded") return;
    if (!loadError && ["failed", "cancelled"].includes(String(job?.status || ""))) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error(lastMessage);
}

export async function failGenerationJob(
  admin: SupabaseClient,
  args: {
    jobId: string;
    expectedStatus: "queued" | "processing" | "finalizing";
    reason: string;
    publicError: string;
    outputPatch?: Record<string, unknown>;
    requireMissingProviderId?: boolean;
  },
) {
  let lastMessage = "Generation failure could not be recorded.";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.rpc("heyy_fail_generation_job", {
      p_job_id: args.jobId,
      p_expected_status: args.expectedStatus,
      p_reason: args.reason.slice(0, 500),
      p_public_error: args.publicError,
      p_output_patch: args.outputPatch || {},
      p_require_provider_job_id_null: args.requireMissingProviderId === true,
    });
    if (!error) return data === true;
    lastMessage = error.message || lastMessage;

    const { data: job } = await admin
      .from("generation_jobs")
      .select("status")
      .eq("id", args.jobId)
      .maybeSingle();
    if (job?.status === "failed") return true;
    if (job?.status === "succeeded") return false;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error(lastMessage);
}
