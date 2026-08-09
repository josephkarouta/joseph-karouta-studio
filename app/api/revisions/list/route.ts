import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { loadProductionMessages } from "@/lib/production/messages";
import { requireAdminApiAccess } from "@/lib/server/admin-api";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  try {
    const productionJobId =
      request.nextUrl.searchParams.get("production_job_id")?.trim() || "";

    if (!productionJobId) {
      return NextResponse.json(
        { success: false, error: "Missing production_job_id" },
        { status: 400 },
      );
    }

    // This endpoint is shared by the client workspace and Admin production page.
    // Admin may inspect any job; clients must own the production job.
    const adminAccessError = await requireAdminApiAccess();
    const isAdmin = adminAccessError === null;
    let clientUserId: string | null = null;

    if (!isAdmin) {
      try {
        const { user } = await requireApiUser(request);
        clientUserId = user.id;
      } catch (error) {
        if (error instanceof ApiAuthError) {
          return NextResponse.json(
            { success: false, error: error.message },
            { status: error.status },
          );
        }
        throw error;
      }
    }

    let jobQuery = supabase
      .from("production_jobs")
      .select("id,user_id,payment_quote_id,metadata")
      .eq("id", productionJobId);

    if (!isAdmin && clientUserId) {
      jobQuery = jobQuery.eq("user_id", clientUserId);
    }

    const { data: job, error: jobError } = await jobQuery.maybeSingle();
    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: isAdmin
            ? "Production job not found"
            : "You do not have access to this production job",
        },
        { status: isAdmin ? 404 : 403 },
      );
    }

    const { data, error } = await supabase
      .from("workspace_revisions")
      .select(`
        *,
        workspace_revision_files (
          id,
          revision_id,
          deliverable_id,
          version,
          production_deliverables (
            id,
            filename,
            original_filename,
            version,
            storage_path,
            file_size,
            mime_type
          )
        )
      `)
      .eq("production_job_id", productionJobId)
      .order("revision_number", { ascending: true });

    if (error) throw error;

    const messages = await loadProductionMessages(supabase, productionJobId);
    const messagesById = new Map(messages.map((message) => [message.id, message]));

    const revisions = (data || []).map((revision: any) => ({
      ...revision,
      client_message: revision.client_message_id
        ? messagesById.get(revision.client_message_id) || null
        : null,
    }));

    const revisionPolicy = await loadRevisionPolicy(job, revisions.length);

    return NextResponse.json({
      success: true,
      revisions,
      revisionPolicy,
    });
  } catch (error) {
    console.error("List revisions error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Could not load revisions",
      },
      { status: 500 },
    );
  }
}

async function loadRevisionPolicy(job: any, used: number) {
  const quoteId = String(job?.payment_quote_id || job?.metadata?.quote_id || "").trim();

  let quote: any = null;
  if (quoteId) {
    const result = await supabase
      .from("workspace_quotes")
      .select("id,included_revisions,extra_revision_fee,currency")
      .eq("id", quoteId)
      .maybeSingle();
    if (result.error) throw result.error;
    quote = result.data;
  }

  if (!quote) {
    const result = await supabase
      .from("workspace_quotes")
      .select("id,included_revisions,extra_revision_fee,currency")
      .eq("production_job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    quote = result.data;
  }

  if (!quote || quote.included_revisions === null || quote.included_revisions === undefined) {
    return {
      enforced: false,
      included: null,
      used,
      remaining: null,
      extraRevisionFee: null,
      currency: null,
    };
  }

  const included = Math.max(0, Math.trunc(Number(quote.included_revisions) || 0));
  return {
    enforced: true,
    included,
    used,
    remaining: Math.max(0, included - used),
    extraRevisionFee: Number(quote.extra_revision_fee || 0),
    currency: String(quote.currency || "USD"),
  };
}
