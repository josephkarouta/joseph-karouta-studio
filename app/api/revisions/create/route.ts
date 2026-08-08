import { NextRequest, NextResponse } from "next/server";

import { Notifications } from "@/lib/notifications";
import {
  cleanMessage,
  createProductionMessage,
  extractMessageFiles,
  ProductionMessageInputError,
} from "@/lib/production/messages";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

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
