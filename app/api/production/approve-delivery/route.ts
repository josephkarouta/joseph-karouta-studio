import { NextRequest, NextResponse } from "next/server";

import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

const BLOCKING_REVISION_STATUSES = ["Requested", "In Progress"];

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

  const { error: clearFinalError } = await admin
    .from("production_deliverables")
    .update({ is_final: false })
    .eq("production_job_id", jobId);

  if (clearFinalError) throw clearFinalError;

  const { error: publishError } = await admin
    .from("production_deliverables")
    .update({
      client_visible: true,
      published_at: now,
    })
    .in("id", deliverableIds);

  if (publishError) throw publishError;

  const finalFile = [...revisionFiles].sort((a: any, b: any) => {
    const aDate = new Date(a.uploaded_at || 0).getTime();
    const bDate = new Date(b.uploaded_at || 0).getTime();
    if (aDate !== bDate) return bDate - aDate;
    return Number(b.version || 1) - Number(a.version || 1);
  })[0];

  const { error: finalError } = await admin
    .from("production_deliverables")
    .update({
      is_final: true,
      is_latest: true,
      client_visible: true,
      published_at: now,
    })
    .eq("id", finalFile.id);

  if (finalError) throw finalError;

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
    finalFile,
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

    const { count: finalCount, error: finalError } = await admin
      .from("production_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", job.id)
      .eq("client_visible", true)
      .eq("is_final", true);

    if (finalError) throw finalError;

    if (!finalCount) {
      return NextResponse.json(
        {
          success: false,
          error: "A delivered final file is required before approving the project.",
        },
        { status: 400 },
      );
    }

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

    return NextResponse.json({
      success: true,
      job: updatedJob,
      acceptedRevisionId: acceptedRevision?.revision?.id || null,
      finalDeliverableId: acceptedRevision?.finalFile?.id || null,
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
