import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductionRevisionPolicy =
  | {
      enforced: false;
      included: null;
      purchasedExtraRevisions: number;
      totalAllowance: null;
      used: number;
      remaining: null;
      extraRevisionFee: null;
      currency: null;
    }
  | {
      enforced: true;
      included: number;
      purchasedExtraRevisions: number;
      totalAllowance: number;
      used: number;
      remaining: number;
      extraRevisionFee: number;
      currency: string;
    };

export async function loadProductionRevisionPolicy(
  admin: SupabaseClient,
  job: Record<string, any>,
  used: number,
): Promise<ProductionRevisionPolicy> {
  const quoteId = String(job?.payment_quote_id || job?.metadata?.quote_id || "").trim();

  let quote: any = null;
  if (quoteId) {
    const result = await admin
      .from("workspace_quotes")
      .select("id,included_revisions,extra_revision_fee,currency")
      .eq("id", quoteId)
      .maybeSingle();
    if (result.error) throw result.error;
    quote = result.data;
  }

  if (!quote) {
    const result = await admin
      .from("workspace_quotes")
      .select("id,included_revisions,extra_revision_fee,currency")
      .eq("production_job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    quote = result.data;
  }

  const { count: purchasedCount, error: purchasedError } = await admin
    .from("production_addons")
    .select("id", { count: "exact", head: true })
    .eq("production_job_id", job.id)
    .eq("kind", "extra_revision")
    .eq("status", "paid");
  if (purchasedError) throw purchasedError;

  const purchasedExtraRevisions = Math.max(0, Number(purchasedCount || 0));

  if (!quote || quote.included_revisions === null || quote.included_revisions === undefined) {
    return {
      enforced: false,
      included: null,
      purchasedExtraRevisions,
      totalAllowance: null,
      used,
      remaining: null,
      extraRevisionFee: null,
      currency: null,
    };
  }

  const included = Math.max(0, Math.trunc(Number(quote.included_revisions) || 0));
  const totalAllowance = included + purchasedExtraRevisions;
  return {
    enforced: true,
    included,
    purchasedExtraRevisions,
    totalAllowance,
    used,
    remaining: Math.max(0, totalAllowance - used),
    extraRevisionFee: Number(quote.extra_revision_fee || 0),
    currency: String(quote.currency || "USD").toUpperCase(),
  };
}
