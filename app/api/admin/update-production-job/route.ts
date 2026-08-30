import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Notifications } from "@/lib/notifications";
import { createProductionMessage } from "@/lib/production/messages";

import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const titles: Record<string, string> = {
  "Waiting Assignment": "Production Requested",
  Assigned: "Production Assigned",
  "In Progress": "Production Started",
  "Ready For Review": "Production Ready For Review",
  "Client Reviewing": "Client Reviewing Files",
  Approved: "Production Approved",
  Delivered: "Production Delivered",
};

const checklistByStatus: Record<string, string[]> = {
  "In Progress": ["Production Started"],
  "Ready For Review": ["Quality Assurance"],
  Delivered: ["Ready For Delivery"],
};

async function completeChecklistItems(
  jobId: string,
  titlesToComplete: string[]
) {
  if (!titlesToComplete.length) return;

  await supabase
    .from("production_checklist")
    .update({ completed: true })
    .eq("production_job_id", jobId)
    .in("title", titlesToComplete);
}

type RevisionFileMeta = {
  revisionId: string;
  status: string;
  revisionNumber: number | null;
};

async function getRevisionFileMeta(jobId: string) {
  const { data: links, error: linksError } = await supabase
    .from("workspace_revision_files")
    .select("deliverable_id,revision_id")
    .eq("production_job_id", jobId);

  if (linksError) throw linksError;

  const revisionIds = Array.from(
    new Set((links || []).map((item: any) => item.revision_id).filter(Boolean))
  );

  const revisionMap = new Map<string, any>();

  if (revisionIds.length > 0) {
    const { data: revisions, error: revisionsError } = await supabase
      .from("workspace_revisions")
      .select("id,status,revision_number")
      .in("id", revisionIds);

    if (revisionsError) throw revisionsError;

    for (const revision of revisions || []) {
      revisionMap.set(revision.id, revision);
    }
  }

  const metaByDeliverableId = new Map<string, RevisionFileMeta>();

  for (const link of links || []) {
    if (!link.deliverable_id) continue;

    const revision = revisionMap.get(link.revision_id);

    metaByDeliverableId.set(link.deliverable_id, {
      revisionId: link.revision_id,
      status: revision?.status || "Unknown",
      revisionNumber: revision?.revision_number ?? null,
    });
  }

  return metaByDeliverableId;
}

function canAppearInFinalHandoff(meta?: RevisionFileMeta) {
  return !meta || meta.status === "Approved";
}


export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const body = await request.json();

    const {
      id,
      status,
      priority,
      assigned_studio,
      internal_notes,
      delivery_status,
      publish_final_deliverables = false,
      delivery_message,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing production job id" },
        { status: 400 }
      );
    }

    const cleanDeliveryMessage =
      typeof delivery_message === "string" ? delivery_message.trim() : "";

    const { data: previousJob, error: previousError } = await supabase
      .from("production_jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (previousError || !previousJob) {
      throw previousError || new Error("Production job not found");
    }

    let selectedFinalFiles: any[] = [];

    if (publish_final_deliverables) {
      const revisionMeta = await getRevisionFileMeta(id);

      const { data: finalFiles, error: finalFilesError } = await supabase
        .from("production_deliverables")
        .select("*")
        .eq("production_job_id", id)
        .eq("is_final", true);

      if (finalFilesError) throw finalFilesError;

      selectedFinalFiles = (finalFiles || []).filter((file: any) =>
        canAppearInFinalHandoff(revisionMeta.get(file.id))
      );

      if (selectedFinalFiles.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Mark one approved production file as Final before delivering it.",
          },
          { status: 400 }
        );
      }
    }

    const nextStatus = publish_final_deliverables
      ? "Client Reviewing"
      : status || previousJob.status;

    const now = new Date().toISOString();

    const { data: job, error: updateError } = await supabase
      .from("production_jobs")
      .update({
        status: nextStatus,
        priority: priority !== undefined ? priority : previousJob.priority,
        assigned_studio:
          assigned_studio !== undefined
            ? assigned_studio
            : previousJob.assigned_studio,
        internal_notes:
          internal_notes !== undefined
            ? internal_notes
            : previousJob.internal_notes,
        delivery_status: publish_final_deliverables
          ? "Awaiting Client Approval"
          : delivery_status !== undefined
            ? delivery_status
            : previousJob.delivery_status,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError || !job) {
      throw updateError || new Error("Could not update production job");
    }

    const statusChanged = previousJob.status !== nextStatus;

    if (statusChanged) {
      await supabase.from("production_timeline").insert({
        production_job_id: id,
        title: titles[nextStatus] || nextStatus,
        description: cleanDeliveryMessage || `Status changed to ${nextStatus}`,
        status: nextStatus,
        created_by: "Admin",
      });

      await completeChecklistItems(
        id,
        checklistByStatus[nextStatus] || []
      );
    }

    if (publish_final_deliverables) {
      const selectedIds = selectedFinalFiles.map((file: any) => file.id);

      const { error: publishError } = await supabase
        .from("production_deliverables")
        .update({
          client_visible: true,
          published_at: now,
        })
        .in("id", selectedIds);

      if (publishError) throw publishError;

      const filenames = selectedFinalFiles.map(
        (file: any) => file.original_filename || file.filename
      );

      const defaultDeliveryMessage =
        selectedFinalFiles.length === 1
          ? `${filenames[0]} — Version ${selectedFinalFiles[0].version || 1} was sent to the client.`
          : `${selectedFinalFiles.length} approved final files were sent to the client.`;

      const messageForClient =
        cleanDeliveryMessage ||
        `Your final ${job.service || "production"} files are ready to download.`;

      await supabase.from("production_timeline").insert({
        production_job_id: id,
        title: "Final Deliverables Published",
        description: cleanDeliveryMessage || defaultDeliveryMessage,
        status: "Delivered",
        created_by: "Admin",
      });

      await createProductionMessage({
        admin: supabase,
        jobId: id,
        senderType: "studio",
        senderName: "Heyy Studio",
        message: messageForClient,
      });

      await Notifications.emit({
        event: "deliverables.uploaded",
        projectId: job.project_id,
        projectName: job.project_name,
        service: job.service,
        studio: job.studio,
        userId: job.user_id,
        metadata: {
          serviceId: job.service_id || job.metadata?.service_id,
          productionJobId: job.id,
          status: "Final deliverables ready",
          fileCount: selectedFinalFiles.length,
          filenames,
          deliveryMessage: messageForClient,
        },
      });
    }

    if (statusChanged && !publish_final_deliverables) {
      const notificationEvent =
        nextStatus === "Assigned"
          ? "production.assigned"
          : nextStatus === "In Progress"
            ? "production.started"
            : nextStatus === "Ready For Review"
              ? "production.review"
              : nextStatus === "Approved"
                ? "project.completed"
                : null;

      if (notificationEvent) {
        await Notifications.emit({
          event: notificationEvent,
          projectId: job.project_id,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          userId: job.user_id,
          metadata: {
            serviceId: job.service_id || job.metadata?.service_id,
            productionJobId: job.id,
            status: nextStatus,
          },
        });
      }
    }

    await recordAdminAudit({
      actorUserId: access.user!.id,
      action: publish_final_deliverables ? "production.deliverables_published" : statusChanged ? "production.status_updated" : "production.updated",
      entityType: "production_job",
      entityId: String(id),
      summary: publish_final_deliverables
        ? `Published final deliverables for ${job.project_name || job.service || "production job"}`
        : statusChanged
          ? `Changed production status to ${nextStatus}`
          : `Updated production job ${job.project_name || job.service || id}`,
      metadata: { previous_status: previousJob.status, next_status: nextStatus, priority: job.priority, assigned_studio: job.assigned_studio },
    });

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error("Update Production Job Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not update production job",
      },
      { status: 500 }
    );
  }
}
