import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiCapability } from "@/lib/server/admin-api";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DELETABLE_REVISION_STATUSES = ["Requested", "In Progress"];

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const jobId = formData.get("jobId") as string | null;
    const revisionId = formData.get("revisionId") as string | null;

    if (!file || !jobId) {
      return NextResponse.json(
        { success: false, error: "Missing file or jobId" },
        { status: 400 },
      );
    }

    if (revisionId) {
      const { data: revision, error: revisionError } = await supabase
        .from("workspace_revisions")
        .select("status")
        .eq("id", revisionId)
        .single();

      if (revisionError || !revision) {
        throw revisionError || new Error("Revision not found");
      }

      if (!DELETABLE_REVISION_STATUSES.includes(revision.status)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Files cannot be added after the revision has been sent to the client",
          },
          { status: 400 },
        );
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = `${jobId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("production-files")
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) throw uploadError;

    const { data: previousFiles, error: previousFilesError } = await supabase
      .from("production_deliverables")
      .select("version")
      .eq("production_job_id", jobId)
      .eq("original_filename", file.name)
      .order("version", { ascending: false })
      .limit(1);

    if (previousFilesError) throw previousFilesError;

    const nextVersion =
      previousFiles && previousFiles.length > 0
        ? Number(previousFiles[0].version || 0) + 1
        : 1;

    const { error: latestError } = await supabase
      .from("production_deliverables")
      .update({ is_latest: false })
      .eq("production_job_id", jobId)
      .eq("original_filename", file.name);

    if (latestError) throw latestError;

    const { data: deliverable, error: insertError } = await supabase
      .from("production_deliverables")
      .insert({
        production_job_id: jobId,
        filename: file.name,
        original_filename: file.name,
        version: nextVersion,
        storage_path: filePath,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        uploaded_by: "Admin",
        is_latest: true,
        is_final: false,
        client_visible: false,
        published_at: null,
      })
      .select()
      .single();

    if (insertError || !deliverable) {
      throw insertError || new Error("Deliverable could not be created");
    }

    let revisionFile = null;

    if (revisionId) {
      const { data: linkedFile, error: revisionFileError } = await supabase
        .from("workspace_revision_files")
        .insert({
          revision_id: revisionId,
          production_job_id: jobId,
          deliverable_id: deliverable.id,
          filename: file.name,
          storage_path: filePath,
          version: nextVersion,
        })
        .select()
        .single();

      if (revisionFileError) throw revisionFileError;

      revisionFile = {
        ...linkedFile,
        production_deliverables: deliverable,
      };
    }

    return NextResponse.json({
      success: true,
      deliverable,
      revisionFile,
    });
  } catch (error: any) {
    console.error("Upload Production File Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Upload failed",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const body = await request.json();

    const revisionFileId = body.revisionFileId as string | undefined;
    const revisionId = body.revisionId as string | undefined;

    if (!revisionFileId || !revisionId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing revisionFileId or revisionId",
        },
        { status: 400 },
      );
    }

    const { data: revision, error: revisionError } = await supabase
      .from("workspace_revisions")
      .select("id,status,production_job_id")
      .eq("id", revisionId)
      .single();

    if (revisionError || !revision) {
      throw revisionError || new Error("Revision not found");
    }

    if (!DELETABLE_REVISION_STATUSES.includes(revision.status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This file cannot be deleted because the revision has already been sent to the client",
        },
        { status: 400 },
      );
    }

    const { data: revisionFile, error: revisionFileError } = await supabase
      .from("workspace_revision_files")
      .select("*")
      .eq("id", revisionFileId)
      .eq("revision_id", revisionId)
      .single();

    if (revisionFileError || !revisionFile) {
      throw revisionFileError || new Error("Revision file not found");
    }

    let deliverable: any = null;

    if (revisionFile.deliverable_id) {
      const { data, error } = await supabase
        .from("production_deliverables")
        .select("*")
        .eq("id", revisionFile.deliverable_id)
        .maybeSingle();

      if (error) throw error;
      deliverable = data;
    }

    const { error: unlinkError } = await supabase
      .from("workspace_revision_files")
      .delete()
      .eq("id", revisionFileId)
      .eq("revision_id", revisionId);

    if (unlinkError) throw unlinkError;

    if (deliverable?.id) {
      const { error: deliverableDeleteError } = await supabase
        .from("production_deliverables")
        .delete()
        .eq("id", deliverable.id);

      if (deliverableDeleteError) throw deliverableDeleteError;

      const originalFilename =
        deliverable.original_filename || deliverable.filename;

      const { data: remainingVersions, error: remainingError } = await supabase
        .from("production_deliverables")
        .select("id,version")
        .eq("production_job_id", revision.production_job_id)
        .eq("original_filename", originalFilename)
        .order("version", { ascending: false })
        .limit(1);

      if (remainingError) throw remainingError;

      const newestRemaining = remainingVersions?.[0];

      if (newestRemaining?.id) {
        const { error: restoreLatestError } = await supabase
          .from("production_deliverables")
          .update({ is_latest: true })
          .eq("id", newestRemaining.id);

        if (restoreLatestError) throw restoreLatestError;
      }
    }

    const storagePath =
      deliverable?.storage_path || revisionFile.storage_path || null;

    if (storagePath) {
      const { error: storageDeleteError } = await supabase.storage
        .from("production-files")
        .remove([storagePath]);

      if (storageDeleteError) {
        console.error(
          "Revision file storage cleanup failed:",
          storageDeleteError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      deletedRevisionFileId: revisionFileId,
      deletedDeliverableId: deliverable?.id || null,
    });
  } catch (error: any) {
    console.error("Delete Revision File Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not delete revision file",
      },
      { status: 500 },
    );
  }
}
