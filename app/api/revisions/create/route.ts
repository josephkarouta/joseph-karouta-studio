import { NextRequest, NextResponse } from "next/server";

import { Notifications } from "@/lib/notifications";
import {
  cleanMessage,
  createProductionMessage,
  extractMessageFiles,
  ProductionMessageInputError,
} from "@/lib/production/messages";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

type RevisionPolicy =
  | {
      enforced: false;
      included: null;
      used: number;
      remaining: null;
      extraRevisionFee: null;
      currency: null;
    }
  | {
      enforced: true;
      included: number;
      used: number;
      remaining: number;
      extraRevisionFee: number;
      currency: string;
    };

export async function POST(request: NextRequest) {
  let createdRevisionId: string | null = null;

  try {
    const { user, admin } = await requireApiUser(request);
    const formData = await request.formData();
    const productionJobId = cleanMessage(formData.get("production_job_id"));
    const message = cleanMessage(formData.get("message"));
    const previousRevisionId = cleanMessage(
      formData.get("previous_revision_id"),
    );
    const files = extractMessageFiles(formData);

    if (!productionJobId) {
      return NextResponse.json(
        { success: false, error: "Missing production_job_id" },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Please explain what needs to change" },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .select("*")
      .eq("id", productionJobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Production job not found" },
        { status: 404 },
      );
    }

    if (job.client_approved_at) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This final delivery is already approved. Start a new production request for additional changes.",
        },
        { status: 400 },
      );
    }

    const { count: deliveredFileCount, error: deliveredFileError } = await admin
      .from("production_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", productionJobId)
      .eq("client_visible", true);

    if (deliveredFileError) throw deliveredFileError;

    if (!deliveredFileCount) {
      return NextResponse.json(
        {
          success: false,
          error: "Wait until the first production file is delivered before requesting a revision.",
        },
        { status: 400 },
      );
    }

    let previousRevision: any = null;

    if (previousRevisionId) {
      const { data, error } = await admin
        .from("workspace_revisions")
        .select("*")
        .eq("id", previousRevisionId)
        .eq("production_job_id", productionJobId)
        .single();

      if (error || !data) {
        throw error || new Error("Previous revision not found");
      }

      previousRevision = data;
    } else {
      const { data: waitingRevision, error: waitingRevisionError } = await admin
        .from("workspace_revisions")
        .select("*")
        .eq("production_job_id", productionJobId)
        .eq("status", "Waiting Approval")
        .order("revision_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (waitingRevisionError) throw waitingRevisionError;
      previousRevision = waitingRevision || null;
    }

    const { count: openRevisionCount, error: openRevisionError } = await admin
      .from("workspace_revisions")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", productionJobId)
      .in("status", ["Requested", "In Progress"]);

    if (openRevisionError) throw openRevisionError;

    if (openRevisionCount) {
      return NextResponse.json(
        {
          success: false,
          error: "There is already an active revision request for this production job.",
        },
        { status: 409 },
      );
    }

    const { count, error: countError } = await admin
      .from("workspace_revisions")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", productionJobId);

    if (countError) throw countError;

    const revisionPolicy = await loadRevisionPolicy(admin, job, count || 0);
    if (revisionPolicy.enforced && revisionPolicy.remaining <= 0) {
      const feeText = revisionPolicy.extraRevisionFee > 0
        ? ` Additional revisions are quoted at ${revisionPolicy.currency} ${revisionPolicy.extraRevisionFee}.`
        : " Contact Heyy Studio if you need additional changes.";

      return NextResponse.json(
        {
          success: false,
          code: "REVISION_LIMIT_REACHED",
          error: `Your ${revisionPolicy.included} included revision${revisionPolicy.included === 1 ? " has" : "s have"} been used.${feeText}`,
          revisionPolicy,
        },
        { status: 409 },
      );
    }

    const revisionNumber = (count || 0) + 1;
    const now = new Date().toISOString();

    const { data: revision, error: revisionError } = await admin
      .from("workspace_revisions")
      .insert({
        production_job_id: productionJobId,
        project_id: job.project_id,
        studio: job.studio,
        service: job.service,
        revision_number: revisionNumber,
        status: "Requested",
        requested_by: user.id,
        message,
        client_visible: true,
      })
      .select()
      .single();

    if (revisionError || !revision) {
      throw revisionError || new Error("Revision could not be created");
    }

    createdRevisionId = revision.id;

    const senderName =
      cleanMessage(user.user_metadata?.full_name) ||
      cleanMessage(user.user_metadata?.name) ||
      cleanMessage(user.email) ||
      "Client";

    const clientMessage = await createProductionMessage({
      admin,
      jobId: productionJobId,
      senderType: "client",
      senderName,
      senderUserId: user.id,
      message: `Revision #${revisionNumber} request\n\n${message}`,
      files,
    });

    const { error: linkError } = await admin
      .from("workspace_revisions")
      .update({ client_message_id: clientMessage.id })
      .eq("id", revision.id);

    if (linkError) throw linkError;

    if (previousRevision) {
      const { error: previousUpdateError } = await admin
        .from("workspace_revisions")
        .update({
          status: "Changes Requested",
          updated_at: now,
          completed_at: now,
        })
        .eq("id", previousRevision.id);

      if (previousUpdateError) throw previousUpdateError;
    }

    const { error: timelineError } = await admin
      .from("production_timeline")
      .insert({
        production_job_id: productionJobId,
        title: `Revision ${revisionNumber} Requested`,
        description: previousRevision
          ? `The client requested additional changes after Revision ${previousRevision.revision_number}.\n\n${message}`
          : message,
        status: "Revision Requested",
        created_by: "Client",
      });

    if (timelineError) throw timelineError;

    await Notifications.emit({
      event: "revision.requested",
      projectId: job.project_id,
      projectName: job.project_name,
      service: job.service,
      studio: job.studio,
      userId: job.user_id,
      clientName: senderName,
      clientEmail: user.email || null,
      metadata: {
        serviceId: job.service_id || job.metadata?.service_id,
        productionJobId: job.id,
        revisionId: revision.id,
        revisionNumber,
        message,
        attachmentCount: files.length,
        previousRevisionId: previousRevision?.id || null,
        previousRevisionNumber: previousRevision?.revision_number || null,
        isAnotherRevision: Boolean(previousRevision),
      },
    });

    return NextResponse.json({
      success: true,
      revision: { ...revision, client_message_id: clientMessage.id },
      previousRevisionId: previousRevision?.id || null,
    });
  } catch (error) {
    console.error("Create revision error:", error);

    if (error instanceof ApiAuthError || error instanceof ProductionMessageInputError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Could not create revision",
      },
      { status: 500 },
    );
  }
}
async function loadRevisionPolicy(admin: any, job: any, used: number): Promise<RevisionPolicy> {
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

