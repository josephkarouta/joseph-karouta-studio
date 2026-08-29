import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ApiAuthError,
  requireApiUser,
} from "@/lib/server/auth";
import { validGenerationReconciliationSignature } from "@/lib/generation-jobs/reconciliation-signature";

export type GenerationStatusAccess = {
  admin: SupabaseClient;
  user: { id: string };
  internal: boolean;
};

export async function requireGenerationStatusAccess(
  request: Request,
  jobId: string,
  tool: "ai_upscaler" | "image_to_video",
): Promise<GenerationStatusAccess> {
  const target = `provider-status:${tool}:${jobId}`;
  const supplied = request.headers.get("x-heyy-reconciliation-signature");

  if (supplied) {
    if (!validGenerationReconciliationSignature(target, supplied)) {
      throw new ApiAuthError("Invalid reconciliation request.", 401);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new ApiAuthError("Account services are temporarily unavailable.", 503);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: job, error } = await admin
      .from("generation_jobs")
      .select("user_id")
      .eq("id", jobId)
      .eq("tool", tool)
      .maybeSingle();

    if (error || !job?.user_id) {
      throw new ApiAuthError("Generation job not found.", 404);
    }

    return {
      admin,
      user: { id: String(job.user_id) },
      internal: true,
    };
  }

  const auth = await requireApiUser(request);
  return {
    admin: auth.admin,
    user: { id: auth.user.id },
    internal: false,
  };
}
