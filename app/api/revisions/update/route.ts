import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Notifications } from "@/lib/notifications";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_STATUSES = [
  "Requested",
  "In Progress",
  "Waiting Approval",
  "Changes Requested",
  "Approved",
  "Declined",
  "Cancelled",
];
async function publishRevisionFilesForReview(
  revisionId: string,
  productionJobId: string,
  publishedAt: string,
) {
  const { data: links, error: linksError } = await supabase
    .from("workspace_revision_files")
    .select("deliverable_id")
    .eq("revision_id", revisionId)
    .eq("production_job_id", productionJobId);

  if (linksError) throw linksError;

  const deliverableIds = (links || [])
    .map((item: any) => item.deliverable_id)
    .filter(Boolean);

  if (!deliverableIds.length) return [];

  const { data: files, error: publishError } = await supabase
    .from("production_deliverables")
    .update({
      client_visible: true,
      published_at: publishedAt,
      is_final: false,
    })
    .in("id", deliverableIds)
    .select();

  if (publishError) throw publishError;
  return files || [];
}


async function promoteApprovedRevisionFiles(
  revisionId: string,
  productionJobId: string,
  publishedAt: string
) {
  const { data: links, error: linksError } = await supabase
    .from("workspace_revision_files")
    .select("deliverable_id")
    .eq("revision_id", revisionId)
    .eq("production_job_id", productionJobId);

  if (linksError) throw linksError;

  const deliverableIds = (links || [])
    .map((item: any) => item.deliverable_id)
    .filter(Boolean);

  if (deliverableIds.length === 0) {
    return {
      promotedFiles: [] as any[],
      finalFile: null as any,
    };
  }

  const { data: revisionFiles, error: filesError } = await supabase
    .from("production_deliverables")
    .select("*")
    .in("id", deliverableIds)
    .order("uploaded_at", { ascending: false });

  if (filesError) throw filesError;

  const promotedFiles = revisionFiles || [];

  if (promotedFiles.length === 0) {
    return {
      promotedFiles: [],
      finalFile: null,
    };
  }

  /*
   * Preserve delivered history, but move the active Final marker
   * to the newest file approved in this revision.
   */
  const { error: clearFinalError } = await supabase
    .from("production_deliverables")
    .update({ is_final: false })
    .eq("production_job_id", productionJobId);

  if (clearFinalError) throw clearFinalError;

  const { error: publishError } = await supabase
    .from("production_deliverables")
    .update({
      client_visible: true,
      published_at: publishedAt,
    })
    .in("id", deliverableIds);

  if (publishError) throw publishError;

  const finalFile = [...promotedFiles].sort((a: any, b: any) => {
    const aDate = new Date(a.uploaded_at || 0).getTime();
    const bDate = new Date(b.uploaded_at || 0).getTime();

    if (aDate !== bDate) return bDate - aDate;

    return Number(b.version || 1) - Number(a.version || 1);
  })[0];

  const { error: finalError } = await supabase
    .from("production_deliverables")
    .update({
      is_final: true,
      is_latest: true,
      client_visible: true,
      published_at: publishedAt,
    })
    .eq("id", finalFile.id);

  if (finalError) throw finalError;

  await supabase
    .from("production_jobs")
    .update({
      status: "Delivered",
      delivery_status: "Completed",
      updated_at: publishedAt,
    })
    .eq("id", productionJobId);

  return {
    promotedFiles: promotedFiles.map((file: any) => ({
      ...file,
      client_visible: true,
      published_at: publishedAt,
      is_final: file.id === finalFile.id,
    })),
    finalFile: {
      ...finalFile,
      is_final: true,
      client_visible: true,
      published_at: publishedAt,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      revision_id,
      status,
      admin_response,
      responded_by,
      notify_client = false,
      client_action,
    } = body;

    if (!revision_id) {
      return NextResponse.json(
        { success: false, error: "Missing revision_id" },
        { status: 400 }
      );
    }

    const { data: existingRevision, error: existingError } = await supabase
      .from("workspace_revisions")
      .select("*")
      .eq("id", revision_id)
      .single();

    if (existingError || !existingRevision) {
      throw existingError || new Error("Revision not found");
    }

    const isClientApproval = client_action === "approve";

    const nextStatus = isClientApproval
      ? "Approved"
      : notify_client
        ? "Waiting Approval"
        : status;

    if (!nextStatus || !ALLOWED_STATUSES.includes(nextStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid revision status" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const adminResponseWasProvided = typeof admin_response === "string";

    const nextAdminResponse = adminResponseWasProvided
      ? admin_response.trim() || null
      : existingRevision.admin_response;

    const responseChanged =
      adminResponseWasProvided &&
      nextAdminResponse !== existingRevision.admin_response;

    const isCompleted = [
      "Changes Requested",
      "Approved",
      "Declined",
      "Cancelled",
    ].includes(nextStatus);

    const { data: revision, error: updateError } = await supabase
      .from("workspace_revisions")
      .update({
        status: nextStatus,
        admin_response: nextAdminResponse,
        responded_by: responseChanged
          ? responded_by || null
          : existingRevision.responded_by,
        responded_at: responseChanged
          ? now
          : existingRevision.responded_at,
        updated_at: now,
        completed_at: isCompleted ? now : null,
      })
      .eq("id", revision_id)
      .select()
      .single();

    if (updateError || !revision) {
      throw updateError || new Error("Revision could not be updated");
    }

    const { data: job, error: jobError } = await supabase
      .from("production_jobs")
      .select("*")
      .eq("id", revision.production_job_id)
      .single();

    if (jobError || !job) {
      throw jobError || new Error("Production job not found");
    }

    if (notify_client) {
      const publishedReviewFiles = await publishRevisionFilesForReview(
        revision.id,
        revision.production_job_id,
        now,
      );

      await supabase
        .from("production_jobs")
        .update({
          status: "Review",
          delivery_status: "Client Reviewing",
          updated_at: now,
        })
        .eq("id", revision.production_job_id);

      await supabase.from("production_timeline").insert({
        production_job_id: revision.production_job_id,
        title: `Revision ${revision.revision_number} Ready for Review`,
        description:
          nextAdminResponse ||
          "The studio uploaded revised files for client review.",
        status: "Ready For Review",
        created_by: "Admin",
      });

      await supabase.from("production_messages").insert({
        production_job_id: revision.production_job_id,
        sender_type: "system",
        sender_name: "Heyy Studio",
        message: `Revision ${revision.revision_number} is ready for your review.`,
      });

      await Notifications.emit({
        event: "revision.ready",
        projectId: job.project_id,
        projectName: job.project_name,
        service: job.service,
        studio: job.studio,
        userId: job.user_id,
        metadata: {
          serviceId: job.service_id || job.metadata?.service_id,
          productionJobId: job.id,
          revisionId: revision.id,
          revisionNumber: revision.revision_number,
          status: "Waiting Approval",
          reviewFileCount: publishedReviewFiles.length,
        },
      });
    }

    let promotedFiles: any[] = [];
    let finalFile: any = null;

    if (isClientApproval) {
      const promotion = await promoteApprovedRevisionFiles(
        revision.id,
        revision.production_job_id,
        now
      );

      promotedFiles = promotion.promotedFiles;
      finalFile = promotion.finalFile;

      const filenames = promotedFiles.map(
        (file: any) => file.original_filename || file.filename
      );

      const approvalDescription =
        promotedFiles.length > 0
          ? `The client approved the revised file${
              promotedFiles.length === 1 ? "" : "s"
            }. ${filenames.join(", ")} ${
              promotedFiles.length === 1 ? "is" : "are"
            } now available in Final Deliverables.`
          : "The client approved the revision. No revised file was attached.";

      await supabase.from("production_timeline").insert({
        production_job_id: revision.production_job_id,
        title: `Revision ${revision.revision_number} Approved`,
        description: approvalDescription,
        status: "Approved",
        created_by: "Client",
      });

      await supabase.from("production_messages").insert({
        production_job_id: revision.production_job_id,
        sender_type: "system",
        sender_name: "Heyy Studio",
        message:
          promotedFiles.length > 0
            ? `Revision ${revision.revision_number} was approved. The approved revised file is now the current final deliverable.`
            : `Revision ${revision.revision_number} was approved by the client.`,
      });

      await Notifications.emit({
        event: "revision.approved",
        projectId: job.project_id,
        projectName: job.project_name,
        service: job.service,
        studio: job.studio,
        userId: job.user_id,
        metadata: {
          serviceId: job.service_id || job.metadata?.service_id,
          productionJobId: job.id,
          revisionId: revision.id,
          revisionNumber: revision.revision_number,
          status: "Approved",
          promotedFileCount: promotedFiles.length,
          promotedFilenames: filenames,
          finalDeliverableId: finalFile?.id || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      revision,
      promotedDeliverables: promotedFiles,
      finalDeliverable: finalFile,
    });
  } catch (error: any) {
    console.error("Update revision error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not update revision",
      },
      { status: 500 }
    );
  }
}
