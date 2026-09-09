import { NextRequest, NextResponse } from "next/server";

import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { Notifications } from "@/lib/notifications";
import {
  notifyAdminOperationalEvent,
  notifyExpertOperationalEvent,
} from "@/lib/expert-network/operational-notifications";

const BLOCKING_REVISION_STATUSES = ["Requested", "In Progress"];

async function reconcileExpertCompletion(admin: any, jobId: string, now = new Date().toISOString()) {
  const { data: assignment, error } = await admin
    .from("expert_assignments")
    .select("id,status,payout_status,completed_at,payout_eligible_at")
    .eq("production_job_id", jobId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!assignment || assignment.status === "cancelled") return assignment || null;

  const update: Record<string, unknown> = {
    status: "completed",
    completed_at: assignment.completed_at || now,
    updated_at: now,
  };

  if (assignment.payout_status === "pending") {
    update.payout_status = "eligible";
    update.payout_eligible_at = assignment.payout_eligible_at || now;
  }

  const { data: updated, error: updateError } = await admin
    .from("expert_assignments")
    .update(update)
    .eq("id", assignment.id)
    .select("id,status,payout_status,completed_at,payout_eligible_at")
    .single();

  if (updateError) throw updateError;
  return updated;
}

async function sendFinalApprovalNotifications(
  admin: any,
  job: any,
  finalDeliverableId?: string | null,
) {
  const metadata =
    job?.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
      ? job.metadata
      : {};

  const clientNotification = Notifications.emit({
    event: "project.completed",
    projectId: job.project_id,
    projectName: job.project_name,
    service: job.service,
    studio: job.studio || job.assigned_studio,
    userId: job.user_id,
    clientName: job.client_name || null,
    clientEmail: job.client_email || null,
    metadata: {
      serviceId: job.service_id || metadata.service_id || metadata.serviceId || null,
      productionJobId: job.id,
      status: "Completed",
      finalDeliverableId: finalDeliverableId || null,
      selectedScopes:
        metadata.selected_production_scopes ||
        metadata.project_context?.selected_production_scopes ||
        null,
      productionOnly: Boolean(metadata.production_only),
    },
  });

  const { data: assignment, error: assignmentError } = await admin
    .from("expert_assignments")
    .select("id,expert_profile_id")
    .eq("production_job_id", job.id)
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    console.error("Final approval Expert assignment lookup failed:", assignmentError);
  }

  const adminNotification = notifyAdminOperationalEvent(admin, {
    key: `client-final-approval-admin:${job.id}`,
    type: "production.client_approved.admin",
    projectName: job.project_name || null,
    service: job.service || null,
    studio: job.studio || job.assigned_studio || null,
    title: "Client approved the final production package",
    message: "The client approved the delivered files. The production review is complete and the project can move to final handoff and Expert payout tracking.",
    status: "Client approved",
    href: `/admin/production/${encodeURIComponent(job.id)}?tab=Expert&expertView=payout`,
  });

  let expertNotification: Promise<unknown> = Promise.resolve();
  if (assignment?.expert_profile_id) {
    const { data: expert, error: expertError } = await admin
      .from("expert_profiles")
      .select("user_id,email,full_name")
      .eq("id", assignment.expert_profile_id)
      .maybeSingle();

    if (expertError) {
      console.error("Final approval Expert profile lookup failed:", expertError);
    } else if (expert) {
      expertNotification = notifyExpertOperationalEvent(admin, {
        key: `client-final-approval-expert:${job.id}`,
        type: "expert.project.client_approved",
        expertUserId: expert.user_id || null,
        expertEmail: expert.email || null,
        expertName: expert.full_name || "Expert",
        projectName: job.project_name || null,
        service: job.service || null,
        studio: job.studio || job.assigned_studio || null,
        title: "Client approved the final delivery",
        message: "The client approved the final production package. Heyy Studio will now complete the project and handle payout tracking.",
        status: "Client approved",
        href: `/expert?section=projects&assignment=${encodeURIComponent(assignment.id)}&panel=files`,
      });
    }
  }

  const results = await Promise.allSettled([
    clientNotification,
    adminNotification,
    expertNotification,
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        ["Client", "Admin", "Expert"][index] + " final approval notification failed:",
        result.reason,
      );
    }
  });
}

async function acceptWaitingRevision(
  admin: any,
  jobId: string,
  now: string,
) {
  const { data: waitingRevision, error: revisionError } = await admin
    .from("workspace_revisions")
    .select("*")
    .eq("production_job_id", jobId)
    .eq("status", "Waiting Approval")
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (revisionError) throw revisionError;
  if (!waitingRevision) return null;

  const { data: links, error: linksError } = await admin
    .from("workspace_revision_files")
    .select("deliverable_id")
    .eq("revision_id", waitingRevision.id)
    .eq("production_job_id", jobId);

  if (linksError) throw linksError;

  const deliverableIds = (links || [])
    .map((item: any) => item.deliverable_id)
    .filter(Boolean);

  if (!deliverableIds.length) {
    throw new Error(
      "The revised delivery has no file attached. Ask Heyy Studio to publish the revised file before approving.",
    );
  }

  const { data: revisionFiles, error: filesError } = await admin
    .from("production_deliverables")
    .select("*")
    .in("id", deliverableIds)
    .order("uploaded_at", { ascending: false });

  if (filesError) throw filesError;
  if (!revisionFiles?.length) {
    throw new Error("The revised production file could not be found.");
  }

  const { error: publishError } = await admin
    .from("production_deliverables")
    .update({
      client_visible: true,
      published_at: now,
    })
    .in("id", deliverableIds);

  if (publishError) throw publishError;

  const { error: approveRevisionError } = await admin
    .from("workspace_revisions")
    .update({
      status: "Approved",
      updated_at: now,
      completed_at: now,
    })
    .eq("id", waitingRevision.id);

  if (approveRevisionError) throw approveRevisionError;

  const { error: closeOlderError } = await admin
    .from("workspace_revisions")
    .update({
      status: "Changes Requested",
      updated_at: now,
      completed_at: now,
    })
    .eq("production_job_id", jobId)
    .eq("status", "Waiting Approval")
    .neq("id", waitingRevision.id);

  if (closeOlderError) throw closeOlderError;

  return {
    revision: waitingRevision,
    revisionFiles,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const jobId = String(body?.jobId || "").trim();

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Missing production job." },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Production job not found." },
        { status: 404 },
      );
    }

    if (job.client_approved_at) {
      // Self-heal both the operational completion state and communication fan-out
      // without changing the client's original approval timestamp.
      await reconcileExpertCompletion(admin, job.id, job.client_approved_at);
      await sendFinalApprovalNotifications(admin, job);
      return NextResponse.json({ success: true, job, alreadyApproved: true });
    }

    const { count: blockingRevisionCount, error: blockingRevisionError } =
      await admin
        .from("workspace_revisions")
        .select("id", { count: "exact", head: true })
        .eq("production_job_id", job.id)
        .in("status", BLOCKING_REVISION_STATUSES);

    if (blockingRevisionError) throw blockingRevisionError;

    if (blockingRevisionCount) {
      return NextResponse.json(
        {
          success: false,
          error:
            "There is an active revision request. Wait for the studio response before approving the production package.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const acceptedRevision = await acceptWaitingRevision(admin, job.id, now);

    // The client's approved package is the source of truth for final files.
    // Mark every latest client-visible deliverable as final so Admin does not
    // have to manually "Mark Final" after the client already approved it.
    const { data: approvedFiles, error: approvedFilesError } = await admin
      .from("production_deliverables")
      .select("id")
      .eq("production_job_id", job.id)
      .eq("client_visible", true)
      .eq("is_latest", true);

    if (approvedFilesError) throw approvedFilesError;
    const approvedFileIds = (approvedFiles || []).map((item: any) => item.id).filter(Boolean);

    if (!approvedFileIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Delivered client files are required before approving the project.",
        },
        { status: 400 },
      );
    }

    const { error: clearFinalError } = await admin
      .from("production_deliverables")
      .update({ is_final: false })
      .eq("production_job_id", job.id);
    if (clearFinalError) throw clearFinalError;

    const { error: markFinalError } = await admin
      .from("production_deliverables")
      .update({ is_final: true })
      .in("id", approvedFileIds);
    if (markFinalError) throw markFinalError;

    const { data: updatedJob, error: updateError } = await admin
      .from("production_jobs")
      .update({
        status: "Delivered",
        delivery_status: "Client Approved",
        client_approved_at: now,
        client_approved_by: user.id,
        updated_at: now,
      })
      .eq("id", job.id)
      .is("client_approved_at", null)
      .select("*")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updatedJob) {
      const { data: currentJob, error: currentError } = await admin
        .from("production_jobs")
        .select("*")
        .eq("id", job.id)
        .single();

      if (currentError) throw currentError;
      await reconcileExpertCompletion(admin, currentJob.id, currentJob.client_approved_at || now);
      await sendFinalApprovalNotifications(admin, currentJob);
      return NextResponse.json({
        success: true,
        job: currentJob,
        alreadyApproved: true,
      });
    }

    const revisionNote = acceptedRevision?.revision
      ? ` Revision ${acceptedRevision.revision.revision_number} was accepted as the final version.`
      : "";

    const { error: timelineError } = await admin
      .from("production_timeline")
      .insert({
        production_job_id: job.id,
        title: "Final Delivery Approved",
        description: `The client approved the delivered files and completed the production review.${revisionNote}`,
        status: "Delivered",
        created_by: "Client",
      });

    if (timelineError) throw timelineError;

    const { error: messageError } = await admin
      .from("production_messages")
      .insert({
        production_job_id: job.id,
        sender_type: "system",
        sender_name: "Heyy Studio",
        message: acceptedRevision?.revision
          ? `The client approved Revision ${acceptedRevision.revision.revision_number} and completed the final delivery.`
          : "The client approved the final delivery. This production package is now complete.",
        read_by_client_at: now,
      });

    if (messageError) throw messageError;

    // Final client approval closes the Expert assignment and makes a pending
    // manual payout eligible. Paid/held payout states are never overwritten.
    await reconcileExpertCompletion(admin, job.id, now);

    // Completion communication is non-destructive and idempotent. It is sent
    // only after the approval state, timeline, system message and Expert state are durable.
    await sendFinalApprovalNotifications(
      admin,
      updatedJob,
      approvedFileIds[0] || null,
    );

    return NextResponse.json({
      success: true,
      job: updatedJob,
      acceptedRevisionId: acceptedRevision?.revision?.id || null,
      finalDeliverableId: approvedFileIds[0] || null,
    });
  } catch (error) {
    console.error("Approve final delivery error:", error);

    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not approve the final delivery.",
      },
      { status: 500 },
    );
  }
}
